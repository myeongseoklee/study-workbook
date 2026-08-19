/**
 * 참고 구현 e04-05-01 — 멱등 검문소
 *
 * 실제 구현(`claimExecution`)이 PostgreSQL의 유일 제약에 판정을 맡긴 것을,
 * 여기서는 `Map`의 키 존재 검사로 옮겼다. 규칙은 같다.
 *
 * 판정은 tests/e04-05-01-idempotency-gate/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep04-agent-server/05-idempotency-in-practice.md
 *
 * 읽을 때 눌러 볼 곳 셋:
 *  1. `payloadHash` — 객체 키는 정렬하고 배열은 그대로 둔다
 *  2. `claim` — 페이로드 검사가 상태 검사보다 **먼저**다
 *  3. `executeOnce` — `try/catch/finally`가 아니라 `catch`에서 failed로 종결한다
 */

export interface Request {
	transactionKey: string;
	eventId: string;
	payload: unknown;
}

export type TerminalStatus = 'completed' | 'failed' | 'timed_out' | 'cancelled';

export type Claim =
	| { kind: 'claimed' }
	| { kind: 'running' }
	| { kind: 'duplicate'; status: TerminalStatus; result: unknown }
	| { kind: 'conflict'; reason: ConflictReason };

export type ConflictReason = 'payload_mismatch' | 'claim_disappeared';

/** 표의 한 행. 실제 스키마의 agent_execution 한 행에 해당한다. */
interface Row {
	requestEventId: string;
	payloadHash: string;
	status: 'running' | TerminalStatus;
	/** status가 종결일 때만 의미 있다. */
	result: unknown;
	/** 결과가 실제로 기록됐는지 — undefined를 저장한 것과 미기록을 구분한다. */
	hasResult: boolean;
}

/**
 * 값을 정규화한다. 객체 키만 정렬하고 배열 순서는 유지한다.
 *
 * 배열을 정렬하면 `[도구A, 도구B]` 호출과 `[도구B, 도구A]` 호출이 같아진다 —
 * 순서가 다른 도구 호출은 다른 요청이므로 그건 오답이다.
 */
function normalize(value: unknown): unknown {
	if (Array.isArray(value)) return ['a', ...value.map(normalize)];
	if (value === null) return ['n'];
	if (typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([k, v]) => [k, normalize(v)] as const);
		return ['o', ...entries];
	}
	// 타입 태그를 붙여 문자열 "1"과 숫자 1을 구분한다.
	return [typeof value, String(value)];
}

export function payloadHash(payload: unknown): string {
	return JSON.stringify(normalize(payload));
}

/** 저장된 결과가 참조로 새어 나가지 않게 복제한다. */
function clone<T>(value: T): T {
	if (value === undefined) return value;
	if (typeof structuredClone === 'function') return structuredClone(value);
	return JSON.parse(JSON.stringify(value)) as T;
}

const TERMINAL: readonly TerminalStatus[] = ['completed', 'failed', 'timed_out', 'cancelled'];

function isTerminal(status: Row['status']): status is TerminalStatus {
	return (TERMINAL as readonly string[]).includes(status);
}

export class Gate {
	readonly #rows = new Map<string, Row>();

	claim(request: Request): Claim {
		const hash = payloadHash(request.payload);
		const existing = this.#rows.get(request.transactionKey);

		// 삽입 자체가 판정이다 — 없으면 내가 임자.
		if (!existing) {
			this.#rows.set(request.transactionKey, {
				requestEventId: request.eventId,
				payloadHash: hash,
				status: 'running',
				result: undefined,
				hasResult: false,
			});
			return { kind: 'claimed' };
		}

		// 페이로드 검사가 상태 검사보다 먼저다. 순서를 바꾸면 종결된 키에 다른
		// 내용이 왔을 때 남의 결과를 돌려준다.
		if (existing.payloadHash !== hash) {
			return { kind: 'conflict', reason: 'payload_mismatch' };
		}

		if (isTerminal(existing.status)) {
			return { kind: 'duplicate', status: existing.status, result: clone(existing.result) };
		}

		return { kind: 'running' };
	}

	complete(transactionKey: string, status: TerminalStatus, result: unknown): void {
		const row = this.#rows.get(transactionKey);
		if (!row) {
			throw new Error(
				`점유하지 않은 키를 종결할 수 없다: ${transactionKey}. ` +
					'조용히 넘기면 아무도 실행하지 않은 요청이 "이미 처리됨"으로 남는다.',
			);
		}
		if (isTerminal(row.status)) {
			throw new Error(
				`이미 종결된 키다: ${transactionKey} (${row.status}). ` +
					'덮어쓰기를 허용하면 늦게 도착한 결과가 먼저 끝난 결과를 갈아치운다.',
			);
		}
		row.status = status;
		row.result = clone(result);
		row.hasResult = true;
	}

	abandon(transactionKey: string): void {
		const row = this.#rows.get(transactionKey);
		if (!row) {
			throw new Error(`없는 키를 버릴 수 없다: ${transactionKey}`);
		}
		if (isTerminal(row.status)) {
			throw new Error(
				`종결된 키는 버릴 수 없다: ${transactionKey}. ` +
					'저장된 결과가 사라지면 다음 재시도가 재실행된다 — 멱등이 깨진다.',
			);
		}
		this.#rows.delete(transactionKey);
	}

	get size(): number {
		return this.#rows.size;
	}
}

export async function executeOnce(
	gate: Gate,
	request: Request,
	run: (request: Request) => Promise<unknown>,
): Promise<Claim> {
	const claim = gate.claim(request);
	if (claim.kind !== 'claimed') return claim;

	try {
		const result = await run(request);
		gate.complete(request.transactionKey, 'completed', result);
		return claim;
	} catch (error) {
		// 실패도 종결이다. running으로 남기면 그 키는 영원히 "기다려"만 돌려준다.
		gate.complete(request.transactionKey, 'failed', {
			message: error instanceof Error ? error.message : String(error),
		});
		return gate.claim(request);
	}
}

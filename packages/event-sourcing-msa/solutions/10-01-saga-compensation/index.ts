/**
 * 참고 구현 — 사가 보상과 데드라인.
 *
 * 판정은 tests/10-01-saga-compensation/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/10-saga-and-optimism.md
 */

export interface Step {
	name: string;
	invoke: () => Promise<void>;
	compensate: () => Promise<void>;
}

export interface SagaOptions {
	deadlineMs?: number;
}

export interface SagaResult {
	ok: boolean;
	completed: string[];
	failedAt?: string;
	reason?: 'error' | 'deadline';
	compensated: string[];
	compensationFailed: string[];
}

/** 데드라인 감시. 심볼로 구별하는 이유는 단계가 던진 에러와 섞이지 않게 하기 위해서다. */
const TIMEOUT = Symbol('timeout');

async function withDeadline<T>(p: Promise<T>, ms: number | undefined): Promise<T | typeof TIMEOUT> {
	if (ms === undefined) return p;
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			p,
			new Promise<typeof TIMEOUT>((resolve) => {
				timer = setTimeout(() => resolve(TIMEOUT), ms);
			}),
		]);
	} finally {
		// 타이머를 남기면 테스트 프로세스가 늦게 끝난다. 이긴 쪽이 누구든 정리한다.
		if (timer) clearTimeout(timer);
	}
}

/**
 * 설계의 핵심은 **무엇을 되돌릴 목록에 넣는 시점**이다.
 *
 * `invoke`가 성공한 **뒤에만** 목록에 넣는다. 실패한 단계를 넣으면 효과가 없는 일을
 * 취소하려 들어 부작용이 생긴다 — 재고를 두 번 되돌리는 식이다.
 *
 * 데드라인으로 끊긴 단계도 같은 규칙을 따른다. 다만 이 경우는 **완료를 확인하지 못한
 * 것**이지 실행되지 않은 것이 아니라서, 실무에서는 그 불확실성 때문에 멱등한 보상을
 * 따로 설계한다(여기서는 명세가 정한 규칙을 따른다).
 */
export async function runSaga(steps: Step[], options: SagaOptions = {}): Promise<SagaResult> {
	const done: Step[] = [];
	let failedAt: string | undefined;
	let reason: 'error' | 'deadline' | undefined;

	for (const step of steps) {
		try {
			const r = await withDeadline(step.invoke(), options.deadlineMs);
			if (r === TIMEOUT) {
				failedAt = step.name;
				reason = 'deadline';
				break;
			}
		} catch {
			failedAt = step.name;
			reason = 'error';
			break;
		}
		done.push(step);
	}

	const completed = done.map((s) => s.name);
	if (failedAt === undefined) {
		return { ok: true, completed, compensated: [], compensationFailed: [] };
	}

	// 역순 보상. 나중에 만든 것을 먼저 치운다 — 앞 단계가 뒤 단계의 전제였을 수 있다.
	const compensated: string[] = [];
	const compensationFailed: string[] = [];
	for (const step of [...done].reverse()) {
		try {
			await step.compensate();
			compensated.push(step.name);
		} catch {
			// 하나가 실패해도 멈추지 않는다 — 남은 것이라도 되돌리는 편이 낫다.
			// 그리고 실패 사실을 반드시 남긴다: 숨기면 아무도 모르는 불일치가 된다.
			compensationFailed.push(step.name);
		}
	}

	return { ok: false, completed, failedAt, reason, compensated, compensationFailed };
}

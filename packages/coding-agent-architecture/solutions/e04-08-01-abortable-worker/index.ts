/**
 * 참고 구현 e04-08-01 — 취소 가능한 워커 루프
 *
 * 판정은 tests/e04-08-01-abortable-worker/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep04-agent-server/08-workers.md
 *
 * 읽을 때 눌러 볼 곳 넷:
 *  1. 중단 확인이 **조각 실행 전**에 있다 — 뒤에 두면 한 조각을 더 한다
 *  2. `signal.aborted`를 루프 진입 전에도 본다 — 이미 취소된 작업을 실행하지 않는다
 *  3. 취소와 시간초과가 겹치면 취소가 이긴다 — 사용자 의사가 먼저다
 *  4. `Slot`은 작업 실패(receive false)와 워커 사망(fail)을 다르게 취급한다
 */

export type Step<T> = () => T;

export type Reason = 'completed' | 'aborted' | 'timed_out' | 'failed';

export interface RunResult<T> {
	reason: Reason;
	values: T[];
	stepsRun: number;
	error?: Error;
}

export interface RunOptions<T> {
	steps: ReadonlyArray<Step<T>>;
	signal?: AbortSignal;
	timeoutMs?: number;
	now?: () => number;
	onProgress?: (stepsDone: number) => void;
}

export function runSteps<T>(options: RunOptions<T>): RunResult<T> {
	const { steps, signal, timeoutMs, now, onProgress } = options;

	const values: T[] = [];
	let stepsRun = 0;

	// 시간 제한은 now가 있을 때만 검사한다. 실제 시계를 쓰지 않는 이유는
	// 테스트가 결정적이어야 하기 때문이다.
	const deadline = now && timeoutMs !== undefined ? now() + timeoutMs : null;

	for (const step of steps) {
		// ── 멈출 지점 ──────────────────────────────────────────────
		// 확인이 조각 실행 **전**에 있다. 뒤에 두면 취소 신호를 받고도 한 조각을
		// 더 실행한다. 그리고 이 확인이 루프 첫 바퀴에도 돌기 때문에, 시작 전에
		// 이미 취소된 경우 한 조각도 실행되지 않는다.
		//
		// 취소를 시간초과보다 먼저 본다 — 둘이 겹칠 때 사용자 의사가 이긴다.
		if (signal?.aborted) return { reason: 'aborted', values: [], stepsRun };
		if (deadline !== null && now!() > deadline) {
			return { reason: 'timed_out', values: [], stepsRun };
		}

		try {
			values.push(step());
		} catch (error) {
			return {
				reason: 'failed',
				values: [],
				stepsRun,
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
		stepsRun += 1;
		onProgress?.(stepsRun);
	}

	// 조각이 다 끝났으면 뒤늦게 온 취소는 아무것도 막지 못했다.
	return { reason: 'completed', values, stepsRun };
}

export interface Task {
	id: string;
	signal?: AbortSignal;
}

export type SlotState = 'idle' | 'busy' | 'retired';

export class Slot {
	readonly #allowed: ReadonlySet<string>;
	#state: SlotState = 'idle';
	#task: Task | null = null;
	#retiredCount = 0;

	constructor(allowedActions: readonly string[]) {
		this.#allowed = new Set(allowedActions);
	}

	get state(): SlotState {
		return this.#state;
	}

	get currentTaskId(): string | null {
		return this.#task?.id ?? null;
	}

	assign(task: Task, action: string): boolean {
		if (this.#state !== 'idle') return false;
		// 허용 목록에 없으면 점유하지 않고 바로 거절한다 — "시도조차 하지 않고".
		if (!this.#allowed.has(action)) return false;
		this.#task = task;
		this.#state = 'busy';
		return true;
	}

	receive(taskId: string, ok: boolean): boolean {
		// 늦게 온 응답을 무시한다. ok 값과 무관하게 id가 먼저다.
		if (this.#state !== 'busy' || this.#task?.id !== taskId) return false;
		// 작업이 실패해도 슬롯은 죽지 않는다 — 창구와 일꾼은 다른 사건을 겪는다.
		void ok;
		this.#task = null;
		this.#state = 'idle';
		return true;
	}

	fail(): void {
		// error와 exit이 연달아 오는 것은 정상이다. 이미 은퇴했으면 아무 일도 없다.
		if (this.#state === 'retired') return;
		this.#state = 'retired';
		this.#task = null;
		this.#retiredCount += 1;
	}

	get retiredCount(): number {
		return this.#retiredCount;
	}
}

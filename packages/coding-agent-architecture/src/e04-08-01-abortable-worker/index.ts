/**
 * 과제 e04-08-01 — 취소 가능한 워커 루프
 *
 * 4강 슬라이드 「워커쓰레드」 3번 항목의 마지막 줄이 이 과제다 —
 *   "다만 이게 가능하려면 작업이 잘게 쪼개져 있어서 중간에 멈출 지점이 있어야 함"
 *
 * 강의: "그냥 무거운 덩어리로 짜면 어보트가 와도 얘가 반응할 수가 없단 말이지.
 * 어보트에 반응하려면 이렇게 짜야 된단 말이지."
 *
 * 즉 취소 가능성은 라이브러리 기능이 아니라 **코드 구조의 성질**이다.
 * 이 과제에서 `AbortSignal`을 받기만 하는 구현은 통과하지 못한다.
 *
 * 명세:  tests/e04-08-01-abortable-worker/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e04-08-01
 * 막히면: docs/ep04-agent-server/08-workers.md
 */

/** 작업의 한 조각. 이 단위 사이가 멈출 수 있는 지점이다. */
export type Step<T> = () => T;

export type Reason = 'completed' | 'aborted' | 'timed_out' | 'failed';

export interface RunResult<T> {
	reason: Reason;
	/** completed일 때만 채워진다. */
	values: T[];
	/** 실제로 실행된 조각 수. 취소가 정말 멈췄는지를 이 값으로 판정한다. */
	stepsRun: number;
	/** failed일 때의 원인. */
	error?: Error;
}

export interface RunOptions<T> {
	steps: ReadonlyArray<Step<T>>;
	signal?: AbortSignal;
	/**
	 * 시간 제한 (밀리초). 없으면 무제한.
	 * 실제 시간을 재지 않는다 — `now`로 주입받은 시계를 쓴다.
	 */
	timeoutMs?: number;
	/** 밀리초를 돌려주는 시계. 없으면 시간 제한을 검사하지 않는다. */
	now?: () => number;
	/**
	 * 조각 하나가 끝날 때마다 불린다 (6장의 하트비트 — `set_vt`에 해당).
	 * 쪼개기가 취소만을 위한 것이 아니라는 증거다.
	 */
	onProgress?: (stepsDone: number) => void;
}

/**
 * 조각들을 순서대로 실행한다. 조각 **사이마다** 중단 조건을 확인한다.
 *
 * 힌트: 확인 시점이 이 과제의 채점 지점이다.
 *   - 시작 전에 이미 취소됐으면 조각을 **하나도** 실행하지 않는다
 *   - 각 조각을 실행하기 전에 확인한다 — 실행한 뒤에 확인하면 한 조각을 더 한다
 *   - 조각이 던지면 남은 조각을 실행하지 않는다
 *
 * 그리고 취소·시간초과가 동시에 성립할 때 무엇을 보고할지 정해야 한다.
 * 사용자가 명시적으로 끊은 것과 시스템이 잘라낸 것은 5장에서 다른 재시도
 * 규칙을 갖는다 — 사용자 의사가 먼저다.
 */
export function runSteps<T>(options: RunOptions<T>): RunResult<T> {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: runSteps');
}

/**
 * 워커 슬롯 하나. 실제 구현(`pool.ts`)의 슬롯 생애주기를 축약했다.
 */
export interface Task {
	id: string;
	signal?: AbortSignal;
}

export type SlotState = 'idle' | 'busy' | 'retired';

/**
 * 워커 슬롯.
 *
 * 실제 코드에서 눌러 봐야 하는 두 지점을 그대로 옮겼다:
 *  - `slot.task.id !== message.id` → 늦게 온 응답을 무시한다
 *  - `worker.on('error')` → 은퇴시키고 교체한다
 */
export class Slot {
	/** 허용 목록. 여기 없는 액션은 시도조차 하지 않는다 (슬라이드 4번 항목). */
	constructor(allowedActions: readonly string[]) {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Slot#constructor');
	}

	get state(): SlotState {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Slot#state');
	}

	/** 현재 점유 중인 작업 id. 없으면 null. */
	get currentTaskId(): string | null {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Slot#currentTaskId');
	}

	/**
	 * 작업을 배정한다.
	 *
	 * 힌트: 이미 바쁘거나 은퇴한 슬롯에 배정하면 어떻게 되나. 그리고 허용 목록에
	 *       없는 액션이면 실행하지 말고 실패로 처리한다 — "시도조차 하지 않고".
	 */
	assign(task: Task, action: string): boolean {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Slot#assign');
	}

	/**
	 * 작업 결과가 도착했다. 처리했으면 true.
	 *
	 * 힌트: 지금 점유 중인 작업의 id와 다르면 무시한다. 취소된 작업의 늦은 응답이
	 *       새 작업의 결과로 들어오는 사고를 막는 장치다.
	 */
	receive(taskId: string, ok: boolean): boolean {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Slot#receive');
	}

	/**
	 * 워커가 오류로 죽었다. 은퇴시킨다.
	 *
	 * 힌트: 이미 은퇴한 슬롯에 오류가 또 오면 어떻게 되나. 실제 코드의
	 *       `if (slot.retired) return;`이 그 자리다.
	 */
	fail(): void {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Slot#fail');
	}

	/** 은퇴한 슬롯이 몇 번 교체됐는지 (검사용). */
	get retiredCount(): number {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Slot#retiredCount');
	}
}

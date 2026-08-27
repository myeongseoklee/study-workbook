/**
 * 과제 e05-04-01 — 큐로 읽기와 로그로 읽기
 *
 * 5강 슬라이드 「큐로 읽기와 로그로 읽기」가 이 과제다 —
 *   "큐는 정확히 한 명에게 주려고 만들어졌고, 로그는 여럿이 보라고 만들어졌다.
 *    결과 경로에 필요한 것은 후자였다."
 *
 * 브로커 셋이 같은 결과 스트림을 읽는다. 두 방식으로 읽어 보고, **무엇이
 * 달라지는지를 숫자로 관측하는 것**이 이 과제의 목적이다. 특히 둘:
 *
 *   1. 큐 모드에서는 자기 채널 이벤트를 남이 집어가면 **영원히 못 본다** (`missed`)
 *   2. 큐의 `read`는 가시성 타임아웃을 거는 `UPDATE`라 **읽기가 곧 쓰기다** (`writes`)
 *      로그의 `read`는 진짜 조회라 쓰기가 0이다
 *
 * 이 과제는 4강 e04-06-01(가시성 타임아웃과 삭제 시점)과 다른 것을 본다.
 * 그쪽은 **한 소비자의 신뢰성**이고, 이쪽은 **여러 소비자의 팬아웃**이다.
 *
 * 명세:  tests/e05-04-01-queue-vs-log/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e05-04-01
 * 막히면: docs/ep05-broker-infra/04-event-broker.md
 */

/** 결과 스트림에 적히는 이벤트 하나. */
export interface StoredEvent {
	/** 로그에서의 위치. 1부터 단조 증가한다. */
	position: number;
	/** 이 이벤트를 구독하는 채널. */
	channel: string;
}

/** 이 브로커가 어떤 채널을 구독하는지. */
export interface Broker {
	brokerId: string;
	channels: string[];
}

/** 한 브로커가 한 번의 읽기에서 얻은 것. */
export interface ReadResult {
	brokerId: string;
	/** 실제로 클라이언트에게 밀어 넣은 이벤트의 position들. 오름차순. */
	delivered: number[];
	/**
	 * 이 브로커가 구독했는데 **끝내 받지 못한** 이벤트의 position들. 오름차순.
	 * 로그 모드에서는 항상 비어 있어야 한다.
	 */
	missed: number[];
}

/** 한 라운드 전체의 관측 결과. */
export interface FanoutReport {
	results: ReadResult[];
	/**
	 * 이 라운드에서 발생한 **쓰기 연산 수.**
	 *
	 * 큐 모드: 브로커가 메시지를 집을 때마다 가시성 타임아웃을 거는 `UPDATE` 1회,
	 *          처리 후 `DELETE` 1회 → 집은 메시지 1건당 2다.
	 * 로그 모드: 읽기는 `SELECT`뿐이므로 0이다.
	 */
	writes: number;
	/** 브로커별 커서의 최종 위치. 로그 모드에서만 의미가 있고, 큐 모드에서는 전부 0이다. */
	cursors: Record<string, number>;
}

/**
 * 큐로 읽기 — 경쟁 소비.
 *
 * 브로커들이 **주어진 순서대로 번갈아** 하나씩 집는다(라운드 로빈). 집은 브로커는
 * 그 이벤트가 자기 채널이면 클라이언트에게 밀어 넣고, 아니면 버린다.
 *
 * 힌트: 한 번 집힌 이벤트는 큐에서 사라진다. 그래서 남의 채널 이벤트를 집은
 *       브로커가 그것을 버리면, 정작 그 채널을 구독한 브로커는 못 본다.
 *       그 못 본 것을 `missed`로 세는 것이 이 과제의 핵심 관측이다.
 */
export function readAsQueue(events: StoredEvent[], brokers: Broker[]): FanoutReport {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: readAsQueue');
}

/**
 * 로그로 읽기 — 팬아웃 tail.
 *
 * 각 브로커가 자기 커서 이후를 전부 훑는다.
 * `SELECT ... WHERE position > cursor ORDER BY position LIMIT n` 에 해당한다.
 *
 * @param limit 한 번에 가져올 최대 건수. 커서는 **훑은 만큼** 전진한다 —
 *              자기 채널이 아니어서 버린 것도 이미 읽은 것이다.
 */
export function readAsLog(
	events: StoredEvent[],
	brokers: Broker[],
	limit: number,
): FanoutReport {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: readAsLog');
}

/**
 * 봉합 비용 판정 — 4장의 판정 도구를 코드로 옮긴 것.
 *
 * "어떤 선택을 지키려고 붙여야 하는 장치의 목록이 원래 문제보다 길면,
 *  선택 자체를 다시 본다."
 *
 * @returns `patches.length > problems.length` 이면 `'reconsider'`, 아니면 `'keep'`
 */
export function patchVerdict(problems: string[], patches: string[]): 'keep' | 'reconsider' {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: patchVerdict');
}

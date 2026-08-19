/**
 * 과제 e04-06-01 — 가시성 타임아웃과 삭제 시점
 *
 * 4강 슬라이드 「큐처리」 4번 항목이 이 과제다 —
 *   "결과를 다 보내고, 저장까지 끝난 뒤에만 원본을 지움.
 *    순서를 앞당기면 중간에 죽었을 때 '일은 했는데 기록이 통째로 사라지는' 사고가 남.
 *    먼저 지우지 않고 늦게 지우기 때문에 같은 일이 중복 처리될 수도 있는데,
 *    그건 멱등성 키의 검문이 걸러줌"
 *
 * 즉 이 과제는 **유실을 중복으로 치환하는** 구조를 만드는 것이다. 중복이
 * 실제로 발생하는지, 그리고 그 중복이 검문소에 흡수되는지까지 테스트가 본다.
 *
 * 시계는 주입받는다 — 실제 시간을 기다리면 테스트가 느려지고 불안정해진다.
 *
 * 명세:  tests/e04-06-01-queue-visibility/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e04-06-01
 * 막히면: docs/ep04-agent-server/06-queue.md
 */

export interface Message<T> {
	/** 큐가 부여하는 식별자. 재출현해도 같은 값이다. */
	id: number;
	/** 이 메시지가 지금까지 몇 번 읽혔나. 재출현하면 늘어난다. */
	readCount: number;
	body: T;
}

/** 밀리초를 돌려주는 시계. 테스트가 임의로 진행시킨다. */
export type Clock = () => number;

/**
 * PGMQ의 동작 세 가지만 흉내낸 큐.
 *
 * 강의: "메시지 큐 시스템은 보통 세 가지밖에 안 해요 — 큐에 있는 거 꺼내기,
 * 지우기, 그리고 '내가 이거 점유하고 있어'라고 계속 마킹하기."
 */
export class Queue<T> {
	constructor(clock: Clock) {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Queue#constructor');
	}

	/** 큐에 넣는다. 부여된 id를 돌려준다. */
	send(body: T): number {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Queue#send');
	}

	/**
	 * 하나 꺼낸다. 꺼낸 메시지는 `visibilityMs` 동안 다른 호출에게 보이지 않는다.
	 *
	 * 힌트: 지우지 않는다 — 숨기기만 한다. 이것이 이 과제의 전부다.
	 *       그리고 숨김이 만료된 메시지는 다시 보여야 한다.
	 */
	read(visibilityMs: number): Message<T> | null {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Queue#read');
	}

	/**
	 * 점유를 연장한다 (PGMQ의 `set_vt`). 처리가 길어지는 작업이 살아 있음을 알린다.
	 *
	 * 힌트: 이미 다른 워커에게 넘어간(= 숨김이 만료돼 재출현한) 메시지를 연장하려
	 *       하면 무엇을 해야 하나. 조용히 성공시키면 두 워커가 같은 메시지를
	 *       점유했다고 믿는다.
	 */
	extend(id: number, visibilityMs: number): boolean {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Queue#extend');
	}

	/** 지운다. **완료·저장이 끝난 뒤에만** 불려야 한다. */
	remove(id: number): boolean {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Queue#remove');
	}

	/** 검사용. 아직 큐에 남아 있는 메시지 수 (숨겨진 것 포함). */
	get length(): number {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Queue#length');
	}

	/** 검사용. 지금 시점에 보이는 메시지 수. */
	get visibleLength(): number {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Queue#visibleLength');
	}
}

/** 워커가 이벤트를 처리한 결과. */
export type Outcome = 'ok' | 'crashed';

export interface WorkerOptions<T> {
	queue: Queue<T>;
	/** 이 워커가 점유를 주장하는 시간. */
	visibilityMs: number;
	/**
	 * 실제 처리. `crashed`를 돌려주면 워커가 죽은 것으로 본다 —
	 * 그때 큐를 어떻게 두느냐가 이 과제의 판정 지점이다.
	 */
	handle: (message: Message<T>) => Outcome;
	/** 결과 저장. 여기까지 끝나야 큐에서 지울 수 있다. */
	persist: (message: Message<T>) => void;
}

/**
 * 한 건을 처리한다. 처리할 것이 없으면 `null`.
 *
 * 순서가 이 과제의 채점표다. 6장의 표를 그대로 옮기면:
 *   ① read(vt)  ② handle  ③ persist  ④ remove
 *
 * 힌트: ④를 ①이나 ② 앞으로 옮기면 그 사이 구간이 전부 유실 창이 된다.
 *       그리고 handle이 `crashed`면 persist도 remove도 하지 않아야 한다 —
 *       그래야 숨김이 만료됐을 때 다시 처리된다.
 */
export function processOne<T>(options: WorkerOptions<T>): Outcome | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: processOne');
}

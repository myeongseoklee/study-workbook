/**
 * 과제 e05-02-01 — 타입이 곧 주소다
 *
 * 5강의 뼈대 한 줄이 이 과제다 —
 *   "이벤트 타입 하나가 어느 워커가 집어가는지와 어느 클라이언트가 받는지를
 *    동시에 정한다. 그래서 라우팅 테이블이 따로 없다."
 *
 * 그리고 5장이 함께 못 박은 함정도 같이 검사한다 —
 *   "워커를 내리는 것은 기능을 끄는 것이 아니라 적체시키는 것이다."
 * 처리할 워커가 없는 이벤트는 사라지지 않고 큐에 남는다. 이 과제에서 그
 * 남은 것을 세는 것이 `pending`이다.
 *
 * 라우터를 만들지 말라. 등록 정보만으로 목적지가 결정되어야 한다.
 *
 * 명세:  tests/e05-02-01-event-routing/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e05-02-01
 * 막히면: docs/ep05-broker-infra/02-four-participants.md, 05-worker-server.md
 */

/** 브로커에 붙은 클라이언트 하나. 구독한 채널(= 이벤트 타입) 집합을 들고 있다. */
export interface ClientSubscription {
	clientId: string;
	/** 이 클라이언트가 받고 싶은 이벤트 타입들. */
	channels: string[];
}

/** 워커 서버 하나. 자기가 처리할 이벤트 타입 집합만 안다. */
export interface WorkerRegistration {
	workerId: string;
	/** 이 워커가 집어갈 이벤트 타입들. */
	handles: string[];
}

/** 큐를 지나가는 이벤트 하나. */
export interface EventEnvelope {
	type: string;
	payload?: unknown;
}

/** 이벤트 하나가 어디로 갔는지의 판정 결과. */
export interface Routing {
	type: string;
	/**
	 * 이 이벤트를 집어간 워커. 없으면 null이고, 그때 이 이벤트는 적체된다.
	 * 여러 워커가 같은 타입을 등록했다면 **등록 순서상 첫 번째**가 집는다
	 * (작업 경로는 경쟁 소비 — 한 작업은 한 워커만 한다).
	 */
	workerId: string | null;
	/**
	 * 이 이벤트를 받는 클라이언트들. 등록 순서를 유지한다.
	 * 결과 경로는 팬아웃이므로 **구독한 모두가** 받는다.
	 */
	clientIds: string[];
}

/**
 * 라우팅 판정 한 건.
 *
 * 힌트: 이 함수 안에 타입별 분기(`if (type === 'turn.start')` 같은 것)를
 *       두면 안 된다. 그런 분기가 생기는 순간 "새 기능 = 워커 추가"가 깨진다.
 */
export function route(
	event: EventEnvelope,
	workers: WorkerRegistration[],
	clients: ClientSubscription[],
): Routing {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: route');
}

/** 한 배치를 흘렸을 때의 집계. */
export interface DispatchReport {
	/** 이벤트별 판정. 입력 순서를 유지한다. */
	routings: Routing[];
	/** 워커별로 몇 건을 집었나. 한 건도 안 집은 워커도 0으로 들어간다. */
	workload: Record<string, number>;
	/**
	 * 처리할 워커가 없어 큐에 남은 이벤트들. 입력 순서를 유지한다.
	 *
	 * 힌트: 구독한 클라이언트가 있어도 워커가 없으면 적체다 —
	 *       결과 이벤트를 만들어 줄 주체가 없기 때문이다.
	 */
	pending: EventEnvelope[];
	/**
	 * 아무 워커도 안 집고 아무 클라이언트도 안 받는 이벤트 타입들.
	 * 중복 없이, 처음 나타난 순서로.
	 */
	orphanTypes: string[];
}

/** 이벤트 배치를 흘려 집계를 낸다. */
export function dispatch(
	events: EventEnvelope[],
	workers: WorkerRegistration[],
	clients: ClientSubscription[],
): DispatchReport {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: dispatch');
}

/**
 * 기능 하나를 정말로 끄려면 무엇을 해야 하는가.
 *
 * 5장: "워커를 내리는 것은 기능을 끄는 것이 아니라 적체시키는 것이다.
 *       진짜로 끄려면 생산 쪽을 먼저 막아야 한다."
 *
 * 주어진 타입에 대해, 워커만 내렸을 때 큐에 쌓이게 될 이벤트 수를 돌려준다.
 * 생산이 멈춘 뒤라면(`producerStopped`) 0이다.
 */
export function backlogIfWorkerRemoved(
	type: string,
	incomingPerMinute: number,
	minutes: number,
	producerStopped: boolean,
): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: backlogIfWorkerRemoved');
}

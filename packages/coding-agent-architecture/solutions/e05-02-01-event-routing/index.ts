/**
 * 참고 구현 e05-02-01 — 타입이 곧 주소다
 *
 * 판정은 tests/e05-02-01-event-routing/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep05-broker-infra/02-four-participants.md · 05-worker-server.md
 *
 * 읽을 때 눌러 볼 곳 셋:
 *  1. `route` — 타입별 분기가 **한 줄도 없다.** 등록 정보의 조회만으로 목적지가 나온다
 *  2. 워커는 `find`(첫 하나), 클라이언트는 `filter`(전부) — **경쟁 소비와 팬아웃의 차이가 이 두 단어다**
 *  3. `pending`과 `orphanTypes`가 다른 것 — "받을 사람은 있는데 만들 사람이 없다"는 상태를 잃지 않기 위해서다
 */

export interface ClientSubscription {
	clientId: string;
	channels: string[];
}

export interface WorkerRegistration {
	workerId: string;
	handles: string[];
}

export interface EventEnvelope {
	type: string;
	payload?: unknown;
}

export interface Routing {
	type: string;
	workerId: string | null;
	clientIds: string[];
}

export function route(
	event: EventEnvelope,
	workers: WorkerRegistration[],
	clients: ClientSubscription[],
): Routing {
	// 작업 경로 — 첫 번째 하나만. 한 작업은 한 워커만 한다.
	const worker = workers.find((w) => w.handles.includes(event.type));

	// 결과 경로 — 구독한 전부. 로그를 각자 커서로 따라 읽는 것과 같은 성질이다.
	const clientIds = clients
		.filter((c) => c.channels.includes(event.type))
		.map((c) => c.clientId);

	// 모르는 타입도 정상 입력이다. 브로커는 내용을 모르는 계층이므로 던지지 않는다.
	return { type: event.type, workerId: worker?.workerId ?? null, clientIds };
}

export interface DispatchReport {
	routings: Routing[];
	workload: Record<string, number>;
	pending: EventEnvelope[];
	orphanTypes: string[];
}

export function dispatch(
	events: EventEnvelope[],
	workers: WorkerRegistration[],
	clients: ClientSubscription[],
): DispatchReport {
	// 등록된 워커를 전부 0으로 깔아 둔다 — 놀고 있는 워커가 보여야
	// 관심사별 배치가 맞는지 판정할 수 있다.
	const workload: Record<string, number> = {};
	for (const w of workers) workload[w.workerId] = 0;

	const routings: Routing[] = [];
	const pending: EventEnvelope[] = [];
	const orphanTypes: string[] = [];
	const seenOrphan = new Set<string>();

	for (const event of events) {
		const routing = route(event, workers, clients);
		routings.push(routing);

		if (routing.workerId === null) {
			// 집어갈 워커가 없으면 적체다 — 구독자가 있어도 마찬가지다.
			// 결과 이벤트를 만들어 줄 주체가 없기 때문이다.
			pending.push(event);

			// 고아는 그중에서도 받는 쪽까지 없는 것. pending의 부분집합이다.
			if (routing.clientIds.length === 0 && !seenOrphan.has(event.type)) {
				seenOrphan.add(event.type);
				orphanTypes.push(event.type);
			}
		} else {
			workload[routing.workerId] = (workload[routing.workerId] ?? 0) + 1;
		}
	}

	return { routings, workload, pending, orphanTypes };
}

export function backlogIfWorkerRemoved(
	type: string,
	incomingPerMinute: number,
	minutes: number,
	producerStopped: boolean,
): number {
	// 소비를 끄는 것은 정지가 아니다. 생산이 멈춰야 큐가 안 찬다.
	// `type`은 시그니처의 일부로만 남는다 — 호출부가 어느 기능을 두고
	// 계산하는지 잃지 않게 하기 위해서다.
	void type;
	return producerStopped ? 0 : incomingPerMinute * minutes;
}

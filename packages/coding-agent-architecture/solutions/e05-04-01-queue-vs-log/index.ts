/**
 * 참고 구현 e05-04-01 — 큐로 읽기와 로그로 읽기
 *
 * 판정은 tests/e05-04-01-queue-vs-log/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep05-broker-infra/04-event-broker.md
 *
 * 읽을 때 눌러 볼 곳 셋:
 *  1. `readAsQueue`의 `queue.shift()` — **집는 순간 남에게서 사라진다.** 여기가 전부다
 *  2. `missed` 계산 — 남이 집어 버린 것 중 내 채널이었던 것. 큐 모드에만 존재하는 개념이다
 *  3. `writes` — 큐는 집은 건수 × 2, 로그는 0. 같은 일을 하는데 부하가 다르다
 */

export interface StoredEvent {
	position: number;
	channel: string;
}

export interface Broker {
	brokerId: string;
	channels: string[];
}

export interface ReadResult {
	brokerId: string;
	delivered: number[];
	missed: number[];
}

export interface FanoutReport {
	results: ReadResult[];
	writes: number;
	cursors: Record<string, number>;
}

export function readAsQueue(events: StoredEvent[], brokers: Broker[]): FanoutReport {
	const delivered = new Map<string, number[]>();
	const cursors: Record<string, number> = {};
	for (const b of brokers) {
		delivered.set(b.brokerId, []);
		cursors[b.brokerId] = 0; // 큐 모드에는 커서라는 것이 없다
	}

	// 집어간 것을 누가 처리했는지 기록해 둔다. missed 계산에 쓴다.
	const takenBy = new Map<number, string>();
	const queue = [...events];

	let writes = 0;
	let turn = 0;
	while (queue.length > 0 && brokers.length > 0) {
		const broker = brokers[turn % brokers.length]!;
		turn += 1;

		// 집는 순간 큐에서 사라진다 — 다른 브로커에게서도 사라진다.
		const event = queue.shift()!;
		takenBy.set(event.position, broker.brokerId);

		// read = UPDATE(가시성 타임아웃), delete = DELETE. 읽기가 쓰기다.
		writes += 2;

		if (broker.channels.includes(event.channel)) {
			delivered.get(broker.brokerId)!.push(event.position);
		}
		// 자기 채널이 아니면 그냥 버린다. 그리고 그 이벤트는 이제 아무 데도 없다.
	}

	const results: ReadResult[] = brokers.map((b) => {
		const mine = events.filter((e) => b.channels.includes(e.channel));
		// 내 채널인데 남이 집어간 것 = 내가 영원히 못 보는 것
		const missed = mine
			.filter((e) => takenBy.get(e.position) !== b.brokerId)
			.map((e) => e.position);
		return { brokerId: b.brokerId, delivered: delivered.get(b.brokerId)!, missed };
	});

	return { results, writes, cursors };
}

export function readAsLog(
	events: StoredEvent[],
	brokers: Broker[],
	limit: number,
): FanoutReport {
	const cursors: Record<string, number> = {};
	const results: ReadResult[] = [];

	for (const broker of brokers) {
		// SELECT ... WHERE position > cursor ORDER BY position LIMIT n
		const page = events
			.filter((e) => e.position > 0)
			.sort((a, b) => a.position - b.position)
			.slice(0, limit);

		const delivered = page
			.filter((e) => broker.channels.includes(e.channel))
			.map((e) => e.position);

		// 커서는 훑은 만큼 전진한다 — 버린 것도 읽은 것이다.
		cursors[broker.brokerId] = page.length > 0 ? page[page.length - 1]!.position : 0;

		// 아무도 아무것도 숨기지 않으므로 놓치는 것이 없다.
		results.push({ brokerId: broker.brokerId, delivered, missed: [] });
	}

	// 읽기는 읽기다. 쓰기가 없다.
	return { results, writes: 0, cursors };
}

export function patchVerdict(problems: string[], patches: string[]): 'keep' | 'reconsider' {
	// 개별 장치는 각각 합리적으로 보인다. 목록으로 모아 세어 봐야 드러난다.
	return patches.length > problems.length ? 'reconsider' : 'keep';
}

/**
 * 참고 구현 e04-06-01 — 가시성 타임아웃과 삭제 시점
 *
 * 판정은 tests/e04-06-01-queue-visibility/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep04-agent-server/06-queue.md
 *
 * 읽을 때 눌러 볼 곳 셋:
 *  1. `read` — 지우지 않고 `visibleAt`만 미룬다
 *  2. `extend` — "지금 점유 중인가"를 확인한 뒤에만 연장한다
 *  3. `processOne` — remove가 persist **뒤**에 있고, crashed면 둘 다 건너뛴다
 */

export interface Message<T> {
	id: number;
	readCount: number;
	body: T;
}

export type Clock = () => number;

/** 큐에 실제로 저장되는 항목. Message에 가시성 상태가 붙는다. */
interface Entry<T> {
	id: number;
	body: T;
	readCount: number;
	/** 이 시각 이후에 보인다. 0이면 처음부터 보인다. */
	visibleAt: number;
}

export class Queue<T> {
	readonly #clock: Clock;
	readonly #entries: Entry<T>[] = [];
	#nextId = 1;

	constructor(clock: Clock) {
		this.#clock = clock;
	}

	send(body: T): number {
		const id = this.#nextId++;
		this.#entries.push({ id, body, readCount: 0, visibleAt: 0 });
		return id;
	}

	read(visibilityMs: number): Message<T> | null {
		const now = this.#clock();
		// 선입선출 — 보이는 것 중 가장 앞의 것.
		const entry = this.#entries.find((e) => e.visibleAt <= now);
		if (!entry) return null;

		// 지우지 않는다. 숨기기만 한다.
		entry.readCount += 1;
		entry.visibleAt = now + visibilityMs;
		return { id: entry.id, readCount: entry.readCount, body: entry.body };
	}

	extend(id: number, visibilityMs: number): boolean {
		const now = this.#clock();
		const entry = this.#entries.find((e) => e.id === id);
		if (!entry) return false;
		// 지금 점유 중이 아니면(아직 안 읽혔거나 이미 만료돼 재출현했으면) 연장 대상이 아니다.
		// 조용히 성공시키면 두 워커가 같은 메시지를 점유했다고 믿는다.
		if (entry.visibleAt <= now) return false;
		entry.visibleAt = now + visibilityMs;
		return true;
	}

	remove(id: number): boolean {
		const index = this.#entries.findIndex((e) => e.id === id);
		if (index === -1) return false;
		this.#entries.splice(index, 1);
		return true;
	}

	get length(): number {
		return this.#entries.length;
	}

	get visibleLength(): number {
		const now = this.#clock();
		return this.#entries.filter((e) => e.visibleAt <= now).length;
	}
}

export type Outcome = 'ok' | 'crashed';

export interface WorkerOptions<T> {
	queue: Queue<T>;
	visibilityMs: number;
	handle: (message: Message<T>) => Outcome;
	persist: (message: Message<T>) => void;
}

export function processOne<T>(options: WorkerOptions<T>): Outcome | null {
	const { queue, visibilityMs, handle, persist } = options;

	// ① read — 꺼내며 숨긴다
	const message = queue.read(visibilityMs);
	if (!message) return null;

	// ② handle
	const outcome = handle(message);

	// 죽었으면 여기서 끝. persist도 remove도 하지 않는다 — 숨김이 만료되면
	// 다른 워커가 다시 집는다. 그 재처리가 곧 "유실을 중복으로 바꾼" 결과다.
	if (outcome === 'crashed') return outcome;

	// ③ persist — 던지면 remove에 도달하지 않는다. 그게 요점이다.
	persist(message);

	// ④ remove — 결과를 다 보내고 저장까지 끝난 뒤에만.
	queue.remove(message.id);
	return outcome;
}

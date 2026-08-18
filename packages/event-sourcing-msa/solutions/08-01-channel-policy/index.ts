/**
 * 참고 구현 — 채널 정책.
 *
 * 판정은 tests/08-01-channel-policy/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/08-pubsub-channel.md
 */

export type Payload = Record<string, unknown>;

export interface Delivered {
	publisher: string | null;
	payload: Payload;
}

export type Fanout = 'all' | 'first' | 'round-robin';

export interface ChannelOptions {
	filter?: (payload: Payload) => boolean;
	fanout?: Fanout;
	anonymize?: boolean;
}

export interface SubscribeOptions {
	replay?: 'all' | number;
}

interface Sub {
	id: string;
	handler: (d: Delivered) => void;
}

export class Channel {
	#subs: Sub[] = [];
	/** 이력. 콜드 재생의 근거이자, 필터를 통과한 것만 담긴다. */
	#history: { publisher: string; payload: Payload }[] = [];
	#cursor = 0;
	#opt: Required<Pick<ChannelOptions, 'fanout' | 'anonymize'>> & Pick<ChannelOptions, 'filter'>;

	constructor(options: ChannelOptions = {}) {
		this.#opt = {
			fanout: options.fanout ?? 'all',
			anonymize: options.anonymize ?? false,
			filter: options.filter,
		};
	}

	/** 발행자 노출 정책은 **전달 시점에** 적용한다 — 그래서 콜드 재생에도 자동으로 걸린다. */
	#envelope(rec: { publisher: string; payload: Payload }): Delivered {
		return { publisher: this.#opt.anonymize ? null : rec.publisher, payload: rec.payload };
	}

	/**
	 * 콜드 재생은 **그 구독자에게만** 과거를 보낸다. 팬아웃 커서를 건드리지 않는 것이
	 * 중요하다 — 건드리면 이후 실시간 분배 순서가 어긋난다.
	 */
	subscribe(id: string, handler: (d: Delivered) => void, options: SubscribeOptions = {}): void {
		this.#subs.push({ id, handler });
		const r = options.replay;
		if (r === undefined) return;
		const back = r === 'all' ? this.#history : this.#history.slice(-Math.max(0, r));
		for (const rec of back) handler(this.#envelope(rec));
	}

	unsubscribe(id: string): void {
		this.#subs = this.#subs.filter((s) => s.id !== id);
	}

	/**
	 * 순서가 설계다: **필터 → 이력 적재 → 팬아웃.**
	 *
	 * 필터를 전달 직전에만 적용하면, 나중에 콜드로 참가한 구독자가 걸러진 메시지를 받는다.
	 * 채널이 받아들이지 않은 것은 **없던 일**이어야 하므로 이력 앞에서 막는다.
	 */
	publish(publisher: string, payload: Payload): void {
		if (this.#opt.filter && !this.#opt.filter(payload)) return;

		const rec = { publisher, payload };
		this.#history.push(rec);

		const targets = this.#targets();
		for (const s of targets) s.handler(this.#envelope(rec));
	}

	#targets(): Sub[] {
		if (this.#subs.length === 0) return [];
		switch (this.#opt.fanout) {
			case 'all':
				return [...this.#subs];
			case 'first':
				return [this.#subs[0]!];
			case 'round-robin': {
				// 구독 해지로 목록이 줄어도 커서가 범위를 벗어나지 않게 모듈로를 취한다.
				const at = this.#cursor % this.#subs.length;
				this.#cursor = at + 1;
				return [this.#subs[at]!];
			}
		}
	}
}

/**
 * 과제 08-01 — 채널 정책 ("채널 매직")
 *
 * 발행-구독의 주인공은 발행자도 구독자도 아니라 **채널**이다. 옵저버와 갈리는 지점은
 * 구독자가 대상을 알지 않는다는 것이고, 그래서 **생성 순서 문제가 사라진다.**
 *
 * 그리고 채널이 갖는 정책들이 이 과제의 본체다 — 필터 · 팬아웃 · 발행자 노출 · 핫/콜드.
 * 브로커의 설정 화면이 결국 이 목록이다.
 *
 * 명세:  tests/08-01-channel-policy/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test 08-01
 * 막히면: docs/08-pubsub-channel.md
 */

export type Payload = Record<string, unknown>;

export interface Delivered {
	/** 발행자 id. anonymize면 null */
	publisher: string | null;
	payload: Payload;
}

export type Fanout = 'all' | 'first' | 'round-robin';

export interface ChannelOptions {
	/** 통과하지 못한 메시지는 **채널이 받아들이지 않는다** (이력에도 남지 않는다) */
	filter?: (payload: Payload) => boolean;
	/** 기본 'all' */
	fanout?: Fanout;
	/** 켜면 구독자에게 발행자를 감춘다 */
	anonymize?: boolean;
}

export interface SubscribeOptions {
	/** 콜드 재생: 'all'이면 전부, 숫자면 최근 N개. 없으면 핫(이후 발행분만) */
	replay?: 'all' | number;
}

export class Channel {
	constructor(options: ChannelOptions = {}) {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Channel constructor');
	}

	/**
	 * 구독한다. 발행자가 아직 없어도 가능해야 한다.
	 *
	 * 힌트: `replay` 옵션이 있으면 **그 구독자에게만** 과거를 보낸다 —
	 *       팬아웃 커서를 움직이면 이후 실시간 분배 순서가 어긋난다.
	 */
	subscribe(id: string, handler: (d: Delivered) => void, options: SubscribeOptions = {}): void {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: subscribe');
	}

	unsubscribe(id: string): void {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: unsubscribe');
	}

	/**
	 * 발행한다. 구독자가 없어도 터지지 않아야 한다.
	 *
	 * 힌트 셋:
	 *   ① 필터를 **먼저** 통과해야 한다. 통과 못하면 이력에도 남기지 않는다
	 *   ② 팬아웃 정책에 따라 대상을 고른다 (all / first / round-robin)
	 *   ③ anonymize면 발행자를 null로 바꿔 전달한다 — 콜드 재생에도 같은 정책이 적용된다
	 */
	publish(publisher: string, payload: Payload): void {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: publish');
	}
}

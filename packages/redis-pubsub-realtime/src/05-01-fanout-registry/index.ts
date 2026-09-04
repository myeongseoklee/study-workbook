/**
 * 과제 05-01 — 팬아웃 레지스트리
 *
 * 클라이언트가 접속할 때마다 Redis 구독을 새로 거는 것이 강의가 안티패턴이라고 밝힌
 * 구조다. 정석은 프로세스가 채널마다 구독을 하나만 유지한 채, 받은 메시지를 내부의
 * 클라이언트 큐 여러 개로 나누어 주는 것이다. 그 「서버 내부의 자료 구조」를 여기에 만든다.
 *
 * 명세:  tests/05-01-fanout-registry/index.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 05-01
 * 막히면: docs/05-fanout-registry.md
 */

export interface FanoutOptions {
	/** 클라이언트 큐 하나가 담을 수 있는 메시지의 최대 개수. */
	queueCapacity: number;
	/** 어떤 채널의 첫 구독자가 등록될 때 정확히 한 번 호출된다 (Redis에 SUBSCRIBE를 보내는 자리). */
	onSubscribe: (channel: string) => void;
	/** 어떤 채널의 마지막 구독자가 해제될 때 정확히 한 번 호출된다 (Redis에 UNSUBSCRIBE를 보내는 자리). */
	onUnsubscribe: (channel: string) => void;
}

export interface FanoutResult {
	/** 큐에 성공적으로 들어간 클라이언트 id. 등록 순서를 유지한다. */
	delivered: string[];
	/** 큐가 가득 차 버려진 클라이언트 id. 등록 순서를 유지한다. */
	dropped: string[];
}

/**
 * 채널별 구독자와 클라이언트별 큐를 함께 관리하는 레지스트리.
 *
 * 힌트 1: onSubscribe와 onUnsubscribe를 언제 부를지는 "그 채널을 듣는 클라이언트가 몇 명인가"로
 *         결정된다. 0에서 1이 되는 순간과 1에서 0이 되는 순간이 그 자리다.
 * 힌트 2: 계수의 단위는 클라이언트가 아니라 채널이다. 같은 클라이언트가 여러 채널을 들을 수 있고,
 *         같은 채널을 여러 클라이언트가 들을 수 있으므로 두 방향의 대응을 모두 알아야 한다.
 * 힌트 3: 큐는 채널마다가 아니라 클라이언트마다 하나다. 큐를 버릴 시점을 정하는 조건이
 *         "한 채널에서 빠졌는가"가 아니라는 점을 명세의 힌트에서 확인하라.
 *
 * 내부 자료 구조는 지정하지 않는다. 위 성질을 만족한다면 무엇으로 만들어도 좋다.
 */
export class FanoutRegistry {
	private readonly options: FanoutOptions;

	constructor(options: FanoutOptions) {
		this.options = options;
	}

	/** 클라이언트를 채널에 등록한다. 같은 조합을 두 번 등록해도 계수는 하나다. */
	register(channel: string, clientId: string): void {
		// 🎯 TODO: 채널에 클라이언트를 넣고, 그 채널의 첫 구독자일 때만 onSubscribe를 부른다
		throw new Error('TODO: register');
	}

	/** 클라이언트를 채널에서 해제한다. 몇 번을 호출해도 결과가 같아야 한다. */
	unregister(channel: string, clientId: string): void {
		// 🎯 TODO: 채널에서 클라이언트를 빼고, 마지막 구독자였을 때만 onUnsubscribe를 부른다.
		//          듣는 채널이 하나도 남지 않은 클라이언트의 큐는 여기서 정리한다
		throw new Error('TODO: unregister');
	}

	/** 채널에 등록된 모든 클라이언트의 큐에 payload를 넣고, 성공한 것과 버려진 것을 갈라 돌려준다. */
	publish(channel: string, payload: string): FanoutResult {
		// 🎯 TODO: 큐가 가득 찬 클라이언트를 만나도 나머지 클라이언트에게는 계속 전달한다
		throw new Error('TODO: publish');
	}

	/** 그 클라이언트의 큐에 쌓인 것을 전부 꺼내고 큐를 비운다. */
	drain(clientId: string): string[] {
		// 🎯 TODO: 넣은 순서대로 돌려주고 큐를 비운다
		throw new Error('TODO: drain');
	}

	/** 그 클라이언트의 큐에 쌓여 있는 개수. */
	pending(clientId: string): number {
		// 🎯 TODO: 큐가 없는 클라이언트는 0이다
		throw new Error('TODO: pending');
	}

	/** 지금 구독 중인 채널 목록. 등록 순서를 유지한다. */
	channels(): string[] {
		// 🎯 TODO: 구독자가 한 명도 없는 채널은 목록에 남기지 않는다
		throw new Error('TODO: channels');
	}
}

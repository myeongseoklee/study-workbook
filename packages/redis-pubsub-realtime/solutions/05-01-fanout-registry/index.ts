/**
 * 과제 05-01의 참고 구현.
 *
 * 판정은 `tests/05-01-fanout-registry/index.test.ts`가 한다. 같은 테스트를 이 파일에 대고
 * 돌린 것이 `pnpm test:solutions`다. 여기 있는 코드는 "정답 하나"가 아니라
 * "성립하는 한 예"다.
 *
 * 📍 되짚기: docs/05-fanout-registry.md § 레지스트리가 책임지는 네 가지
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
 * 세 개의 Map으로 네 가지 책임을 나누어 담는다.
 *
 * 자료 구조를 셋으로 나눈 이유는 조회의 방향이 셋이기 때문이다. 팬아웃은 「채널 →
 * 클라이언트들」을 물어보고, 이탈 정리는 「클라이언트 → 채널들」을 물어보며, 전달과
 * 소비는 「클라이언트 → 큐」를 물어본다. 한 방향만 저장해 두면 나머지 두 질문에
 * 답할 때마다 전체를 훑어야 하고, 그 순회는 클라이언트 수에 비례해서 커진다.
 *
 * `Set`과 `Map`을 쓴 것도 명세와 직접 이어진다. JavaScript의 `Set`과 `Map`은 삽입
 * 순서를 보존하므로 `delivered`·`dropped`·`channels()`가 요구하는 등록 순서가 별도의
 * 정렬 없이 그대로 나오고, `Set`은 같은 값을 두 번 넣어도 하나로 유지되므로 중복
 * 등록이 계수를 부풀리지 않는다.
 *
 * 참조 계수를 숫자 하나(`Map<string, number>`)로 세는 방법도 생각할 수 있지만, 그러면
 * 같은 클라이언트가 두 번 등록될 때 계수가 2가 되어 해제 후에도 구독이 남는다. 계수를
 * 세는 대상이 「등록 호출의 횟수」가 아니라 「지금 듣고 있는 서로 다른 클라이언트」이기
 * 때문에, 집합의 크기로 세는 편이 정의에 더 가깝다.
 */
export class FanoutRegistry {
	private readonly options: FanoutOptions;

	/** 채널 → 그 채널을 듣는 클라이언트들. 이 집합의 크기가 곧 참조 계수다. */
	private readonly membersByChannel = new Map<string, Set<string>>();

	/** 클라이언트 → 그 클라이언트가 듣는 채널들. 큐를 언제 버릴지 판단할 때 쓴다. */
	private readonly channelsByClient = new Map<string, Set<string>>();

	/** 클라이언트 → 아직 읽어 가지 않은 메시지. 채널별이 아니라 클라이언트별로 하나다. */
	private readonly queueByClient = new Map<string, string[]>();

	constructor(options: FanoutOptions) {
		this.options = options;
	}

	/**
	 * 등록 — 채널의 구독자 집합에 넣고, 그 채널이 처음 생길 때만 Redis 구독을 건다.
	 *
	 * `onSubscribe`를 부르는 조건을 「구독자 집합이 방금 만들어졌는가」로 잡았다.
	 * 「집합의 크기가 1인가」로 잡으면 결과는 대체로 같지만, 마지막 구독자가 떠난 뒤에도
	 * 빈 집합을 남겨 두는 구현에서는 크기가 다시 1이 될 때 구독이 이미 살아 있는지를
	 * 알 수 없게 된다. 그래서 아래 `unregister`는 비어 버린 채널의 항목 자체를 지우고,
	 * 여기서는 항목의 존재 여부만으로 판단한다. 두 메서드가 같은 약속을 공유하는 셈이다.
	 */
	register(channel: string, clientId: string): void {
		let members = this.membersByChannel.get(channel);
		if (members === undefined) {
			members = new Set<string>();
			this.membersByChannel.set(channel, members);
			this.options.onSubscribe(channel);
		}
		members.add(clientId);

		let subscriptions = this.channelsByClient.get(clientId);
		if (subscriptions === undefined) {
			subscriptions = new Set<string>();
			this.channelsByClient.set(clientId, subscriptions);
			this.queueByClient.set(clientId, []);
		}
		subscriptions.add(channel);
	}

	/**
	 * 해제 — 참조 계수가 0이 되는 순간에만 구독을 끊고, 듣는 채널이 없어진 클라이언트의 큐를 버린다.
	 *
	 * 첫 줄의 조기 반환이 「몇 번을 호출해도 같은 결과」를 만든다. 등록된 적이 없는
	 * 조합이면 아무것도 하지 않으므로, 연결 종료와 오류 처리가 겹쳐 해제를 두 번 불러도
	 * `onUnsubscribe`가 두 번 나가지 않는다. 이 방어가 없으면 두 번째 호출이 UNSUBSCRIBE를
	 * 한 번 더 보내고, 그 사이에 다시 접속한 클라이언트의 구독까지 끊어진다.
	 *
	 * 큐를 버리는 조건이 `subscriptions.size === 0`인 것도 의도적이다. 한 채널에서 빠졌다는
	 * 이유로 큐를 비우면 아직 읽지 않은 다른 채널의 메시지가 함께 사라진다. 반대로 큐를
	 * 영영 지우지 않으면 떠난 클라이언트가 붙잡은 메모리가 프로세스 수명 내내 남는데,
	 * 이 누수는 서비스가 오래 살아 있을수록 커진다.
	 */
	unregister(channel: string, clientId: string): void {
		const members = this.membersByChannel.get(channel);
		if (members === undefined || !members.has(clientId)) {
			return;
		}

		members.delete(clientId);
		if (members.size === 0) {
			this.membersByChannel.delete(channel);
			this.options.onUnsubscribe(channel);
		}

		const subscriptions = this.channelsByClient.get(clientId);
		if (subscriptions !== undefined) {
			subscriptions.delete(channel);
			if (subscriptions.size === 0) {
				this.channelsByClient.delete(clientId);
				this.queueByClient.delete(clientId);
			}
		}
	}

	/**
	 * 팬아웃 — 한 클라이언트의 실패가 다른 클라이언트의 전달을 막지 않는다.
	 *
	 * 이 메서드에서 가장 중요한 것은 가득 찬 큐를 만났을 때 `continue`로 넘어간다는
	 * 점이다. 여기서 예외를 던지거나 반복을 `break`로 끊으면 느린 사용자 한 명이 나머지
	 * 모두의 알림을 막고, 그러면 정석 구조로 옮긴 이득이 그대로 사라진다.
	 *
	 * 정원 판정을 `>=`로 쓴 이유는 `queueCapacity`가 「담을 수 있는 최대 개수」이기
	 * 때문이다. 이미 그만큼 들어 있다면 한 건도 더 받을 수 없다. `>`로 쓰면 정원보다
	 * 한 건을 더 받게 되는데, 이런 어긋남은 정원이 큰 운영 환경에서는 눈에 띄지 않다가
	 * 정원을 줄여 시험할 때에야 드러난다.
	 *
	 * 가득 찼을 때 새 메시지를 버리고 가장 오래된 것을 남기는 선택도 근거가 있다. 오래된
	 * 것을 밀어내면 아직 읽지 않은 메시지가 소리 없이 사라지고, 무엇을 잃었는지 `dropped`에도
	 * 남지 않는다. 무엇을 버렸는지 셀 수 있어야 느린 클라이언트를 끊는 판단을 할 수 있다.
	 */
	publish(channel: string, payload: string): FanoutResult {
		const delivered: string[] = [];
		const dropped: string[] = [];

		const members = this.membersByChannel.get(channel);
		if (members === undefined) {
			// 구독자가 없는 채널이다. 마지막 클라이언트가 떠난 직후에 이미 날아온 메시지가
			// 도착하는 구간이 실제로 있으므로, 예외를 던지면 구독 루프 전체가 죽는다.
			return { delivered, dropped };
		}

		for (const clientId of members) {
			const queue = this.queueByClient.get(clientId);
			if (queue === undefined) {
				continue;
			}
			if (queue.length >= this.options.queueCapacity) {
				dropped.push(clientId);
				continue;
			}
			queue.push(payload);
			delivered.push(clientId);
		}

		return { delivered, dropped };
	}

	/**
	 * 소비 — 쌓인 것을 넘겨주고 같은 배열을 그 자리에서 비운다.
	 *
	 * `splice(0)`는 꺼내기와 비우기를 한 번에 하므로 그 사이에 다른 코드가 끼어들 틈이
	 * 없다. `const taken = queue; this.queueByClient.set(clientId, [])`처럼 배열을 통째로
	 * 갈아 끼워도 결과는 같지만, 그 경우 이전 배열을 참조하던 곳이 있으면 옛 내용을 계속
	 * 보게 된다. 반대로 `[...queue]`로 복사만 하고 비우기를 잊으면 같은 메시지가 다음
	 * drain에서 또 나온다.
	 */
	drain(clientId: string): string[] {
		const queue = this.queueByClient.get(clientId);
		if (queue === undefined) {
			return [];
		}
		return queue.splice(0);
	}

	/** 아직 읽어 가지 않은 개수. 큐가 없는 클라이언트는 0이며, 이때 예외를 던지지 않는다. */
	pending(clientId: string): number {
		return this.queueByClient.get(clientId)?.length ?? 0;
	}

	/**
	 * 지금 구독 중인 채널 목록.
	 *
	 * 등록한 채널을 별도의 배열에 덧붙여 두는 방식은 해제된 채널이 목록에 남는다. 살아
	 * 있는 Map의 키에서 바로 뽑으면 등록과 해제가 목록에 자동으로 반영되고, Map이 삽입
	 * 순서를 보존하므로 등록 순서도 함께 지켜진다.
	 */
	channels(): string[] {
		return [...this.membersByChannel.keys()];
	}
}

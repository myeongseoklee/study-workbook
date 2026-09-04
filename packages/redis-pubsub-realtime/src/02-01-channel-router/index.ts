/**
 * 과제 02-01: 채널 라우터
 *
 * `PUBLISH` 한 번이 일어났을 때, 지금 걸려 있는 구독 목록을 보고 **누구에게 어떤 모양의
 * 메시지가 가는지**를 계산한다. Redis 서버를 띄우지 않고 라우팅 판단만 떼어낸 것이므로
 * 입력과 출력이 모두 순수한 값이고, 네트워크도 시계도 쓰지 않는다.
 *
 * 명세:  tests/02-01-channel-router/index.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 02-01
 * 막히면: docs/02-core-principles.md의 「필수 지식 1」
 */

/**
 * 지금 걸려 있는 구독 하나.
 *
 * `channel`은 `SUBSCRIBE`로 등록한 것이고 이름을 문자 그대로 비교한다.
 * `pattern`은 `PSUBSCRIBE`로 등록한 것이고 글로브 문법으로 비교한다.
 */
export type Subscription =
	| { kind: 'channel'; subscriberId: string; channel: string }
	| { kind: 'pattern'; subscriberId: string; pattern: string };

/** 구독자 한 명에게 밀어 넣는 메시지 하나. */
export interface Delivery {
	subscriberId: string;
	/** 채널 구독으로 받으면 'message', 패턴 구독으로 받으면 'pmessage'다. */
	type: 'message' | 'pmessage';
	/** 'pmessage'일 때만 존재한다. 들어맞은 패턴이다. */
	pattern?: string;
	/** 원본 채널 이름이다. 두 경우 모두 존재한다. */
	channel: string;
	payload: string;
}

/**
 * 글로브 패턴이 채널 이름 전체와 들어맞는지 판정한다.
 *
 * 지원하는 문법은 명세 파일 상단에 적힌 여섯 가지다. 그 밖의 문법은 검사하지 않는다.
 *
 * 힌트 1: 정규식으로 바꾸어 푸는 방식도 성립한다. 다만 그때는 글로브 문법이 **아닌**
 *         정규식 메타문자를 빠짐없이 이스케이프해야 하고, 앞뒤에 앵커를 붙여야 한다.
 * 힌트 2: 직접 훑어서 푸는 방식이라면 `*`에서 되돌아오는 경우를 생각해야 한다.
 *         `*`가 몇 글자를 삼킬지는 뒤를 다 보기 전에는 정할 수 없다.
 */
export function matchesPattern(pattern: string, channel: string): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: matchesPattern');
}

/**
 * 채널 하나로 발행된 메시지가 누구에게 어떤 모양으로 가는지 계산한다.
 *
 * 힌트 1: 전달의 순서가 명세에 규정되어 있다. 배열을 한 번만 훑으면서 나오는 대로
 *         담으면 그 순서가 나오지 않는다.
 * 힌트 2: 같은 구독자가 채널과 패턴에 모두 걸리는 경우와, 같은 등록이 두 번 들어온
 *         경우는 서로 다른 이야기다. 하나는 전달이 둘이고 다른 하나는 하나다.
 *         무엇을 기준으로 "같은 등록"이라고 볼지 먼저 정해라.
 */
export function route(subscriptions: Subscription[], channel: string, payload: string): Delivery[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: route');
}

/**
 * `PUBLISH` 명령이 돌려주는 숫자를 흉내 낸다.
 *
 * 힌트: 이 숫자는 구독자의 수가 아니다. 무엇의 수인지는 명세의 마지막 describe가
 *       한 줄로 못박아 두었다.
 */
export function publishCount(subscriptions: Subscription[], channel: string): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: publishCount');
}

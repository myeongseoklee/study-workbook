/**
 * 과제 02-01의 참고 구현.
 *
 * 판정은 `tests/02-01-channel-router/index.test.ts`가 한다. 같은 테스트를 이 파일에 대고
 * 돌린 것이 `pnpm test:solutions`다. 여기 있는 코드는 "정답 하나"가 아니라 "성립하는 한
 * 예"이며, 명세를 만족하는 다른 형태도 얼마든지 있다.
 *
 * 📍 되짚기: docs/02-core-principles.md § 필수 지식 1
 */

export type Subscription =
	| { kind: 'channel'; subscriberId: string; channel: string }
	| { kind: 'pattern'; subscriberId: string; pattern: string };

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

/* ------------------------------------------------------------------ *
 * 1. 글로브 일치
 * ------------------------------------------------------------------ */

/**
 * 왜 정규식으로 바꾸지 않고 직접 훑는가.
 *
 * 글로브를 정규식으로 번역하는 방식도 성립하고, 실제로 그렇게 푼 라이브러리가 많다.
 * 다만 그 방식에는 번역이라는 단계가 하나 더 있고, 그 단계에서 두 가지를 빠뜨리기 쉽다.
 *
 * 첫째는 이스케이프다. 글로브에서 아무 뜻도 없는 `.` `+` `(` `$` `|`가 정규식에서는
 * 전부 메타문자이므로, 그대로 넘기면 `news.art`라는 패턴이 `newsXart`라는 채널까지
 * 받아 버린다. 채널 이름에 마침표를 구분자로 쓰는 관행이 널리 퍼져 있어서 이 실수는
 * 거의 모든 패턴에 영향을 준다.
 *
 * 둘째는 앵커다. `RegExp.prototype.test`는 부분 일치를 참으로 판정하므로 `^`와 `$`를
 * 붙이지 않으면 `news`가 `news.art`를 받는다. 패턴 구독은 채널 이름 **전체**와
 * 들어맞아야 한다.
 *
 * 직접 훑으면 이 두 가지가 애초에 생기지 않는다. 글로브 문법에 속하지 않는 글자는
 * 마지막 분기에서 전부 "글자 하나를 그대로 비교한다"로 떨어지고, 종료 조건이
 * `c === channel.length`이므로 전체 일치가 정의에 포함된다.
 */
export function matchesPattern(pattern: string, channel: string): boolean {
	return matchFrom(pattern, 0, channel, 0);
}

/**
 * 패턴의 `p`번째 글자와 채널의 `c`번째 글자를 맞춰 나간다.
 *
 * `*`를 만나면 되돌아오기(backtracking)가 필요하다. 별표가 몇 글자를 삼킬지는 뒤에
 * 남은 패턴을 다 맞춰 보기 전에는 정할 수 없기 때문이다. 예를 들어 패턴 `*.art`를
 * 채널 `news.art.art`에 맞출 때, 별표가 최대한 삼키면 `.art`가 남지 않는다. 그래서
 * 삼키는 길이를 0부터 하나씩 늘려 가며 나머지가 성립하는지 확인한다.
 *
 * 채널 이름은 보통 짧기 때문에 이 되돌아오기의 비용은 실질적으로 문제가 되지 않는다.
 * Redis의 `stringmatchlen`도 같은 구조로 되어 있다.
 */
function matchFrom(pattern: string, patternIndex: number, channel: string, channelIndex: number): boolean {
	let p = patternIndex;
	let c = channelIndex;

	while (p < pattern.length) {
		const token = pattern[p];

		if (token === '*') {
			// 별표가 연달아 있으면 하나와 뜻이 같으므로 묶어서 넘어간다.
			while (pattern[p + 1] === '*') p += 1;
			// 패턴이 별표로 끝나면 남은 채널 이름이 무엇이든 들어맞는다. 길이가 0이어도
			// 마찬가지이며, 이 한 줄이 `news.*`가 `news.`를 받는 근거다.
			if (p + 1 === pattern.length) return true;
			for (let skip = c; skip <= channel.length; skip += 1) {
				if (matchFrom(pattern, p + 1, channel, skip)) return true;
			}
			return false;
		}

		// 여기부터는 어떤 분기로 가든 채널 쪽 글자를 정확히 하나 소비한다. 채널이 이미
		// 끝났다면 소비할 것이 없으므로 실패다. `?`와 `[...]`가 0글자에 들어맞지 않는
		// 이유가 이 한 줄이다.
		const target = channel[c];
		if (target === undefined) return false;

		if (token === '?') {
			p += 1;
			c += 1;
			continue;
		}

		if (token === '[') {
			const parsed = parseCharClass(pattern, p);
			if (parsed === null) {
				// 닫는 대괄호가 없으면 문자 집합이 아니므로 여는 대괄호를 글자로 다룬다.
				if (target !== '[') return false;
				p += 1;
				c += 1;
				continue;
			}
			if (!parsed.matches(target)) return false;
			p = parsed.nextIndex;
			c += 1;
			continue;
		}

		if (token === '\\') {
			// 역슬래시는 스스로를 소비하고 뒤 글자의 특수한 뜻을 지운다. 패턴 끝에 홀로
			// 남은 역슬래시는 뜻을 지울 대상이 없으므로 역슬래시라는 글자로 본다.
			const escaped = pattern[p + 1];
			if (escaped === undefined) {
				if (target !== '\\') return false;
				p += 1;
				c += 1;
				continue;
			}
			if (target !== escaped) return false;
			p += 2;
			c += 1;
			continue;
		}

		// 글로브 문법에 속하지 않는 글자는 전부 여기로 온다. 마침표도 더하기도
		// 괄호도 예외가 아니므로, 정규식 메타문자를 따로 이스케이프할 일이 없다.
		if (target !== token) return false;
		p += 1;
		c += 1;
	}

	// 패턴을 다 썼다면 채널도 정확히 다 소비되어 있어야 한다. 이 비교가 전체 일치를
	// 보장하며, 정규식 방식의 `$`에 해당한다.
	return c === channel.length;
}

/**
 * `[`에서 시작하는 문자 집합을 읽는다. 닫는 대괄호가 없으면 `null`을 돌려준다.
 *
 * 부정(`^`)은 여는 대괄호 바로 뒤에 있을 때만 부정이다. 그 자리를 벗어난 캐럿은
 * 캐럿이라는 글자를 뜻한다.
 *
 * 범위(`a-z`)는 하이픈의 **뒤에 글자가 남아 있을 때만** 범위다. `[a-]`처럼 하이픈이
 * 닫는 대괄호에 붙어 있으면 그것은 하이픈이라는 글자이므로, 여기서 `']'`를 따로
 * 걸러 낸다. 이 예외를 두지 않으면 대괄호를 닫는 글자가 범위의 끝으로 먹혀 버린다.
 */
function parseCharClass(
	pattern: string,
	openIndex: number,
): { matches: (ch: string) => boolean; nextIndex: number } | null {
	let i = openIndex + 1;
	let negated = false;

	if (pattern[i] === '^') {
		negated = true;
		i += 1;
	}

	const ranges: Array<{ from: string; to: string }> = [];
	let closed = false;

	while (i < pattern.length) {
		const current = pattern[i];
		if (current === undefined) break;

		if (current === ']') {
			i += 1;
			closed = true;
			break;
		}

		if (current === '\\') {
			const escaped = pattern[i + 1];
			if (escaped !== undefined) {
				ranges.push({ from: escaped, to: escaped });
				i += 2;
				continue;
			}
		}

		const next = pattern[i + 1];
		const after = pattern[i + 2];
		if (next === '-' && after !== undefined && after !== ']') {
			ranges.push({ from: current, to: after });
			i += 3;
			continue;
		}

		ranges.push({ from: current, to: current });
		i += 1;
	}

	if (!closed) return null;

	return {
		nextIndex: i,
		matches(ch: string): boolean {
			const hit = ranges.some((range) => ch >= range.from && ch <= range.to);
			return negated ? !hit : hit;
		},
	};
}

/* ------------------------------------------------------------------ *
 * 2. 라우팅
 * ------------------------------------------------------------------ */

/**
 * 같은 등록인지 판정하는 열쇠를 만든다.
 *
 * "같은 구독자가 두 번 받는 경우"와 "같은 등록이 두 번 들어온 경우"를 가르는 자리가
 * 여기다. 열쇠에 `kind`와 대상(채널 이름 또는 패턴)까지 넣기 때문에, 채널 구독과
 * 패턴 구독은 구독자가 같아도 서로 다른 등록으로 남고 전달이 둘 만들어진다. 반대로
 * `SUBSCRIBE foo`를 두 번 보낸 것은 열쇠가 완전히 같으므로 하나로 접힌다.
 *
 * 열쇠를 `subscriberId` 하나로 잡으면 채널과 패턴에 모두 걸린 구독자가 한 번만 받게
 * 되어 규정된 동작이 깨진다. 반대로 중복 제거를 아예 하지 않으면 `PUBLISH`의 반환값이
 * 실제 커넥션 수보다 커진다.
 *
 * 구분자로 널 문자(`\u0000`)를 쓰는 이유는 채널 이름이나 구독자 식별자에 이 글자가 들어갈 일이
 * 사실상 없기 때문이다. 콜론처럼 흔한 글자를 쓰면 `a:b`와 `a` + `:b`가 같은 열쇠가
 * 되어 서로 다른 등록이 하나로 접힌다.
 */
function registrationKey(subscription: Subscription): string {
	const target =
		subscription.kind === 'channel' ? subscription.channel : subscription.pattern;
	return `${subscription.kind}\u0000${subscription.subscriberId}\u0000${target}`;
}

/**
 * 발행된 메시지 하나가 만드는 전달의 목록을 돌려준다.
 *
 * 채널 전달과 패턴 전달을 **따로 모았다가 이어 붙이는** 까닭은 순서 때문이다. 배열을
 * 한 번 훑으면서 나오는 대로 담으면 등록 순서에 따라 pmessage가 message보다 앞에 올 수
 * 있다. Redis는 채널 구독자에게 먼저 밀어 넣고 그다음에 패턴 구독자를 훑으므로, 그
 * 순서를 그대로 재현한다.
 *
 * 각 종류 안에서 등록 순서를 유지하는 것도 의도적이다. 순서를 정렬 등으로 흔들면
 * 같은 입력에 대해 결과가 달라 보일 수 있고, 그러면 이 함수를 쓰는 테스트가 구현의
 * 내부 사정에 끌려다니게 된다.
 */
export function route(subscriptions: Subscription[], channel: string, payload: string): Delivery[] {
	const seen = new Set<string>();
	const channelDeliveries: Delivery[] = [];
	const patternDeliveries: Delivery[] = [];

	for (const subscription of subscriptions) {
		const key = registrationKey(subscription);
		if (seen.has(key)) continue;
		seen.add(key);

		if (subscription.kind === 'channel') {
			// 채널 구독은 글로브를 해석하지 않는다. `SUBSCRIBE news.*`는 이름이
			// `news.*`인 채널 하나만 듣는다는 뜻이지 와일드카드가 아니다.
			if (subscription.channel === channel) {
				channelDeliveries.push({
					subscriberId: subscription.subscriberId,
					type: 'message',
					channel,
					payload,
				});
			}
			continue;
		}

		// 패턴 구독은 등록된 것마다 독립적으로 판정한다. 한 구독자가 들어맞는 패턴을
		// 여럿 걸어 두었다면 전달도 그만큼 만들어지며, 받는 쪽은 `pattern` 값을 보고
		// 어느 콜백을 부를지 정한다. 그래서 여기서 합치면 안 된다.
		if (matchesPattern(subscription.pattern, channel)) {
			patternDeliveries.push({
				subscriberId: subscription.subscriberId,
				type: 'pmessage',
				pattern: subscription.pattern,
				channel,
				payload,
			});
		}
	}

	return [...channelDeliveries, ...patternDeliveries];
}

/**
 * `PUBLISH`가 돌려주는 숫자를 흉내 낸다.
 *
 * 이 숫자는 구독자의 수가 아니라 **메시지를 밀어 넣은 대상의 수**다. 채널과 들어맞는
 * 패턴에 모두 걸린 구독자는 둘로 세고, 채널 구독자가 한 명도 없어도 패턴 구독자가
 * 있으면 0이 아니다. 받아서 처리한 수는 더더욱 아니다. 밀어 넣은 직후에 구독자가
 * 죽어도 이 숫자는 달라지지 않으며, 그것이 at-most-once 전달 보장의 다른 얼굴이다.
 *
 * 그러므로 이 함수를 따로 세지 않고 `route`의 길이로 정의한다. 중복 등록을 한 번만
 * 세는 규칙과 두 번 전달하는 규칙을 양쪽에 각각 구현하면, 한쪽만 고쳤을 때 발행자가
 * 보는 숫자와 실제로 밀어 넣은 대상의 수가 조용히 어긋난다.
 */
export function publishCount(subscriptions: Subscription[], channel: string): number {
	return route(subscriptions, channel, '').length;
}

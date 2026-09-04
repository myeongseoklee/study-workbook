/**
 * 과제 02-01의 명세: 채널 라우터
 *
 * 이 파일이 과제의 정의다. `src/02-01-channel-router/index.ts`를 채워서 여기를 통과시켜라.
 * **이 파일은 고치지 않는다.** 명세를 고쳐서 통과시키는 것은 과제를 푸는 것이 아니다.
 * 고쳐야 할 것 같다면 구현이 아니라 이해가 틀렸을 가능성을 먼저 의심해라. 그럴 때는
 * docs/02-core-principles.md의 「필수 지식 1」을 다시 읽어라.
 *
 * 이 과제가 지원하는 글로브 문법은 Redis가 지원하는 것 전체가 아니라 아래 여섯 가지로
 * 이루어진 부분집합이다. 여기에 없는 문법은 검사하지 않으므로 구현하지 않아도 된다.
 *
 *   `*`      길이 0을 포함한 임의의 문자열
 *   `?`      정확히 한 글자
 *   `[abc]`  괄호 안의 글자 중 하나
 *   `[a-z]`  범위 안의 글자 하나
 *   `[^abc]` 괄호 안의 글자가 아닌 글자 하나
 *   `\x`     바로 뒤 글자를 문자 그대로 해석한다. 예를 들어 `\*`는 별표 자체를 뜻한다
 *
 * 실행: pnpm test 02-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { matchesPattern, publishCount, route } from '../../src/02-01-channel-router';
import type { Subscription } from '../../src/02-01-channel-router';

/** 채널 구독 하나를 짧게 적기 위한 헬퍼다. */
function ch(subscriberId: string, channel: string): Subscription {
	return { kind: 'channel', subscriberId, channel };
}

/** 패턴 구독 하나를 짧게 적기 위한 헬퍼다. */
function pat(subscriberId: string, pattern: string): Subscription {
	return { kind: 'pattern', subscriberId, pattern };
}

describe('matchesPattern: 글로브 문법', () => {
	it('`*`는 길이 0인 문자열에도 들어맞고, 마디 구분자를 넘어 여러 마디를 한꺼번에 삼킨다', () => {
		retrace(
			'`*`를 "한 글자 이상"으로 구현하면 `news.*`가 `news.`를 놓친다. ' +
				'또한 마침표를 마디 경계로 보고 한 마디만 삼키도록 만들면 `news.*`가 ' +
				'`news.art.figurative`를 놓친다. Redis의 글로브에는 마디 경계라는 개념이 없다.',
			() => {
				expect(matchesPattern('news.*', 'news.')).toBe(true);
				expect(matchesPattern('news.*', 'news.art')).toBe(true);
				expect(matchesPattern('news.*', 'news.art.figurative')).toBe(true);
				expect(matchesPattern('*', '')).toBe(true);
			},
		);
	});

	it('`?`는 정확히 한 글자에 들어맞으며, 0글자와 2글자에는 들어맞지 않는다', () => {
		retrace(
			'`?`를 `*`와 같은 자리에서 처리하면 개수 제한이 사라진다. ' +
				'이 기호는 반드시 한 글자를 소비하고, 그 이상도 그 이하도 아니다.',
			() => {
				expect(matchesPattern('news.?', 'news.a')).toBe(true);
				expect(matchesPattern('news.?', 'news.')).toBe(false);
				expect(matchesPattern('news.?', 'news.ab')).toBe(false);
				expect(matchesPattern('room??', 'room12')).toBe(true);
			},
		);
	});

	it('`[abc]`는 괄호 안의 글자 하나를, `[a-z]`는 범위 안의 글자 하나를 받는다', () => {
		retrace(
			'대괄호는 여러 글자를 나열하지만 소비하는 것은 언제나 한 글자다. ' +
				'`room[123]`이 `room12`에 들어맞았다면 대괄호를 별표처럼 다룬 것이다.',
			() => {
				expect(matchesPattern('room[123]', 'room2')).toBe(true);
				expect(matchesPattern('room[123]', 'room4')).toBe(false);
				expect(matchesPattern('room[123]', 'room12')).toBe(false);
				expect(matchesPattern('room[a-f]', 'roomc')).toBe(true);
				expect(matchesPattern('room[a-f]', 'roomz')).toBe(false);
			},
		);
	});

	it('`[^abc]`는 부정이지만, 부정이어도 글자 하나는 반드시 소비한다', () => {
		retrace(
			'`^`를 부정 기호로 읽지 않고 캐럿이라는 글자로 다루면 `room4`가 거짓이 된다. ' +
				'반대로 부정을 "해당하는 글자가 없어도 된다"로 확장하면 채널 이름이 `room`에서 ' +
				'끝나는 경우까지 참이 되는데, 부정 문자 집합도 자리 하나를 차지한다.',
			() => {
				expect(matchesPattern('room[^123]', 'room4')).toBe(true);
				expect(matchesPattern('room[^123]', 'room1')).toBe(false);
				expect(matchesPattern('room[^123]', 'room')).toBe(false);
			},
		);
	});

	it('`\\*`는 별표 자체를 뜻하므로 와일드카드로 작동하지 않는다', () => {
		retrace(
			'이스케이프를 처리하지 않으면 역슬래시 뒤의 별표가 와일드카드로 남아 ' +
				'`news.art`까지 받아 버린다. 반대로 역슬래시를 평범한 한 글자로 세면 ' +
				'채널 이름 쪽에도 역슬래시가 있어야 들어맞게 되어 `news*`를 놓친다.',
			() => {
				expect(matchesPattern('news\\*', 'news*')).toBe(true);
				expect(matchesPattern('news\\*', 'news.art')).toBe(false);
				expect(matchesPattern('news\\*', 'news')).toBe(false);
				expect(matchesPattern('news\\?', 'news?')).toBe(true);
				expect(matchesPattern('news\\?', 'newsX')).toBe(false);
			},
		);
	});

	it('패턴 안의 마침표는 정규식 메타문자가 아니라 마침표 한 글자다', () => {
		retrace(
			'패턴을 정규식으로 바꾸어 푸는 방식도 성립하지만, 글로브 문법이 아닌 정규식 ' +
				'메타문자(`.` `+` `(` `$` 등)를 이스케이프하지 않으면 여기서 걸린다. ' +
				'`newsXart`가 참으로 나왔다면 마침표를 "아무 글자 하나"로 흘려보낸 것이다.',
			() => {
				expect(matchesPattern('news.art', 'news.art')).toBe(true);
				expect(matchesPattern('news.art', 'newsXart')).toBe(false);
				expect(matchesPattern('news.*', 'newsXart')).toBe(false);
				expect(matchesPattern('a+b', 'a+b')).toBe(true);
				expect(matchesPattern('a+b', 'aaab')).toBe(false);
			},
		);
	});

	it('패턴은 채널 이름 전체와 들어맞아야 하며, 부분 일치는 인정하지 않는다', () => {
		retrace(
			'정규식으로 바꾸어 풀 때 `^`와 `$`를 붙이지 않으면 부분 일치가 되어 ' +
				'`news`가 `news.art`까지 받아 버린다. RegExp.test는 기본이 부분 일치다. ' +
				'반대로 `*.art`가 거짓으로 나왔다면 앵커가 아니라 되돌아오기가 원인이다: ' +
				'별표가 남은 글자를 최대한 삼키고 멈추면 뒤에 남은 `.art`를 맞출 자리가 없다. ' +
				'별표가 몇 글자를 삼킬지는 뒤를 다 맞춰 보기 전에 정할 수 없다.',
			() => {
				expect(matchesPattern('news', 'news.art')).toBe(false);
				expect(matchesPattern('art', 'news.art')).toBe(false);
				expect(matchesPattern('news', 'news')).toBe(true);
				expect(matchesPattern('*.art', 'news.art')).toBe(true);
				expect(matchesPattern('news.*.jazz', 'news.music.jazz')).toBe(true);
			},
		);
	});
});

describe('route: 채널 구독과 패턴 구독이 함께 걸릴 때', () => {
	it('채널 구독으로 받은 전달은 종류가 message이고 pattern 필드를 갖지 않는다', () => {
		const deliveries = route([ch('c1', 'news.art')], 'news.art', 'hello');
		expect(deliveries).toEqual([
			{ subscriberId: 'c1', type: 'message', channel: 'news.art', payload: 'hello' },
		]);
		retrace(
			'채널 구독에는 "들어맞은 패턴"이라는 개념이 없다. 빈 자리를 채우려고 ' +
				'pattern에 채널 이름을 넣어 두면, 받는 쪽이 패턴으로 콜백을 찾을 때 ' +
				'등록하지 않은 패턴을 만나게 된다.',
			() => {
				expect(deliveries.map((d) => d.pattern)).toEqual([undefined]);
			},
		);
	});

	it('패턴 구독으로 받은 전달은 종류가 pmessage이고, 들어맞은 패턴과 원본 채널이 함께 온다', () => {
		retrace(
			'channel 자리에 패턴을 그대로 넣으면 받는 쪽이 어느 채널에서 온 메시지인지 알 수 없다. ' +
				'pmessage에 원소가 하나 더 있는 까닭은 두 정보가 모두 필요하기 때문이다. ' +
				'패턴으로는 콜백을 찾고, 채널로는 사건이 일어난 자리를 안다.',
			() => {
				expect(route([pat('p1', 'news.*')], 'news.art', 'hello')).toEqual([
					{
						subscriberId: 'p1',
						type: 'pmessage',
						pattern: 'news.*',
						channel: 'news.art',
						payload: 'hello',
					},
				]);
			},
		);
	});

	it('채널 전달이 모두 먼저 나오고 그다음에 패턴 전달이 나오며, 같은 종류 안에서는 등록 순서를 지킨다', () => {
		// 등록 순서를 식별자의 사전순과 일부러 어긋나게 두었다. 두 순서가 우연히 같으면
		// 결과를 식별자로 정렬해 버려도 이 검사가 통과하므로, 등록 순서를 지키는지가
		// 판정되지 않는다.
		const subscriptions = [
			pat('p2', 'news.*'),
			ch('c2', 'news.art'),
			pat('p1', '*'),
			ch('c1', 'news.art'),
		];
		retrace(
			'배열을 한 번만 훑으면서 만들어지는 대로 담으면 p2가 c2보다 앞에 온다. ' +
				'채널 전달과 패턴 전달을 따로 모았다가 이어 붙여야 규정된 순서가 나온다. ' +
				'또한 결과를 식별자로 정렬하면 안 된다. 등록 순서는 그 자체로 규정된 정보다.',
			() => {
				expect(route(subscriptions, 'news.art', 'x').map((d) => `${d.type}:${d.subscriberId}`)).toEqual([
					'message:c2',
					'message:c1',
					'pmessage:p2',
					'pmessage:p1',
				]);
			},
		);
	});

	it('채널과 들어맞는 패턴에 모두 걸린 구독자는 두 번 받는다: 중복 제거는 오답이다', () => {
		const deliveries = route([ch('u1', 'foo'), pat('u1', 'f*')], 'foo', 'payload');
		retrace(
			'subscriberId로 중복을 제거하면 전달이 하나만 남는다. Redis는 이 경우 message 한 번과 ' +
				'pmessage 한 번, 모두 두 번을 밀어 넣는다. 이것은 결함이 아니라 규정된 동작이며, ' +
				'중복 제거는 받은 쪽에서 애플리케이션이 할 일이다.',
			() => {
				expect(deliveries).toHaveLength(2);
				expect(deliveries.map((d) => d.type)).toEqual(['message', 'pmessage']);
				expect(deliveries.map((d) => d.subscriberId)).toEqual(['u1', 'u1']);
				expect(deliveries.map((d) => d.pattern)).toEqual([undefined, 'f*']);
			},
		);
	});

	it('한 구독자가 들어맞는 패턴을 여럿 걸어 두면 패턴마다 전달이 하나씩 만들어진다', () => {
		const subscriptions = [pat('u1', 'news.*'), pat('u1', '*.art'), pat('u1', 'sports.*')];
		retrace(
			'들어맞는 패턴을 하나 찾자마자 다음 구독자로 넘어가면 전달이 하나만 남는다. ' +
				'패턴 구독은 등록된 것마다 독립적으로 판정하며, 어느 패턴 때문에 받았는지를 ' +
				'구별해야 하므로 합칠 수 없다.',
			() => {
				const deliveries = route(subscriptions, 'news.art', 'x');
				expect(deliveries).toHaveLength(2);
				expect(deliveries.map((d) => d.pattern)).toEqual(['news.*', '*.art']);
			},
		);
	});

	it('완전히 같은 구독 등록이 중복으로 들어오면 한 번만 센다', () => {
		const subscriptions = [ch('c1', 'foo'), ch('c1', 'foo'), pat('p1', 'f*'), pat('p1', 'f*')];
		retrace(
			'같은 클라이언트가 같은 채널로 SUBSCRIBE를 두 번 보내도 Redis에서는 한 번 구독한 것이다. ' +
				'배열을 그대로 훑으면 전달이 넷이 된다. 이것은 바로 앞 검사의 "두 번 받는다"와 다른 ' +
				'이야기다: 거기서는 구독의 종류가 서로 달랐고, 여기서는 등록이 완전히 같다.',
			() => {
				expect(route(subscriptions, 'foo', 'x')).toHaveLength(2);
			},
		);
	});

	it('채널 구독은 글로브를 해석하지 않고 이름을 문자 그대로 비교한다', () => {
		const subscriptions = [ch('c1', 'news.*')];
		retrace(
			'SUBSCRIBE는 패턴을 해석하지 않는다. 채널 구독까지 matchesPattern으로 판정하면 ' +
				'`news.*`를 구독한 클라이언트가 `news.art`의 메시지를 message 종류로 받게 되는데, ' +
				'그것은 Redis에 없는 동작이다. 패턴으로 받으려면 PSUBSCRIBE로 등록해야 한다.',
			() => {
				expect(route(subscriptions, 'news.art', 'x')).toEqual([]);
				expect(route(subscriptions, 'news.*', 'x')).toHaveLength(1);
			},
		);
	});

	it('들어맞는 구독이 하나도 없으면 빈 배열을 돌려준다', () => {
		expect(route([ch('c1', 'other'), pat('p1', 'sports.*')], 'news.art', 'x')).toEqual([]);
		expect(route([], 'news.art', 'x')).toEqual([]);
	});
});

describe('publishCount: PUBLISH가 돌려주는 숫자', () => {
	it('구독자의 수가 아니라 메시지를 밀어 넣은 대상의 수를 돌려준다', () => {
		retrace(
			'구독자를 세면 u1 한 명뿐이라 1이 나온다. PUBLISH가 돌려주는 숫자는 사람의 수도 아니고 ' +
				'메시지를 받아서 처리한 수도 아니라, 그 순간 메시지를 밀어 넣은 대상의 수다. ' +
				'이 구별이 "발행자는 누가 받았는지 알 수 없다"는 원리와 이어진다.',
			() => {
				expect(publishCount([ch('u1', 'foo'), pat('u1', 'f*')], 'foo')).toBe(2);
			},
		);
	});

	it('패턴 구독자도 함께 세므로, 채널을 직접 구독한 클라이언트가 없어도 0이 아니다', () => {
		const subscriptions = [pat('p1', 'news.*'), pat('p2', '*')];
		retrace(
			'채널 구독만 세면 0이 나오고, 발행자는 아무도 듣고 있지 않다고 판단하게 된다. ' +
				'패턴 구독자도 같은 메시지를 밀어 받는 대상이다.',
			() => {
				expect(publishCount(subscriptions, 'news.art')).toBe(2);
				expect(publishCount(subscriptions, 'sports.f1')).toBe(1);
			},
		);
	});

	it('언제나 route가 만드는 전달의 개수와 같다', () => {
		const subscriptions = [
			ch('c1', 'news.art'),
			ch('c1', 'news.art'),
			pat('c1', 'news.*'),
			pat('p2', '*.art'),
			ch('c3', 'news.music'),
			pat('p4', 'sports.*'),
		];
		retrace(
			'두 함수가 어긋나면 실제로 밀어 넣은 대상의 수와 발행자가 본 숫자가 달라진다. ' +
				'publishCount를 route와 따로 세는 것은 자유이지만, 중복 등록을 한 번만 세는 규칙과 ' +
				'채널과 패턴에 모두 걸리면 두 번 세는 규칙이 양쪽에 똑같이 적용되어야 한다.',
			() => {
				expect(publishCount(subscriptions, 'news.art')).toBe(3);
				expect(publishCount(subscriptions, 'news.art')).toBe(
					route(subscriptions, 'news.art', 'x').length,
				);
			},
		);
	});
});

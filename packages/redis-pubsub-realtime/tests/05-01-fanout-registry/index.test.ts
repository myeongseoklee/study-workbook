/**
 * 과제 05-01의 명세 — 팬아웃 레지스트리
 *
 * 이 파일이 과제의 정의다. `src/05-01-fanout-registry/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저이므로, docs/05-fanout-registry.md를 다시 읽어라.
 *
 * 실행: pnpm test 05-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { FanoutRegistry } from '../../src/05-01-fanout-registry';

/**
 * 레지스트리 하나와 콜백 기록장을 함께 만든다.
 *
 * `onSubscribe`와 `onUnsubscribe`는 실제 서비스에서 Redis에 SUBSCRIBE·UNSUBSCRIBE를
 * 보내는 자리이지만, 여기서는 호출된 채널을 배열에 밀어 넣기만 한다. 그래야 호출
 * 횟수와 순서를 그대로 검사할 수 있고, 시계나 네트워크가 개입하지 않으므로 결과가
 * 언제나 같게 나온다.
 */
function makeHarness(queueCapacity: number) {
	const subscribed: string[] = [];
	const unsubscribed: string[] = [];
	const registry = new FanoutRegistry({
		queueCapacity,
		onSubscribe: (channel: string) => {
			subscribed.push(channel);
		},
		onUnsubscribe: (channel: string) => {
			unsubscribed.push(channel);
		},
	});
	return { registry, subscribed, unsubscribed };
}

describe('FanoutRegistry — 참조 계수에 따른 구독과 해제', () => {
	it('첫 구독자가 등록될 때만 onSubscribe를 호출한다. 두 번째 구독자는 Redis에 아무것도 보내지 않는다', () => {
		const { registry, subscribed } = makeHarness(4);

		registry.register('room:1', 'c1');
		expect(subscribed).toEqual(['room:1']);

		registry.register('room:1', 'c2');
		retrace(
			'클라이언트가 접속할 때마다 SUBSCRIBE를 보내는 것이 강의가 안티패턴이라고 밝힌 구조다. ' +
				'프로세스는 채널마다 구독을 하나만 유지하고, 나머지는 프로세스 메모리 안에서 나누어 준다.',
			() => {
				expect(subscribed).toEqual(['room:1']);
			},
		);
	});

	it('구독자가 남아 있으면 해제하지 않는다. 먼저 해제하면 남은 클라이언트가 오류 없이 알림을 잃는다', () => {
		const { registry, unsubscribed } = makeHarness(4);
		registry.register('room:1', 'c1');
		registry.register('room:1', 'c2');

		registry.unregister('room:1', 'c1');

		retrace(
			'참조 계수를 세지 않고 해제하면 c2의 연결은 살아 있는데 메시지만 오지 않는다. ' +
				'예외도 로그도 남지 않기 때문에 이 결함은 조용히 틀리고, 나중에 찾기가 가장 비싸다.',
			() => {
				expect(unsubscribed).toEqual([]);
				expect(registry.channels()).toEqual(['room:1']);
				expect(registry.publish('room:1', 'hello').delivered).toEqual(['c2']);
			},
		);
	});

	it('마지막 구독자가 떠나는 순간에만 onUnsubscribe를 정확히 한 번 호출한다', () => {
		const { registry, unsubscribed } = makeHarness(4);
		registry.register('room:1', 'c1');
		registry.register('room:1', 'c2');

		registry.unregister('room:1', 'c1');
		registry.unregister('room:1', 'c2');

		expect(unsubscribed).toEqual(['room:1']);
		expect(registry.channels()).toEqual([]);
	});

	it('같은 클라이언트를 같은 채널에 두 번 등록해도 계수는 하나다. 한 번의 해제로 구독이 끊긴다', () => {
		const { registry, subscribed, unsubscribed } = makeHarness(4);

		registry.register('room:1', 'c1');
		registry.register('room:1', 'c1');
		expect(subscribed).toEqual(['room:1']);

		registry.unregister('room:1', 'c1');
		retrace(
			'중복 등록을 계수 2로 세면 클라이언트가 떠난 뒤에도 계수가 1로 남는다. ' +
				'그러면 아무도 듣지 않는 채널을 Redis가 계속 밀어 넣고, 그 낭비가 채널 수만큼 쌓인다.',
			() => {
				expect(unsubscribed).toEqual(['room:1']);
				expect(registry.channels()).toEqual([]);
			},
		);
	});

	it('해제는 몇 번을 호출해도 같은 결과다. 두 번째 호출은 오류를 던지지도, onUnsubscribe를 다시 부르지도 않는다', () => {
		const { registry, unsubscribed } = makeHarness(4);
		registry.register('room:1', 'c1');
		registry.unregister('room:1', 'c1');

		retrace(
			'클라이언트가 떠나는 경로는 연결 종료·오류·서버 종료로 여럿이고, 그 경로들이 겹쳐서 ' +
				'해제가 두 번 불리는 일이 실제로 일어난다. 두 번째 호출이 UNSUBSCRIBE를 한 번 더 ' +
				'보내면, 그 사이에 다시 접속한 클라이언트의 구독까지 끊어진다.',
			() => {
				expect(() => {
					registry.unregister('room:1', 'c1');
				}).not.toThrow();
				expect(unsubscribed).toEqual(['room:1']);
			},
		);
	});

	it('등록된 적 없는 채널이나 클라이언트로 해제해도 아무 일이 일어나지 않는다', () => {
		const { registry, unsubscribed } = makeHarness(4);
		registry.register('room:1', 'c1');

		expect(() => {
			registry.unregister('room:404', 'c1');
			registry.unregister('room:1', 'ghost');
		}).not.toThrow();

		expect(unsubscribed).toEqual([]);
		expect(registry.channels()).toEqual(['room:1']);
	});

	it('참조 계수는 채널마다 따로 유지된다. 한 채널이 비어도 다른 채널의 구독은 남는다', () => {
		const { registry, subscribed, unsubscribed } = makeHarness(4);
		registry.register('room:1', 'c1');
		registry.register('room:2', 'c1');
		registry.register('room:1', 'c2');

		registry.unregister('room:1', 'c1');
		registry.unregister('room:1', 'c2');

		retrace(
			'계수를 클라이언트마다 하나만 두면 c1이 room:1에서 빠질 때 room:2의 계수까지 함께 흔들린다. ' +
				'계수의 단위는 클라이언트가 아니라 채널이다.',
			() => {
				expect(subscribed).toEqual(['room:1', 'room:2']);
				expect(unsubscribed).toEqual(['room:1']);
				expect(registry.channels()).toEqual(['room:2']);
			},
		);
	});

	it('channels()는 지금 구독 중인 채널만 등록 순서대로 돌려준다', () => {
		const { registry } = makeHarness(4);
		registry.register('room:a', 'c1');
		registry.register('room:b', 'c1');
		registry.register('room:c', 'c1');

		registry.unregister('room:b', 'c1');
		expect(registry.channels()).toEqual(['room:a', 'room:c']);

		registry.register('room:b', 'c2');
		retrace(
			'등록한 채널을 배열에 계속 덧붙이기만 하면 해제된 채널이 목록에 남는다. ' +
				'channels()는 기록이 아니라 현재 구독 중인 채널을 돌려주어야 하고, ' +
				'다시 등록한 채널은 그 시점의 새 등록이므로 목록의 끝에 붙는다.',
			() => {
				expect(registry.channels()).toEqual(['room:a', 'room:c', 'room:b']);
			},
		);
	});
});

describe('FanoutRegistry — 채널별 팬아웃', () => {
	it('publish는 그 채널의 모든 클라이언트 큐에 넣고 delivered를 등록 순서로 돌려준다', () => {
		const { registry } = makeHarness(4);
		// 등록 순서가 클라이언트 id의 사전순과 어긋나 있다. delivered가 등록 순서를
		// 따르는지, 아니면 id로 정렬된 것인지를 이 배치가 가른다.
		registry.register('room:1', 'c2');
		registry.register('room:1', 'c3');
		registry.register('room:1', 'c1');

		const result = registry.publish('room:1', 'hello');

		retrace(
			'delivered는 구독자를 순회한 순서를 그대로 담는다. 구독자를 정렬하거나 순서를 ' +
				'보존하지 않는 자료 구조에 담으면, 어느 클라이언트까지 전달되었는지를 ' +
				'등록 순서로 따라갈 수 없게 된다.',
			() => {
				expect(result.delivered).toEqual(['c2', 'c3', 'c1']);
				expect(result.dropped).toEqual([]);
				expect(registry.pending('c3')).toBe(1);
			},
		);
	});

	it('다른 채널의 구독자에게는 전달하지 않는다', () => {
		const { registry } = makeHarness(4);
		registry.register('room:1', 'c1');
		registry.register('room:2', 'c2');

		const result = registry.publish('room:1', 'hello');

		expect(result.delivered).toEqual(['c1']);
		expect(registry.pending('c2')).toBe(0);
	});

	it('구독자가 없는 채널에 publish해도 오류를 던지지 않고 빈 결과를 돌려준다', () => {
		const { registry } = makeHarness(4);

		const result = registry.publish('room:empty', 'hello');

		retrace(
			'구독 루프는 자기가 구독을 건 채널의 메시지를 받는데, 마지막 클라이언트가 떠난 직후에 ' +
				'이미 날아온 메시지가 도착하는 구간이 있다. 그때 예외를 던지면 구독 루프 전체가 죽는다.',
			() => {
				expect(result.delivered).toEqual([]);
				expect(result.dropped).toEqual([]);
			},
		);
	});

	it('큐가 가득 찬 클라이언트가 있어도 나머지는 그대로 받는다. 이 성질이 팬아웃 레지스트리의 존재 이유다', () => {
		const { registry } = makeHarness(2);
		// 등록 순서를 일부러 c3 → c1 → c2로 잡는다. 클라이언트 id의 사전순과 어긋나야
		// 결과를 정렬해서 돌려주는 구현이 여기서 드러난다.
		registry.register('room:1', 'c3');
		registry.register('room:1', 'c1');
		registry.register('room:1', 'c2');
		registry.publish('room:1', 'm1');
		registry.publish('room:1', 'm2');
		registry.drain('c2'); // c2만 밀린 메시지를 모두 읽어 갔다

		const result = registry.publish('room:1', 'm3');

		retrace(
			'가득 찬 큐를 만났을 때 반복을 중단하거나 예외를 던지면, 느린 사용자 한 명이 ' +
				'나머지 모두의 알림을 막는다. 그러면 정석 구조로 옮긴 이득이 사라진다. ' +
				'또한 delivered와 dropped는 둘 다 등록 순서를 유지하므로, 먼저 등록한 c3가 ' +
				'c1보다 앞에 온다. 결과를 정렬하거나 집합에 담았다가 꺼내면 이 순서가 무너진다.',
			() => {
				expect(result.delivered).toEqual(['c2']);
				expect(result.dropped).toEqual(['c3', 'c1']);
			},
		);
	});

	it('중복 등록된 클라이언트에게도 메시지는 한 번만 간다', () => {
		const { registry } = makeHarness(4);
		registry.register('room:1', 'c1');
		registry.register('room:1', 'c1');

		const result = registry.publish('room:1', 'hello');

		expect(result.delivered).toEqual(['c1']);
		expect(registry.pending('c1')).toBe(1);
	});

	it('해제된 클라이언트에게는 더 이상 전달하지 않는다', () => {
		const { registry } = makeHarness(4);
		registry.register('room:1', 'c1');
		registry.register('room:1', 'c2');
		registry.unregister('room:1', 'c1');

		const result = registry.publish('room:1', 'hello');

		expect(result.delivered).toEqual(['c2']);
		expect(result.dropped).toEqual([]);
	});
});

describe('FanoutRegistry — 큐 정원의 경계', () => {
	it('정원까지는 받고, 정원을 넘어서는 첫 한 건부터 버린다', () => {
		const { registry } = makeHarness(3);
		registry.register('room:1', 'c1');

		retrace(
			'정원이 3이면 세 번째 메시지까지는 들어가고 네 번째부터 버려진다. ' +
				'부등호를 length > capacity로 쓰면 정원보다 한 건을 더 받아 네 번째가 전달되고, ' +
				'length >= capacity - 1로 쓰면 한 칸을 비워 둔 채로 버리기 시작해서 ' +
				'세 번째가 이미 dropped로 나온다. 어느 방향으로 어긋났는지는 몇 번째 ' +
				'publish에서 처음 갈라졌는지를 보고 판단하라.',
			() => {
				expect(registry.publish('room:1', 'm1').delivered).toEqual(['c1']);
				expect(registry.publish('room:1', 'm2').delivered).toEqual(['c1']);
				expect(registry.publish('room:1', 'm3').delivered).toEqual(['c1']);
				expect(registry.pending('c1')).toBe(3);

				const fourth = registry.publish('room:1', 'm4');
				expect(fourth.delivered).toEqual([]);
				expect(fourth.dropped).toEqual(['c1']);
				expect(registry.pending('c1')).toBe(3);
			},
		);
	});

	it('가득 찼을 때 버리는 것은 새 메시지이고, 가장 오래된 것을 밀어내지 않는다', () => {
		const { registry } = makeHarness(2);
		registry.register('room:1', 'c1');
		registry.publish('room:1', 'm1');
		registry.publish('room:1', 'm2');
		registry.publish('room:1', 'm3');

		retrace(
			'가장 오래된 것을 밀어내는 방식으로 만들면 drain 결과가 [m2, m3]가 된다. ' +
				'그 방식은 아직 읽지 않은 메시지를 소리 없이 덮어쓰기 때문에, 어떤 것을 잃었는지 ' +
				'dropped에도 남지 않는다. 이 명세는 새 메시지를 버리고 그 사실을 dropped로 알린다.',
			() => {
				expect(registry.drain('c1')).toEqual(['m1', 'm2']);
			},
		);
	});
});

describe('FanoutRegistry — 큐는 채널별이 아니라 클라이언트별이다', () => {
	it('한 클라이언트가 두 채널을 들으면 양쪽 메시지가 하나의 큐에 도착 순서대로 쌓인다', () => {
		const { registry } = makeHarness(3);
		registry.register('room:1', 'c1');
		registry.register('room:2', 'c1');

		registry.publish('room:1', 'a1');
		registry.publish('room:2', 'b1');
		registry.publish('room:1', 'a2');
		const overflow = registry.publish('room:2', 'b2');

		retrace(
			'큐를 채널마다 하나씩 만들면 정원이 사실상 채널 수만큼 늘어나서, 한 클라이언트가 ' +
				'붙잡는 메모리를 우리가 정한 값으로 묶을 수 없다. 정원 3은 그 클라이언트가 ' +
				'듣는 채널이 몇 개이든 그 클라이언트 전체에 걸리는 한도다.',
			() => {
				expect(registry.drain('c1')).toEqual(['a1', 'b1', 'a2']);
				expect(overflow.dropped).toEqual(['c1']);
			},
		);
	});

	it('drain은 넣은 순서대로 비우고, 다시 부르면 빈 배열이다', () => {
		const { registry } = makeHarness(4);
		registry.register('room:1', 'c1');
		registry.publish('room:1', 'm1');
		registry.publish('room:1', 'm2');

		expect(registry.drain('c1')).toEqual(['m1', 'm2']);
		expect(registry.drain('c1')).toEqual([]);
		expect(registry.pending('c1')).toBe(0);
	});

	it('모든 채널에서 해제되면 큐도 정리된다. 정리하지 않으면 오래 사는 프로세스에서 메모리가 샌다', () => {
		const { registry } = makeHarness(4);
		registry.register('room:1', 'c1');
		registry.publish('room:1', 'm1');
		registry.publish('room:1', 'm2');
		expect(registry.pending('c1')).toBe(2);

		registry.unregister('room:1', 'c1');

		retrace(
			'구독 목록에서만 지우고 큐를 그대로 두면, 떠난 클라이언트가 붙잡은 메시지가 ' +
				'프로세스가 살아 있는 동안 계속 남는다. 강의 샘플의 finally 절이 하던 정리를 ' +
				'이 구조에서는 레지스트리가 대신 책임진다.',
			() => {
				expect(registry.pending('c1')).toBe(0);
				expect(registry.drain('c1')).toEqual([]);
			},
		);
	});

	it('한 채널에서만 해제되고 다른 채널에 남아 있으면 큐는 유지된다', () => {
		const { registry } = makeHarness(4);
		registry.register('room:1', 'c1');
		registry.register('room:2', 'c1');
		registry.publish('room:1', 'a1');
		registry.publish('room:2', 'b1');

		registry.unregister('room:1', 'c1');

		retrace(
			'해제될 때마다 큐를 버리면, 아직 읽지 않은 다른 채널의 메시지까지 함께 사라진다. ' +
				'큐를 버리는 조건은 "한 채널에서 빠졌는가"가 아니라 "듣는 채널이 하나도 남지 않았는가"다.',
			() => {
				expect(registry.pending('c1')).toBe(2);
				expect(registry.drain('c1')).toEqual(['a1', 'b1']);
			},
		);
	});
});

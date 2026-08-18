// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/08-01-channel-policy/index.ts를 고쳐라.
//
// 발행-구독의 주인공은 발행자도 구독자도 아니라 **채널**이다. 옵저버와의 결정적 차이는
// 구독자가 대상을 알지 않는다는 것이고, 그래서 **생성 순서 문제가 사라진다.**
// 그리고 채널이 갖는 정책들 — 필터 · 팬아웃 · 발행자 노출 · 핫/콜드 — 이 "채널 매직"이다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import { Channel, type Delivered } from '../../src/08-01-channel-policy';

const received = () => {
	const got: Delivered[] = [];
	return { got, fn: (d: Delivered) => void got.push(d) };
};

describe('순서 문제가 없다 — 옵저버와 갈리는 지점', () => {
	it('발행자가 없어도 구독할 수 있다', () => {
		retrace(
			'옵저버는 subject를 알아야 구독하므로 subject가 먼저 존재해야 한다. ' +
				'엔터프라이즈에서는 대상이 나중에 태어나기 때문에 그 제약이 순서 문제를 만든다.',
			() => {
				const ch = new Channel();
				const a = received();
				expect(() => ch.subscribe('s1', a.fn)).not.toThrow();
				ch.publish('pub-1', { n: 1 });
				expect(a.got).toHaveLength(1);
			},
		);
	});

	it('구독자가 없을 때 발행해도 터지지 않는다', () => {
		const ch = new Channel();
		expect(() => ch.publish('pub-1', { n: 1 })).not.toThrow();
	});
});

describe('기본 전달', () => {
	it('모든 구독자에게 전달한다 (기본 팬아웃)', () => {
		const ch = new Channel();
		const a = received();
		const b = received();
		ch.subscribe('a', a.fn);
		ch.subscribe('b', b.fn);
		ch.publish('pub-1', { n: 1 });
		expect(a.got).toHaveLength(1);
		expect(b.got).toHaveLength(1);
	});

	it('페이로드를 그대로 전달한다', () => {
		const ch = new Channel();
		const a = received();
		ch.subscribe('a', a.fn);
		ch.publish('pub-1', { n: 7, tag: 'x' });
		expect(a.got[0]!.payload).toEqual({ n: 7, tag: 'x' });
	});

	it('구독을 해지하면 더 받지 않는다', () => {
		const ch = new Channel();
		const a = received();
		ch.subscribe('a', a.fn);
		ch.unsubscribe('a');
		ch.publish('pub-1', { n: 1 });
		expect(a.got).toEqual([]);
	});
});

describe('채널 매직 ① 발행자 노출 여부', () => {
	it('기본은 발행자를 알려준다', () => {
		const ch = new Channel();
		const a = received();
		ch.subscribe('a', a.fn);
		ch.publish('newspaper-1', { n: 1 });
		expect(a.got[0]!.publisher).toBe('newspaper-1');
	});

	it('anonymize를 켜면 발행자를 감춘다', () => {
		retrace(
			'네이버 메인이 신문사를 감추면 독자는 발행자를 모른다 — 이것도 채널의 결정이다. ' +
				'구독자 코드가 아니라 채널 설정이 이걸 정한다는 점이 요점이다.',
			() => {
				const ch = new Channel({ anonymize: true });
				const a = received();
				ch.subscribe('a', a.fn);
				ch.publish('newspaper-1', { n: 1 });
				expect(a.got[0]!.publisher).toBeNull();
			},
		);
	});
});

describe('채널 매직 ② 필터', () => {
	it('필터를 통과하지 못한 메시지는 아무에게도 가지 않는다', () => {
		const ch = new Channel({ filter: (p) => (p as { n: number }).n > 10 });
		const a = received();
		ch.subscribe('a', a.fn);
		ch.publish('pub-1', { n: 5 });
		ch.publish('pub-1', { n: 50 });
		expect(a.got.map((d) => (d.payload as { n: number }).n)).toEqual([50]);
	});

	it('필터에 걸린 메시지는 이력에도 남지 않는다', () => {
		retrace(
			'필터를 "전달 직전"에만 적용하면, 나중에 콜드로 참가한 구독자가 걸러진 메시지를 ' +
				'받게 된다. 채널이 받아들이지 않은 것은 없던 일이어야 한다.',
			() => {
				const ch = new Channel({ filter: (p) => (p as { n: number }).n > 10 });
				ch.publish('pub-1', { n: 5 });
				const late = received();
				ch.subscribe('late', late.fn, { replay: 'all' });
				expect(late.got).toEqual([]);
			},
		);
	});
});

describe('채널 매직 ③ 팬아웃 정책', () => {
	it('first — 먼저 등록한 한 명에게만 간다', () => {
		const ch = new Channel({ fanout: 'first' });
		const a = received();
		const b = received();
		ch.subscribe('a', a.fn);
		ch.subscribe('b', b.fn);
		ch.publish('pub-1', { n: 1 });
		expect(a.got).toHaveLength(1);
		expect(b.got).toHaveLength(0);
	});

	it('round-robin — 발행마다 다음 구독자에게 돌아간다', () => {
		retrace('작업 큐에서 부하를 나눌 때 쓰는 정책이다. 같은 메시지가 중복 처리되지 않는다', () => {
			const ch = new Channel({ fanout: 'round-robin' });
			const a = received();
			const b = received();
			ch.subscribe('a', a.fn);
			ch.subscribe('b', b.fn);
			ch.publish('p', { n: 1 });
			ch.publish('p', { n: 2 });
			ch.publish('p', { n: 3 });
			expect(a.got.map((d) => (d.payload as { n: number }).n)).toEqual([1, 3]);
			expect(b.got.map((d) => (d.payload as { n: number }).n)).toEqual([2]);
		});
	});

	it('round-robin은 구독 해지 후에도 남은 구독자에게 계속 돈다', () => {
		const ch = new Channel({ fanout: 'round-robin' });
		const a = received();
		const b = received();
		ch.subscribe('a', a.fn);
		ch.subscribe('b', b.fn);
		ch.publish('p', { n: 1 }); // a
		ch.unsubscribe('a');
		ch.publish('p', { n: 2 });
		ch.publish('p', { n: 3 });
		expect(b.got.map((d) => (d.payload as { n: number }).n)).toEqual([2, 3]);
	});
});

describe('채널 매직 ④ 핫/콜드', () => {
	it('기본은 핫 — 구독 이후 발행분만 받는다', () => {
		const ch = new Channel();
		ch.publish('p', { n: 1 });
		const a = received();
		ch.subscribe('a', a.fn);
		ch.publish('p', { n: 2 });
		expect(a.got.map((d) => (d.payload as { n: number }).n)).toEqual([2]);
	});

	it('replay: all — 태초부터 다시 받는다', () => {
		const ch = new Channel();
		ch.publish('p', { n: 1 });
		ch.publish('p', { n: 2 });
		const a = received();
		ch.subscribe('a', a.fn, { replay: 'all' });
		expect(a.got.map((d) => (d.payload as { n: number }).n)).toEqual([1, 2]);
	});

	it('replay: 숫자 — 최근 N개만 받는다', () => {
		const ch = new Channel();
		for (const n of [1, 2, 3, 4]) ch.publish('p', { n });
		const a = received();
		ch.subscribe('a', a.fn, { replay: 2 });
		expect(a.got.map((d) => (d.payload as { n: number }).n)).toEqual([3, 4]);
	});

	it('콜드로 받은 것도 발행자 노출 정책을 따른다', () => {
		const ch = new Channel({ anonymize: true });
		ch.publish('newspaper-1', { n: 1 });
		const a = received();
		ch.subscribe('a', a.fn, { replay: 'all' });
		expect(a.got[0]!.publisher).toBeNull();
	});

	it('replay가 팬아웃 정책을 건드리지 않는다', () => {
		retrace(
			'콜드 재생은 "그 구독자 한 명에게 과거를 보내주는 것"이다. ' +
				'round-robin 커서를 움직이면 이후 실시간 분배 순서가 어긋난다.',
			() => {
				const ch = new Channel({ fanout: 'round-robin' });
				ch.publish('p', { n: 1 });
				const a = received();
				const b = received();
				ch.subscribe('a', a.fn, { replay: 'all' });
				ch.subscribe('b', b.fn);
				ch.publish('p', { n: 2 });
				// a는 과거(1) + 실시간 첫 차례(2), b는 아직 없음
				expect(a.got.map((d) => (d.payload as { n: number }).n)).toEqual([1, 2]);
				expect(b.got).toEqual([]);
			},
		);
	});
});

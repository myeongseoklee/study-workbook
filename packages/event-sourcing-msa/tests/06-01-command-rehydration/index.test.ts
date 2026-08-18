// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/06-01-command-rehydration/index.ts를 고쳐라.
//
// 이벤트 소싱의 애그리게이트 루트는 커맨드 패턴의 Invoker다. 재수화가 성립하려면
// **현재 상태가 오직 커맨드의 적용 결과**여야 하고, 그래서 입구가 하나로 좁혀진다.
// 이 과제에서 가장 자주 깨지는 곳은 **리플레이 중에 커맨드를 다시 쌓는 것**이다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import { Cart, type CartCommand } from '../../src/06-01-command-rehydration';

const add = (productNo: string, qty = 1): CartCommand => ({ kind: 'add', productNo, qty });
const remove = (productNo: string): CartCommand => ({ kind: 'remove', productNo });

describe('on — 커맨드가 유일한 입구다', () => {
	it('add를 적용하면 상태가 바뀐다', () => {
		const c = new Cart();
		expect(c.on(add('A'))).toBe(true);
		expect(c.items).toEqual([{ productNo: 'A', qty: 1 }]);
	});

	it('같은 상품을 다시 add하면 수량이 올라간다', () => {
		const c = new Cart();
		c.on(add('A', 2));
		c.on(add('A', 3));
		expect(c.items).toEqual([{ productNo: 'A', qty: 5 }]);
	});

	it('모르는 커맨드는 무시하고 false를 준다 — 던지지 않는다', () => {
		retrace(
			'이벤트 스토어에는 이 애그리게이트가 모르는 이벤트도 섞여 있을 수 있다. ' +
				'던지면 재수화가 그 지점에서 멈춘다.',
			() => {
				const c = new Cart();
				expect(c.on({ kind: 'unknown' } as never)).toBe(false);
				expect(c.items).toEqual([]);
			},
		);
	});
});

describe('불변식 — 애그리게이트 루트가 진다', () => {
	it('remove는 아이템이 2개 이상일 때만 지운다 (하나는 남긴다)', () => {
		const c = new Cart();
		c.on(add('A'));
		c.on(add('B'));
		expect(c.on(remove('A'))).toBe(true);
		expect(c.items.map((i) => i.productNo)).toEqual(['B']);
	});

	it('마지막 하나는 지울 수 없다', () => {
		const c = new Cart();
		c.on(add('A'));
		expect(c.on(remove('A'))).toBe(false);
		expect(c.items).toHaveLength(1);
	});

	it('없는 상품을 remove하면 false다', () => {
		const c = new Cart();
		c.on(add('A'));
		c.on(add('B'));
		expect(c.on(remove('Z'))).toBe(false);
		expect(c.items).toHaveLength(2);
	});

	it('실패한 커맨드는 기록되지 않는다', () => {
		retrace(
			'적용되지 않은 커맨드를 로그에 남기면 재수화 때 그것이 다시 시도되고, ' +
				'그때는 조건이 달라 성공할 수도 있다 — 상태가 갈린다.',
			() => {
				const c = new Cart();
				c.on(add('A'));
				c.on(remove('A')); // 실패
				expect(c.save()).toHaveLength(1);
			},
		);
	});
});

describe('save — 넘기고 비운다', () => {
	it('적용된 커맨드들을 순서대로 준다', () => {
		const c = new Cart();
		c.on(add('A'));
		c.on(add('B'));
		expect(c.save().map((x) => x.kind)).toEqual(['add', 'add']);
	});

	it('save 후에는 내부 커맨드가 비워진다 (플러시)', () => {
		const c = new Cart();
		c.on(add('A'));
		c.save();
		expect(c.save()).toEqual([]);
	});

	it('넘긴 배열을 외부에서 고쳐도 내부에 영향이 없다', () => {
		const c = new Cart();
		c.on(add('A'));
		const dumped = c.save();
		dumped.push(add('X'));
		c.on(add('B'));
		expect(c.save()).toHaveLength(1);
	});

	it('save는 상태를 바꾸지 않는다', () => {
		const c = new Cart();
		c.on(add('A'));
		c.save();
		expect(c.items).toEqual([{ productNo: 'A', qty: 1 }]);
	});
});

describe('restore — 빈 객체에만 가능하다', () => {
	it('커맨드 목록으로 상태를 복원한다', () => {
		const c = new Cart();
		expect(c.restore([add('A', 2), add('B'), remove('A')])).toBe(true);
		expect(c.items.map((i) => i.productNo)).toEqual(['B']);
	});

	it('이미 커맨드가 쌓인 객체에는 복원할 수 없다', () => {
		retrace(
			'복원은 "이 객체가 아직 아무 일도 겪지 않았다"를 전제한다. ' +
				'이미 상태가 있으면 그것은 새 객체가 아니고, 섞으면 어느 쪽이 진실인지 알 수 없다.',
			() => {
				const c = new Cart();
				c.on(add('A'));
				expect(c.restore([add('B')])).toBe(false);
				expect(c.items.map((i) => i.productNo)).toEqual(['A']);
			},
		);
	});

	it('빈 목록으로 복원하면 성공하고 상태는 빈 채로 남는다', () => {
		const c = new Cart();
		expect(c.restore([])).toBe(true);
		expect(c.items).toEqual([]);
	});

	it('복원은 예외를 던지지 않고 boolean으로 알린다', () => {
		const c = new Cart();
		c.on(add('A'));
		expect(() => c.restore([add('B')])).not.toThrow();
	});
});

describe('리플레이 — 이 과제의 핵심', () => {
	it('복원 중 적용한 커맨드는 다시 쌓이지 않는다', () => {
		retrace(
			'리플레이 중에 커맨드를 쌓으면 다음 save에서 **같은 이벤트가 두 번** 저장된다. ' +
				'그러면 그다음 재수화에서 add가 두 번 적용돼 수량이 배로 늘어난다 — ' +
				'이벤트 로그가 스스로를 오염시키는 지점이다.',
			() => {
				const c = new Cart();
				c.restore([add('A'), add('B')]);
				expect(c.save()).toEqual([]);
			},
		);
	});

	it('복원 후 새로 받은 커맨드는 정상적으로 쌓인다', () => {
		const c = new Cart();
		c.restore([add('A')]);
		c.on(add('B'));
		expect(c.save().map((x) => x.kind)).toEqual(['add']);
	});

	it('복원 → 저장 → 재복원을 거쳐도 상태가 같다 (왕복 무손실)', () => {
		retrace('이 성질이 깨지면 이벤트 소싱 자체가 성립하지 않는다', () => {
			const origin = new Cart();
			origin.on(add('A', 2));
			origin.on(add('B'));
			origin.on(add('A', 1));
			const log = origin.save();

			const restored = new Cart();
			restored.restore(log);
			expect(restored.items).toEqual(origin.items);

			// 복원된 것에서 다시 저장해도 새 커맨드가 없다
			expect(restored.save()).toEqual([]);
		});
	});

	it('복원이 끝나면 리플레이 모드가 꺼진다', () => {
		const c = new Cart();
		c.restore([add('A')]);
		c.on(add('B'));
		c.on(remove('A'));
		// 복원 후의 두 커맨드만 쌓여 있어야 한다
		expect(c.save()).toHaveLength(2);
	});
});

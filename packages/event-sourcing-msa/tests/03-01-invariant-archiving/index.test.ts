// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/03-01-invariant-archiving/index.ts를 고쳐라.
//
// 애그리게이트 메서드의 일반적 구현 절차를 만든다 —
//   사본을 떠서 → 로직을 전개하고 → 불변식을 검사한 뒤 → 통과하면 원본에 반영.
// 강의자가 "아카이빙"이라 부른 구조다. 핵심은 **실패했을 때 원본이 손상되지 않는 것**이고,
// 그것이 애그리게이트가 트랜잭션 일관성을 보장한다는 말의 실제 내용이다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import { Aggregate, type Invariant } from '../../src/03-01-invariant-archiving';

/** 장바구니 — 03장의 예시를 최소로 줄인 것. */
interface CartState {
	items: { productNo: string; qty: number }[];
	coupon: string | null;
}

const atLeastOneItem: Invariant<CartState> = {
	name: 'at-least-one-item',
	check: (s) => s.items.length >= 1,
};
const qtyPositive: Invariant<CartState> = {
	name: 'qty-positive',
	check: (s) => s.items.every((i) => i.qty > 0),
};
const couponNeedsTwoItems: Invariant<CartState> = {
	name: 'coupon-needs-two-items',
	check: (s) => s.coupon === null || s.items.length >= 2,
};

function cart(over: Partial<CartState> = {}) {
	const init: CartState = { items: [{ productNo: 'A', qty: 1 }], coupon: null, ...over };
	return new Aggregate(init, [atLeastOneItem, qtyPositive, couponNeedsTwoItems]);
}

describe('생성 시점', () => {
	it('초기 상태가 불변식을 만족하면 생성된다', () => {
		expect(cart().state.items).toHaveLength(1);
	});

	it('초기 상태가 불변식을 위반하면 생성 자체가 실패한다', () => {
		retrace(
			'불변식은 "어떤 순간에도" 어긋나면 안 된다 — 생성 직후도 그 순간에 포함된다. ' +
				'여기를 열어 두면 위반 상태로 태어난 객체가 이후 모든 검사를 통과해 버린다.',
			() => {
				expect(() => new Aggregate<CartState>({ items: [], coupon: null }, [atLeastOneItem])).toThrow(
					/at-least-one-item/,
				);
			},
		);
	});

	it('state는 읽을 수 있다', () => {
		expect(cart().state.coupon).toBeNull();
	});
});

describe('mutate — 성공 경로', () => {
	it('변경이 불변식을 만족하면 반영된다', () => {
		const c = cart();
		const r = c.mutate((s) => {
			s.items.push({ productNo: 'B', qty: 2 });
		});
		expect(r.ok).toBe(true);
		expect(c.state.items.map((i) => i.productNo)).toEqual(['A', 'B']);
	});

	it('성공하면 위반 목록이 비어 있다', () => {
		const c = cart();
		expect(c.mutate((s) => void s.items.push({ productNo: 'B', qty: 1 })).violations).toEqual([]);
	});
});

describe('mutate — 실패하면 원본이 그대로여야 한다', () => {
	it('불변식을 위반하면 반영하지 않는다', () => {
		const c = cart();
		const r = c.mutate((s) => {
			s.items = [];
		});
		expect(r.ok).toBe(false);
		expect(c.state.items).toHaveLength(1);
	});

	it('변경 도중 여러 필드를 건드렸어도 전부 되돌아간다', () => {
		retrace(
			'사본을 뜨지 않고 원본을 직접 고치다가 검사에서 실패하면, 이미 반쯤 바뀐 상태가 남는다. ' +
				'그것이 "중간 과정도 일관되어야 한다"는 트랜잭션 일관성이 깨지는 지점이다.',
			() => {
				const c = cart();
				c.mutate((s) => {
					s.coupon = 'SALE'; // 이것만 보면 통과지만
					s.items = []; // 이것 때문에 전체가 실패한다
				});
				expect(c.state.coupon).toBeNull();
				expect(c.state.items).toHaveLength(1);
			},
		);
	});

	it('위반한 불변식의 이름을 모두 보고한다 — 첫 실패에서 멈추지 않는다', () => {
		const c = cart();
		const r = c.mutate((s) => {
			s.items = [{ productNo: 'A', qty: 0 }];
			s.coupon = 'SALE';
		});
		// qty-positive(0) · coupon-needs-two-items(1개뿐) 둘 다 위반
		expect(r.violations.sort()).toEqual(['coupon-needs-two-items', 'qty-positive']);
	});

	it('mutate 안에서 예외가 나도 원본은 그대로다', () => {
		retrace('로직 자체가 터진 경우와 불변식 위반은 다른 사건이지만, 원본 보존이라는 결과는 같아야 한다', () => {
			const c = cart();
			const r = c.mutate(() => {
				throw new Error('boom');
			});
			expect(r.ok).toBe(false);
			expect(r.violations).toEqual(['<error>']);
			expect(c.state.items).toHaveLength(1);
		});
	});
});

describe('사본 격리 — 얕은 복사로는 통과할 수 없다', () => {
	it('실패한 mutate가 중첩 객체를 오염시키지 않는다', () => {
		retrace(
			'`{...state}`는 items 배열의 참조를 공유한다. 그러면 사본의 items를 건드린 것이 원본에도 ' +
				'반영돼, 검사에서 실패해도 이미 원본이 바뀐 상태가 된다. 깊은 복사가 필요하다.',
			() => {
				const c = cart();
				c.mutate((s) => {
					s.items[0]!.qty = 0; // 중첩 객체의 필드를 직접 수정 → qty-positive 위반
				});
				expect(c.state.items[0]!.qty).toBe(1);
			},
		);
	});

	it('성공한 mutate의 결과도 외부 참조와 분리돼 있다', () => {
		const c = cart();
		const leaked: CartState[] = [];
		c.mutate((s) => {
			leaked.push(s);
			s.items.push({ productNo: 'B', qty: 1 });
		});
		// mutate에 넘겨준 사본을 나중에 건드려도 애그리게이트 상태는 변하지 않아야 한다
		leaked[0]!.items.push({ productNo: 'C', qty: 9 });
		expect(c.state.items).toHaveLength(2);
	});
});

describe('불변식 목록', () => {
	it('불변식이 없으면 어떤 변경도 통과한다', () => {
		const bare = new Aggregate<CartState>({ items: [], coupon: null }, []);
		expect(bare.mutate((s) => void (s.coupon = 'X')).ok).toBe(true);
		expect(bare.state.coupon).toBe('X');
	});

	it('모든 mutate에 전체 불변식이 적용된다', () => {
		retrace(
			'메서드별로 필요한 불변식만 고르는 것이 이론적으로 맞지만, 실무 구현은 귀찮아서 ' +
				'전체를 적용한다. 그리고 그 편이 우회 경로를 남기지 않는다.',
			() => {
				const c = cart({ items: [{ productNo: 'A', qty: 1 }, { productNo: 'B', qty: 1 }] });
				// 쿠폰과 무관한 변경인데도 coupon 불변식이 함께 검사된다
				const r = c.mutate((s) => {
					s.coupon = 'SALE';
					s.items.pop();
				});
				expect(r.ok).toBe(false);
				expect(r.violations).toContain('coupon-needs-two-items');
			},
		);
	});
});

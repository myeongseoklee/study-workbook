/**
 * 과제 03-01 — 애그리게이트 불변식 아카이빙
 *
 * 애그리게이트 메서드의 일반적 구현 절차를 만든다:
 *   **사본을 떠서 → 로직을 전개하고 → 불변식을 검사한 뒤 → 통과하면 원본에 반영.**
 *
 * 핵심은 실패했을 때 **원본이 손상되지 않는 것**이고, 그것이 "애그리게이트가 트랜잭션
 * 일관성을 보장한다"는 말의 실제 내용이다.
 *
 * 명세:  tests/03-01-invariant-archiving/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test 03-01
 * 막히면: docs/03-aggregate-and-invariant.md § 불변식을 코드에서 어디에 두나
 */

/** 도메인에서 발견된 규칙 하나. 이름은 위반 보고에 쓰인다. */
export interface Invariant<S> {
	name: string;
	/** 이 상태가 규칙을 만족하는가 */
	check: (state: S) => boolean;
}

export interface MutateResult {
	ok: boolean;
	/** 위반한 불변식의 이름들. 로직이 예외를 던졌으면 `['<error>']` */
	violations: string[];
}

export class Aggregate<S> {
	/**
	 * 초기 상태가 불변식을 위반하면 **생성 자체가 실패한다.**
	 * 위반한 이름을 담은 에러를 던져라 — 불변식은 "어떤 순간에도" 지켜져야 하고
	 * 생성 직후도 그 순간이다.
	 */
	constructor(initial: S, invariants: Invariant<S>[]) {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Aggregate constructor');
	}

	/** 현재 상태. 외부에서 읽을 수 있다. */
	get state(): S {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: state');
	}

	/**
	 * 상태를 바꾸려 시도한다.
	 *
	 * 힌트 셋:
	 *   ① `mutate`에 넘기는 것은 **사본**이다. `{...state}`로는 부족하다 — 중첩 객체의
	 *      참조가 공유되면 실패해도 원본이 이미 바뀐다
	 *   ② 검사는 **전체 불변식**에 대해 하고, 위반한 이름을 **모두** 모은다
	 *   ③ 로직이 예외를 던져도 원본은 그대로여야 한다
	 */
	mutate(fn: (draft: S) => void): MutateResult {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: mutate');
	}
}

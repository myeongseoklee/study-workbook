/**
 * 참고 구현 — 애그리게이트 불변식 아카이빙.
 *
 * 판정은 tests/03-01-invariant-archiving/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/03-aggregate-and-invariant.md
 */

export interface Invariant<S> {
	name: string;
	check: (state: S) => boolean;
}

export interface MutateResult {
	ok: boolean;
	violations: string[];
}

/**
 * 깊은 복사. `structuredClone`이 있으면 그것을 쓰고, 없으면 JSON 왕복으로 떨어진다.
 *
 * 얕은 복사(`{...state}`)로는 이 과제가 성립하지 않는다 — 중첩 배열·객체의 참조가
 * 공유되면 사본을 고친 것이 원본에 반영되고, 검사에서 실패해도 이미 늦는다.
 */
function clone<S>(v: S): S {
	if (typeof structuredClone === 'function') return structuredClone(v);
	return JSON.parse(JSON.stringify(v)) as S;
}

export class Aggregate<S> {
	#state: S;
	#invariants: Invariant<S>[];

	/**
	 * 생성 시점에도 검사한다. 여기를 열어 두면 위반 상태로 태어난 객체가 이후 모든
	 * 검사를 통과해 버린다 — 불변식이 "어떤 순간에도" 지켜진다는 정의가 무너진다.
	 */
	constructor(initial: S, invariants: Invariant<S>[]) {
		this.#invariants = [...invariants];
		const bad = this.#violationsOf(initial);
		if (bad.length > 0) {
			throw new Error(`불변식 위반으로 생성할 수 없다: ${bad.join(', ')}`);
		}
		this.#state = clone(initial);
	}

	/** 외부가 내부 상태를 직접 고치지 못하게 사본을 준다. */
	get state(): S {
		return clone(this.#state);
	}

	#violationsOf(candidate: S): string[] {
		// 첫 위반에서 멈추지 않는다 — 한 번에 고칠 것을 다 알려주는 편이 왕복을 줄인다.
		return this.#invariants.filter((inv) => !inv.check(candidate)).map((inv) => inv.name);
	}

	/**
	 * 사본 → 로직 → 검사 → 반영. 이 순서가 전부다.
	 *
	 * 예외를 잡아 `<error>`로 보고하는 이유: 로직이 터진 것과 불변식 위반은 다른 사건이지만
	 * **원본 보존이라는 결과는 같아야** 한다. 호출자는 둘을 구별할 수 있어야 하므로 이름을 남긴다.
	 */
	mutate(fn: (draft: S) => void): MutateResult {
		const draft = clone(this.#state);
		try {
			fn(draft);
		} catch {
			return { ok: false, violations: ['<error>'] };
		}
		const violations = this.#violationsOf(draft);
		if (violations.length > 0) return { ok: false, violations };
		// 여기서만 원본이 바뀐다. draft를 다시 복사하는 이유는 호출자가 draft 참조를
		// 들고 있다가 나중에 고치는 경우를 막기 위해서다.
		this.#state = clone(draft);
		return { ok: true, violations: [] };
	}
}

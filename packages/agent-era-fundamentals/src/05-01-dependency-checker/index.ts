/**
 * 과제 05-01 — 의존 규칙 체커
 *
 * 명세는 `tests/05-01-dependency-checker/index.test.ts`다.
 * 배경은 docs/05-module-structure-as-leverage.md.
 *
 * 밥이 만든 것과 같은 종류의 도구다. 어느 모듈이 어느 모듈에 의존해도 되는지를
 * 명세에 적어 두면, 체커가 실제 의존과 대조해 위반을 잡아낸다. 문서에 "레이어를
 * 지켜라"라고 적는 대신 **지켜졌는지를 기계가 판정하게** 만드는 것이다.
 *
 * 소스 코드를 파싱하지 않는다. 의존 그래프는 이미 추출된 상태로 주어진다.
 *
 * 실행: pnpm --filter agent-era-fundamentals test 05-01
 */

/** 허용된 의존을 적어 둔 명세. 여기 없는 의존은 전부 위반이다. */
export interface DependencySpec {
	/** 이 시스템에 존재한다고 선언된 모듈 전부 */
	modules: string[];
	/** 허용된 의존 관계. `[의존하는 쪽, 의존받는 쪽]` */
	allowed: Array<[from: string, to: string]>;
}

/** 실제로 추출된 의존. 키가 모듈, 값이 그 모듈이 의존하는 모듈들이다. */
export type DependencyGraph = Record<string, string[]>;

export type ViolationKind =
	/** 명세에 없는 모듈이 그래프에 나타났다 */
	| 'unknown-module'
	/** 모듈이 자기 자신에 의존한다 */
	| 'self-dependency'
	/** 두 모듈 다 명세에 있지만 이 의존은 허용되지 않았다 */
	| 'not-allowed';

export interface Violation {
	from: string;
	to: string;
	kind: ViolationKind;
}

/**
 * 명세와 실제 그래프를 대조해 위반을 모은다.
 *
 * 판정 순서가 중요하다. 모르는 모듈이 끼어 있으면 허용 여부를 따지는 것 자체가
 * 무의미하므로 `unknown-module`을 먼저 판정하고, 그다음 `self-dependency`,
 * 마지막에 `not-allowed`를 본다. 한 의존은 **하나의 위반만** 낳는다.
 *
 * 결과는 `from`의 사전순, 같으면 `to`의 사전순으로 정렬한다.
 */
export function checkDependencies(spec: DependencySpec, graph: DependencyGraph): Violation[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: checkDependencies');
}

/**
 * 그래프에서 순환 의존을 전부 찾는다.
 *
 * 각 순환은 `['a', 'b', 'c']` 형태이고 a에서 b, b에서 c, c에서 다시 a로 돌아오는
 * 관계를 뜻한다. **시작점을 끝에 반복하지 않는다.** 같은 순환이 여러 표현을 갖지
 * 않도록 두 가지를 지킨다.
 *
 * 1. 각 순환은 **사전순으로 가장 작은 모듈에서 시작**하도록 회전시킨다
 * 2. 순환 목록은 첫 원소부터 차례로 비교해 사전순으로 정렬하고, 앞부분이 모두
 *    같으면 짧은 것이 먼저다
 *
 * 자기 자신에 의존하는 모듈은 길이 1의 순환(`['a']`)이다.
 */
export function findCycles(graph: DependencyGraph): string[][] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: findCycles');
}

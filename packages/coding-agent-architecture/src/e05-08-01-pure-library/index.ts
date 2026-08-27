/**
 * 과제 e05-08-01 — 순수 라이브러리 판별식
 *
 * 8장의 한 줄이 이 과제다 —
 *   "순수 라이브러리의 판별식은 '의존성이 전부 외부인가'다. 사내 패키지를
 *    하나라도 물면 그 코드는 이미 그 제품에 묶여 있다."
 *
 * 그리고 8장이 함께 준 구분이 판정의 기준이다 —
 *   "도메인이 붙은 애들은 apps에 실제로 그런 앱이 존재하고, 이 앱에 있는
 *    코어 로직을 packages에서 관리한다. 근데 그에 비해 agent는 순수한 라이브러리다."
 *
 * 즉 워크스페이스 안이라고 다 문제가 아니다. 문제는 **특정 앱에 묶인 패키지**에
 * 닿는 것이다. 그리고 그 닿음은 대개 **직접이 아니라 전이로** 일어난다 —
 * 공용처럼 보이는 유틸이 도메인 하나를 물고 있는 식이다.
 *
 * 7장이 이 판별식을 쓰는 이유를 준다: "인프라는 영원히 재사용"이라는 주장은
 * **의견이 아니라 의존성 그래프가 증명해야 한다.**
 *
 * 명세:  tests/e05-08-01-pure-library/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e05-08-01
 * 막히면: docs/ep05-broker-infra/08-implementation-shape.md · 07-infra-as-fixed-asset.md
 */

/** 워크스페이스 안의 패키지 하나. */
export interface PackageNode {
	name: string;
	/**
	 * 이 패키지가 특정 앱에 묶여 있으면 그 앱 이름, 아니면 null.
	 * 묶여 있다는 것은 "그 앱이 없으면 의미가 없다"는 뜻이다.
	 */
	boundTo: string | null;
	/** 의존하는 것들. 워크스페이스 안팎이 섞여 있다. */
	dependencies: string[];
}

/** 판별 결과. */
export interface PurityVerdict {
	name: string;
	/** 앱에 묶인 패키지에 하나도 닿지 않으면 true. */
	pure: boolean;
	/**
	 * 순수하지 않은 이유 — 이 패키지에서 **묶인 패키지에 닿는 가장 짧은 경로.**
	 * 자기 자신부터 시작해 도달한 묶인 패키지에서 끝난다. 순수하면 빈 배열이다.
	 *
	 * 예: `['agent', 'vibe-domain']`            — 직접 물었다
	 *     `['agent', 'fmt-utils', 'vibe-domain']` — 공용처럼 보이는 유틸을 통해 전이로 닿았다
	 *
	 * 여러 경로가 있으면 **더 짧은 것**, 길이가 같으면 **의존 배열 순서상 먼저
	 * 발견되는 것**을 고른다.
	 */
	via: string[];
}

/**
 * 워크스페이스 안의 패키지 이름 집합.
 *
 * 힌트: 이 집합에 없는 이름은 전부 외부 의존이다. 외부는 그래프가 없으므로
 *       거기서 탐색이 끊긴다 — **알 수 없는 것은 외부로 본다**가 이 판별식의 전제다.
 */
export function internalNames(packages: PackageNode[]): Set<string> {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: internalNames');
}

/**
 * 한 패키지가 순수 라이브러리인지 판정한다.
 *
 * 규칙:
 *  - **앱에 묶인 패키지**에 직접이든 전이든 닿으면 순수하지 않다
 *  - 묶이지 않은 워크스페이스 패키지를 통과하는 것은 문제가 아니다 — 계속 따라간다
 *  - **대상 자신이 묶여 있으면** 순수하지 않고, `via`는 자기 이름 하나짜리 배열이다
 *  - 순환 의존이 있어도 무한 루프에 빠지지 않아야 한다
 *  - 워크스페이스에 없는 이름은 외부다. 더 따라가지 않는다
 *  - 워크스페이스에 없는 대상을 물으면 `pure: true`, `via: []`로 돌려준다
 */
export function classify(target: string, packages: PackageNode[]): PurityVerdict {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: classify');
}

/** 워크스페이스 전체를 판정한다. 입력 순서를 유지한다. */
export function audit(packages: PackageNode[]): PurityVerdict[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: audit');
}

/**
 * "이 패키지를 순수하게 만들려면 무엇을 끊어야 하는가."
 *
 * 대상이 **직접 물고 있는 워크스페이스 의존들** 중, 그것을 통해 묶인 패키지에
 * 닿게 되는 것만 돌려준다. 의존 배열 순서를 유지하고 중복은 제거한다.
 *
 * 힌트: 직접 의존 하나를 잘라 냈을 때 순수해지는가를 묻는 것이므로,
 *       **그 의존 자체가 순수한지**를 다시 물어보면 된다.
 */
export function offendingEdges(target: string, packages: PackageNode[]): string[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: offendingEdges');
}

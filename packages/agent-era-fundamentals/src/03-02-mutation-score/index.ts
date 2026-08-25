/**
 * 과제 03-02 — 뮤테이션 분석기
 *
 * 명세는 `tests/03-02-mutation-score/index.test.ts`다. 배경은 docs/03-revived-quality-tools.md.
 *
 * 이 과제도 소스 코드를 파싱하지 않는다. 변이 대상은 이미 추출된 목록으로
 * 주어진다. 여기서 다루는 것은 **살아남은 변종을 어떤 기준으로 가려내고
 * 그것을 어떻게 점수로 옮기는가**다.
 *
 * 실행: pnpm --filter agent-era-fundamentals test 03-02
 */

/** 변이 가능한 연산자. */
export type Operator = '<' | '<=' | '>' | '>=' | '==' | '!=' | '+' | '-';

/**
 * 변이 규칙. 각 연산자를 무엇으로 바꿀지, **이 순서대로** 정한다.
 *
 * 관계 연산자는 둘씩 짝지어져 있는데 하나는 경계를 옮기고(`<` → `<=`)
 * 다른 하나는 방향을 뒤집는다(`<` → `>=`). 경계 조건만 검사하는 테스트와
 * 방향만 검사하는 테스트가 각각 다른 변종을 놓치기 때문이다.
 */
export const MUTATIONS: Readonly<Record<Operator, readonly Operator[]>> = {
	'<': ['<=', '>='],
	'<=': ['<', '>'],
	'>': ['>=', '<='],
	'>=': ['>', '<'],
	'==': ['!='],
	'!=': ['=='],
	'+': ['-'],
	'-': ['+'],
} as const;

/** 소스에서 이미 추출된 변이 대상 하나. */
export interface MutationTarget {
	/** 위치 식별자. 예: `validateAge:12` */
	id: string;
	operator: Operator;
}

/** 원본 하나를 한 번 바꾼 결과. */
export interface Mutant {
	/** `${targetId}~${mutated}` 형식 */
	id: string;
	targetId: string;
	original: Operator;
	mutated: Operator;
}

/**
 * 그 변종을 넣고 테스트 스위트를 돌린 결과.
 *
 * `'fail'`은 테스트가 변경을 **잡아냈다**는 뜻이다. 변종이 죽었고 테스트가 제 일을 했다.
 * `'pass'`는 코드를 바꿨는데도 아무 테스트가 항의하지 않았다는 뜻이다. 변종이 살아남았다.
 */
export type TestOutcome = 'pass' | 'fail';

export interface MutationReport {
	/** 죽은 변종의 id. 입력 변종의 생성 순서를 유지한다 */
	killed: string[];
	/** 살아남은 변종의 id. 같은 순서 규칙 */
	survived: string[];
	/** 테스트 결과가 없어 판정하지 못한 변종의 id */
	notRun: string[];
	/**
	 * killed / (killed + survived). 판정하지 못한 것은 분모에 넣지 않는다.
	 * 판정된 변종이 하나도 없으면 `null`이다 — 0점과 "잴 수 없음"은 다르다.
	 */
	score: number | null;
	/** 판정하지 못한 변종이 하나도 없을 때만 참 */
	complete: boolean;
}

/**
 * 변이 대상 목록에서 모든 변종을 만든다.
 *
 * 대상의 순서를 유지하고, 한 대상 안에서는 `MUTATIONS`에 적힌 순서를 따른다.
 */
export function generateMutants(targets: MutationTarget[]): Mutant[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: generateMutants');
}

/**
 * 변종을 만들고 테스트 결과와 대조해 보고서를 낸다.
 */
export function analyze(
	targets: MutationTarget[],
	results: Record<string, TestOutcome>,
): MutationReport {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: analyze');
}

/**
 * 살아남은 변종이 있는 대상을, 살아남은 개수가 많은 순으로 돌려준다.
 * 개수가 같으면 대상 id의 사전순이다. 테스트를 어디에 더 붙일지 정하는 데 쓴다.
 */
export function weakestTargets(
	targets: MutationTarget[],
	results: Record<string, TestOutcome>,
): string[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: weakestTargets');
}

/**
 * 과제 03-01 — CRAP 점수 계산기
 *
 * 명세는 `tests/03-01-crap-score/index.test.ts`다. 배경은 docs/03-revived-quality-tools.md.
 *
 * 이 과제는 소스 코드를 파싱하지 않는다. 순환 복잡도와 커버리지는 이미 측정된
 * 값으로 주어진다. 여기서 다루는 것은 **그 두 값을 어떤 기준으로 결합해
 * 위험을 판정하는가**다.
 *
 * 실행: pnpm --filter agent-era-fundamentals test 03-01
 */

/** 함수 하나에 대해 이미 측정된 지표. */
export interface FunctionMetric {
	/** 함수 이름. 보고에만 쓰인다 */
	name: string;
	/** 순환 복잡도 — 함수를 지나는 경로의 개수. 1 이상이다 */
	complexity: number;
	/** 테스트 커버리지 — 0.0(전혀 안 덮임) ~ 1.0(전부 덮임) */
	coverage: number;
}

/**
 * CRAP 점수를 계산한다.
 *
 *     CRAP(m) = CC² × (1 − cov)³ + CC
 *
 * 잘못된 입력은 `RangeError`를 던진다. 복잡도가 1 미만이거나 정수가 아닌 경우,
 * 커버리지가 0~1 밖인 경우다. 측정값이 깨진 채로 점수가 나오면 그 점수를
 * 근거로 내린 판단이 전부 조용히 틀어진다.
 */
export function crapScore(complexity: number, coverage: number): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: crapScore');
}

/**
 * 임계값을 **초과한** 함수만 골라 CRAP 점수 내림차순으로 돌려준다.
 * 점수가 같으면 이름의 사전순으로 정렬한다.
 */
export function findCrapFunctions(
	metrics: FunctionMetric[],
	threshold: number,
): FunctionMetric[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: findCrapFunctions');
}

/**
 * 주어진 복잡도의 함수를 임계값 **이하**로 끌어내리는 데 필요한 최소 커버리지를
 * 돌려준다. 커버리지를 100%까지 올려도 임계값 이하로 내려가지 않으면 `null`이다.
 *
 * 이 함수가 `null`을 돌려주는 조건을 직접 유도해 보면, 밥이 말한
 * "커버리지 100%라면 CRAP 6은 경로가 여섯 개라는 뜻"이 왜 성립하는지 드러난다.
 */
export function coverageNeeded(complexity: number, threshold: number): number | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: coverageNeeded');
}

/**
 * 과제 03-01 참고 구현 — CRAP 점수 계산기
 *
 * 📍 되짚기: docs/03-revived-quality-tools.md — "CRAP 점수가 재는 것"
 *
 * 이 구현에서 판단이 갈린 곳은 셋이다.
 *
 * **①** 잘못된 측정값에 점수를 내주지 않고 던진다. 이 도구의 출력은 "이 함수를
 * 고칠 것인가"라는 판단의 근거가 되므로, 근거가 깨진 채 흘러가면 그 위의 판단이
 * 전부 조용히 오염된다. 검사기를 만들 때 입력 검증을 후순위로 두기 쉬운데,
 * 검사기야말로 자기 입력을 검사해야 하는 물건이다.
 *
 * **②** `findCrapFunctions`는 임계값을 "초과"한 것만 남긴다. 경계값을 포함할지는
 * 취향처럼 보이지만, 임계값을 정확히 맞춘 함수를 매번 보고하면 고칠 수 없는 항목이
 * 목록에 상주하게 되고 목록 전체가 무시당한다.
 *
 * **③** `coverageNeeded`의 `null`이 이 과제의 핵심이다. 커버리지 100%에서
 * CRAP은 복잡도 그 자체가 되므로(뒷항이 0이 된다), 임계값이 복잡도보다 낮으면
 * 테스트를 아무리 붙여도 도달할 수 없다. 그때 필요한 것은 테스트가 아니라
 * **함수를 쪼개는 일**이고, 도구는 그 둘을 구별해 말해 줄 수 있어야 한다.
 */

export interface FunctionMetric {
	name: string;
	complexity: number;
	coverage: number;
}

function assertValid(complexity: number, coverage: number): void {
	if (!Number.isInteger(complexity) || complexity < 1) {
		throw new RangeError(`순환 복잡도는 1 이상의 정수여야 한다 (받은 값: ${complexity})`);
	}
	if (!(coverage >= 0 && coverage <= 1)) {
		throw new RangeError(`커버리지는 0과 1 사이여야 한다 (받은 값: ${coverage})`);
	}
}

export function crapScore(complexity: number, coverage: number): number {
	assertValid(complexity, coverage);
	const uncovered = 1 - coverage;
	return complexity ** 2 * uncovered ** 3 + complexity;
}

export function findCrapFunctions(
	metrics: FunctionMetric[],
	threshold: number,
): FunctionMetric[] {
	return metrics
		.map((m) => ({ metric: m, score: crapScore(m.complexity, m.coverage) }))
		.filter(({ score }) => score > threshold)
		.sort((a, b) => b.score - a.score || a.metric.name.localeCompare(b.metric.name))
		.map(({ metric }) => metric);
}

export function coverageNeeded(complexity: number, threshold: number): number | null {
	assertValid(complexity, 0);

	// 커버리지가 100%면 뒷항이 사라져 CRAP은 복잡도 그 자체가 된다.
	// 그러므로 임계값이 복잡도보다 작으면 어떤 커버리지로도 도달할 수 없다.
	if (threshold < complexity) return null;

	// CC² × (1-cov)³ + CC ≤ T  →  (1-cov)³ ≤ (T - CC) / CC²
	const maxUncoveredCubed = (threshold - complexity) / complexity ** 2;
	if (maxUncoveredCubed >= 1) return 0;

	const maxUncovered = Math.cbrt(maxUncoveredCubed);
	return 1 - maxUncovered;
}

/**
 * 과제 03-01 참고 구현 — 가설 다양성 판정기
 *
 * 📍 되짚기: docs/03-search-space-design.md — "③ 다양성을 강제한다"
 *
 * 이 구현에서 판단이 갈린 곳은 셋이다.
 *
 * **①** 중복 판정의 키를 메커니즘 하나로만 잡았다. 영역을 키에 섞고 싶은
 * 유혹이 있는데(다른 영역이면 다른 가설 아닌가?), 그러면 같은 인과 경로를
 * 영역만 바꿔 적은 후보가 살아남는다. 프롬프트가 금지한 것이 정확히 그것이다 —
 * 개수를 채우려고 표기를 바꾸는 일.
 *
 * **②** 중복 제거를 먼저 하고 커버리지를 그 결과로 계산한다. 순서가 이 과제의
 * 전부라고 해도 된다. 반대로 하면 "세지 않기로 한 가설"이 커버리지에는
 * 기여하게 되어, 다양성 판정이 실제보다 후해진다. 그리고 후해진 판정은
 * 조용하다 — satisfied가 true로 나오면 아무도 되짚어 보지 않는다.
 *
 * **③** `missingDomains`가 정규화한 형태가 아니라 호출자의 원래 표기를
 * 돌려준다. 판정은 정규화된 값으로 하고 보고는 원래 값으로 하는 이 분리는
 * 사소해 보이지만, 지키지 않으면 사람이 읽는 출력에 소문자로 뭉개진 영역명이
 * 나온다. **비교용 형태와 표시용 형태는 다른 것이다.**
 */

export interface Hypothesis {
	id: string;
	domain: string;
	mechanism: string;
}

export interface DiversityReport {
	distinct: number;
	dropped: Hypothesis[];
	missingDomains: string[];
	satisfied: boolean;
}

/**
 * 메커니즘과 영역이 같은 정규화 규칙을 쓴다. 둘 다 "사람이 손으로 적은
 * 라벨"이라 표기 흔들림의 성질이 같기 때문이다.
 */
function normalizeLabel(raw: string): string {
	return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeMechanism(raw: string): string {
	return normalizeLabel(raw);
}

export function dedupeByMechanism(hypotheses: Hypothesis[]): Hypothesis[] {
	const seen = new Set<string>();
	const kept: Hypothesis[] = [];

	// 앞에서부터 훑으며 처음 보는 메커니즘만 담는다. Map에 담아 values()를
	// 꺼내는 방식은 나중 것이 앞의 것을 덮으므로 여기서는 쓸 수 없다.
	for (const hypothesis of hypotheses) {
		const key = normalizeLabel(hypothesis.mechanism);
		if (seen.has(key)) continue;
		seen.add(key);
		kept.push(hypothesis);
	}

	return kept;
}

export function missingDomains(hypotheses: Hypothesis[], required: string[]): string[] {
	const covered = new Set(hypotheses.map((x) => normalizeLabel(x.domain)));
	// 비교는 정규화된 값으로, 반환은 호출자가 준 원래 표기로.
	return required.filter((domain) => !covered.has(normalizeLabel(domain)));
}

export function assessDiversity(
	hypotheses: Hypothesis[],
	required: string[],
	minDistinct: number,
): DiversityReport {
	if (!Number.isInteger(minDistinct) || minDistinct < 0) {
		throw new RangeError(`minDistinct는 0 이상의 정수여야 한다 (받은 값: ${minDistinct})`);
	}

	const kept = dedupeByMechanism(hypotheses);
	// id가 아니라 객체 참조로 가른다. id가 겹치는 입력이 들어와도 어긋나지 않는다.
	const keptRefs = new Set(kept);
	const dropped = hypotheses.filter((x) => !keptRefs.has(x));

	// 커버리지는 살아남은 목록으로만 계산한다 — 걷어낸 것은 가설로 세지 않기로 했다.
	const missing = missingDomains(kept, required);

	return {
		distinct: kept.length,
		dropped,
		missingDomains: missing,
		satisfied: kept.length >= minDistinct && missing.length === 0,
	};
}

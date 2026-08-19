/**
 * 과제 03-01의 참고 구현.
 *
 * 📍 되짚기: docs/03-use-method.md § 해석 규칙 / docs/06-saturation-and-queueing.md § %util의 거짓
 *           / docs/90-must-memorize.md 카드 3·8
 */

export interface ResourceSample {
	name: string;
	utilizationPct: number | null;
	saturation: number | null;
	errorsDelta: number | null;
	parallel?: boolean;
}

export type Verdict = 'ok' | 'watch' | 'problem' | 'unobserved';

export type Reason =
	| 'errors-increasing'
	| 'saturated'
	| 'utilization-high'
	| 'utilization-unreliable'
	| 'unobserved';

export interface ResourceFinding {
	name: string;
	verdict: Verdict;
	reasons: Reason[];
}

export const UTILIZATION_SUSPECT_PCT = 70;

export function diagnoseResource(s: ResourceSample): ResourceFinding {
	const reasons: Reason[] = [];
	const missing = s.utilizationPct === null || s.saturation === null || s.errorsDelta === null;
	const allMissing = s.utilizationPct === null && s.saturation === null && s.errorsDelta === null;

	// 아무것도 못 재는 자원은 판정 대상이 아니라 관측 공백 그 자체다. USE 절차에서
	// "도구를 못 찾은 칸"이 이 상태이고, 그것을 목록에 남기는 것이 절차의 산출물이다.
	if (allMissing) {
		return { name: s.name, verdict: 'unobserved', reasons: ['unobserved'] };
	}

	// 순서가 의미를 갖는다. Gregg는 에러를 먼저 봐도 된다고 말한다 — 해석에 판단이
	// 거의 필요 없어서다. 근거 배열의 순서를 "해석이 값싼 순"으로 두면 사람이 위에서
	// 아래로 읽으면서 가장 빨리 결론에 닿는다.
	//
	// errorsDelta를 증분으로 받는 것도 의도적이다. 누적 카운터는 과거의 에러를 영원히
	// 현재의 장애로 보고하므로, 판정에 쓸 수 없다.
	if (s.errorsDelta !== null && s.errorsDelta > 0) reasons.push('errors-increasing');

	// 포화의 임계선은 0이다. 사용률의 70% 같은 여유선이 없다 — 큐에 하나라도 앉아
	// 있으면 누군가 기다린 것이고, 그것이 곧 성능 저하다.
	if (s.saturation !== null && s.saturation > 0) reasons.push('saturated');

	// 병렬 자원의 시간 기반 사용률은 한계를 말하지 않는다. 그래서 판정에서 빼고,
	// 대신 "이 값을 믿지 말라"는 근거를 남긴다 — 조용히 무시하면 다음 사람이
	// "왜 100%인데 아무 표시가 없지?"에서 멈춘다.
	if (s.parallel === true) {
		if (s.utilizationPct !== null) reasons.push('utilization-unreliable');
	} else if (s.utilizationPct !== null && s.utilizationPct >= UTILIZATION_SUSPECT_PCT) {
		reasons.push('utilization-high');
	}

	if (missing) reasons.push('unobserved');

	// verdict는 근거의 성격으로 결정된다. 사용률만 높은 것은 "의심"이고,
	// 포화·에러는 "문제"다. 이 구분이 없으면 정상 부하의 서버가 전부 빨개진다.
	const hasProblem = reasons.includes('errors-increasing') || reasons.includes('saturated');
	// 관측 공백은 최소 watch로 올린다. 남은 값이 정상이라고 ok로 두면, 포화를 아예
	// 못 재는 자원이 초록으로 보이고 아무도 그 사실을 모른다.
	const hasWatch = reasons.includes('utilization-high') || reasons.includes('unobserved');

	const verdict: Verdict = hasProblem ? 'problem' : hasWatch ? 'watch' : 'ok';
	return { name: s.name, verdict, reasons };
}

/**
 * unobserved가 ok보다 **위**에 오는 것이 이 순서의 핵심이다.
 * 아래로 두면 못 보고 있는 자원이 목록 끝으로 밀려 영원히 눈에 안 들어온다.
 */
const VERDICT_RANK: Record<Verdict, number> = {
	problem: 0,
	watch: 1,
	unobserved: 2,
	ok: 3,
};

export function rankBottlenecks(samples: ResourceSample[]): ResourceFinding[] {
	return samples
		.map(diagnoseResource)
		.sort(
			(a, b) =>
				VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || a.name.localeCompare(b.name),
		);
}

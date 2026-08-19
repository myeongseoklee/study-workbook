/**
 * 과제 05-01의 참고 구현.
 *
 * 📍 되짚기: docs/05-percentiles-and-histograms.md § 선형 보간, § 분위수는 평균낼 수 없다
 *           / docs/90-must-memorize.md 카드 11·12
 */

export interface Bucket {
	le: number;
	count: number;
}

/** `le` 오름차순으로 정렬한 사본. 원본을 건드리지 않는다. */
function sortByLe(buckets: Bucket[]): Bucket[] {
	return [...buckets].sort((a, b) => a.le - b.le);
}

export function histogramQuantile(phi: number, buckets: Bucket[]): number | null {
	if (phi < 0 || phi > 1) return null;

	const sorted = sortByLe(buckets);
	const last = sorted[sorted.length - 1];

	// +Inf 버킷이 없으면 전체 건수를 알 수 없다. 마지막 유한 버킷의 카운트를 N으로
	// 대체하면 그 경계를 넘은 요청이 존재하지 않는 것처럼 계산되는데, 그것은 정확히
	// 꼬리를 잘라내고 꼬리 분위수를 구하는 짓이다.
	if (last === undefined || last.le !== Number.POSITIVE_INFINITY) return null;

	const total = last.count;
	if (total <= 0) return null;

	const rank = phi * total;
	let lowerBound = 0; // 첫 버킷의 하한. 응답 시간은 음수가 없으므로 0에서 시작한다.
	let cumulativeBelow = 0;

	for (const b of sorted) {
		if (b.count >= rank) {
			// +Inf 버킷 안에 분위수가 있으면 보간할 상한이 없다. Infinity를 내면 그래프가
			// 깨지므로, 알 수 있는 최대한(마지막 유한 경계)을 낸다 — "적어도 이보다 크다"는
			// 정보는 남는다.
			if (b.le === Number.POSITIVE_INFINITY) {
				const lastFinite = sorted[sorted.length - 2];
				return lastFinite?.le ?? null;
			}

			// 구간 건수는 누적의 차다. 여기서 b.count를 그대로 분모로 쓰는 것이 가장
			// 흔한 오답이고, 값이 조용히 작아진다(보간 비율이 과소평가된다).
			const inBucket = b.count - cumulativeBelow;
			if (inBucket <= 0) return b.le;

			return lowerBound + (b.le - lowerBound) * ((rank - cumulativeBelow) / inBucket);
		}
		lowerBound = b.le;
		cumulativeBelow = b.count;
	}

	return null;
}

export function ratioWithin(threshold: number, buckets: Bucket[]): number | null {
	const sorted = sortByLe(buckets);
	const last = sorted[sorted.length - 1];
	if (last === undefined || last.le !== Number.POSITIVE_INFINITY) return null;
	if (last.count <= 0) return null;

	// 정확히 같은 경계만 인정한다. 근처 버킷으로 보간해 "대략 0.96쯤"을 내놓으면
	// 그 짐작이 SLO 판정에 섞이고, 나중에 그것이 짐작이었다는 사실이 남지 않는다.
	const exact = sorted.find((b) => b.le === threshold);
	if (exact === undefined) return null;

	return exact.count / last.count;
}

/**
 * 누적 버킷에서 "그 경계 이하 누적값"을 읽는다.
 *
 * 입력에 그 경계가 없을 수 있다. 그때는 **그 경계보다 작거나 같은 경계 중 가장 큰 것**의
 * 누적값이 답이다 — 누적이므로 그 값이 곧 "그 경계 이하의 실제 건수"다. 0으로 채우면
 * 상위 경계에서 관측이 통째로 사라진다.
 */
function cumulativeAt(sorted: Bucket[], le: number): number {
	let acc = 0;
	for (const b of sorted) {
		if (b.le <= le) acc = b.count;
		else break;
	}
	return acc;
}

export function mergeBuckets(sets: Bucket[][]): Bucket[] {
	if (sets.length === 0) return [];

	const boundaries = new Set<number>();
	for (const set of sets) for (const b of set) boundaries.add(b.le);
	const sortedBoundaries = [...boundaries].sort((a, b) => a - b);

	const sortedSets = sets.map(sortByLe);

	// 버킷 카운트는 **더할 수 있는 값**이다. 이것이 히스토그램이 인스턴스 간 합산을
	// 지원하고 Summary가 못 하는 이유다 — 분위수는 분포의 위치라서 더할 수 없지만,
	// 건수는 그냥 건수다. 그래서 "버킷을 먼저 합치고 분위수를 나중에" 구한다.
	return sortedBoundaries.map((le) => ({
		le,
		count: sortedSets.reduce((sum, set) => sum + cumulativeAt(set, le), 0),
	}));
}

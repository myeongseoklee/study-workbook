/**
 * 과제 05-01 — 히스토그램 분위수
 *
 * 누적 버킷에서 분위수를 추정하고, 여러 인스턴스의 버킷을 합친다. 모니터링 시스템의
 * 레이턴시 계산부에 해당한다 — 02가 만든 레이턴시 표본이 실제 시스템에서는 이 형태로 저장된다.
 *
 * 명세:  tests/05-01-histogram-quantile/index.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 05-01
 * 막히면: docs/05-percentiles-and-histograms.md
 */

/**
 * 누적 버킷 하나. `count`는 "`le` 이하 관측의 **누적** 건수"다.
 * 그래서 `le: +Infinity` 버킷의 `count`가 전체 건수가 된다.
 */
export interface Bucket {
	le: number;
	count: number;
}

/**
 * φ 분위수를 선형 보간으로 추정한다.
 *
 * 절차:
 *   1. `N` = `+Inf` 버킷의 카운트
 *   2. `rank` = φ × N
 *   3. 누적 카운트가 `rank`를 처음 넘어서는(또는 같아지는) 버킷을 찾는다
 *   4. 그 버킷 구간 `[lower, upper]` 안에서 균일 분포를 가정해 보간
 *
 * 힌트 1: 구간 건수는 "그 버킷의 누적"이 아니라 "그 버킷의 누적 − 앞 버킷의 누적"이다.
 * 힌트 2: 첫 버킷의 `lower`는 앞 버킷이 없다. 무엇으로 잡을지 정해야 한다.
 * 힌트 3: 찾은 버킷이 `+Inf`면 보간할 상한이 없다. 그때 무엇을 낼지 명세에 있다.
 * 힌트 4: `+Inf` 버킷이 없는 입력은 계산하지 않는다 — 왜인지 명세의 힌트를 읽어라.
 *
 * @returns 추정값, 또는 계산이 성립하지 않으면 `null`
 */
export function histogramQuantile(phi: number, buckets: Bucket[]): number | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: histogramQuantile');
}

/**
 * "threshold 이내 비율"을 보간 없이 정확히 낸다.
 *
 * 힌트: threshold와 **정확히 같은** 경계가 없으면 값을 내지 않는다. 근처 버킷으로
 *       보간하는 것이 친절해 보이지만, 그 짐작이 SLO 판정에 섞인다.
 */
export function ratioWithin(threshold: number, buckets: Bucket[]): number | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: ratioWithin');
}

/**
 * 여러 인스턴스의 누적 버킷을 하나로 합친다.
 *
 * 힌트: 경계의 합집합을 만들고, 각 경계에서 **각 입력의 그 경계 이하 누적값**을 더한다.
 *       어떤 입력에 그 경계가 없으면 "그 경계보다 작거나 같은 경계 중 가장 큰 것"의
 *       누적값을 쓴다 — 누적 버킷이라 그것이 그 경계 이하의 실제 건수다.
 */
export function mergeBuckets(sets: Bucket[][]): Bucket[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: mergeBuckets');
}

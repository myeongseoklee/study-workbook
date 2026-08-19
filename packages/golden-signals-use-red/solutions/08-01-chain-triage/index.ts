/**
 * 과제 08-01의 참고 구현.
 *
 * 📍 되짚기: docs/02-golden-signals.md § 인과 사슬 / docs/08-composing-the-three.md § 읽는 규칙
 *           / docs/90-must-memorize.md 카드 16
 */

export interface SignalSeries {
	traffic: number[];
	saturation: number[];
	latencyP99: number[];
	errorRate: number[];
}

export type Origin = 'overload' | 'capacity-loss' | 'dependency' | 'off-chain' | 'none';
export type SignalName = 'traffic' | 'saturation' | 'latency' | 'errors';
export type Action =
	| 'scale-out'
	| 'check-recent-change'
	| 'check-dependencies'
	| 'check-deploy-and-locks'
	| 'none';

export interface Triage {
	origin: Origin;
	firstMoved: SignalName | null;
	movedAtIndex: number | null;
	action: Action;
}

export interface TriageOptions {
	baselineCount: number;
	sigma: number;
}

export const DEFAULT_OPTIONS: TriageOptions = { baselineCount: 6, sigma: 3 };

export function detectFirstMove(
	series: number[],
	baselineCount: number,
	sigma: number,
): number | null {
	// 기준선을 만들 표본이 없거나, 기준선 뒤에 볼 구간이 없으면 판정할 수 없다.
	if (baselineCount <= 0 || series.length <= baselineCount) return null;

	const baseline = series.slice(0, baselineCount);
	const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
	const variance =
		baseline.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / baseline.length;
	const sd = Math.sqrt(variance);

	// 기준선을 앞 구간으로만 만드는 것이 이 함수의 핵심이다. 전체 평균을 쓰면
	// 스파이크가 자기 자신을 기준선에 섞어 정상으로 만들고, **이상이 클수록 감지가
	// 어려워지는** 역전이 생긴다.
	//
	// σ = 0이면 μ + kσ = μ가 되어 "평균보다 크면 이탈"이 된다. 이 경우를 빼면 완전히
	// 평탄한 기준선(합성 부하, 저트래픽 환경)에서 어떤 변화도 감지되지 않는다.
	const threshold = mean + sigma * sd;

	for (let i = baselineCount; i < series.length; i += 1) {
		const v = series[i];
		// 네 신호 모두 상승이 이상이다. 하강(트래픽 급감 등)도 실제로는 신호이지만
		// 사슬 판정의 대상이 아니라 별개의 문제(유입 차단·업스트림 장애)다.
		if (v !== undefined && v > threshold) return i;
	}
	return null;
}

/**
 * 사슬 순서가 곧 동점 판정 순서다. 해상도가 거칠면 여러 신호가 같은 버킷에서 튀는데,
 * 그때 뒤쪽을 고르면 **전파의 끝을 원인으로 지목**한다.
 */
const CHAIN: ReadonlyArray<{
	signal: SignalName;
	key: keyof SignalSeries;
	origin: Origin;
	action: Action;
}> = [
	{ signal: 'traffic', key: 'traffic', origin: 'overload', action: 'scale-out' },
	{
		signal: 'saturation',
		key: 'saturation',
		origin: 'capacity-loss',
		action: 'check-recent-change',
	},
	{ signal: 'latency', key: 'latencyP99', origin: 'dependency', action: 'check-dependencies' },
	{ signal: 'errors', key: 'errorRate', origin: 'off-chain', action: 'check-deploy-and-locks' },
];

export function triage(s: SignalSeries, opts: TriageOptions = DEFAULT_OPTIONS): Triage {
	let best: { index: number; entry: (typeof CHAIN)[number] } | null = null;

	for (const entry of CHAIN) {
		const at = detectFirstMove(s[entry.key], opts.baselineCount, opts.sigma);
		if (at === null) continue;
		// `<`만 쓰는 것이 동점 처리다. CHAIN을 사슬 순서로 순회하므로, 같은 인덱스에서는
		// 먼저 만난 것(사슬 앞쪽)이 남는다.
		if (best === null || at < best.index) best = { index: at, entry };
	}

	if (best === null) {
		return { origin: 'none', firstMoved: null, movedAtIndex: null, action: 'none' };
	}

	// origin과 action이 신호에서 곧바로 결정된다. 특히 errors가 먼저 움직인 경우에
	// scale-out을 권하지 않는 것이 이 매핑의 요점이다 — 부하 문제가 아닌데 인스턴스를
	// 늘리면 실패하는 요청을 더 많이 만든다.
	return {
		origin: best.entry.origin,
		firstMoved: best.entry.signal,
		movedAtIndex: best.index,
		action: best.entry.action,
	};
}

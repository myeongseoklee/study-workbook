/**
 * 과제 08-01 — 인과 사슬 트리아지
 *
 * 네 신호의 시계열을 받아 "무엇이 먼저 움직였는가"로 원인 방향을 지목한다.
 * 앞 과제들이 만든 값이 여기 모여 판단이 된다 — 모니터링 시스템의 판단부다.
 *
 * 명세:  tests/08-01-chain-triage/index.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 08-01
 * 막히면: docs/02-golden-signals.md § 인과 사슬 / docs/08-composing-the-three.md
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
	/** 기준선을 만드는 데 쓸 앞쪽 표본 수. */
	baselineCount: number;
	/** 기준선 표준편차의 몇 배를 이탈로 볼지. */
	sigma: number;
}

export const DEFAULT_OPTIONS: TriageOptions = { baselineCount: 6, sigma: 3 };

/**
 * 기준선 대비 처음 위로 이탈한 인덱스를 찾는다.
 *
 * 힌트 1: 기준선은 **앞 `baselineCount`개로만** 만든다. 전체 평균을 쓰면 스파이크가
 *         기준선을 끌어올려 자기 자신을 정상으로 만든다.
 * 힌트 2: 표준편차가 0인 경우를 별도로 처리해야 한다 — 빼면 완전히 평탄한 기준선에서
 *         어떤 변화도 감지되지 않는다.
 * 힌트 3: 네 신호 모두 "상승"이 이상이다. 하강은 이탈로 보지 않는다.
 */
export function detectFirstMove(
	series: number[],
	baselineCount: number,
	sigma: number,
): number | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: detectFirstMove');
}

/**
 * 네 신호에서 원인 방향을 판정한다.
 *
 * 힌트 1: 가장 이른 이탈을 고른다. 동점이면 사슬 순서(traffic → saturation → latency →
 *         errors)가 가른다 — 뒤쪽을 고르면 전파의 끝을 원인으로 지목한다.
 * 힌트 2: 신호와 origin, action의 대응은 명세에 전부 있다.
 */
export function triage(s: SignalSeries, opts: TriageOptions = DEFAULT_OPTIONS): Triage {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: triage');
}

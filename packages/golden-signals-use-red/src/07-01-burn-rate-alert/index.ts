/**
 * 과제 07-01 — 에러 예산 소진율 알림
 *
 * 에러율을 "얼마나 급한가"로 바꾸고, 두 창을 함께 보아 발화를 결정한다.
 * 모니터링 시스템의 알림부다 — 02가 만든 errorRate가 여기로 들어온다.
 *
 * 명세:  tests/07-01-burn-rate-alert/index.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 07-01
 * 막히면: docs/07-slo-and-error-budget.md
 */

export interface AlertRule {
	name: string;
	severity: 'page' | 'ticket';
	longWindowHours: number;
	shortWindowHours: number;
	burnRateThreshold: number;
}

export interface WindowMeasurement {
	/** 긴 창에서 관측된 에러율. */
	longErrorRate: number;
	/** 짧은 창에서 관측된 에러율. */
	shortErrorRate: number;
}

/**
 * 99.9% SLO에 권장되는 세 규칙.
 *
 * 🎯 TODO: 문서의 표를 그대로 채워라. 이름은 `fast-burn` · `medium-burn` · `slow-burn`이고
 *          순서는 급한 것부터다. 짧은 창은 시간 단위로 적는다(5분 = 5/60).
 */
export const STANDARD_RULES: AlertRule[] = [];

/** 에러 예산 = 1 - SLO. */
export function errorBudget(slo: number): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: errorBudget');
}

/** 예산의 절대 크기를 분으로. */
export function budgetMinutes(slo: number, periodDays: number): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: budgetMinutes');
}

/** 소진율 = 실제 에러율 ÷ 허용 에러율. */
export function burnRate(errorRate: number, slo: number): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: burnRate');
}

/**
 * 이 소진율이 유지될 때 예산이 고갈되기까지의 시간(시간 단위).
 *
 * 힌트: 소진율 1이 "기간이 끝나는 순간 정확히 다 쓴다"를 뜻한다는 정의에서 식이 나온다.
 *       소진율이 0 이하일 때의 반환값이 명세에 못 박혀 있다.
 */
export function timeToExhaustionHours(burn: number, periodDays: number): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: timeToExhaustionHours');
}

/**
 * 규칙별로 두 창을 평가해 발화한 규칙 이름을 낸다.
 *
 * 힌트 1: 두 창이 **모두** 임계 이상일 때만 발화한다. 짧은 창이 왜 필요한지 명세에 있다.
 * 힌트 2: 측정값이 없는 규칙의 처리가 명세에 못 박혀 있다.
 * 힌트 3: 반환 순서에 규칙이 있다.
 */
export function evaluateAlerts(
	slo: number,
	measured: Record<string, WindowMeasurement>,
	rules: AlertRule[],
): string[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: evaluateAlerts');
}

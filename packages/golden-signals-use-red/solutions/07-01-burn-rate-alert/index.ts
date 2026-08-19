/**
 * 과제 07-01의 참고 구현.
 *
 * 📍 되짚기: docs/07-slo-and-error-budget.md § 소진율, § 다중 창·다중 소진율 알림
 *           / docs/90-must-memorize.md 카드 14·15
 */

export interface AlertRule {
	name: string;
	severity: 'page' | 'ticket';
	longWindowHours: number;
	shortWindowHours: number;
	burnRateThreshold: number;
}

export interface WindowMeasurement {
	longErrorRate: number;
	shortErrorRate: number;
}

/**
 * 세 규칙이 나뉘어 있는 이유는 **급한 것과 느린 것을 다르게 처리**하기 위해서다.
 * 빠르게 타는 것은 사람을 깨우고, 천천히 타는 것은 티켓으로 남긴다. 후자를 호출로
 * 만들면 새벽에 깨어나 할 일이 없고, 전자를 티켓으로 만들면 아침에 예산이 없다.
 *
 * 짧은 창이 긴 창의 1/12인 것도 규칙의 일부다 — 3일 규칙의 짧은 창이 6시간인 것이
 * 그 계산에서 나온다.
 */
export const STANDARD_RULES: AlertRule[] = [
	{
		name: 'fast-burn',
		severity: 'page',
		longWindowHours: 1,
		shortWindowHours: 5 / 60,
		burnRateThreshold: 14.4,
	},
	{
		name: 'medium-burn',
		severity: 'page',
		longWindowHours: 6,
		shortWindowHours: 0.5,
		burnRateThreshold: 6,
	},
	{
		name: 'slow-burn',
		severity: 'ticket',
		longWindowHours: 72,
		shortWindowHours: 6,
		burnRateThreshold: 1,
	},
];

export function errorBudget(slo: number): number {
	return 1 - slo;
}

export function budgetMinutes(slo: number, periodDays: number): number {
	return periodDays * 24 * 60 * errorBudget(slo);
}

export function burnRate(errorRate: number, slo: number): number {
	const allowed = errorBudget(slo);
	// SLO가 100%면 허용 에러율이 0이고 소진율이 정의되지 않는다. 에러가 하나라도 있으면
	// 즉시 무한이라는 것이 그 상태의 정직한 표현이다 — 그리고 그것이 SLO 100%를
	// 잡으면 안 되는 이유이기도 하다.
	if (allowed <= 0) return errorRate > 0 ? Number.POSITIVE_INFINITY : 0;
	return errorRate / allowed;
}

export function timeToExhaustionHours(burn: number, periodDays: number): number {
	// 소진율 1의 정의가 "기간이 끝나는 순간 정확히 다 쓴다"이므로, 기간을 소진율로
	// 나눈 것이 곧 고갈 시간이다. 곱하면 방향이 반대가 되어 빠르게 타는 것이
	// 여유로워 보인다.
	if (burn <= 0) return Number.POSITIVE_INFINITY;
	return (periodDays * 24) / burn;
}

/** page를 ticket보다 위에 두기 위한 순서. 사람이 목록의 첫 줄부터 읽기 때문이다. */
const SEVERITY_RANK: Record<AlertRule['severity'], number> = { page: 0, ticket: 1 };

export function evaluateAlerts(
	slo: number,
	measured: Record<string, WindowMeasurement>,
	rules: AlertRule[],
): string[] {
	const firing = rules.filter((rule) => {
		const m = measured[rule.name];
		// 측정값이 없는 규칙은 판정하지 않는다. 0으로 채우면 "정상"으로 보고되고,
		// 반대로 발화시키면 계측이 붙기 전의 서비스가 전부 알림을 낸다. 둘 다 틀렸고,
		// 없는 것은 없는 것으로 두는 편이 정직하다.
		if (m === undefined) return false;

		const longBurn = burnRate(m.longErrorRate, slo);
		const shortBurn = burnRate(m.shortErrorRate, slo);

		// 두 창이 모두 임계 이상이어야 발화한다.
		//   긴 창  = "충분히 심각한가"  (노이즈에 흔들리지 않는 판단)
		//   짧은 창 = "지금도 타는 중인가" (복구되면 즉시 식어 알림을 해제한다)
		// 짧은 창을 빼면 5분 만에 복구된 장애의 알림이 긴 창 길이만큼 계속 울리고,
		// 그런 알림이 몇 번 반복되면 사람이 알림 자체를 신뢰하지 않게 된다.
		return longBurn >= rule.burnRateThreshold && shortBurn >= rule.burnRateThreshold;
	});

	return firing
		.slice()
		.sort(
			(a, b) =>
				SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
				b.burnRateThreshold - a.burnRateThreshold,
		)
		.map((r) => r.name);
}

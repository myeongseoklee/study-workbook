/**
 * 과제 4-1의 참고 구현.
 *
 * 판정은 `tests/4-1-rolling-deploy.test.ts`가 한다. 여기 있는 코드는
 * "정답 하나"가 아니라 "성립하는 한 예"다.
 *
 * 📍 되짚기: docs/04-ecs-fargate.md § 롤링 배포의 산수 / § 서킷 브레이커
 *            / docs/90-must-memorize.md 카드 15·16·17
 */

export interface DeployRange {
	min: number;
	max: number;
}

/**
 * 최소는 올림, 최대는 내림.
 *
 * 방향이 다른 것은 의도된 설계다 — 최소를 올리면 가용성이 지켜지고,
 * 최대를 내리면 비용 한도가 지켜진다. 둘 다 "안전한 쪽"으로 반올림하는 것이며,
 * 안전한 쪽의 방향이 서로 반대인 것이다.
 */
export function deployRange(
	desiredCount: number,
	minimumHealthyPercent = 100,
	maximumPercent = 200,
): DeployRange {
	return {
		min: Math.ceil((desiredCount * minimumHealthyPercent) / 100),
		max: Math.floor((desiredCount * maximumPercent) / 100),
	};
}

/**
 * 시작할 여유도 없고 멈출 여유도 없으면 교착이다.
 *
 * - 시작 가능: max > desiredCount  (현재 개수 위에 하나 더 띄울 자리)
 * - 멈춤 가능: min < desiredCount  (현재 개수에서 하나 내릴 여유)
 *
 * DesiredCount 1에서 50/100이 100/100과 같은 결과가 되는 이유가 여기 드러난다 —
 * ceil(0.5) = 1 이라 최소가 내려가지 않는다.
 */
export function isDeadlocked(
	desiredCount: number,
	minimumHealthyPercent = 100,
	maximumPercent = 200,
): boolean {
	const { min, max } = deployRange(desiredCount, minimumHealthyPercent, maximumPercent);
	const canStart = max > desiredCount;
	const canStop = min < desiredCount;
	return !canStart && !canStop;
}

/**
 * 무중단 = 용량이 줄지 않으면서(min >= desiredCount) 진행 가능(max > desiredCount).
 *
 * 두 조건이 함께 필요하다. min만 보면 100/100 교착을 무중단으로 잘못 판정하고,
 * max만 보면 50/100(용량 절반으로 감소)을 무중단으로 잘못 판정한다.
 */
export function isZeroDowntime(
	desiredCount: number,
	minimumHealthyPercent = 100,
	maximumPercent = 200,
): boolean {
	const { min, max } = deployRange(desiredCount, minimumHealthyPercent, maximumPercent);
	return min >= desiredCount && max > desiredCount;
}

export type ThresholdConfig =
	| { type: 'BOUNDED_PERCENT'; value?: number }
	| { type: 'UNBOUNDED_PERCENT'; value: number }
	| { type: 'COUNT'; value: number };

const MIN_BOUND = 3;
const MAX_BOUND = 200;

export function circuitBreakerThreshold(desiredCount: number, config?: ThresholdConfig): number {
	const resolved: ThresholdConfig = config ?? { type: 'BOUNDED_PERCENT', value: 50 };

	if (resolved.type === 'COUNT') {
		// DesiredCount와 무관한 고정값. clamp도 하지 않는다.
		return resolved.value;
	}

	const percent = resolved.type === 'BOUNDED_PERCENT' ? (resolved.value ?? 50) : resolved.value;
	const raw = Math.ceil((percent / 100) * desiredCount);

	if (resolved.type === 'UNBOUNDED_PERCENT') return raw;

	// BOUNDED_PERCENT — 계산값이 3보다 작으면 3, 200보다 크면 200.
	// 경계값 자체(3, 200)는 그대로 쓴다.
	return Math.min(MAX_BOUND, Math.max(MIN_BOUND, raw));
}

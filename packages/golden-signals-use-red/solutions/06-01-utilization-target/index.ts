/**
 * 과제 06-01의 참고 구현.
 *
 * 📍 되짚기: docs/06-saturation-and-queueing.md § 식으로 보기, § 목표 사용률을 역산한다
 *           / docs/90-must-memorize.md 카드 13
 */

export function latencyMultiplier(rho: number): number {
	// 음수 사용률은 물리적으로 없다. 측정·계산 과정에서 새어 들어온 잡음이므로 무부하로
	// 취급한다 — NaN을 흘리면 임계값 비교가 조용히 항상 false가 된다.
	if (rho <= 0) return 1;
	// ρ ≥ 1은 도착이 처리를 따라잡은 상태다. M/M/1의 안정 조건(λ < μ)이 깨진 것이고,
	// 큐가 발산하므로 Infinity가 수학적으로 맞는 답이다. 1000 같은 큰 수로 자르면
	// "아직 유한하다"는 잘못된 신호를 준다.
	if (rho >= 1) return Number.POSITIVE_INFINITY;
	return 1 / (1 - rho);
}

export function utilizationTarget(k: number): number {
	// k ≤ 1은 "지연이 전혀 늘어나면 안 된다"는 요구이고, 그것은 사용률 0에서만 성립한다.
	// 음수를 그대로 내면 임계값 계산에 흘러들어가 "사용률 -20%부터 알림" 같은 값이 된다.
	if (k <= 1) return 0;
	return 1 - 1 / k;
}

export function responseTimeMs(serviceMs: number, rho: number): number {
	return serviceMs * latencyMultiplier(rho);
}

export function capacityFactorFor(currentRho: number, targetRho: number): number {
	if (targetRho <= 0) return Number.POSITIVE_INFINITY;

	// ρ = λ/μ 이고 λ는 그대로다. 목표 ρ'에 닿으려면 μ' = λ/ρ' 이어야 하므로
	// μ'/μ = (λ/ρ') / (λ/ρ) = ρ/ρ' 이다. 차(0.9-0.6)로 쓰면 단위가 맞지 않고,
	// 비율을 뒤집으면(0.6/0.9) 증설이 아니라 축소를 지시한다.
	const factor = currentRho / targetRho;

	// 이미 목표 이하일 때 1 미만을 내면 "줄여라"가 되는데, 축소는 비용·여유·버스트
	// 내성을 함께 봐야 하는 별개 결정이다. 이 함수는 증설 소요만 대답한다.
	return Math.max(factor, 1);
}

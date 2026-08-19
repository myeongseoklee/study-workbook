/**
 * 과제 06-01 — 목표 사용률 계산기
 *
 * 사용률과 지연의 비선형 관계를 양방향으로 계산한다. 모니터링 시스템의 임계값에
 * 근거를 붙이는 부분이다 — "CPU 80% 알림"이 어떤 지연 배수를 전제하는지 여기서 나온다.
 *
 * 명세:  tests/06-01-utilization-target/index.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 06-01
 * 막히면: docs/06-saturation-and-queueing.md
 */

/**
 * 사용률 ρ에서의 지연 배수 `1/(1-ρ)`.
 *
 * 힌트: ρ가 1 이상일 때와 음수일 때를 각각 처리해야 한다. 하나는 수학적으로 무한이고,
 *       하나는 측정 잡음이므로 방어값이 필요하다.
 */
export function latencyMultiplier(rho: number): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: latencyMultiplier');
}

/**
 * 허용 지연 배수 k에서 목표 사용률 `1 - 1/k`.
 *
 * 힌트: `latencyMultiplier`의 역함수여야 한다. 명세가 실제로 그것을 검사한다.
 */
export function utilizationTarget(k: number): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: utilizationTarget');
}

/**
 * 무부하 처리 시간과 사용률에서 평균 응답 시간 `S/(1-ρ)`.
 */
export function responseTimeMs(serviceMs: number, rho: number): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: responseTimeMs');
}

/**
 * 도착률이 그대로일 때, 현재 사용률에서 목표 사용률로 내리려면 처리 용량을 몇 배로
 * 올려야 하는가.
 *
 * 힌트: ρ = λ/μ 관계에서 유도한다. 차를 쓰거나 비율을 뒤집으면 방향이 반대가 된다.
 *       그리고 이미 목표 이하인 경우의 반환값이 명세에 못 박혀 있다.
 */
export function capacityFactorFor(currentRho: number, targetRho: number): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: capacityFactorFor');
}

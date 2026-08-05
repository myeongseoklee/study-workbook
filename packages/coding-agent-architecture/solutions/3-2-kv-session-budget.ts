/**
 * 과제 3-2의 참고 구현.
 *
 * 판정은 `tests/3-2-kv-session-budget.test.ts`가 한다.
 *
 * 📍 되짚기: docs/ep01-concepts/06-local-llm.md § KV 캐시 산수 / § 두 개의 마지노선
 */

/** 양자화 하한 — 이 아래는 원본 분포에서 벗어나 사실상 다른 모델이 된다. */
export const QUANT_FLOOR_BITS = 5;

/** 모델 크기 하한(단위: B, 십억 파라미터) — 이 아래는 제품 수준 코딩이 안 된다. */
export const PARAM_FLOOR_B = 200;

/**
 * 모델 적재에 필요한 GB.
 *
 * 파라미터 하나가 차지하는 바이트는 `bits / 8`이다. 그래서 1B 파라미터를
 * 8비트로 적재하면 정확히 1GB — 이 대응 덕분에 십억 단위와 GB 단위가
 * 그대로 맞물리고, 식에서 단위 변환이 사라진다.
 */
export function modelFootprintGb(paramsB: number, bits: number): number {
	return (paramsB * bits) / 8;
}

/**
 * 노드에서 모델을 적재한 뒤 열 수 있는 풀 컨텍스트 세션 수.
 *
 * 모델은 한 번만 올라가고 세션마다 복제되지 않는다. 그래서 뺄셈이 먼저,
 * 나눗셈이 나중이다. 남은 것이 음수면 세션이 0개인 것이지 −5개가 아니다.
 */
export function concurrentSessions(
	nodeMemoryGb: number,
	modelGb: number,
	sessionCacheGb: number,
): number {
	const remaining = nodeMemoryGb - modelGb;
	if (remaining <= 0) return 0;
	return Math.floor(remaining / sessionCacheGb);
}

/**
 * 1인이 동시에 여는 세션 수를 감안한 수용 인원.
 *
 * 내림인 이유는 사람을 쪼갤 수 없기 때문이다. 2.86명을 3명으로 올리면 세 번째
 * 사람은 자기 세션 중 하나를 못 연다.
 */
export function developerCapacity(sessions: number, sessionsPerDeveloper: number): number {
	return Math.floor(sessions / sessionsPerDeveloper);
}

/**
 * 이 구성이 두 하한을 모두 통과하는가.
 *
 * AND인 것이 중요하다. 크기만 보면 460B Q4가 통과하고, 양자화만 보면 30B Q8이
 * 통과한다. 둘 다 실제로는 쓸 수 없는 구성이다.
 */
export function meetsFloors(paramsB: number, bits: number): boolean {
	return paramsB >= PARAM_FLOOR_B && bits >= QUANT_FLOOR_BITS;
}

// 직접 실행하면 강의의 예시 구성을 계산해 본다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const modelGb = modelFootprintGb(460, 5);
	const sessions = concurrentSessions(500, modelGb, 10);
	console.log(`모델 적재: ${modelGb.toFixed(0)}GB`);
	console.log(`동시 세션: ${sessions}개 → 개발자 ${developerCapacity(sessions, 7)}명`);
	console.log(`하한 통과: ${meetsFloors(460, 5)}`);
}

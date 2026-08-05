/**
 * 과제 3-2 — KV 세션 예산 계산기 (1강)
 *
 * 온프레미스 로컬 LLM에서 "개발자 몇 명을 수용할 수 있는가"는 감이 아니라
 * 산수다. 노드 메모리에서 모델 적재분을 빼고, 남은 것을 세션당 KV 캐시로 나눈다.
 *
 * 판정:  npm run test:3-2
 * 막히면: docs/ep01-concepts/06-local-llm.md § KV 캐시 산수
 *
 * 성공 기준 (테스트가 검사하는 항목)
 *  - modelFootprintGb: 파라미터 수(B)와 비트폭으로 적재 용량을 계산한다
 *  - concurrentSessions: (노드 − 모델) / 세션당 캐시, 내림
 *  - concurrentSessions: 모델이 노드보다 크면 0 (음수를 반환하지 않는다)
 *  - developerCapacity: 1인당 동시 세션 수로 나눈다, 내림
 *  - QUANT_FLOOR_BITS·PARAM_FLOOR_B 두 하한이 상수로 명시돼 있다
 *  - meetsFloors: 두 하한을 모두 만족해야 true (하나만 만족하면 false)
 */

/** 양자화 하한 — 이 아래는 원본 분포에서 벗어나 사실상 다른 모델이 된다. */
export const QUANT_FLOOR_BITS: number = 0; // 🎯 TODO: 비트폭 하한

/** 모델 크기 하한(단위: B, 십억 파라미터) — 이 아래는 제품 수준 코딩이 안 된다. */
export const PARAM_FLOOR_B: number = 0; // 🎯 TODO: 파라미터 하한

/**
 * 모델 적재에 필요한 GB.
 *
 * 파라미터 하나가 차지하는 바이트는 비트폭에서 나온다. 1B 파라미터를 8비트로
 * 적재하면 약 1GB다 — 이 관계를 쓰면 식이 짧아진다.
 */
export function modelFootprintGb(paramsB: number, bits: number): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: modelFootprintGb');
}

/** 노드에서 모델을 적재한 뒤 열 수 있는 풀 컨텍스트 세션 수. */
export function concurrentSessions(
	nodeMemoryGb: number,
	modelGb: number,
	sessionCacheGb: number,
): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: concurrentSessions');
}

/** 1인이 동시에 여는 세션 수를 감안한 수용 인원. */
export function developerCapacity(sessions: number, sessionsPerDeveloper: number): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: developerCapacity');
}

/** 이 구성이 두 하한(모델 크기·양자화)을 모두 통과하는가. */
export function meetsFloors(paramsB: number, bits: number): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: meetsFloors');
}

// 직접 실행하면 강의의 예시 구성을 계산해 본다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const modelGb = modelFootprintGb(460, 5);
	const sessions = concurrentSessions(500, modelGb, 10);
	console.log(`모델 적재: ${modelGb.toFixed(0)}GB`);
	console.log(`동시 세션: ${sessions}개 → 개발자 ${developerCapacity(sessions, 7)}명`);
	console.log(`하한 통과: ${meetsFloors(460, 5)}`);
}

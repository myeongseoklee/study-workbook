/**
 * 과제 10-01 — 사가 보상과 데드라인
 *
 * 사가는 **낙관성을 전제**한다. 대부분 성공한다는 가정이 없으면 보상 절차가 본 작업보다
 * 비싸진다. 그래서 판정 대상은 성공 경로가 아니라 **실패했을 때 어디까지 되돌리는가**와
 * **응답하지 않는 참가자를 어떻게 끊는가**다.
 *
 * 명세:  tests/10-01-saga-compensation/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test 10-01
 * 막히면: docs/10-saga-and-optimism.md
 */

export interface Step {
	name: string;
	/** 이 단계를 수행한다. 던지면 실패다. */
	invoke: () => Promise<void>;
	/** 이 단계를 되돌린다. */
	compensate: () => Promise<void>;
}

export interface SagaOptions {
	/** 단계 하나가 이 시간을 넘기면 실패로 본다 (단계마다 적용). 없으면 기다린다. */
	deadlineMs?: number;
}

export interface SagaResult {
	ok: boolean;
	/** 성공적으로 완료된 단계 이름들 (실행 순서) */
	completed: string[];
	/** 실패한 단계 이름 */
	failedAt?: string;
	/** 'error' = 단계가 던졌다 · 'deadline' = 시간을 넘겼다 */
	reason?: 'error' | 'deadline';
	/** 되돌린 단계 이름들 (보상 순서 = 역순) */
	compensated: string[];
	/** 보상 자체가 실패한 단계 이름들 — 숨기지 않는다 */
	compensationFailed: string[];
}

/**
 * 단계들을 순서대로 실행하고, 실패하면 **성공한 것만 역순으로** 되돌린다.
 *
 * 힌트 넷:
 *   ① **실패한 단계 자신은 보상하지 않는다** — 효과를 내지 못했으므로 되돌릴 것이 없다
 *   ② 보상은 **역순**이다. 앞 단계가 뒤 단계의 전제였을 수 있다
 *   ③ 데드라인은 **단계마다** 적용한다(전체 합이 아니다). 초과하면 `reason: 'deadline'`
 *   ④ **보상이 실패해도 나머지 보상은 계속하고, 실패 사실을 결과에 남긴다** —
 *      조용히 넘기면 아무도 모르는 불일치가 생긴다
 */
export async function runSaga(steps: Step[], options: SagaOptions = {}): Promise<SagaResult> {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: runSaga');
}

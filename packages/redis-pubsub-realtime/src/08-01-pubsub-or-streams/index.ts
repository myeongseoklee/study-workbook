/**
 * 과제 08-01 — Pub/Sub인가, Streams인가, 아니면 Redis 밖의 메시지 큐인가
 *
 * 업무 요건을 받아 세 수단 중 하나를 고르고, 그 수단을 고른 근거를 함께 돌려주는
 * 순수 함수를 만든다. 판정 절차는 docs/08-pubsub-or-streams.md의 「판정 절차」에 있다.
 *
 * 무엇을 만들지는 명세가 정의한다: tests/08-01-pubsub-or-streams/index.test.ts
 * 판정: pnpm test 08-01
 */

export interface Requirement {
	/** 이 메시지를 놓쳐도 업무가 성립하는가 */
	lossTolerated: boolean;
	/** 소비자가 처리 도중 죽었을 때 다른 소비자가 그 일을 이어받아야 하는가 */
	needsRedelivery: boolean;
	/** 요구되는 보존 기간(시간). 0이면 보존 요구가 없다 */
	retentionHours: number;
	/** 그 기간 동안 보존해야 하는 총량(MB) */
	retainedVolumeMb: number;
	/** 이 용도로 쓸 수 있는 Redis 메모리(MB) */
	availableMemoryMb: number;
}

export type Choice = 'pubsub' | 'streams' | 'external-mq';

export type ReasonCode =
	| 'loss-tolerated'
	| 'redelivery-required'
	| 'retention-exceeds-threshold'
	| 'volume-exceeds-memory';

export interface Decision {
	choice: Choice;
	reason: ReasonCode;
}

/**
 * Redis 밖으로 나갈지를 가르는 보존 기간 경계(시간).
 * 이 값은 Redis의 규정이 아니라 이 판정이 채택한 정책 상수다.
 */
export const RETENTION_THRESHOLD_HOURS = 24;

/**
 * 요건을 받아 수단과 근거를 판정한다.
 *
 * 규칙은 아래 순서로 적용한다. 순서 자체가 명세이므로, 조건을 모두 맞게 쓰더라도
 * 보는 차례가 다르면 다른 답이 나온다.
 *
 *   1. needsRedelivery가 true이면 손실을 허용할 수 없다고 본다.
 *      재처리가 필요하다는 것은 놓치면 안 된다는 뜻이므로, 이때는 lossTolerated가
 *      true여도 무시한다. 다만 입력 객체를 직접 고쳐서는 안 된다.
 *   2. 손실을 허용하면(위 무효화를 거친 뒤에도 lossTolerated가 true이면)
 *      { choice: 'pubsub', reason: 'loss-tolerated' }로 끝난다.
 *      보존 기간이나 보존량이 아무리 커도 여기서 판정이 확정된다.
 *   3. 손실을 허용하지 않으면 아래를 이 순서대로 본다.
 *      a. retentionHours가 RETENTION_THRESHOLD_HOURS 이상이면
 *         { choice: 'external-mq', reason: 'retention-exceeds-threshold' }
 *      b. retainedVolumeMb가 availableMemoryMb를 초과하면
 *         { choice: 'external-mq', reason: 'volume-exceeds-memory' }
 *      c. 그 밖에는 { choice: 'streams', reason: 'redelivery-required' }
 *
 * 경계의 부등호 방향이 3-a와 3-b에서 서로 다르다는 점에 유의한다.
 * 3-a는 이상(같으면 걸린다)이고 3-b는 초과(같으면 걸리지 않는다)다.
 */
export function decide(req: Requirement): Decision {
	// 🎯 TODO: 위 1~3의 규칙을 그 순서대로 적용해 Decision을 돌려준다.
	//          조건을 개별적으로 맞히는 것이 아니라, 어느 조건을 먼저 보는지가 판정의 핵심이다.
	throw new Error('TODO: decide');
}

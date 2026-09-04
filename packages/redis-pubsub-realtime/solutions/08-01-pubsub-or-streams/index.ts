/**
 * 과제 08-01 참고 구현 — Pub/Sub인가, Streams인가, 아니면 Redis 밖의 메시지 큐인가
 *
 * 📍 되짚기: docs/08-pubsub-or-streams.md § 판정 절차
 *
 * 이것은 정답 하나가 아니라 명세를 만족하는 한 예다. 코드 자체는 조건문 몇 줄이므로,
 * 여기서 읽을 것은 구현이 아니라 규칙을 왜 이 순서로 놓았는가다.
 *
 * ## 왜 순서가 곧 명세인가
 *
 * 세 수단을 가르는 질문 셋은 서로 독립적이지 않다. 한 요건이 여러 질문에 동시에 걸리는
 * 일이 흔하고, 그때 어느 질문을 먼저 읽었는지에 따라 답이 달라진다. 예를 들어
 * "놓쳐도 되는 공지인데 한 달치를 보존하고 싶다"는 요건은, 보존 조건을 먼저 보면
 * Redis 밖의 메시지 큐가 나오고 손실 허용 여부를 먼저 보면 Pub/Sub이 나온다.
 * 학습 자료가 위에서부터 내려가며 처음 걸리는 곳이 답이라고 규정한 이유가 이것이다.
 * 조건을 모두 맞게 구현하고도 보는 차례가 다르면 다른 답이 나오므로, 순서를 정하지 않은
 * 판정은 판정이 아니다.
 *
 * ## 1단계: needsRedelivery가 lossTolerated를 무효화하는 이유
 *
 * 두 필드는 요건 작성자가 각각 적는 값이라 서로 모순될 수 있다. "놓쳐도 된다"와
 * "소비자가 죽으면 다른 소비자가 이어받아야 한다"가 함께 적혀 있으면, 둘 중 하나는
 * 잘못 적힌 것이다. 이때 어느 쪽을 믿을지는 틀렸을 때의 대가로 정한다. 놓쳐도 되는
 * 메시지에 Streams를 쓰면 자르기 정책과 소비자 그룹 관리라는 운영 부담이 늘어날 뿐이지만,
 * 반드시 처리되어야 하는 일에 Pub/Sub을 쓰면 메시지가 영구히 사라진다.
 * 되돌릴 수 있는 손해와 되돌릴 수 없는 손해 중 안전한 쪽을 고르는 것이다.
 *
 * 무효화는 지역 변수로 처리하고 입력 객체에 대입하지 않는다. 인자로 받은 요건을 고치면
 * 호출한 쪽이 들고 있던 값이 조용히 바뀌고, 같은 객체로 다시 판정하거나 화면에 다시
 * 그릴 때 원래 요건이 무엇이었는지 알 수 없게 된다.
 *
 * ## 2단계: Pub/Sub 갈래가 아래 조건을 읽지 않고 끝나는 이유
 *
 * 놓쳐도 되는 메시지에는 보존 요구가 애초에 성립하지 않는다. 저장하지 않기로 한 것의
 * 보존 기간과 총량을 따지는 것은 계산할 필요가 없는 값을 계산하는 일이다. 그래서 이 갈래는
 * retentionHours와 retainedVolumeMb를 아예 읽지 않고 끝난다. 흔한 오답은 세 조건을 모두
 * 계산해 놓고 마지막에 우선순위를 매기는 형태인데, 그렇게 하면 "놓쳐도 되는데 보존 기간이 길다"는
 * 모순된 요건에서 Redis 밖으로 나가는 답이 나온다.
 *
 * ## 3단계: 두 external-mq 조건 중 보존 기간을 먼저 보는 이유
 *
 * 둘 다 결론은 Redis 밖의 메시지 큐로 같지만 근거 코드가 다르고, 근거는 읽는 사람의
 * 다음 행동을 바꾼다. volume-exceeds-memory는 "메모리를 증설하면 Streams로 돌아올 수 있다"로
 * 읽히지만, retention-exceeds-threshold는 증설로 해결되지 않는 요구다. 며칠에서 몇 주에 걸친
 * 보존을 메모리에 사는 자료 구조로 감당하는 것은 비용 구조 자체가 맞지 않기 때문이다.
 * 그래서 둘이 함께 걸릴 때는 더 근본적인 쪽을 근거로 남긴다.
 *
 * ## 경계의 부등호 방향이 서로 다른 이유
 *
 * 보존 기간은 이상(>=)에서 걸리고 보존량은 초과(>)에서 걸린다. 방향이 다른 것은 실수가 아니라
 * 두 값의 성질이 다르기 때문이다. RETENTION_THRESHOLD_HOURS는 "이 정도를 넘어가는 보존은
 * Redis로 감당하지 않는다"고 미리 그어 둔 정책선이므로 그 선에 닿는 순간 정책이 적용된다.
 * 반면 availableMemoryMb는 실제로 담을 수 있는 물리적 한계이고, 한계와 정확히 같은 양은
 * 아직 담기므로 걸리지 않는다.
 *
 * ## 근거 코드가 입력 필드의 이름이 아닌 이유
 *
 * needsRedelivery가 false여도 손실을 허용하지 않는 갈래의 근거는 redelivery-required다.
 * 근거 코드는 입력의 어느 필드가 참이었는지를 말하는 것이 아니라 판정이 도달한 갈래를 가리킨다.
 * 손실을 허용하지 않는 이상 확인 응답과 재전달이 필요하다는 것이 이 갈래의 내용이고,
 * 요건 작성자가 그 요구를 명시하지 않았을 뿐이다.
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

export function decide(req: Requirement): Decision {
	// 1단계. 재처리 요구가 손실 허용 선언을 무효화한다.
	//        입력 객체를 고치지 않고 지역 변수 하나로만 판단을 좁힌다.
	const lossTolerated = req.lossTolerated && !req.needsRedelivery;

	// 2단계. 놓쳐도 되면 여기서 끝난다. 아래 조건은 읽지 않는다.
	if (lossTolerated) {
		return { choice: 'pubsub', reason: 'loss-tolerated' };
	}

	// 3-a. 정책선에 닿으면 걸린다(이상).
	if (req.retentionHours >= RETENTION_THRESHOLD_HOURS) {
		return { choice: 'external-mq', reason: 'retention-exceeds-threshold' };
	}

	// 3-b. 물리적 한계를 넘어야 걸린다(초과). 한계와 같은 양은 아직 담긴다.
	if (req.retainedVolumeMb > req.availableMemoryMb) {
		return { choice: 'external-mq', reason: 'volume-exceeds-memory' };
	}

	// 3-c. 놓치면 안 되고, 보존도 용량도 Redis 안에서 감당된다.
	return { choice: 'streams', reason: 'redelivery-required' };
}

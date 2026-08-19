/**
 * 과제 e04-03-01 — 봉투로 인과 그래프 복원
 *
 * 4강: "이벤트는 계속 순서도 없이 막 도착하니까 걔네들을 연결해주는 내부적인
 * 그래프 처리가 필요하잖아. (…) 분명히 순서가 있는 일인데 이벤트 큐 시스템이
 * 순서 보장을 안 해준단 말이지. 막 날아 나온단 말이야."
 *
 * 즉 순서는 큐가 주지 않는다. **봉투의 필드로 애플리케이션이 복원한다.**
 * 이 과제는 봉투의 네 필드가 각각 무슨 일을 하는지를 코드로 확인하는 것이다.
 *
 * 명세:  tests/e04-03-01-causal-graph/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e04-03-01
 * 막히면: docs/ep04-agent-server/03-envelope.md
 */

/** 봉투의 분류 축 중 `scope`. 계층의 어느 층에 속한 이벤트인가. */
export type Scope = 'session' | 'turn' | 'iteration' | 'tool';

/** 봉투. 이 과제에 필요한 필드만 남겼다. */
export interface Envelope {
	/** 이벤트 1건의 고유 ID. 재시도하면 바뀐다. */
	eventKey: string;
	/** 멱등 경계. 재시도해도 같다. */
	transactionKey: string;
	/** 인과 그래프의 부모. 루트면 null. */
	parentEventKey: string | null;
	scope: Scope;
	/**
	 * 스트림 조각의 순번. 단조 증가.
	 * 스트리밍이 아닌 이벤트는 null이다.
	 */
	sequence: number | null;
	/** 표시용 이름 (예: `turn.start`, `iteration.progress`). */
	action: string;
}

/** 복원된 인과 트리의 노드. */
export interface Node {
	envelope: Envelope;
	/** 도착 순서가 아니라 인과 순서로 정렬된 자식들. */
	children: Node[];
}

export interface Restored {
	/** parentEventKey가 null인 이벤트들에서 뻗은 트리들. */
	roots: Node[];
	/**
	 * 부모를 찾을 수 없어 트리에 붙지 못한 이벤트들.
	 *
	 * 버리면 안 된다 — 부모 이벤트가 아직 도착하지 않은 것일 수도 있고,
	 * 인과 키가 잘못 채워진 버그일 수도 있다. 둘 다 알아야 한다.
	 */
	orphans: Envelope[];
}

/**
 * 순서 없이 도착한 이벤트 배열에서 인과 트리를 복원한다.
 *
 * 힌트: 입력 배열의 순서를 그대로 믿으면 안 된다 — 부모가 자식보다 늦게
 *       도착할 수 있다. 그리고 데이터가 깨져 부모 관계에 **순환**이 생기면
 *       재귀가 무한히 돈다.
 *
 *       자식 정렬 기준: `sequence`가 있으면 그것으로, 없으면 도착 순서를 유지한다.
 *       도착 순서를 유지해야 하는 이유는, 순번이 없는 이벤트에 대해 우리가
 *       가진 유일한 정보가 그것뿐이기 때문이다.
 */
export function restore(events: Envelope[]): Restored {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: restore');
}

/**
 * 한 트랜잭션의 스트림에서 빠진 순번을 찾는다.
 *
 * 3장: sequence는 "스트림 재정렬 **및 누락 감지**용 단조 증가 번호"다.
 * 3 다음에 5가 오면 4가 빠졌음을 수신자가 알 수 있어야 한다.
 *
 * 힌트: 어디서부터 세는지가 결정이다. 받은 것 중 가장 작은 번호부터 세면
 *       맨 앞이 빠진 경우를 놓친다 — 스트림은 0(또는 1)부터 시작한다는 사실을
 *       쓸 수 있다. 이 과제는 **0부터 시작**하는 규약이다.
 */
export function missingSequences(events: Envelope[], transactionKey: string): number[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: missingSequences');
}

/**
 * 트리를 인과 순서대로 평탄화한다 (깊이 우선, 부모가 자식보다 먼저).
 *
 * 이것이 "재정렬"의 결과물이다 — 도착 순서가 아니라 실제로 일어난 순서.
 */
export function flatten(nodes: Node[]): Envelope[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: flatten');
}

/**
 * 계층 규칙을 어긴 간선을 찾는다.
 *
 * 계층은 session → turn → iteration → tool 순이다. 부모의 scope가 자식보다
 * **아래** 층이면 뒤집힌 것이다 (예: tool 이벤트의 자식이 turn 이벤트).
 * 같은 층끼리는 허용한다 — 이터레이션이 이터레이션을 잇는 것은 정상이다.
 *
 * 힌트: 이 검사는 "데이터가 잘못됐다"를 알려주는 용도다. 조용히 통과시키면
 *       그래프가 그려지긴 하는데 의미가 없는 그래프가 된다.
 */
export function scopeViolations(events: Envelope[]): Array<{ child: string; parent: string }> {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: scopeViolations');
}

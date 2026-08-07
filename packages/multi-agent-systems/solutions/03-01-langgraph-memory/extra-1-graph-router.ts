/**
 * 선택 문제의 참고 구현 — StateGraph의 두 조각.
 *
 * 판정은 tests/03-01-langgraph-memory/extra-1-graph-router.test.ts가 한다.
 *
 * 📍 되짚기: docs/03-langgraph-basics.md
 */

export interface GraphMessage {
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; name: string }>;
  tool_call_id?: string;
}

export interface GraphState {
  messages: GraphMessage[];
}

/**
 * 판단 근거는 **마지막 메시지 하나**다. 과거의 툴 호출까지 보면 이미 처리된
 * 호출로 tools 노드에 다시 들어가 루프가 끝나지 않는다.
 *
 * `tool_calls`는 존재가 아니라 **길이**로 본다. 툴을 쓰지 않은 응답에도 빈
 * 배열이 실려 오는 프로바이더가 있고, 키의 유무만 보면 그런 응답에서 tools로
 * 가버린다 — tools 노드는 실행할 게 없어 빈 결과를 돌려주고, 그 결과가 다시
 * 모델로 들어가면서 같은 자리를 맴돈다.
 */
export function shouldContinue(state: GraphState): "tools" | "__end__" {
  const last = state.messages.at(-1);
  return last?.tool_calls?.length ? "tools" : "__end__";
}

/**
 * 리듀서는 새 배열을 만든다. `prev.push(...next)`로 제자리에서 바꾸면 당장은
 * 같아 보이지만, 체크포인트에서 복원하거나 같은 상태에서 분기(fork)할 때
 * 이전 스냅샷까지 함께 변해 버린다 — 원인을 찾기 어려운 종류의 버그다.
 */
export function appendMessages(prev: GraphMessage[], next: GraphMessage[]): GraphMessage[] {
  return [...prev, ...next];
}

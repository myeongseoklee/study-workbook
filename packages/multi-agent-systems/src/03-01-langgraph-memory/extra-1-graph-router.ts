/**
 * 선택 문제 — StateGraph를 손수 조립할 때의 두 조각 (docs/03-langgraph-basics.md)
 *
 * 프리빌트(createAgent)는 "언제 툴로 가고 언제 끝낼지"와 "상태를 어떻게 쌓을지"를
 * 대신 정해 준다. 손으로 조립하려면 그 둘을 직접 써야 하는데, 이건 LangGraph API가
 * 아니라 **에이전트 루프의 설계**다 — 그래서 프레임워크 없이도 만들 수 있다.
 *
 * 명세: tests/03-01-langgraph-memory/extra-1-graph-router.test.ts (먼저 읽어라)
 * 판정: pnpm test extra-1-graph-router
 * 막히면: docs/03-langgraph-basics.md
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
 * 조건부 엣지: 다음에 tools 노드로 갈지, 그래프를 끝낼지.
 *
 * 힌트: 무엇을 보고 판단하는가? "툴 호출이 있다"의 정의를 조심하라 —
 *       프로바이더에 따라 툴을 안 쓴 응답에도 빈 배열이 실려 온다.
 */
export function shouldContinue(state: GraphState): "tools" | "__end__" {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: shouldContinue");
}

/**
 * 상태 리듀서: 기존 메시지에 새 메시지를 더한다.
 *
 * 힌트: LangGraph의 리듀서는 이전 상태를 **바꾸지 않고** 새 상태를 돌려준다.
 *       제자리 변경(push)은 재실행·분기·체크포인트 복원에서 조용히 어긋난다.
 */
export function appendMessages(prev: GraphMessage[], next: GraphMessage[]): GraphMessage[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: appendMessages");
}

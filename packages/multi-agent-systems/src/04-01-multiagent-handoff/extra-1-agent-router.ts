/**
 * 선택 문제 — 순차 핸드오프를 오케스트레이터로 (docs/04-multi-agent-patterns.md)
 *
 * 순차 핸드오프는 "다음은 누구"를 코드가 미리 정해 둔다. 그걸 LLM이 tool_use로
 * 고르게 바꾸는 순간, 모델이 지어낸 이름·병렬 위임·깨진 인자를 코드가 감당해야
 * 한다. 이 파일은 그 판단만 떼어낸 것이다 — 실행 루프는 index.ts가 담당한다.
 *
 * 명세: tests/04-01-multiagent-handoff/extra-1-agent-router.test.ts (먼저 읽어라)
 * 판정: pnpm test extra-1-agent-router
 * 막히면: docs/04-multi-agent-patterns.md
 */

export interface AssistantTurn {
  role: "assistant";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export type RouteDecision =
  | { kind: "agent"; name: string; input: string }
  | { kind: "final"; answer: string }
  | { kind: "error"; reason: string };

/**
 * 모델의 응답을 읽고 다음 차례를 정한다.
 *
 * 위임 규약: 툴 이름은 `call_{에이전트}` 형식이고, 인자는 `{"input": "..."}`.
 *
 * 힌트: 실패 경로가 성공 경로보다 많다. 무엇이 error이고 무엇이 정상인지
 *       테스트가 정확히 정해 두었으니 먼저 읽어라. 그리고 이 함수는
 *       **던지지 않는다** — 라우터가 예외를 흘리면 루프 전체가 죽는다.
 */
export function decideNext(turn: AssistantTurn, registry: string[]): RouteDecision {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: decideNext");
}

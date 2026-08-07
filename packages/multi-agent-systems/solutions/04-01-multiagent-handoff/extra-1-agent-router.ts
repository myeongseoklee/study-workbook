/**
 * 선택 문제의 참고 구현 — 오케스트레이터 라우터.
 *
 * 판정은 tests/04-01-multiagent-handoff/extra-1-agent-router.test.ts가 한다.
 *
 * 📍 되짚기: docs/04-multi-agent-patterns.md
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

const PREFIX = "call_";

/**
 * 판정 순서가 곧 설계다.
 *
 *   ① 툴 호출이 **없으면** 최종 답 — 여기서 `tool_calls`의 존재가 아니라 길이를
 *      보는 이유는 빈 배열을 실어 보내는 프로바이더가 있어서다.
 *   ② 둘 이상이면 거부 — 병렬 위임을 허용하는 순간 "최종 답을 누가 쓰는가"가
 *      불분명해진다. 두 갈래가 다른 결론을 내면 합칠 근거가 없다(단일 작성자).
 *   ③ 이름이 규약(`call_{에이전트}`)과 레지스트리에 맞는지 — 모델은 없는
 *      에이전트를 지어낸다. 실행 전에 걸러야 한다.
 *   ④ 인자 파싱 — 모델이 만든 문자열은 언제든 깨진다.
 *
 * 어느 경로에서도 **던지지 않는다.** 라우터가 예외를 흘리면 오케스트레이션
 * 루프가 통째로 죽고, 모델에게 "무엇이 잘못됐는지" 돌려줄 기회도 사라진다.
 */
export function decideNext(turn: AssistantTurn, registry: string[]): RouteDecision {
  const calls = turn.tool_calls ?? [];

  if (calls.length === 0) {
    if (typeof turn.content === "string" && turn.content.length > 0) {
      return { kind: "final", answer: turn.content };
    }
    return { kind: "error", reason: "툴 호출도 답변 내용도 없다" };
  }

  if (calls.length > 1) {
    const names = calls.map((c) => c.function.name).join(", ");
    return { kind: "error", reason: `한 번에 하나만 위임할 수 있다 (받은 호출: ${names})` };
  }

  const { name, arguments: rawArgs } = calls[0]!.function;
  if (!name.startsWith(PREFIX)) {
    return { kind: "error", reason: `위임 규약을 벗어난 툴 이름: ${name} (call_ 접두 필요)` };
  }

  const agent = name.slice(PREFIX.length);
  if (!registry.includes(agent)) {
    return { kind: "error", reason: `등록되지 않은 에이전트: ${agent}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs || "{}");
  } catch {
    return { kind: "error", reason: `인자 JSON을 읽을 수 없다: ${rawArgs}` };
  }

  // 인자 누락은 오류가 아니다 — 위임받은 에이전트가 원래 질문으로 시작하면 된다.
  const input = (parsed as { input?: unknown })?.input;
  return { kind: "agent", name: agent, input: typeof input === "string" ? input : "" };
}

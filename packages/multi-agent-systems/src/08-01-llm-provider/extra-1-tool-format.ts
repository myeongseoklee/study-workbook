/**
 * 선택 문제 — 벤더별 tool 형식 정규화 (docs/08-agent-platform-infra.md)
 *
 * LLMProvider가 텍스트만 다루면 에이전트를 못 만든다. tool 호출까지 인터페이스에
 * 넣으려면 벤더 차이를 **어댑터가 흡수**해야 한다. 흡수하지 못하면 상위 코드가
 * 벤더를 알게 되고, 그 순간 추상화는 이름만 남는다.
 *
 * 명세: tests/08-01-llm-provider/extra-1-tool-format.test.ts (먼저 읽어라)
 * 판정: pnpm test extra-1-tool-format
 * 막히면: docs/08-agent-platform-infra.md
 */

/** 우리 쪽 표준 형식 — 벤더 중립. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** 정규화된 툴 호출 — 어느 벤더에서 왔든 이 모양이다. */
export interface NormalizedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * ToolSpec → OpenAI 형식.
 *
 * 힌트: OpenAI는 `function` 아래로 한 겹 감싼다.
 */
export function toOpenAITool(spec: ToolSpec): Record<string, unknown> {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: toOpenAITool");
}

/**
 * ToolSpec → Anthropic 형식.
 *
 * 힌트: 평평하다. 그리고 같은 개념인데 **키 이름이 다르다** — 그 한 글자를
 *       흘리면 벤더를 바꿨을 때 툴이 통째로 무시된다.
 */
export function toAnthropicTool(spec: ToolSpec): Record<string, unknown> {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: toAnthropicTool");
}

/**
 * 벤더 응답 → 정규화된 툴 호출 목록.
 *
 * 힌트: 두 벤더의 가장 잦은 혼동 지점은 **인자의 타입**이다. 한쪽은 JSON
 *       문자열이고 다른 쪽은 이미 객체다. 그리고 이 함수는 던지지 않는다 —
 *       모델이 만든 문자열은 언제든 깨지는데, 어댑터가 던지면 같은 응답의
 *       정상 호출까지 함께 잃는다.
 */
export function parseToolCalls(
  vendor: "openai" | "anthropic",
  raw: Record<string, unknown>,
): NormalizedToolCall[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: parseToolCalls");
}

/**
 * 선택 문제의 참고 구현 — 벤더별 tool 형식 정규화.
 *
 * 판정은 tests/08-01-llm-provider/extra-1-tool-format.test.ts가 한다.
 *
 * 📍 되짚기: docs/08-agent-platform-infra.md
 */

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface NormalizedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** OpenAI는 `function` 아래로 한 겹 감싼다. */
export function toOpenAITool(spec: ToolSpec): Record<string, unknown> {
  return {
    type: "function",
    function: { name: spec.name, description: spec.description, parameters: spec.parameters },
  };
}

/**
 * Anthropic은 평평하고, 스키마 키가 `input_schema`다.
 *
 * `parameters`를 그대로 넘기면 에러가 나지 않고 **툴이 조용히 무시된다** —
 * 모델은 인자 스키마를 못 받은 채 이름만 보고 호출을 시도하거나 아예 안 쓴다.
 * 벤더 교체 후 "모델이 갑자기 툴을 안 쓴다"의 흔한 원인이 이것이다.
 */
export function toAnthropicTool(spec: ToolSpec): Record<string, unknown> {
  return { name: spec.name, description: spec.description, input_schema: spec.parameters };
}

function asObject(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

/**
 * 두 벤더의 차이는 **위치**와 **인자 타입** 둘이다.
 *
 *   OpenAI    : `tool_calls[]`      · arguments가 JSON **문자열** → 파싱해야 한다
 *   Anthropic : `content[]`의 일부  · input이 이미 **객체** → 파싱하면 안 된다
 *
 * 한쪽 규칙을 다른 쪽에 적용하면 `JSON.parse(object)`가 `"[object Object]"`를
 * 먹고 던지거나, 반대로 문자열이 그대로 input에 실려 도구가 인자를 못 읽는다.
 *
 * 깨진 호출은 **그것만 버린다.** 던지면 같은 응답에 함께 온 정상 호출까지
 * 잃고, 상위 루프는 회복할 기회가 없다.
 */
export function parseToolCalls(
  vendor: "openai" | "anthropic",
  raw: Record<string, unknown>,
): NormalizedToolCall[] {
  if (vendor === "openai") {
    const calls = Array.isArray(raw.tool_calls) ? raw.tool_calls : [];
    const out: NormalizedToolCall[] = [];
    for (const c of calls as Array<Record<string, any>>) {
      const fn = c?.function;
      if (!fn?.name) continue;
      try {
        out.push({ id: String(c.id), name: String(fn.name), input: asObject(JSON.parse(fn.arguments || "{}")) });
      } catch {
        // 모델이 만든 인자 문자열이 깨졌다 — 이 호출만 버린다.
      }
    }
    return out;
  }

  const blocks = Array.isArray(raw.content) ? raw.content : [];
  return (blocks as Array<Record<string, any>>)
    .filter((b) => b?.type === "tool_use")
    .map((b) => ({ id: String(b.id), name: String(b.name), input: asObject(b.input) }));
}

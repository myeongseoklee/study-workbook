/**
 * 선택 문제의 참고 구현 — 벤더별 tool 형식 정규화.
 *
 * 판정은 tests/08-01-llm-provider/extra-1-tool-format.test.ts가 한다.
 *
 * 📍 되짚기: docs/08-agent-platform-infra.md § 벤더별 tool 형식 — 실제 모양
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

/** openai: chat.completions 응답의 message.tool_calls. */
export interface OpenAIToolCallsRaw {
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
}

/**
 * anthropic: messages 응답의 content. tool_use 외 블록(text 등)도 섞여 온다.
 * text·tool_use가 한 배열에 섞이므로 필드를 리터럴로 좁히지 않는다 — `type`으로
 * 직접 걸러야 한다(구현에서 `b.type === "tool_use"`로 확인).
 */
export interface AnthropicContentRaw {
  content?: Array<{
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
}

/** gemini: generateContent 응답. functionCall 은 thoughtSignature 와 나란히 온다. */
export interface GeminiCandidatesRaw {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        functionCall?: { name: string; args: Record<string, unknown>; id?: string };
        thoughtSignature?: string;
      }>;
    };
  }>;
}

/** parseToolCalls 가 받는 원본 응답 — 벤더별로 이 셋 중 하나다. */
export type VendorToolResponse = OpenAIToolCallsRaw | AnthropicContentRaw | GeminiCandidatesRaw;


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
 * 세 벤더의 차이는 **위치**와 **인자 타입**이다.
 *
 *   openai    : `tool_calls[]`                        · arguments가 JSON **문자열** → 파싱해야 한다
 *   anthropic : `content[]`의 일부(`type: tool_use`)   · input이 이미 **객체** → 파싱하면 안 된다
 *   gemini    : `candidates[0].content.parts[]`의 일부 · args가 이미 **객체** → 파싱하면 안 된다
 *
 * 한쪽 규칙을 다른 쪽에 적용하면 `JSON.parse(object)`가 `"[object Object]"`를
 * 먹고 던지거나, 반대로 문자열이 그대로 input에 실려 도구가 인자를 못 읽는다.
 *
 * 깨진 호출은 **그것만 버린다.** 던지면 같은 응답에 함께 온 정상 호출까지
 * 잃고, 상위 루프는 회복할 기회가 없다.
 *
 * gemini의 각 part엔 `functionCall`과 나란히 `thoughtSignature`가 실려 있다.
 * 여기서 그 필드를 버리는 것 자체는 맞다 — NormalizedToolCall이 담을 자리가
 * 없다. 다만 이 결과로 **다음 턴을 이어가려 하면** 그 서명이 없어 깨진다.
 * docs/03-langgraph-basics.md 가 LangGraph에서 겪은 바로 그 유실이, 정규화
 * 함수 하나로도 재현된다는 것이 이 케이스의 요점이다.
 */
export function parseToolCalls(
  vendor: "openai" | "anthropic" | "gemini",
  raw: VendorToolResponse,
): NormalizedToolCall[] {
  if (vendor === "openai") {
    const calls = (raw as OpenAIToolCallsRaw).tool_calls ?? [];
    const out: NormalizedToolCall[] = [];
    for (const c of calls) {
      if (!c?.function?.name) continue;
      try {
        out.push({ id: c.id, name: c.function.name, input: asObject(JSON.parse(c.function.arguments || "{}")) });
      } catch {
        // 모델이 만든 인자 문자열이 깨졌다 — 이 호출만 버린다.
      }
    }
    return out;
  }

  if (vendor === "gemini") {
    const parts = (raw as GeminiCandidatesRaw).candidates?.[0]?.content?.parts ?? [];
    const out: NormalizedToolCall[] = [];
    for (const part of parts) {
      const fc = part.functionCall;
      if (!fc?.name || !fc?.id) continue; // id 없이는 이후 응답과 짝지을 수 없다 — 버린다.
      out.push({ id: fc.id, name: fc.name, input: asObject(fc.args) });
    }
    return out;
  }

  const blocks = (raw as AnthropicContentRaw).content ?? [];
  const out: NormalizedToolCall[] = [];
  for (const b of blocks) {
    if (b.type !== "tool_use" || !b.id || !b.name) continue;
    out.push({ id: b.id, name: b.name, input: asObject(b.input) });
  }
  return out;
}

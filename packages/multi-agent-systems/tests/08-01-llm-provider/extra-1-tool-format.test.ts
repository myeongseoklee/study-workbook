// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/08-01-llm-provider/extra-1-tool-format.ts를 고쳐라.
//
// 선택 문제: LLMProvider가 텍스트만 다루면 에이전트를 못 만든다. tool 호출까지
// 인터페이스에 넣으려면 벤더별 형식 차이를 어댑터가 흡수해야 하는데, 그 변환은
// 순수 함수라 네트워크 없이 판정할 수 있다.
import { describe, expect, it } from "vitest";
import { parseToolCalls, toAnthropicTool, toOpenAITool } from "../../src/08-01-llm-provider/extra-1-tool-format";
import type { ToolSpec } from "../../src/08-01-llm-provider/extra-1-tool-format";

const spec: ToolSpec = {
  name: "add",
  description: "두 수를 더한다",
  parameters: {
    type: "object",
    properties: { a: { type: "number" }, b: { type: "number" } },
    required: ["a", "b"],
  },
};

describe("toOpenAITool — function 래핑", () => {
  it("type:function 아래 name·description·parameters를 넣는다", () => {
    expect(toOpenAITool(spec)).toEqual({
      type: "function",
      function: { name: "add", description: "두 수를 더한다", parameters: spec.parameters },
    });
  });
});

describe("toAnthropicTool — 평평하고, 스키마 키 이름이 다르다", () => {
  it("래핑 없이 name·description과 input_schema를 낸다", () => {
    // 같은 개념(파라미터 스키마)의 키 이름이 벤더마다 다르다. 이 한 글자 차이를
    // 어댑터가 흡수하지 않으면 상위 코드가 벤더를 알게 된다 — 추상화가 새는 지점.
    expect(toAnthropicTool(spec)).toEqual({
      name: "add",
      description: "두 수를 더한다",
      input_schema: spec.parameters,
    });
  });

  it("parameters라는 키를 남기지 않는다", () => {
    expect(toAnthropicTool(spec)).not.toHaveProperty("parameters");
  });
});

describe("parseToolCalls — 응답에서 호출을 꺼낸다", () => {
  it("openai: arguments는 JSON **문자열**이라 파싱해야 한다", () => {
    const raw = {
      tool_calls: [
        { id: "c1", type: "function", function: { name: "add", arguments: '{"a":3,"b":5}' } },
      ],
    };
    expect(parseToolCalls("openai", raw)).toEqual([{ id: "c1", name: "add", input: { a: 3, b: 5 } }]);
  });

  it("anthropic: input은 이미 **객체**라 파싱하면 안 된다", () => {
    // 두 벤더의 가장 잦은 혼동 지점. 한쪽 규칙을 다른 쪽에 적용하면
    // JSON.parse(object)가 "[object Object]"를 먹고 던지거나, 반대로
    // 문자열이 그대로 input에 실려 도구가 인자를 못 읽는다.
    const raw = {
      content: [
        { type: "text", text: "계산할게요" },
        { type: "tool_use", id: "c1", name: "add", input: { a: 3, b: 5 } },
      ],
    };
    expect(parseToolCalls("anthropic", raw)).toEqual([{ id: "c1", name: "add", input: { a: 3, b: 5 } }]);
  });

  it("anthropic: text 블록은 건너뛰고 tool_use만 모은다", () => {
    const raw = {
      content: [
        { type: "text", text: "먼저" },
        { type: "tool_use", id: "c1", name: "add", input: {} },
        { type: "text", text: "그리고" },
        { type: "tool_use", id: "c2", name: "multiply", input: {} },
      ],
    };
    expect(parseToolCalls("anthropic", raw).map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("툴 호출이 없으면 양쪽 다 빈 배열이다 — null이 아니다", () => {
    expect(parseToolCalls("openai", { tool_calls: [] })).toEqual([]);
    expect(parseToolCalls("openai", {})).toEqual([]);
    expect(parseToolCalls("anthropic", { content: [{ type: "text", text: "답" }] })).toEqual([]);
    expect(parseToolCalls("anthropic", {})).toEqual([]);
  });

  it("openai: arguments가 빈 문자열이면 빈 객체로 본다 (경계)", () => {
    const raw = { tool_calls: [{ id: "c1", type: "function", function: { name: "now", arguments: "" } }] };
    expect(parseToolCalls("openai", raw)).toEqual([{ id: "c1", name: "now", input: {} }]);
  });

  it("openai: arguments가 깨졌으면 던지지 않고 그 호출만 버린다", () => {
    // 모델이 만든 문자열은 언제든 깨진다. 어댑터가 던지면 나머지 정상 호출까지
    // 함께 잃고, 상위 루프는 회복할 기회가 없다.
    const raw = {
      tool_calls: [
        { id: "bad", type: "function", function: { name: "add", arguments: "{a:" } },
        { id: "ok", type: "function", function: { name: "add", arguments: '{"a":1}' } },
      ],
    };
    expect(parseToolCalls("openai", raw)).toEqual([{ id: "ok", name: "add", input: { a: 1 } }]);
  });

  it("두 벤더의 결과 모양이 같다 — 상위 코드가 벤더를 몰라도 되는 이유다", () => {
    const openai = parseToolCalls("openai", {
      tool_calls: [{ id: "c1", type: "function", function: { name: "add", arguments: '{"a":1}' } }],
    });
    const anthropic = parseToolCalls("anthropic", {
      content: [{ type: "tool_use", id: "c1", name: "add", input: { a: 1 } }],
    });
    expect(openai).toEqual(anthropic);
  });
});

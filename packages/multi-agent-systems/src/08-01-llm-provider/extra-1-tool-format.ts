/**
 * 선택 문제 — 벤더별 tool 형식 정규화 (docs/08-agent-platform-infra.md)
 *
 * LLMProvider가 텍스트만 다루면 에이전트를 못 만든다. tool 호출까지 인터페이스에
 * 넣으려면 벤더 차이를 **어댑터가 흡수**해야 한다. 흡수하지 못하면 상위 코드가
 * 벤더를 알게 되고, 그 순간 추상화는 이름만 남는다.
 *
 * 명세: tests/08-01-llm-provider/extra-1-tool-format.test.ts (먼저 읽어라)
 * 판정: pnpm test extra-1-tool-format
 * 막히면: docs/08-agent-platform-infra.md § 벤더별 tool 형식 — 실제 모양
 */

import type { ChatCompletionMessageFunctionToolCall } from "openai/resources/chat/completions/completions";
import type { TextBlock, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages/messages";

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
 * openai: chat.completions 응답의 message.tool_calls.
 *
 * `function` 필드는 `openai` 패키지의 실제 타입(`ChatCompletionMessageFunctionToolCall["function"]`)을
 * 그대로 재사용한다 — `name`·`arguments`가 지어낸 모양이 아니라 SDK가 실제로 주는 모양이다.
 * `type`만 리터럴("function")이 아니라 string이다 — 명세가 `const raw = {...}`로 먼저 변수에
 * 담은 뒤 넘기는 자리가 있어, 그 시점에 리터럴이 string으로 넓어진다(타입이 아니라 이 파일
 * 밖의 명세가 정할 수 없는 제약이라 여기서 맞춰준다).
 */
export interface OpenAIToolCallsRaw {
  tool_calls?: Array<{
    id: string;
    type: string;
    function: ChatCompletionMessageFunctionToolCall["function"];
  }>;
}

/**
 * anthropic: messages 응답의 content. text·tool_use 블록이 섞여 온다.
 *
 * `input`은 `@anthropic-ai/sdk`의 실제 `ToolUseBlock["input"]`(=`unknown`)을 그대로 쓴다.
 * `type`은 위와 같은 이유로 리터럴이 아니라 string이다 — `b.type === "tool_use"`로
 * 직접 걸러야 한다(구현 참고).
 */
export interface AnthropicContentItem {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: ToolUseBlock["input"];
}

export interface AnthropicContentRaw {
  content?: AnthropicContentItem[];
}

/**
 * gemini: generateContent 응답. functionCall 은 thoughtSignature 와 나란히 온다.
 * 이 프로젝트엔 Gemini 네이티브 SDK가 의존성으로 없어서(OpenAI 호환 엔드포인트만
 * 쓴다) 가져올 실제 타입이 없다 — 아래는 gemini-3.1-flash-lite 를 실제로 호출해
 * 확인한 응답 모양을 손으로 옮긴 것이다(docs/08 § 벤더별 tool 형식 참고).
 */
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
 * 힌트: 세 벤더의 가장 잦은 혼동 지점은 **인자의 타입**이다. openai는 JSON
 *       문자열, anthropic·gemini는 이미 객체다. 그리고 이 함수는 던지지 않는다 —
 *       모델이 만든 문자열은 언제든 깨지는데, 어댑터가 던지면 같은 응답의
 *       정상 호출까지 함께 잃는다.
 *
 *       gemini는 `candidates[0].content.parts[]`에 functionCall이 실린다.
 *       각 part엔 함께 `thoughtSignature`(대화를 이어갈 서명)가 붙어 있는데,
 *       NormalizedToolCall에는 그 자리가 없다 — docs/03-langgraph-basics.md
 *       § 프레임워크와 provider 호환 이 경고한 "정규화가 곧 재구성"이 여기서
 *       실제로 벌어진다. 이 함수가 만든 결과로 **다음 턴을 이어가려 하면
 *       깨진다** — 지금 이 정규화는 한 번의 호출을 읽는 데만 안전하다.
 */
// vendor·raw가 한 객체의 필드가 아니라 별개 파라미터라, switch(vendor) 만으로는
// TypeScript가 raw를 자동으로 좁혀주지 않는다(진짜 discriminated union이 아니다).
// 오버로드로 "vendor가 이 값이면 raw는 이 타입"을 호출부에 알려준다 — 그래야
// 잘못된 벤더에 잘못된 모양의 raw를 넘기는 실수를 호출 시점에 잡는다.
export function parseToolCalls(vendor: "openai", raw: OpenAIToolCallsRaw): NormalizedToolCall[];
export function parseToolCalls(vendor: "anthropic", raw: AnthropicContentRaw): NormalizedToolCall[];
export function parseToolCalls(vendor: "gemini", raw: GeminiCandidatesRaw): NormalizedToolCall[];
export function parseToolCalls(
  vendor: "openai" | "anthropic" | "gemini",
  raw: VendorToolResponse,
): NormalizedToolCall[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: parseToolCalls");
}

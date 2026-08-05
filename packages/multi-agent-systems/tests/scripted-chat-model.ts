// 테스트 전용 헬퍼 — 명세가 아니다. week1(LangGraph) 테스트에서만 쓴다.
//
// LangChain의 내장 페이크(@langchain/core/utils/testing)는 이 실습에 안 맞는다:
// FakeChatModel은 tool_call을 못 만들고, FakeListChatModel은 텍스트 응답만 대본에 담을 수 있다.
// createAgent가 실제로 도는 걸 검증하려면 tool_call이 있는 AIMessage를 순서대로 돌려주는
// 모델이 필요해서, BaseChatModel을 직접 상속해 만든다.
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";

export interface ScriptedStep {
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
}

/** 정해진 순서대로 AIMessage를 돌려주는 가짜 채팅 모델. 받은 messages를 매 호출마다 기록한다. */
export class ScriptedChatModel extends BaseChatModel {
  private readonly steps: ScriptedStep[];
  private cursor = 0;
  readonly calls: BaseMessage[][] = [];

  constructor(steps: ScriptedStep[]) {
    super({});
    this.steps = steps;
  }

  static override lc_name() {
    return "ScriptedChatModel";
  }

  override _llmType(): string {
    return "scripted";
  }

  // createAgent가 모델에 툴 스키마를 알려주려고 호출한다. 이 스텁은 대본대로만 답하므로
  // 툴 정의 자체는 쓰지 않고 그대로 통과시킨다.
  override bindTools(): this {
    return this;
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    this.calls.push(messages);
    if (this.cursor >= this.steps.length) {
      throw new Error(
        `ScriptedChatModel: 대본은 ${this.steps.length}개인데 ${this.cursor + 1}번째 호출이 들어왔습니다. ` +
          `종료 조건에 도달하지 못하고 계속 도는 중인지 확인하세요.`
      );
    }
    const step = this.steps[this.cursor];
    this.cursor += 1;

    const message = new AIMessage({
      content: step.content,
      tool_calls: step.toolCalls?.map((tc, i) => ({
        name: tc.name,
        args: tc.args,
        id: tc.id ?? `call_${this.cursor}_${i}`,
        type: "tool_call" as const,
      })),
    });

    return { generations: [{ message, text: step.content }] };
  }
}

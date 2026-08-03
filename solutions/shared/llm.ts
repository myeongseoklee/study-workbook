import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

// 모든 실습이 공유하는 LLM 클라이언트.
// .env 의 ANTHROPIC_API_KEY 를 자동으로 읽는다 (dotenv/config).
if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "\n⚠️  ANTHROPIC_API_KEY 가 없습니다.\n" +
      "   1) cp .env.example .env\n" +
      "   2) .env 에 실제 키를 넣으세요.\n"
  );
  process.exit(1);
}

export const client = new Anthropic();

// 사용할 모델. .env 의 MODEL 로 덮어쓸 수 있다.
export const MODEL = process.env.MODEL ?? "claude-sonnet-5";

/**
 * 시스템 프롬프트(역할)와 사용자 입력을 받아 최종 텍스트만 돌려주는 헬퍼.
 * 툴이 없는 단순 '전문가에게 물어보기' 용도 (week3, infra 에서 사용).
 */
export async function ask(system: string, user: string): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

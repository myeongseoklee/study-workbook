import "dotenv/config";
import OpenAI from "openai";

// 주차 실습(week0~7)은 OpenAI 호환 방식으로 LLM을 호출한다.
// 기본 provider = Google Gemini (무료 티어). 키: https://aistudio.google.com/apikey
//
// 여러 provider(Gemini·Claude·OpenAI)를 어댑터 인터페이스로 추상화하는 것은
// 08장 연습문제다 → src/infra/llm-provider.ts (Claude "cc" 어댑터를 직접 구현)
//
// ⚠️ 환경변수 주입은 이 파일에서만 일어난다 (위의 `import "dotenv/config"`).
//    .env 는 그 import 를 실행한 프로세스에만 로드되므로, 다른 파일에서
//    process.env.GEMINI_API_KEY 를 직접 읽으면 undefined 다.
//    → 다른 파일은 아래 export(API_KEY·MODEL·BASE_URL)를 import 해서 쓴다.
//    (예외: src/infra/llm-provider.ts — provider 전환 자체가 연습 대상이라 자체 로드)

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";

export const API_KEY = process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error(
    "\n⚠️  GEMINI_API_KEY 가 없습니다.\n" +
      "   1) https://aistudio.google.com/apikey 에서 무료 키 발급\n" +
      "   2) cp .env.example .env  후 GEMINI_API_KEY 를 채우세요.\n"
  );
  process.exit(1);
}

// baseURL 을 비우면 OpenAI 본토, 그대로면 Gemini(OpenAI 호환 엔드포인트).
export const BASE_URL = process.env.LLM_BASE_URL ?? GEMINI_BASE;

export const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: BASE_URL,
});

// 사용할 모델. .env 의 MODEL 로 덮어쓸 수 있다.
export const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

/**
 * 시스템 프롬프트(역할) + 사용자 입력 → 최종 텍스트.
 * 툴이 없는 '전문가에게 물어보기' 용도 (week3/5/7, infra 에서 사용).
 */
export async function ask(system: string, user: string): Promise<string> {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}

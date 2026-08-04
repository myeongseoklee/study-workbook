import OpenAI from "openai";
import { API_KEY, BASE_URL, MODEL } from "./env";

// 주차 실습(week0~7)은 OpenAI 호환 방식으로 LLM을 호출한다.
// 기본 provider = Google Gemini (무료 티어). 키: https://aistudio.google.com/apikey
//
// 여러 provider(Gemini·Claude·OpenAI)를 어댑터 인터페이스로 추상화하는 것은
// 08장 연습문제다 → src/infra/llm-provider.ts (Claude "cc" 어댑터를 직접 구현)
//
// ⚠️ 환경변수는 shared/env.ts 에서만 주입된다(dotenv/config) — 여기서도 값을 import 해 쓴다.
//    실습 파일들은 이 모듈을 통해 client·MODEL·API_KEY 를 받으면 키 검증까지 함께 얻는다.

// 값은 env 에서 왔지만, 실습 파일이 shared/llm 하나만 보고도 쓰도록 다시 내보낸다.
export { API_KEY, BASE_URL, MODEL } from "./env";

if (!API_KEY) {
  console.error(
    "\n⚠️  GEMINI_API_KEY 가 없습니다.\n" +
      "   1) https://aistudio.google.com/apikey 에서 무료 키 발급\n" +
      "   2) cp .env.example .env  후 GEMINI_API_KEY 를 채우세요.\n"
  );
  process.exit(1);
}

export const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: BASE_URL,
});

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
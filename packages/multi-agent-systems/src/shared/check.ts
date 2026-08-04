/**
 * 환경 점검 — 연습문제와 무관하게 "API 키/네트워크가 되나"만 확인한다.
 * 이게 성공하면 세팅 완료. 이후 실습에서 에러가 나면 그건 '내 코드' 문제다.
 *
 * 실행: npm run check
 */
import { MODEL, ask } from "./llm";

async function main() {
  const text = await ask("정확히 'ok'라고만 답해.", "확인");
  console.log(`✅ 환경 OK — 모델(${MODEL}) 응답: ${text.trim()}`);
}

main().catch((e) => {
  console.error("❌ 환경 점검 실패:", e?.message ?? e);
  console.error(
    "   .env 의 GEMINI_API_KEY 를 확인하세요 (무료 키: https://aistudio.google.com/apikey).\n" +
      "   404면 GEMINI_MODEL 을 현행 모델로: gemini-3.1-flash-lite (2.5-* 는 신규 계정 불가)."
  );
  process.exit(1);
});

/**
 * 환경 점검 — 연습문제와 무관하게 "API 키/네트워크가 되나"만 확인한다.
 * 이게 성공하면 세팅 완료. 이후 실습에서 에러가 나면 그건 '내 코드' 문제다.
 *
 * 실행: npm run check
 */
import { client, MODEL } from "./llm";

async function main() {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16,
    messages: [{ role: "user", content: "정확히 'ok'라고만 답해." }],
  });
  const text = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  console.log(`✅ 환경 OK — 모델(${MODEL}) 응답: ${text.trim()}`);
}

main().catch((e) => {
  console.error("❌ 환경 점검 실패:", e?.message ?? e);
  console.error("   .env 의 ANTHROPIC_API_KEY 와 크레딧을 확인하세요.");
  process.exit(1);
});

/**
 * 7주차+ — 필요해지면 RAG (docs/06-rag-when-needed.md)
 *
 * RAG = LLM에게 오픈북 시험. 질문에 관련된 문서를 검색해 프롬프트에 넣고 답을 생성.
 * 여기선 의존성 없이 "원리"만 보이도록 naive 키워드 검색으로 시작한다.
 * 진짜 의미 검색(임베딩+벡터DB)은 아래 [직접 해볼 것]에서 교체하라.
 *
 * 실행: npm run week7
 */
import { client, MODEL } from "../shared/llm";

// 아주 작은 지식 베이스 (실제로는 회사 위키/문서를 청킹한 것)
const DOCS = [
  "환불 정책: 구매 후 7일 이내, 미개봉 상태에서만 전액 환불이 가능하다.",
  "배송 정책: 평일 오후 2시 이전 주문은 당일 출고된다. 도서산간은 +2일.",
  "멤버십: 골드 등급은 무료 배송과 5% 적립을 받는다. 실버는 적립만.",
  "고객센터 운영시간: 평일 09~18시. 주말/공휴일 휴무.",
];

// 1) 검색(retrieval) — 지금은 naive 키워드 겹침 점수. (docs/06: 이걸 임베딩 검색으로 교체)
function retrieve(query: string, k = 2): string[] {
  const q = query.toLowerCase();
  return DOCS.map((d) => ({ d, score: d.split("").filter((ch) => q.includes(ch)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.d);
}

async function answer(query: string) {
  // 2) augment — 검색한 문서를 프롬프트에 끼워넣는다
  const context = retrieve(query).join("\n");
  // 3) generate — 그 근거로 답을 생성
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system:
      "너는 고객 지원 봇이다. 아래 '참고 문서'에 근거해서만 답하라. 문서에 없으면 모른다고 말하라.",
    messages: [{ role: "user", content: `참고 문서:\n${context}\n\n질문: ${query}` }],
  });
  return res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
}

async function main() {
  for (const q of ["환불 언제까지 돼?", "골드 멤버 혜택이 뭐야?"]) {
    console.log(`\nQ: ${q}`);
    console.log("A:", await answer(q));
  }
  console.log("\n👉 RAG 없이(참고 문서 제거) 같은 질문을 던져 차이를 관찰하라.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/*
 * 🛠 직접 해볼 것 (docs/06 참고):
 * 1. retrieve()를 진짜 의미 검색으로 교체: 임베딩 모델 + hnswlib-node/MemoryVectorStore
 * 2. 청크 크기를 크게/작게 바꿔 검색 품질 비교
 * 3. 정확한 제품코드/ID를 묻는 질문으로 벡터 검색이 약한 지점을 관찰 → 하이브리드(키워드+벡터)
 * 4. week5의 평가셋으로 RAG 파이프라인 변경 전후를 숫자로 측정
 */

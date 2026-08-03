/**
 * 7주차+ — 필요해지면 RAG (docs/06-rag-when-needed.md)  [연습문제]
 *
 * RAG = LLM에게 오픈북 시험. 관련 문서를 검색해 프롬프트에 넣고 답을 생성.
 * 지식 베이스(DOCS)는 채워져 있다. 검색(retrieve)과 답변(answer)을 구현하라.
 * 막히면 정답: solutions/week7-rag/index.ts
 *
 * 실행: npm run week7
 */
import { client, MODEL } from "../shared/llm";

// 아주 작은 지식 베이스 (실제로는 회사 위키/문서를 청킹한 것) — scaffolding
const DOCS = [
  "환불 정책: 구매 후 7일 이내, 미개봉 상태에서만 전액 환불이 가능하다.",
  "배송 정책: 평일 오후 2시 이전 주문은 당일 출고된다. 도서산간은 +2일.",
  "멤버십: 골드 등급은 무료 배송과 5% 적립을 받는다. 실버는 적립만.",
  "고객센터 운영시간: 평일 09~18시. 주말/공휴일 휴무.",
];

// 1) 검색(retrieval) — 지금은 naive 로 시작. 나중에 임베딩 검색으로 교체.
function retrieve(query: string, k = 2): string[] {
  // 🎯 TODO: query 와 관련도가 높은 DOCS 상위 k개를 반환하라.
  //   처음엔 naive 하게: 문자 겹침/키워드 매칭 점수로 정렬 → slice(0, k)
  //   (docs/06: 이후 임베딩+벡터 스토어로 교체하면 '의미 검색'이 된다)
  throw new Error("TODO: retrieve 구현. 막히면 solutions/week7-rag/index.ts 참고");
}

async function answer(query: string): Promise<string> {
  // 🎯 TODO:
  //   1) retrieve(query) 로 관련 문서를 뽑아 하나의 context 문자열로 합친다 (augment)
  //   2) client.messages.create 로, "아래 참고 문서에 근거해서만 답하라" 시스템 프롬프트 + context + query (generate)
  //   3) 최종 텍스트를 반환
  throw new Error("TODO: answer 구현. 막히면 solutions/week7-rag/index.ts 참고");
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
 * 🛠 더 해볼 것 (docs/06):
 * - retrieve()를 임베딩 검색으로 교체 (hnswlib-node / MemoryVectorStore)
 * - 청크 크기 실험 / 정확한 코드·ID 질문으로 벡터 검색의 약점 관찰 → 하이브리드
 * - week5 평가셋으로 파이프라인 변경 전후를 숫자로 측정
 */

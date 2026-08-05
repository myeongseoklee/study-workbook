/**
 * 7주차+ — 필요해지면 RAG (docs/06-rag-when-needed.md)
 *
 * RAG = LLM에게 오픈북 시험. 관련 문서를 검색해 프롬프트에 넣고 답을 생성.
 * 지식 베이스(DOCS)는 채워져 있다. 검색(retrieve)과 답변(answer)을 구현하라.
 *
 * 명세: tests/7-1-rag-retrieve.test.ts (먼저 읽어라)
 * 막히면 정답: solutions/7-1-rag-retrieve.ts
 */
import { ask } from "../shared/llm";

/** ask(system, user) 시그니처 — 실제 구현은 shared/llm의 ask, 테스트에서는 스텁으로 갈아끼운다. */
export type Ask = (system: string, user: string) => Promise<string>;

// 아주 작은 지식 베이스 (실제로는 회사 위키/문서를 청킹한 것) — scaffolding
export const DOCS = [
  "환불 정책: 구매 후 7일 이내, 미개봉 상태에서만 전액 환불이 가능하다.",
  "배송 정책: 평일 오후 2시 이전 주문은 당일 출고된다. 도서산간은 +2일.",
  "멤버십: 골드 등급은 무료 배송과 5% 적립을 받는다. 실버는 적립만.",
  "고객센터 운영시간: 평일 09~18시. 주말/공휴일 휴무.",
];

// 1) 검색(retrieval) — 지금은 naive 로 시작. 나중에 임베딩 검색으로 교체.
export function retrieve(query: string, docs: string[] = DOCS, k = 2): string[] {
  // 🎯 TODO: 질의와 관련도가 높은 문서 상위 k개를 docs 에서 골라 반환하라.
  //   처음엔 단순하게 — 질의와 문서의 글자/키워드 겹침으로 점수를 매겨 정렬하면 된다.
  //   (docs/06: 이후 임베딩+벡터 스토어로 바꾸면 '의미 검색'이 된다). 막히면 solutions.
  throw new Error("TODO: retrieve 구현. 막히면 solutions/7-1-rag-retrieve.ts 참고");
}

/** 검색(retrieve) → 주입(augment) → 생성(generate). askFn을 주입받아 실제 호출과 분리한다. */
export async function answer(query: string, askFn: Ask, docs: string[] = DOCS): Promise<string> {
  // 🎯 TODO: retrieve 로 뽑은 문서를 근거로 답을 생성하라 (검색 → 주입 → 생성).
  //   검색 결과를 하나의 컨텍스트로 합쳐, "이 문서에 근거해서만 답하고 없으면 모른다고 하라"는
  //   지시와 함께 모델(askFn)에 넘긴다. 막히면 solutions.
  throw new Error("TODO: answer 구현. 막히면 solutions/7-1-rag-retrieve.ts 참고");
}

async function main() {
  for (const q of ["환불 언제까지 돼?", "골드 멤버 혜택이 뭐야?"]) {
    console.log(`\nQ: ${q}`);
    console.log("A:", await answer(q, ask));
  }
  console.log("\n👉 RAG 없이(참고 문서 제거) 같은 질문을 던져 차이를 관찰하라.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

/*
 * 🛠 더 해볼 것 (docs/06):
 * - retrieve()를 임베딩 검색으로 교체 (hnswlib-node / MemoryVectorStore)
 * - 청크 크기 실험 / 정확한 코드·ID 질문으로 벡터 검색의 약점 관찰 → 하이브리드
 * - week5 평가셋으로 파이프라인 변경 전후를 숫자로 측정
 */

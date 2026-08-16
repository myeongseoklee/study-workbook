/**
 * 선택 문제 A — 스토어 없이 만드는 하이브리드 검색 (docs/06-rag-when-needed.md)
 *
 * 필수 문제의 키워드 검색만으로는 낱말이 겹치지 않는 질문을 놓친다. 반대로
 * 벡터 검색만 쓰면 "ERR_2041" 같은 정확한 코드를 놓친다. 이 문제에서는 벡터
 * 스토어 없이 코사인 유사도부터 두 검색의 결합까지 직접 만들어 원리를 확인한다.
 *
 * 명세: tests/06-01-rag-retrieve/extra-1-hybrid-rank.test.ts
 * 판정: pnpm test extra-1-hybrid-rank
 * 막히면: docs/06-rag-when-needed.md
 *   § 가깝다를 무엇으로 재나 — 코사인 유사도
 *   § 어떻게 합치나 — 순위로 합친다 (RRF)
 */

export interface VecDoc {
  id: string;
  vec: number[];
}

export interface HybridDoc extends VecDoc {
  text: string;
}

/** 두 벡터가 얼마나 같은 방향인지 계산한다. */
export function cosine(a: number[], b: number[]): number {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: cosine");
}

/** 질의 벡터와 가까운 순으로 상위 k개의 id를 반환한다. */
export function topK(query: number[], docs: VecDoc[], k: number): string[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: topK");
}

/** 여러 랭킹을 Reciprocal Rank Fusion으로 하나로 합친다. */
export function rrf(rankings: string[][], rankConstant = 60): string[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: rrf");
}

/** 키워드 랭킹과 직접 계산한 벡터 랭킹을 RRF로 합쳐 상위 k개 id를 반환한다. */
export function hybridSearch(
  query: string,
  queryVec: number[],
  docs: HybridDoc[],
  k = 3,
): string[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: hybridSearch");
}

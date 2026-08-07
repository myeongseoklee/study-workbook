/**
 * 선택 문제 — 벡터 검색과 하이브리드 랭킹 (docs/06-rag-when-needed.md)
 *
 * 키워드 검색을 벡터 검색으로 **교체**하면 정확한 코드·ID 질문에서 오히려
 * 나빠진다("ERR_2041"은 의미가 아니라 글자다). 실무의 답은 둘을 합치는 것이고,
 * 합치는 규칙은 임베딩 모델 없이도 만들 수 있다 — 순위만 쓰기 때문이다.
 *
 * 명세: tests/06-01-rag-retrieve/extra-1-hybrid-rank.test.ts (먼저 읽어라)
 * 판정: pnpm test extra-1-hybrid-rank
 * 막히면: docs/06-rag-when-needed.md
 */

export interface VecDoc {
  id: string;
  vec: number[];
}

/**
 * 코사인 유사도 — 두 벡터가 이루는 각도만 본다.
 *
 * 힌트: 크기를 나누지 않으면 긴 문서가 항상 이긴다(그건 내적이지 유사도가
 *       아니다). 그리고 영벡터가 들어오면 0으로 나누게 된다.
 */
export function cosine(a: number[], b: number[]): number {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: cosine");
}

/**
 * 질의 벡터와 가까운 순으로 상위 k개의 id.
 *
 * 힌트: 점수가 같을 때의 순서도 정해야 한다.
 */
export function topK(query: number[], docs: VecDoc[], k: number): string[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: topK");
}

/**
 * Reciprocal Rank Fusion — 여러 랭킹을 하나로 합친다.
 *
 * 각 랭킹에서 문서의 기여도는 `1 / (k + 순위)`이고(순위는 1부터), 그 합이 큰
 * 순으로 정렬한다. **점수가 아니라 순위만 쓰는 것**이 이 방식의 핵심이다 —
 * 키워드 점수(BM25)와 벡터 유사도는 단위가 달라 그대로 더할 수 없다.
 *
 * 힌트: k는 상위 편중을 얼마나 완화할지의 손잡이다(관례값 60).
 */
export function rrf(rankings: string[][], k = 60): string[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: rrf");
}

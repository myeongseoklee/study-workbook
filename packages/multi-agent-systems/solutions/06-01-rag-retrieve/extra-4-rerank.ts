/**
 * 선택 문제 D의 참고 구현 — 2단계 검색과 리랭킹.
 *
 * 📍 되짚기: docs/06-rag-when-needed.md § 3. 리랭킹 — 다시 정렬
 */

export interface Candidate {
  id: string;
  text: string;
}

export type ScoreFn = (query: string, text: string) => number;

/**
 * 점수를 **먼저 한 번씩 매겨 두고** 정렬한다. 비교 함수 안에서 계산하면 같은
 * 후보가 여러 번 채점되는데, 점수 함수는 실제로는 모델 호출이라 그 낭비가
 * 곧 비용이다.
 *
 * 동점에 입력 순서를 지키려면 안정 정렬이면 되지만, index 를 명시적으로 담아
 * 두면 정렬 구현에 기대지 않아도 된다.
 */
function order(query: string, candidates: Candidate[], score: ScoreFn): Candidate[] {
  return candidates
    .map((c, index) => ({ c, index, s: score(query, c.text) }))
    .sort((x, y) => y.s - x.s || x.index - y.index)
    .map(({ c }) => c);
}

export function rerank(query: string, candidates: Candidate[], score: ScoreFn, k?: number): string[] {
  const limit = k === undefined ? candidates.length : Math.max(0, k);
  if (limit === 0) return [];
  return order(query, candidates, score)
    .slice(0, limit)
    .map((c) => c.id);
}

/**
 * 좁히기를 **먼저** 하는 것이 이 함수의 전부다. 정밀 점수를 전체에 매기고
 * 나중에 자르면 결과는 같아 보여도 비싼 호출을 전부 치른 셈이라, 2단계로
 * 나눈 이유가 사라진다.
 */
export function twoStage(
  query: string,
  documents: Candidate[],
  cheapScore: ScoreFn,
  preciseScore: ScoreFn,
  retrieveK: number,
  finalK: number,
): string[] {
  if (documents.length === 0) return [];

  const shortlist = order(query, documents, cheapScore).slice(0, Math.max(0, retrieveK));
  return rerank(query, shortlist, preciseScore, finalK);
}

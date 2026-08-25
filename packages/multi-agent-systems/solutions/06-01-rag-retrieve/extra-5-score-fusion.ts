/**
 * 선택 문제 E의 참고 구현 — 점수로 합치는 융합.
 *
 * 📍 되짚기: docs/06-rag-when-needed.md § 점수로 합치기 — 정규화 가중합
 */

export interface ScoredDoc {
  id: string;
  score: number;
}

export interface FusionOptions {
  /** 융합 점수가 이 값 미만이면 버린다 */
  minScore?: number;
  /** id 별 계수. 정본은 올리고 초안은 내리는 자리 */
  boost?: Record<string, number>;
}

/**
 * min-max 정규화. 전부 같은 점수면 분모가 0이 되는데, 그냥 나누면 NaN이 흘러
 * 정렬이 조용히 망가진다(코사인의 영벡터와 같은 사고다). 서로 우열이 없다는
 * 뜻이므로 모두 1로 둔다 — 0으로 두면 검색기 하나짜리 결과가 통째로 사라진다.
 */
export function normalize(docs: ScoredDoc[]): ScoredDoc[] {
  if (docs.length === 0) return [];
  const scores = docs.map((d) => d.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min;
  return docs.map((d) => ({ id: d.id, score: span === 0 ? 1 : (d.score - min) / span }));
}

/**
 * 각 검색기의 점수를 정규화해 가중합한다.
 *
 * 한쪽에만 등장한 문서는 다른 쪽을 0점으로 친다 — RRF가 "없는 랭킹은 기여하지
 * 않음"으로 처리하는 것과 갈리는 지점이고, 그래서 점수 융합이 한쪽에만 걸린
 * 문서에 더 가혹하다.
 */
export function weightedFusion(
  lists: ScoredDoc[][],
  weights: number[],
  options: FusionOptions = {},
): string[] {
  if (lists.length !== weights.length) {
    throw new Error(`가중치 개수가 검색기 수와 다릅니다: ${weights.length} ≠ ${lists.length}`);
  }

  const total = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  let order = 0;

  lists.forEach((list, i) => {
    for (const d of normalize(list)) {
      total.set(d.id, (total.get(d.id) ?? 0) + weights[i]! * d.score);
      if (!firstSeen.has(d.id)) firstSeen.set(d.id, order++);
    }
  });

  const { minScore, boost } = options;
  return [...total.entries()]
    .map(([id, score]) => ({ id, score: score * (boost?.[id] ?? 1) }))
    .filter(({ score }) => (minScore === undefined ? true : score >= minScore))
    .sort((a, b) => b.score - a.score || firstSeen.get(a.id)! - firstSeen.get(b.id)!)
    .map(({ id }) => id);
}

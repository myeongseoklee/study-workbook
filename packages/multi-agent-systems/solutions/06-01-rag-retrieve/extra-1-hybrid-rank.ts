/**
 * 선택 문제의 참고 구현 — 벡터 검색과 하이브리드 랭킹.
 *
 * 판정은 tests/06-01-rag-retrieve/extra-1-hybrid-rank.test.ts가 한다.
 *
 * 📍 되짚기: docs/06-rag-when-needed.md
 */

export interface VecDoc {
  id: string;
  vec: number[];
}

/**
 * 분모가 0이면(둘 중 하나가 영벡터) 0을 준다. NaN을 흘려보내면 정렬이 조용히
 * 망가진다 — NaN은 어떤 비교에서도 false라서 그 문서가 배열 어디에 놓일지
 * 정렬 구현에 달리게 된다.
 */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i]! * b[i]!;
  }
  for (const x of a) na += x * x;
  for (const x of b) nb += x * x;
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * 동점일 때 입력 순서를 지키려면 **안정 정렬**이어야 한다. JS의 `Array#sort`는
 * 명세상 안정이므로 비교 함수가 0을 돌려주기만 하면 된다 — 여기서 굳이
 * id로 2차 정렬을 하면 오히려 입력 순서가 깨진다.
 */
export function topK(query: number[], docs: VecDoc[], k: number): string[] {
  return docs
    .map((d) => ({ id: d.id, score: cosine(query, d.vec) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, Math.max(0, k))
    .map((d) => d.id);
}

/**
 * RRF가 점수 대신 순위를 쓰는 이유: BM25 점수와 코사인 유사도는 단위도 분포도
 * 달라 그대로 더하거나 가중 평균할 수 없다. 정규화를 시도하면 코퍼스가 바뀔
 * 때마다 스케일이 흔들린다. 순위는 그런 문제가 없다.
 *
 * `1 / (k + 순위)`의 모양이 만드는 성질: 1위와 2위의 차이는 크고 뒤로 갈수록
 * 차이가 작아진다. 그래서 **한 검색에서만 1위인 문서**보다 **두 검색 모두에서
 * 상위인 문서**가 이긴다 — 하이브리드가 노리는 바가 정확히 그것이다.
 */
export function rrf(rankings: string[][], k = 60): string[] {
  const score = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  let order = 0;

  for (const ranking of rankings) {
    ranking.forEach((id, i) => {
      score.set(id, (score.get(id) ?? 0) + 1 / (k + i + 1));
      if (!firstSeen.has(id)) firstSeen.set(id, order++);
    });
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || firstSeen.get(a[0])! - firstSeen.get(b[0])!)
    .map(([id]) => id);
}

/**
 * 선택 문제 A의 참고 구현 — 스토어 없이 만드는 하이브리드 검색.
 *
 * 📍 되짚기: docs/06-rag-when-needed.md
 *    § 가깝다를 무엇으로 재나 — 코사인 유사도
 *    § 어떻게 합치나 — 순위로 합친다 (RRF)
 */

export interface VecDoc {
  id: string;
  vec: number[];
}

export interface HybridDoc extends VecDoc {
  text: string;
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`벡터 차원이 다릅니다: ${a.length} !== ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

export function topK(query: number[], docs: VecDoc[], k: number): string[] {
  return docs
    .map((doc, index) => ({ id: doc.id, index, score: cosine(query, doc.vec) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, k))
    .map(({ id }) => id);
}

export function rrf(rankings: string[][], rankConstant = 60): string[] {
  const scores = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  let order = 0;

  for (const ranking of rankings) {
    ranking.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (rankConstant + index + 1));
      if (!firstSeen.has(id)) firstSeen.set(id, order++);
    });
  }

  return [...scores]
    .sort((a, b) => b[1] - a[1] || firstSeen.get(a[0])! - firstSeen.get(b[0])!)
    .map(([id]) => id);
}

function keywordRank(query: string, docs: HybridDoc[]): string[] {
  const terms = query.split(/\s+/).filter(Boolean);
  return docs
    .map((doc, index) => ({
      id: doc.id,
      index,
      score: terms.filter((term) => doc.text.includes(term)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ id }) => id);
}

export function hybridSearch(
  query: string,
  queryVec: number[],
  docs: HybridDoc[],
  k = 3,
): string[] {
  if (docs.length === 0 || k <= 0) return [];
  const vectorRank = topK(queryVec, docs, docs.length);
  return rrf([keywordRank(query, docs), vectorRank]).slice(0, k);
}

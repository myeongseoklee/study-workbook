/**
 * 선택 문제 B의 참고 구현 — MemoryVectorStore로 만드는 하이브리드 검색.
 *
 * 📍 되짚기: docs/06-rag-when-needed.md
 *    § Node에서 연습하는 두 경로
 *    § 어떻게 합치나 — 순위로 합친다 (RRF)
 */
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";

export interface MemoryStoreDoc {
  id: string;
  text: string;
  vec: number[];
}

export interface MemoryHybridIndex {
  docs: MemoryStoreDoc[];
  store: MemoryVectorStore;
}

export const PRECOMPUTED_VECTORS_ONLY: EmbeddingsInterface = {
  async embedDocuments() {
    throw new Error("이 과제에서는 문서 벡터를 addVectors()로 직접 넣습니다.");
  },
  async embedQuery() {
    throw new Error("이 과제에서는 질의 벡터로 직접 검색합니다.");
  },
};

export async function buildMemoryIndex(docs: MemoryStoreDoc[]): Promise<MemoryHybridIndex> {
  const store = new MemoryVectorStore(PRECOMPUTED_VECTORS_ONLY);
  await store.addVectors(
    docs.map(({ vec }) => vec),
    docs.map(({ id, text }) => new Document({ pageContent: text, metadata: { id } })),
  );
  return { docs, store };
}

function keywordRank(query: string, docs: MemoryStoreDoc[]): string[] {
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

function rrf(rankings: string[][], rankConstant = 60): string[] {
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

export async function hybridSearchWithMemoryStore(
  query: string,
  queryVec: number[],
  index: MemoryHybridIndex,
  k = 3,
): Promise<string[]> {
  if (index.docs.length === 0 || k <= 0) return [];

  const hits = await index.store.similaritySearchVectorWithScore(queryVec, index.docs.length);
  const vectorRank = hits.map(([doc]) => String(doc.metadata.id));
  return rrf([keywordRank(query, index.docs), vectorRank]).slice(0, k);
}

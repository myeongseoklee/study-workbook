/**
 * 선택 문제 B — MemoryVectorStore로 만드는 하이브리드 검색
 *
 * 선택 문제 A와 같은 결과를 만들지만 거리 계산은 직접 하지 않는다. 미리 만든
 * 문서 벡터를 인메모리 스토어에 넣고, 스토어의 벡터 랭킹과 키워드 랭킹을 RRF로
 * 합친다. 두 선택 문제는 독립적이므로 이 파일만 풀어도 된다.
 *
 * 명세: tests/06-01-rag-retrieve/extra-2-memory-vector-store.test.ts
 * 판정: pnpm test extra-2-memory-vector-store
 * 막히면: docs/06-rag-when-needed.md § Node에서 연습하는 두 경로
 */
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

export interface MemoryStoreDoc {
  id: string;
  text: string;
  vec: number[];
}

export interface MemoryHybridIndex {
  docs: MemoryStoreDoc[];
  store: MemoryVectorStore;
}

// addVectors()에는 이미 계산된 벡터를 넘기므로 이 구현은 호출되지 않는다.
export const PRECOMPUTED_VECTORS_ONLY: EmbeddingsInterface = {
  async embedDocuments() {
    throw new Error("이 과제에서는 문서 벡터를 addVectors()로 직접 넣습니다.");
  },
  async embedQuery() {
    throw new Error("이 과제에서는 질의 벡터로 직접 검색합니다.");
  },
};

/** 문서 벡터와 id 메타데이터를 MemoryVectorStore에 적재한다. */
export async function buildMemoryIndex(docs: MemoryStoreDoc[]): Promise<MemoryHybridIndex> {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: buildMemoryIndex");
}

/** 스토어의 벡터 랭킹과 키워드 랭킹을 합쳐 상위 k개 문서 id를 반환한다. */
export async function hybridSearchWithMemoryStore(
  query: string,
  queryVec: number[],
  index: MemoryHybridIndex,
  k = 3,
): Promise<string[]> {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: hybridSearchWithMemoryStore");
}

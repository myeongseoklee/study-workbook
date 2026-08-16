// 이 파일은 고치지 않는다 — 명세다. 통과시키려면
// ../../src/06-01-rag-retrieve/extra-2-memory-vector-store.ts를 고쳐라.
//
// 선택 문제 B: MemoryVectorStore에 벡터를 적재하고 키워드 랭킹과 결합한다.
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { describe, expect, it } from "vitest";
import {
  buildMemoryIndex,
  hybridSearchWithMemoryStore,
} from "../../src/06-01-rag-retrieve/extra-2-memory-vector-store";
import type { MemoryStoreDoc } from "../../src/06-01-rag-retrieve/extra-2-memory-vector-store";

const DOCS: MemoryStoreDoc[] = [
  { id: "err", text: "ERR_2041 결제 게이트웨이 응답 시간 초과", vec: [1, 0, 0] },
  { id: "refund", text: "구매 후 7일 이내 미개봉 상태면 전액 돌려드립니다", vec: [0, 1, 0] },
  { id: "ship", text: "평일 오후 2시 이전 주문은 당일 출고", vec: [0, 0, 1] },
];

describe("buildMemoryIndex", () => {
  it("MemoryVectorStore를 만든다", async () => {
    const index = await buildMemoryIndex(DOCS);
    expect(index.store).toBeInstanceOf(MemoryVectorStore);
  });

  it("미리 만든 벡터를 가까운 순서로 검색할 수 있다", async () => {
    const index = await buildMemoryIndex(DOCS);
    const hits = await index.store.similaritySearchVectorWithScore([0, 1, 0], 1);
    expect(hits[0]?.[0].metadata.id).toBe("refund");
  });

  it("원문과 id 메타데이터를 함께 보존한다", async () => {
    const index = await buildMemoryIndex(DOCS);
    const hits = await index.store.similaritySearchVectorWithScore([0, 0, 1], 1);
    expect(hits[0]?.[0]).toMatchObject({
      pageContent: DOCS[2]!.text,
      metadata: { id: "ship" },
    });
  });

  it("빈 문서 목록도 색인할 수 있다", async () => {
    const index = await buildMemoryIndex([]);
    expect(index.docs).toEqual([]);
    expect(index.store).toBeInstanceOf(MemoryVectorStore);
  });
});

describe("hybridSearchWithMemoryStore", () => {
  it("정확한 코드는 질의 벡터가 다른 문서를 가리켜도 결과에 포함한다", async () => {
    const index = await buildMemoryIndex(DOCS);
    expect(await hybridSearchWithMemoryStore("ERR_2041", [0, 1, 0], index, 2)).toContain("err");
  });

  it("문서에 같은 낱말이 없어도 벡터가 가까운 문서를 찾는다", async () => {
    const index = await buildMemoryIndex(DOCS);
    expect(await hybridSearchWithMemoryStore("환불 규정", [0, 1, 0], index, 1)).toEqual(["refund"]);
  });

  it("키워드와 벡터가 같은 문서를 가리키면 그 문서가 1위다", async () => {
    const index = await buildMemoryIndex(DOCS);
    expect(await hybridSearchWithMemoryStore("출고 언제", [0, 0, 1], index, 1)).toEqual(["ship"]);
  });

  it("k가 0이거나 문서가 없으면 빈 배열이다", async () => {
    const index = await buildMemoryIndex(DOCS);
    expect(await hybridSearchWithMemoryStore("ERR_2041", [1, 0, 0], index, 0)).toEqual([]);

    const empty = await buildMemoryIndex([]);
    expect(await hybridSearchWithMemoryStore("무엇이든", [1, 0, 0], empty, 3)).toEqual([]);
  });
});

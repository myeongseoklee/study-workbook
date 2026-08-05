// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../src/06-01-rag-retrieve/index.ts를 고쳐라.
import { describe, expect, it } from "vitest";
import { scripted } from "@study/testkit";
import { answer, retrieve } from "../../src/06-01-rag-retrieve";

describe("retrieve", () => {
  it("질의와 글자가 겹치는 문서를 우선한다", () => {
    const docs = ["환불 정책 설명문서", "배송 정책 설명문서", "완전 다른 이야기"];

    const result = retrieve("환불", docs, 1);

    expect(result).toEqual(["환불 정책 설명문서"]);
  });

  it("k개까지만 반환한다", () => {
    const docs = ["환불 관련 문서 하나", "환불 관련 문서 둘", "전혀 상관없는 내용"];

    const result = retrieve("환불", docs, 2);

    expect(result).toHaveLength(2);
    expect(result).not.toContain("전혀 상관없는 내용");
  });

  it("docs를 생략하면 기본 지식 베이스(DOCS)에서 검색한다", () => {
    const result = retrieve("환불 언제까지 돼?");

    expect(result.some((d) => d.includes("환불"))).toBe(true);
  });
});

describe("answer", () => {
  it("retrieve한 문서를 컨텍스트로 담아 askFn을 호출하고 그 응답을 그대로 반환한다", async () => {
    const docs = ["환불 정책: 7일 이내 전액 환불", "배송 정책: 당일 출고"];
    const ask = scripted<[string, string], Promise<string>>([Promise.resolve("7일 이내 환불 가능합니다")]);

    const result = await answer("환불 언제까지 돼?", ask, docs);

    expect(result).toBe("7일 이내 환불 가능합니다");
    expect(ask.calls).toHaveLength(1);
    expect(ask.calls[0][1]).toContain("환불 정책: 7일 이내 전액 환불");
    expect(ask.calls[0][1]).toContain("환불 언제까지 돼?");
  });

  it("문서에 근거해서만 답하라는 지시를 system에 담는다", async () => {
    const ask = scripted<[string, string], Promise<string>>([Promise.resolve("...")]);

    await answer("질문", ask, ["문서"]);

    expect(ask.calls[0][0]).toContain("근거");
  });
});

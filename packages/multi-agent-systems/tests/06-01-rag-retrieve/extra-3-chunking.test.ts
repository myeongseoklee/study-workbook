// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/06-01-rag-retrieve/extra-3-chunking.ts를 고쳐라.
//
// 선택 문제 C: 검색 품질의 첫 변수는 검색기가 아니라 청킹이다.
//
// 개념은 docs/06-rag-when-needed.md 의 § 1. 청킹 절에 있다.
// 이 파일은 답만 적고 이유는 적지 않는다.
import { describe, expect, it } from "vitest";
import { chunk, chunkByParagraph } from "../../src/06-01-rag-retrieve/extra-3-chunking";

describe("chunk — 고정 크기", () => {
  it("크기대로 자르고 마지막은 남는 만큼만 준다", () => {
    expect(chunk("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("텍스트가 크기보다 짧으면 그대로 하나다", () => {
    expect(chunk("ab", 4)).toEqual(["ab"]);
  });

  it("딱 나누어떨어지면 남는 조각이 없다", () => {
    expect(chunk("abcdefgh", 4)).toEqual(["abcd", "efgh"]);
  });

  it("빈 텍스트는 빈 배열이다", () => {
    expect(chunk("", 4)).toEqual([]);
  });

  it("겹침을 주면 앞 조각의 끝이 다음 조각의 앞에 다시 나온다", () => {
    expect(chunk("abcdefghij", 4, 2)).toEqual(["abcd", "cdef", "efgh", "ghij", "ij"]);
  });

  it("겹침 0은 겹침을 주지 않은 것과 같다", () => {
    expect(chunk("abcdefghij", 4, 0)).toEqual(chunk("abcdefghij", 4));
  });

  it("겹침이 크기와 같으면 거부한다", () => {
    expect(() => chunk("abcdefghij", 4, 4)).toThrow(/겹침/);
  });

  it("겹침이 크기보다 크면 거부한다", () => {
    expect(() => chunk("abcdefghij", 4, 5)).toThrow(/겹침/);
  });

  it("크기가 0이거나 음수면 거부한다", () => {
    expect(() => chunk("abc", 0)).toThrow(/크기/);
    expect(() => chunk("abc", -1)).toThrow(/크기/);
  });

  it("겹침이 음수면 거부한다", () => {
    expect(() => chunk("abc", 4, -1)).toThrow(/겹침/);
  });
});

describe("chunkByParagraph — 문단 경계", () => {
  it("문단들이 한도 안에 들어가면 한 조각으로 묶는다", () => {
    expect(chunkByParagraph("가나다\n\n라마바", 20)).toEqual(["가나다\n\n라마바"]);
  });

  it("한도를 넘기면 넘기 전까지만 묶고 새 조각을 시작한다", () => {
    expect(chunkByParagraph("가나다\n\n라마바\n\n사아자", 8)).toEqual(["가나다\n\n라마바", "사아자"]);
  });

  it("문단 하나가 한도보다 크면 그 문단을 크기로 자른다", () => {
    expect(chunkByParagraph("가나다라마바사아", 3)).toEqual(["가나다", "라마바", "사아"]);
  });

  it("빈 문단은 버린다", () => {
    expect(chunkByParagraph("가나다\n\n\n\n라마바", 20)).toEqual(["가나다\n\n라마바"]);
  });

  it("빈 텍스트는 빈 배열이다", () => {
    expect(chunkByParagraph("", 20)).toEqual([]);
  });

  it("공백만 있는 텍스트도 빈 배열이다", () => {
    expect(chunkByParagraph("   \n\n  ", 20)).toEqual([]);
  });
});

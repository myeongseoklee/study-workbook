/**
 * 선택 문제 C — 청킹 (docs/06-rag-when-needed.md § 1. 청킹)
 *
 * 검색 품질의 첫 변수는 검색기가 아니라 **어떻게 잘랐는가**다. 크게 자르면
 * 여러 주제가 한 벡터에 눌려 희석되고, 잘게 자르면 의미를 지탱하는 낱말이
 * 잘려 나간다. 두 가지 자르기를 만들어 그 손잡이를 직접 쥐어 본다.
 *
 * 명세: tests/06-01-rag-retrieve/extra-3-chunking.test.ts
 * 판정: pnpm test extra-3-chunking
 * 막히면: docs/06-rag-when-needed.md § 1. 청킹 — 문서를 조각으로
 */

/**
 * 고정 크기로 자른다. `overlap`만큼 앞 조각의 끝을 다음 조각이 다시 물고 간다.
 *
 * 사양:
 *   - 조각의 시작 위치는 `size - overlap` 씩 전진한다.
 *   - 마지막 조각은 남은 만큼만 담는다(크기를 못 채워도 버리지 않는다).
 *   - 크기가 1 미만이면, 겹침이 음수이거나 크기 이상이면 오류로 거부한다.
 *
 * 힌트: 겹침이 크기와 같으면 시작 위치가 전진하지 못한다 — 거부하는 이유가 그것이다.
 *       거부하지 않으면 무한 루프가 되고, 그건 청킹 설정 실수를 장애로 바꾼다.
 */
export function chunk(text: string, size: number, overlap = 0): string[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: chunk");
}

/**
 * 문단 경계를 지키며 자른다. 문단은 **빈 줄**로 나뉜다.
 *
 * 사양:
 *   - 문단을 순서대로 모으되, 이어 붙인 길이가 `maxSize`를 넘으면 새 조각을 시작한다.
 *   - 모을 때 문단 사이는 빈 줄(`\n\n`)로 잇는다. 길이는 이어 붙인 결과로 센다.
 *   - 문단 하나가 그 자체로 `maxSize`보다 크면 그 문단은 `chunk`로 잘라 넣는다.
 *   - 비어 있거나 공백뿐인 문단은 버린다.
 *
 * 힌트: docs/06 의 실측표에서 가장 나빴던 조각은 가장 짧은 것이었다. 고정 크기로만
 *       자르면 문장이 경계에 걸려 반쪽이 나는데, 문단을 지키면 그 사고가 줄어든다.
 */
export function chunkByParagraph(text: string, maxSize: number): string[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: chunkByParagraph");
}

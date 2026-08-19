/**
 * 선택 문제 D — 2단계 검색과 리랭킹 (docs/06-rag-when-needed.md § 3. 리랭킹)
 *
 * 정밀한 판정은 비싸서 전체 문서에 돌릴 수 없다. 그래서 싼 검색으로 후보를
 * 좁히고 비싼 판정을 거기에만 쓴다. 이 문제에서는 점수 함수를 주입받아
 * 그 2단계 구조만 만든다 — 실제 모델은 자리에 끼우면 된다.
 *
 * 명세: tests/06-01-rag-retrieve/extra-4-rerank.test.ts
 * 판정: pnpm test extra-4-rerank
 * 막히면: docs/06-rag-when-needed.md § 3. 리랭킹 — 다시 정렬
 */

export interface Candidate {
  id: string;
  text: string;
}

/** 질의와 문서 본문을 받아 관련도를 내는 함수. 실무에서는 모델 호출 자리다. */
export type ScoreFn = (query: string, text: string) => number;

/**
 * 후보를 점수 순으로 다시 세운다.
 *
 * 사양:
 *   - 점수가 높은 순. 같으면 입력 순서를 지킨다.
 *   - `k`를 주면 그만큼만, 주지 않으면 전부. `k`가 0 이하면 빈 배열.
 *   - 후보마다 점수 함수를 **한 번씩만** 부른다.
 *
 * 힌트: 정렬 비교 함수 안에서 점수를 계산하면 같은 후보를 여러 번 부르게 된다.
 *       점수 함수는 실제로는 모델 호출이라, 그 낭비가 그대로 비용이 된다.
 */
export function rerank(query: string, candidates: Candidate[], score: ScoreFn, k?: number): string[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: rerank");
}

/**
 * 1단계에서 싼 점수로 후보를 좁히고, 2단계에서 정밀 점수로 다시 세운다.
 *
 * 사양:
 *   - 1단계: 모든 문서에 `cheapScore`를 매겨 상위 `retrieveK`개를 남긴다.
 *   - 2단계: 그 후보에만 `preciseScore`를 매겨 상위 `finalK`개의 id를 낸다.
 *   - 두 단계 모두 점수가 같으면 입력 순서를 지킨다.
 *   - 문서가 없으면 어느 점수 함수도 부르지 않는다.
 *
 * 힌트: `preciseScore`가 몇 번 불리는지를 명세가 검사한다. 전체에 먼저 매기고
 *       나중에 자르면 그 검사가 걸린다 — 그리고 그게 2단계로 나눈 이유 자체를
 *       무너뜨린다(docs/06 § 그래서 2단계인 것이다).
 */
export function twoStage(
  query: string,
  documents: Candidate[],
  cheapScore: ScoreFn,
  preciseScore: ScoreFn,
  retrieveK: number,
  finalK: number,
): string[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: twoStage");
}

/**
 * 선택 문제 F — 검색 평가 지표 (docs/06-rag-when-needed.md § 검색을 무엇으로 재나)
 *
 * 이 장의 기법들은 전부 "재고 나서 켜라"고 말한다. 그 자를 만든다.
 * 최종 답의 품질만 보면 검색이 나빴는지 생성이 나빴는지 갈리지 않으므로,
 * 검색만 따로 재는 지표가 필요하다.
 *
 * 명세: tests/06-01-rag-retrieve/extra-6-retrieval-eval.test.ts
 * 판정: pnpm test extra-6-retrieval-eval
 * 막히면: docs/06-rag-when-needed.md § 검색을 무엇으로 재나
 */

export interface EvalItem {
  /** 검색기가 돌려준 문서 id, 순위 순 */
  retrieved: string[];
  /** 이 질의의 정답 문서 id들 */
  relevant: string[];
}

export interface EvalSummary {
  recall: number;
  precision: number;
  mrr: number;
}

/**
 * 정답 중 몇 개를 상위 k 안에서 찾아냈나.
 *
 * 사양: 정답이 비어 있거나 k가 1 미만이면 오류로 거부한다.
 *       같은 문서가 여러 번 나와도 한 번으로 센다.
 *
 * 힌트: 정답이 없는 질의를 0으로 두면 점수가 부당하게 낮아지고 1로 두면 부당하게
 *       높아진다 — 어느 쪽이든 평균이 거짓이 되므로 평가셋 오류로 본다.
 */
export function recallAt(retrieved: string[], relevant: string[], k: number): number {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: recallAt");
}

/**
 * 상위 k 중 몇 개가 정답이었나.
 *
 * 사양: recallAt 과 같은 거부 조건. 검색 결과가 비면 0.
 */
export function precisionAt(retrieved: string[], relevant: string[], k: number): number {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: precisionAt");
}

/**
 * 첫 정답이 몇 번째였나의 역수. 하나도 없으면 0.
 *
 * 힌트: 중복된 문서가 앞에 있으면 순위를 어떻게 셀지 정해야 한다.
 *       중복은 검색기의 결함이지 성과가 아니다.
 */
export function reciprocalRank(retrieved: string[], relevant: string[]): number {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: reciprocalRank");
}

/**
 * 평가셋 전체를 돌려 세 지표의 평균을 낸다.
 *
 * 사양: 케이스마다 지표를 내고 **케이스 단위로** 평균한다. 빈 평가셋은 전부 0.
 *
 * 힌트: 질의마다 정답 개수가 다른데 전체를 한 덩어리로 합산하면 정답이 많은
 *       질의가 평균을 좌우한다. 질의 하나가 한 표씩 갖게 하려면 어떻게 해야 하나?
 */
export function evaluate(items: EvalItem[], k: number): EvalSummary {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: evaluate");
}

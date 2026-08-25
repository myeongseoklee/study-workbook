/**
 * 선택 문제 E — 점수로 합치는 융합 (docs/06-rag-when-needed.md § 점수로 합치기)
 *
 * extra-1 의 `rrf` 는 순위만 써서 정규화를 면제받는 대신, 1위와 2위가 박빙인지
 * 압도적인지를 버렸다. 이 문제는 반대쪽이다 — 점수의 세기를 살리고, 그 대가로
 * 정규화·가중치·임계값을 직접 다룬다.
 *
 * 명세: tests/06-01-rag-retrieve/extra-5-score-fusion.test.ts
 * 판정: pnpm test extra-5-score-fusion
 * 막히면: docs/06-rag-when-needed.md § 점수로 합치기 — 정규화 가중합
 */

export interface ScoredDoc {
  id: string;
  score: number;
}

export interface FusionOptions {
  /** 융합 점수가 이 값 미만이면 버린다 */
  minScore?: number;
  /** id 별 계수. 정본은 올리고 초안은 내리는 자리 */
  boost?: Record<string, number>;
}

/**
 * 점수를 0~1로 옮긴다(min-max).
 *
 * 힌트: docs/06 의 정규화 식에는 경계가 하나 있다. 그 경우 무엇을 돌려줄지는
 *       명세가 정해 두었는데, 왜 그 값인지는 § 점수로 합치기 절에 있다.
 */
export function normalize(docs: ScoredDoc[]): ScoredDoc[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: normalize");
}

/**
 * 각 검색기의 점수를 정규화해 가중합하고, 높은 순으로 id를 낸다.
 *
 * 사양:
 *   - 검색기마다 `normalize`를 적용한 뒤 `weights[i]`를 곱해 문서별로 더한다.
 *   - 한쪽에만 등장한 문서는 다른 쪽 점수를 **0**으로 친다.
 *   - `boost[id]`가 있으면 합산 점수에 곱한다(없으면 1).
 *   - `minScore`가 있으면 그 미만인 문서를 버린다(boost를 적용한 뒤에 판정).
 *   - 점수가 같으면 **처음 등장한 순서**를 지킨다.
 *   - 가중치 개수가 검색기 수와 다르면 오류로 거부한다.
 *
 * 힌트: 한쪽에만 걸린 문서를 0점으로 치는 것이 rrf 와 갈리는 지점이다.
 *       rrf 는 없는 랭킹이 합에 기여하지 않을 뿐이었다 — 두 코드를 나란히 놓고 보라.
 */
export function weightedFusion(
  lists: ScoredDoc[][],
  weights: number[],
  options: FusionOptions = {},
): string[] {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: weightedFusion");
}

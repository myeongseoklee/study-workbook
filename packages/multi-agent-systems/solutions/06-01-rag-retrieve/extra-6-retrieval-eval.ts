/**
 * 선택 문제 F의 참고 구현 — 검색 평가 지표.
 *
 * 📍 되짚기: docs/06-rag-when-needed.md § 검색을 무엇으로 재나
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
 * 정답이 없는 질의는 평가할 수 없다. 0으로 두면 점수가 부당하게 낮아지고 1로
 * 두면 부당하게 높아진다 — 어느 쪽이든 평균이 거짓이 되므로 평가셋 오류로 본다.
 */
function guard(relevant: string[], k: number): void {
  if (relevant.length === 0) throw new Error("정답이 없는 케이스는 평가할 수 없습니다");
  if (!Number.isFinite(k) || k < 1) throw new Error(`k는 1 이상이어야 합니다: ${k}`);
}

/** 같은 문서가 두 번 나와도 한 번으로 센다 — 중복은 검색기의 결함이지 성과가 아니다. */
function topUnique(retrieved: string[], k: number): string[] {
  return [...new Set(retrieved.slice(0, k))];
}

/** 정답 중 몇 개를 상위 k 안에서 찾아냈나. 놓치지 않았는지를 본다. */
export function recallAt(retrieved: string[], relevant: string[], k: number): number {
  guard(relevant, k);
  const top = new Set(topUnique(retrieved, k));
  const hit = relevant.filter((id) => top.has(id)).length;
  return hit / relevant.length;
}

/** 상위 k 중 몇 개가 정답이었나. 정답이 하나뿐이면 상한이 1/k 임에 주의. */
export function precisionAt(retrieved: string[], relevant: string[], k: number): number {
  guard(relevant, k);
  const top = topUnique(retrieved, k);
  if (top.length === 0) return 0;
  const rel = new Set(relevant);
  return top.filter((id) => rel.has(id)).length / top.length;
}

/** 첫 정답이 몇 번째였나의 역수. 하나도 없으면 0. */
export function reciprocalRank(retrieved: string[], relevant: string[]): number {
  if (relevant.length === 0) throw new Error("정답이 없는 케이스는 평가할 수 없습니다");
  const rel = new Set(relevant);
  const seen = new Set<string>();
  let rank = 0;
  for (const id of retrieved) {
    if (seen.has(id)) continue;
    seen.add(id);
    rank++;
    if (rel.has(id)) return 1 / rank;
  }
  return 0;
}

/**
 * 케이스별 지표를 내고 평균한다(macro average). 질의마다 정답 개수가 달라도
 * 질의 하나가 한 표씩 갖게 하려면 케이스 단위로 평균해야 한다.
 */
export function evaluate(items: EvalItem[], k: number): EvalSummary {
  if (items.length === 0) return { recall: 0, precision: 0, mrr: 0 };
  const avg = (f: (it: EvalItem) => number) => items.reduce((s, it) => s + f(it), 0) / items.length;
  return {
    recall: avg((it) => recallAt(it.retrieved, it.relevant, k)),
    precision: avg((it) => precisionAt(it.retrieved, it.relevant, k)),
    mrr: avg((it) => reciprocalRank(it.retrieved, it.relevant)),
  };
}

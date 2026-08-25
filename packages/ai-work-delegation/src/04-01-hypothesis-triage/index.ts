/**
 * 과제 04-01 — 가설 등급 분류기
 *
 * 명세는 `tests/04-01-hypothesis-triage/index.test.ts`다. 배경은
 * docs/04-what-only-humans-pick.md의 "세 기준은 누적적이다".
 *
 * 세 기준(놀라움 → 신규성 → 반증가능성)은 **개수가 아니라 누적**이다.
 * 1번까지 통과하면 이야깃거리, 2번까지면 인사이트, 3번까지면 논문 주제다.
 * 개수로 세는 구현은 대부분의 케이스에서 같은 답을 내고 **몇 개에서만
 * 틀린다** — 그 몇 개를 명세가 겨냥한다.
 *
 * 실행: pnpm --filter ai-work-delegation test 04-01
 */

/** 세 기준으로 평가가 끝난 가설 후보. */
export interface Candidate {
	/** 식별자 */
	id: string;
	/** 기준 1 — 이 설명이 맞다면 내 기존 이해가 바뀌는가 */
	surprising: boolean;
	/** 기준 2 — 이미 널리 이야기되는 설명의 재포장이 아닌가 */
	novel: boolean;
	/** 기준 3 — 이 가설이 거짓일 때 관측될 무언가가 있는가 */
	falsifiable: boolean;
}

/**
 * 누적 등급.
 *
 * - `'paper'` — 세 기준 전부. 논문 주제가 된다
 * - `'insight'` — 놀랍고 새롭다. 인사이트가 된다
 * - `'hook'` — 놀랍기만 하다. 이야깃거리는 된다
 * - `'none'` — 놀랍지 않다. 등급이 없다
 */
export type Grade = 'paper' | 'insight' | 'hook' | 'none';

/** 세 기준의 이름. 순서가 곧 누적 순서다. */
export type Criterion = 'surprising' | 'novel' | 'falsifiable';

/**
 * 후보의 누적 등급을 판정한다.
 *
 * 누적이므로 앞 칸이 비면 뒤 칸은 보지 않는다. 놀랍지 않은 후보는 새롭고
 * 반증 가능해도 `'none'`이다.
 */
export function gradeCandidate(candidate: Candidate): Grade {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: gradeCandidate');
}

/**
 * 누적 순서로 훑어 **처음 걸린 기준**의 이름을 돌려준다. 셋 다 통과하면 `null`.
 *
 * 탈락 사유를 사람에게 보여 주기 위한 함수다. "세 기준 중 두 개 실패"보다
 * "놀라움에서 걸렸다"가 다음 행동을 정해 준다.
 */
export function firstFailedCriterion(candidate: Candidate): Criterion | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: firstFailedCriterion');
}

/**
 * 등급이 높은 순으로 정렬해 위에서 `limit`개까지 돌려준다.
 *
 * 규칙 셋:
 *
 * 1. **등급이 `'none'`인 후보는 자리가 남아도 절대 넣지 않는다.** 목표 개수를
 *    채우려고 등급 없는 후보를 끌어올리면, 그 후보에 쓰는 시간이 진짜
 *    후보에서 빠져나간다
 * 2. 같은 등급끼리는 **입력 순서를 유지한다** (안정 정렬)
 * 3. 원본 배열을 훼손하지 않는다
 *
 * `limit`이 음수이거나 정수가 아니면 `RangeError`를 던진다.
 */
export function triage(candidates: Candidate[], limit: number): Candidate[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: triage');
}

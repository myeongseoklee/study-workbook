/**
 * 과제 03-01 — 가설 다양성 판정기
 *
 * 명세는 `tests/03-01-hypothesis-diversity/index.test.ts`다. 배경은
 * docs/03-search-space-design.md의 "③ 다양성을 강제한다".
 *
 * 프롬프트로 걸었던 두 제약을 코드로 판정한다.
 *
 *   "앞의 가설과 같은 방식이나 메커니즘의 변형은 새로운 가설로 세지 마라"
 *   "최소한 다음 영역을 하나씩 포함하라"
 *
 * 두 제약이 **서로 간섭한다**는 점이 이 과제의 중심이다. 중복으로 걷어낸
 * 가설이 어떤 영역을 유일하게 덮고 있었다면, 그 영역은 덮인 것인가?
 *
 * 실행: pnpm --filter ai-work-delegation test 03-01
 */

/** 가설 하나. AI가 낸 후보를 구조화한 것이다. */
export interface Hypothesis {
	/** 식별자. 보고에만 쓰인다 */
	id: string;
	/** 인과 층위 — "회계", "공급망", "시장심리" 같은 것 */
	domain: string;
	/** 인과 경로의 요약. 같으면 같은 가설로 센다 */
	mechanism: string;
}

/** `assessDiversity`의 판정 결과. */
export interface DiversityReport {
	/** 메커니즘 중복을 걷어낸 뒤 남은 가설 수 */
	distinct: number;
	/** 중복으로 걷어낸 가설들. 입력 순서를 유지한다 */
	dropped: Hypothesis[];
	/** 덮이지 않은 요구 영역. `required`에 적힌 순서를 유지한다 */
	missingDomains: string[];
	/** distinct가 minDistinct 이상이고 missingDomains가 비었을 때만 참 */
	satisfied: boolean;
}

/**
 * 메커니즘 문자열을 비교 가능한 형태로 정규화한다.
 *
 * 대소문자를 무시하고, 앞뒤 공백을 지우고, 문자열 가운데의 연속 공백을
 * 한 칸으로 줄인다. 같은 인과 경로를 표기만 다르게 적은 것을 같은 것으로
 * 보기 위한 최소한의 처리다.
 */
export function normalizeMechanism(raw: string): string {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: normalizeMechanism');
}

/**
 * 정규화된 메커니즘 기준으로 중복을 걷어낸다.
 *
 * **먼저 등장한 것을 남긴다.** 입력 순서를 그대로 유지하고, 원본 배열을
 * 훼손하지 않는다.
 */
export function dedupeByMechanism(hypotheses: Hypothesis[]): Hypothesis[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: dedupeByMechanism');
}

/**
 * 요구 영역 중 덮이지 않은 것을 `required`에 적힌 순서대로 돌려준다.
 *
 * 영역 비교도 대소문자와 앞뒤 공백을 무시한다. 돌려주는 값은 **`required`에
 * 적힌 원래 표기**다 — 정규화한 형태가 아니다. 보고에 그대로 쓰기 위해서다.
 *
 * 이 함수는 넘겨받은 목록을 그대로 본다. 중복 제거는 호출하는 쪽의 책임이다.
 */
export function missingDomains(hypotheses: Hypothesis[], required: string[]): string[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: missingDomains');
}

/**
 * 가설 목록이 다양성 제약을 만족하는지 판정한다.
 *
 * **중복 제거를 먼저 하고, 그 결과로 커버리지를 계산한다.** 순서가 반대면
 * "메커니즘이 중복이라 세지 않기로 한 가설"이 영역 커버리지에는 기여하게
 * 되어, 판정이 실제보다 후해진다.
 *
 * `minDistinct`가 음수이거나 정수가 아니면 `RangeError`를 던진다.
 */
export function assessDiversity(
	hypotheses: Hypothesis[],
	required: string[],
	minDistinct: number,
): DiversityReport {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: assessDiversity');
}

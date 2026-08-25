/**
 * 과제 05-01 — 전제 부정 계산기 (케이블 끊기)
 *
 * 명세는 `tests/05-01-premise-negation/index.test.ts`다. 배경은
 * docs/05-cutting-the-cable.md.
 *
 * 결론은 하나의 전제 묶음으로만 지지되지 않는다. 여러 **지지 경로**가 있을 수
 * 있고, 각 경로 안의 전제는 전부 참이어야 하지만(AND) 경로끼리는 하나만
 * 살아 있으면 된다(OR). 이 구조에서 "전제 하나를 끊으면 결론이 무너지는가"는
 * 계산할 수 있는 질문이 된다.
 *
 *     paths = [ ['수요 강세', '가격 유지'],      ← 경로 1
 *               ['경쟁사 이탈'] ]                ← 경로 2
 *
 * 위 논증에서 '수요 강세'를 끊어도 경로 2가 남아 결론은 살아남는다.
 * **경로가 하나뿐인 결론은 그 경로가 급소**라는 05장의 판정이, 여기서는
 * "지지 경로가 하나면 그 안의 전제가 전부 load-bearing"으로 나타난다.
 *
 * 실행: pnpm --filter ai-work-delegation test 05-01
 */

/**
 * 하나의 결론과 그것을 떠받치는 지지 경로들.
 *
 * `paths`의 각 원소는 **동시에 참이어야 하는 전제들**의 묶음이고, 경로끼리는
 * 하나만 성립해도 결론이 선다.
 */
export interface Argument {
	/** 결론 문장. 계산에는 쓰이지 않고 보고에만 쓰인다 */
	conclusion: string;
	/** 지지 경로 목록. 비어 있으면 결론을 지지하는 근거가 없는 것이다 */
	paths: string[][];
}

/**
 * `negated`에 든 전제를 전부 거짓으로 가정했을 때도 결론이 성립하는가.
 *
 * 부정된 전제를 **하나도 쓰지 않는 경로가 하나라도 남으면** 성립한다.
 * 전제가 하나도 없는 경로(`[]`)는 무조건 성립하는 경로이므로, 무엇을 끊어도
 * 결론이 살아남는다.
 *
 * `paths`가 비어 있으면 `RangeError`를 던진다 — 지지 근거가 없는 논증은
 * 애초에 결론을 지지하지 않으므로, 끊어 보는 계산 자체가 성립하지 않는다.
 */
export function holdsWithout(argument: Argument, negated: string[]): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: holdsWithout');
}

/**
 * 혼자 끊었을 때 결론이 무너지는 전제들을 **사전순**으로 돌려준다.
 *
 * 05장의 처방으로 옮기면, 여기 나오는 전제가 "실제로 확인해야 하는" 것들이다.
 * 목록이 비어 있다면 단독 급소가 없다는 뜻이고, 그 결론은 그만큼 단단하다.
 */
export function loadBearing(argument: Argument): string[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: loadBearing');
}

/**
 * 결론을 무너뜨리는 **최소 전제 조합**을 크기 `maxSize` 이하에서 전부 찾는다.
 *
 * "최소"란 그 조합에서 전제를 하나라도 빼면 더 이상 결론을 무너뜨리지 못한다는
 * 뜻이다. 무너뜨리는 조합의 상위집합은 결과에 넣지 않는다 — 넣으면 목록이
 * 지수적으로 불어나면서 정보는 늘지 않는다.
 *
 * 정렬 규칙: **크기 오름차순, 같은 크기끼리는 사전순.** 각 조합 안의 전제도
 * 사전순으로 정렬한다. 작은 조합이 앞에 오는 이유는 그것이 더 값싼 공격이기
 * 때문이다 — 하나만 확인하면 되는 급소부터 봐야 한다.
 *
 * `maxSize`가 음수이거나 정수가 아니면 `RangeError`를 던진다.
 */
export function minimalBreakingSets(argument: Argument, maxSize: number): string[][] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: minimalBreakingSets');
}

/**
 * 과제 03-02 참고 구현 — 뮤테이션 분석기
 *
 * 📍 되짚기: docs/03-revived-quality-tools.md — "뮤테이션 테스팅이 재는 것"
 *
 * **가장 자주 뒤집히는 곳은 `analyze`의 판정 방향이다.** 테스트가 실패하면
 * 변종이 죽은 것이다. 코드를 망가뜨렸는데 테스트가 실패했다면 테스트가 제 일을
 * 했다는 뜻이기 때문이다. 반대로 통과했다면 그 변경을 아무도 잡지 못했다는
 * 신호이고, 그것이 살아남은 변종이다.
 *
 * **판정하지 못한 것을 세 번째 상태로 둔 이유**도 같은 결에 있다. 돌리지 않은
 * 변종을 죽었다고 세면 점수가 부풀고, 살아남았다고 세면 없는 구멍을 좇게 된다.
 * 그리고 판정된 변종이 하나도 없을 때 0이 아니라 `null`을 내는 것은, 0점이
 * "전부 살아남았다"는 **사실**인 반면 `null`은 "아직 모른다"는 **상태**이기
 * 때문이다. 둘을 같은 값으로 뭉개면 아무것도 돌리지 않은 코드가 최악의 코드로
 * 보고된다.
 *
 * `weakestTargets`는 `analyze`를 다시 부른다. 개수를 세면서 동시에 분류하도록
 * 합칠 수도 있지만, 분류 규칙이 한 곳에만 있어야 나중에 규칙이 바뀔 때 두 함수의
 * 판정이 갈라지지 않는다.
 */

export type Operator = '<' | '<=' | '>' | '>=' | '==' | '!=' | '+' | '-';

export const MUTATIONS: Readonly<Record<Operator, readonly Operator[]>> = {
	'<': ['<=', '>='],
	'<=': ['<', '>'],
	'>': ['>=', '<='],
	'>=': ['>', '<'],
	'==': ['!='],
	'!=': ['=='],
	'+': ['-'],
	'-': ['+'],
} as const;

export interface MutationTarget {
	id: string;
	operator: Operator;
}

export interface Mutant {
	id: string;
	targetId: string;
	original: Operator;
	mutated: Operator;
}

export type TestOutcome = 'pass' | 'fail';

export interface MutationReport {
	killed: string[];
	survived: string[];
	notRun: string[];
	score: number | null;
	complete: boolean;
}

export function generateMutants(targets: MutationTarget[]): Mutant[] {
	return targets.flatMap((target) =>
		MUTATIONS[target.operator].map((mutated) => ({
			id: `${target.id}~${mutated}`,
			targetId: target.id,
			original: target.operator,
			mutated,
		})),
	);
}

export function analyze(
	targets: MutationTarget[],
	results: Record<string, TestOutcome>,
): MutationReport {
	const killed: string[] = [];
	const survived: string[] = [];
	const notRun: string[] = [];

	for (const mutant of generateMutants(targets)) {
		const outcome = results[mutant.id];
		// 테스트가 실패했다는 것은 변경을 잡아냈다는 뜻이다. 변종이 죽었다.
		if (outcome === 'fail') killed.push(mutant.id);
		else if (outcome === 'pass') survived.push(mutant.id);
		else notRun.push(mutant.id);
	}

	const judged = killed.length + survived.length;
	return {
		killed,
		survived,
		notRun,
		score: judged === 0 ? null : killed.length / judged,
		complete: notRun.length === 0,
	};
}

export function weakestTargets(
	targets: MutationTarget[],
	results: Record<string, TestOutcome>,
): string[] {
	const { survived } = analyze(targets, results);
	const counts = new Map<string, number>();

	for (const mutant of generateMutants(targets)) {
		if (!survived.includes(mutant.id)) continue;
		counts.set(mutant.targetId, (counts.get(mutant.targetId) ?? 0) + 1);
	}

	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([targetId]) => targetId);
}

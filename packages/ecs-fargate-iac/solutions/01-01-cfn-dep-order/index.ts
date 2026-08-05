/**
 * 과제 1-1의 참고 구현.
 *
 * 판정은 `tests/01-01-cfn-dep-order/index.test.ts`가 한다. 같은 테스트를 이 파일에 대고
 * 돌린 것이 `pnpm test:solutions`다 — 명세가 실제로 통과 가능한지를 증명하는
 * 쪽이라, 여기 있는 코드는 "정답 하나"가 아니라 "성립하는 한 예"다.
 *
 * 📍 되짚기: docs/01-iac-and-cloudformation.md § 의존 순서 / docs/90-must-memorize.md 카드 2
 */

export interface Resource {
	name: string;
	refs?: string[];
	dependsOn?: string[];
}

/**
 * 리소스별 의존 집합. `refs`와 `dependsOn`을 구분하지 않고 합친다 —
 * CloudFormation에게 둘은 같은 "먼저 만들어져야 하는 것"이다. 차이는 의존이
 * 코드에 드러나는지 여부뿐이고, 순서 계산에는 영향이 없다.
 */
function dependencyMap(resources: Resource[], validate: boolean): Map<string, Set<string>> {
	const names = new Set(resources.map((r) => r.name));
	const map = new Map<string, Set<string>>();

	for (const r of resources) {
		const deps = new Set<string>([...(r.refs ?? []), ...(r.dependsOn ?? [])]);
		for (const target of deps) {
			if (!names.has(target)) {
				if (validate) {
					throw new Error(
						`리소스 ${r.name}이 존재하지 않는 ${target}을 참조한다 — 오타이거나 다른 스택의 리소스다`,
					);
				}
				deps.delete(target);
			}
		}
		map.set(r.name, deps);
	}
	return map;
}

/**
 * 의존 개수가 0인 것부터 벗겨내는 위상 정렬(Kahn 알고리즘).
 *
 * 한 배치를 벗기면 그 배치에 의존했던 리소스들의 미해결 의존이 사라지고,
 * 다음 배치가 드러난다. 벗길 것이 없는데 남은 리소스가 있으면 순환이다.
 */
export function resolveWaves(resources: Resource[]): string[][] {
	const deps = dependencyMap(resources, true);
	const waves: string[][] = [];
	const settled = new Set<string>();

	while (settled.size < resources.length) {
		const wave = resources
			.map((r) => r.name)
			.filter((name) => !settled.has(name) && [...deps.get(name)!].every((d) => settled.has(d)))
			// 정렬이 있어야 결과가 입력 순서에 의존하지 않는다.
			.sort();

		if (wave.length === 0) {
			const stuck = resources
				.map((r) => r.name)
				.filter((n) => !settled.has(n))
				.sort();
			throw new Error(`순환 의존이 있어 순서를 정할 수 없다: ${stuck.join(', ')}`);
		}

		waves.push(wave);
		for (const name of wave) settled.add(name);
	}

	return waves;
}

/**
 * 조사용. resolveWaves와 달리 던지지 않고 목록을 돌려준다.
 *
 * 존재하지 않는 참조는 무시한다 — 그건 순환이 아니라 별개 문제이고,
 * 여기서 함께 던지면 "순환이 있는가"에 답할 수 없다.
 */
export function findCycle(resources: Resource[]): string[] | null {
	const deps = dependencyMap(resources, false);
	const settled = new Set<string>();

	let progressed = true;
	while (progressed) {
		progressed = false;
		for (const r of resources) {
			if (settled.has(r.name)) continue;
			if ([...deps.get(r.name)!].every((d) => settled.has(d))) {
				settled.add(r.name);
				progressed = true;
			}
		}
	}

	const stuck = resources
		.map((r) => r.name)
		.filter((n) => !settled.has(n))
		.sort();
	return stuck.length > 0 ? stuck : null;
}

/**
 * 참고 구현 e05-08-01 — 순수 라이브러리 판별식
 *
 * 판정은 tests/e05-08-01-pure-library/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep05-broker-infra/08-implementation-shape.md · 07-infra-as-fixed-asset.md
 *
 * 읽을 때 눌러 볼 곳 넷:
 *  1. BFS를 쓴 이유 — **가장 짧은 경로**를 요구하므로 DFS로는 안 된다
 *  2. 대상 자신의 `boundTo`를 먼저 보는 것 — 자기가 묶여 있으면 이웃을 볼 필요가 없다
 *  3. `visited` — 순환 의존에서 멈추기 위한 것. 실제 모노레포에 순환은 드물지 않다
 *  4. 외부 이름에서 탐색을 끊는 것 — 워크스페이스 밖은 그래프가 없다.
 *     "알 수 없는 것은 외부로 본다"가 이 판별식의 전제이고, 동시에 한계다
 */

export interface PackageNode {
	name: string;
	boundTo: string | null;
	dependencies: string[];
}

export interface PurityVerdict {
	name: string;
	pure: boolean;
	via: string[];
}

export function internalNames(packages: PackageNode[]): Set<string> {
	return new Set(packages.map((p) => p.name));
}

export function classify(target: string, packages: PackageNode[]): PurityVerdict {
	const byName = new Map(packages.map((p) => [p.name, p]));
	const start = byName.get(target);

	// 워크스페이스에 없는 이름은 외부다. 외부는 이 판별의 대상이 아니다.
	if (!start) return { name: target, pure: true, via: [] };

	// 자기가 이미 앱에 묶여 있으면 이웃을 볼 이유가 없다.
	if (start.boundTo !== null) return { name: target, pure: false, via: [target] };

	// BFS — 최단 경로를 요구하므로 너비 우선이어야 한다.
	const queue: string[][] = [[target]];
	const visited = new Set<string>([target]); // 순환 방지

	while (queue.length > 0) {
		const path = queue.shift()!;
		const node = byName.get(path[path.length - 1]!);
		if (!node) continue;

		for (const dep of node.dependencies) {
			if (visited.has(dep)) continue;
			visited.add(dep);

			const next = byName.get(dep);
			// 외부 의존 — 따라갈 그래프가 없다. 여기서 끊는다.
			if (!next) continue;

			// 묶인 패키지에 닿았다. BFS이므로 첫 도달이 곧 최단 경로다.
			if (next.boundTo !== null) return { name: target, pure: false, via: [...path, dep] };

			// 묶이지 않은 워크스페이스 패키지는 통과해도 된다 — 계속 따라간다.
			// 공용처럼 보이는 유틸이 도메인을 물고 있는 경우가 여기서 잡힌다.
			queue.push([...path, dep]);
		}
	}

	return { name: target, pure: true, via: [] };
}

export function audit(packages: PackageNode[]): PurityVerdict[] {
	return packages.map((p) => classify(p.name, packages));
}

export function offendingEdges(target: string, packages: PackageNode[]): string[] {
	const byName = new Map(packages.map((p) => [p.name, p]));
	const node = byName.get(target);
	if (!node) return [];

	const seen = new Set<string>();
	const out: string[] = [];
	for (const dep of node.dependencies) {
		if (seen.has(dep)) continue;
		seen.add(dep);
		if (!byName.has(dep)) continue; // 외부는 끊을 대상이 아니다

		// 이 의존 자체가 순수하지 않다면, 이것을 끊어야 대상이 순수해진다.
		if (!classify(dep, packages).pure) out.push(dep);
	}
	return out;
}

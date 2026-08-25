/**
 * 과제 05-01 참고 구현 — 의존 규칙 체커
 *
 * 📍 되짚기: docs/05-module-structure-as-leverage.md — "의존 규칙 명세와 체커"
 *
 * **명세를 허용 목록으로 다루는 것이 이 도구의 전제다.** 금지 목록으로 만들면
 * 새 모듈이 생길 때마다 아무 규칙에도 걸리지 않고 통과하므로, 명세가 자라지 않는
 * 한 검사가 조용히 약해진다. 허용 목록은 반대로 새 관계가 생길 때마다 사람에게
 * 판단을 요구한다. 귀찮음이 곧 이 도구의 값이다.
 *
 * **판정 순서에 이유가 있다.** 모르는 모듈이 끼어 있으면 허용 여부를 따지는 것
 * 자체가 무의미하다. 순서를 뒤집으면 명세에서 빠진 모듈이 전부 "허용되지 않은
 * 의존"으로 보고되어, 진짜 문제(명세가 낡았다)가 가짜 문제(방향이 틀렸다) 뒤에
 * 숨는다.
 *
 * **순환 탐지에서 정규화가 필요한 이유**는 같은 순환이 탐색 시작점에 따라 다른
 * 배열로 나오기 때문이다. 회전시켜 가장 작은 모듈에서 시작하도록 맞추지 않으면
 * 하나의 문제가 여러 건으로 세어지고, 고쳤는지 여부도 판정할 수 없게 된다.
 *
 * 순환 탐색은 경로에 이미 있는 노드를 만나면 멈추므로 방문 노드 수가 모듈 수를
 * 넘지 않는다. 모듈 수백 개 규모까지는 이 단순한 깊이 우선 탐색으로 충분하고,
 * 그보다 커지면 강결합 요소를 먼저 나누는 알고리즘으로 옮겨야 한다.
 */

export interface DependencySpec {
	modules: string[];
	allowed: Array<[from: string, to: string]>;
}

export type DependencyGraph = Record<string, string[]>;

export type ViolationKind = 'unknown-module' | 'self-dependency' | 'not-allowed';

export interface Violation {
	from: string;
	to: string;
	kind: ViolationKind;
}

export function checkDependencies(spec: DependencySpec, graph: DependencyGraph): Violation[] {
	const known = new Set(spec.modules);
	const allowed = new Set(spec.allowed.map(([from, to]) => `${from} ${to}`));
	const violations: Violation[] = [];

	for (const [from, deps] of Object.entries(graph)) {
		for (const to of deps) {
			// 모르는 모듈이 끼어 있으면 허용 여부를 따지는 것 자체가 의미 없다.
			if (!known.has(from) || !known.has(to)) {
				violations.push({ from, to, kind: 'unknown-module' });
			} else if (from === to) {
				violations.push({ from, to, kind: 'self-dependency' });
			} else if (!allowed.has(`${from} ${to}`)) {
				violations.push({ from, to, kind: 'not-allowed' });
			}
		}
	}

	return violations.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

/** 사전순으로 가장 작은 원소가 맨 앞에 오도록 회전시킨다. */
function normalize(cycle: string[]): string[] {
	let minIndex = 0;
	let min: string | undefined;
	for (const [i, value] of cycle.entries()) {
		if (min === undefined || value.localeCompare(min) < 0) {
			min = value;
			minIndex = i;
		}
	}
	return [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
}

function compare(a: string[], b: string[]): number {
	for (const [i, left] of a.entries()) {
		const right = b[i];
		if (right === undefined) break;
		const c = left.localeCompare(right);
		if (c !== 0) return c;
	}
	// 앞부분이 모두 같으면 짧은 순환이 먼저다.
	return a.length - b.length;
}

export function findCycles(graph: DependencyGraph): string[][] {
	const found = new Map<string, string[]>();

	const walk = (path: string[], node: string): void => {
		const seen = path.indexOf(node);
		if (seen !== -1) {
			// 경로에 이미 있는 노드로 되돌아왔다. 그 지점부터가 순환이다.
			const cycle = normalize(path.slice(seen));
			found.set(cycle.join(' '), cycle);
			return;
		}
		for (const next of [...(graph[node] ?? [])].sort()) {
			walk([...path, node], next);
		}
	};

	for (const node of Object.keys(graph).sort()) {
		walk([], node);
	}

	return [...found.values()].sort(compare);
}

/**
 * 참고 구현 e04-03-01 — 봉투로 인과 그래프 복원
 *
 * 판정은 tests/e04-03-01-causal-graph/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep04-agent-server/03-envelope.md
 *
 * 읽을 때 눌러 볼 곳 넷:
 *  1. `restore` — 먼저 전체를 색인한 뒤 붙인다. 한 번 순회로는 안 된다
 *  2. `reachesRoot` — 순환을 방문 집합으로 끊는다
 *  3. `sortSiblings` — sequence가 있는 것끼리만 정렬하고 나머지는 도착 순서 유지
 *  4. `missingSequences` — 0부터 최대값까지를 기대 집합으로 잡는다
 */

export type Scope = 'session' | 'turn' | 'iteration' | 'tool';

export interface Envelope {
	eventKey: string;
	transactionKey: string;
	parentEventKey: string | null;
	scope: Scope;
	sequence: number | null;
	action: string;
}

export interface Node {
	envelope: Envelope;
	children: Node[];
}

export interface Restored {
	roots: Node[];
	orphans: Envelope[];
}

/** 계층의 깊이. 숫자가 크면 아래 층이다. */
const DEPTH: Record<Scope, number> = { session: 0, turn: 1, iteration: 2, tool: 3 };

/**
 * 형제 정렬. sequence가 있는 것은 순번으로, 없는 것은 도착 순서로.
 *
 * `Array#sort`가 안정 정렬이라는 사실에 의존하지 않고, 두 묶음을 명시적으로
 * 나눈 뒤 이어붙인다 — 의도가 코드에 보이는 편이 낫다.
 */
function sortSiblings(nodes: Node[]): Node[] {
	const numbered = nodes.filter((n) => n.envelope.sequence !== null);
	const plain = nodes.filter((n) => n.envelope.sequence === null);
	numbered.sort((a, b) => (a.envelope.sequence as number) - (b.envelope.sequence as number));
	return [...numbered, ...plain];
}

export function restore(events: Envelope[]): Restored {
	// ① 전체를 먼저 색인한다. 한 번 순회로 붙이려 하면 부모가 늦게 온 경우를 놓친다.
	const byKey = new Map<string, Envelope>();
	for (const e of events) byKey.set(e.eventKey, e);

	const nodes = new Map<string, Node>();
	for (const e of events) nodes.set(e.eventKey, { envelope: e, children: [] });

	// ② 루트에 도달하는지 확인한다. 방문 집합으로 순환을 끊는다 —
	//    재귀로 부모를 따라 올라가면 a→b→a에서 스택이 터진다.
	const verdict = new Map<string, boolean>();
	const reachesRoot = (start: string): boolean => {
		const cached = verdict.get(start);
		if (cached !== undefined) return cached;

		const path: string[] = [];
		const seen = new Set<string>();
		let cursor: string | undefined = start;
		let ok = false;

		while (cursor !== undefined) {
			if (seen.has(cursor)) break; // 순환 — 루트에 도달하지 못한다
			const known = verdict.get(cursor);
			if (known !== undefined) {
				ok = known;
				break;
			}
			seen.add(cursor);
			path.push(cursor);

			const envelope = byKey.get(cursor);
			if (!envelope) break; // 부모가 입력에 없다 — 고아
			if (envelope.parentEventKey === null) {
				ok = true;
				break;
			}
			cursor = envelope.parentEventKey;
		}

		for (const key of path) verdict.set(key, ok);
		return ok;
	};

	const roots: Node[] = [];
	const orphans: Envelope[] = [];

	// ③ 입력 순서를 유지하며 붙인다 — 도착 순서가 형제 정렬의 기본값이다.
	for (const e of events) {
		if (!reachesRoot(e.eventKey)) {
			orphans.push(e);
			continue;
		}
		const node = nodes.get(e.eventKey)!;
		if (e.parentEventKey === null) {
			roots.push(node);
		} else {
			nodes.get(e.parentEventKey)!.children.push(node);
		}
	}

	// ④ 형제 정렬을 트리 전체에 적용한다.
	const applySort = (node: Node): void => {
		node.children = sortSiblings(node.children);
		for (const child of node.children) applySort(child);
	};
	for (const root of roots) applySort(root);

	return { roots: sortSiblings(roots), orphans };
}

export function missingSequences(events: Envelope[], transactionKey: string): number[] {
	const seen = new Set<number>();
	for (const e of events) {
		if (e.transactionKey !== transactionKey) continue;
		if (e.sequence === null) continue;
		seen.add(e.sequence); // Set이라 중복 도착이 구멍 판정을 흔들지 않는다
	}
	if (seen.size === 0) return [];

	// 0부터 센다. 받은 것 중 최소값부터 세면 맨 앞이 빠진 경우를 놓친다.
	const max = Math.max(...seen);
	const missing: number[] = [];
	for (let i = 0; i <= max; i += 1) {
		if (!seen.has(i)) missing.push(i);
	}
	return missing;
}

export function flatten(nodes: Node[]): Envelope[] {
	const out: Envelope[] = [];
	const walk = (node: Node): void => {
		out.push(node.envelope); // 부모가 먼저 (전위 순회)
		for (const child of node.children) walk(child);
	};
	for (const node of nodes) walk(node);
	return out;
}

export function scopeViolations(events: Envelope[]): Array<{ child: string; parent: string }> {
	const byKey = new Map<string, Envelope>();
	for (const e of events) byKey.set(e.eventKey, e);

	const violations: Array<{ child: string; parent: string }> = [];
	for (const child of events) {
		if (child.parentEventKey === null) continue;
		const parent = byKey.get(child.parentEventKey);
		if (!parent) continue; // 부모가 없으면 고아 판정 몫이다
		// 층을 건너뛰는 것(session → tool)은 정상이고, 같은 층도 정상이다.
		// 부모가 자식보다 아래 층일 때만 뒤집힌 것이다.
		if (DEPTH[parent.scope] > DEPTH[child.scope]) {
			violations.push({ child: child.eventKey, parent: parent.eventKey });
		}
	}
	return violations;
}

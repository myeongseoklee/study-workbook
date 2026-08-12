/**
 * 참고 구현 — 조직 트리와 모델 라우팅.
 *
 * 판정은 tests/e03-06-01-org-tree/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep03-admin-implementation/06-org-tree-and-routing.md
 */

export interface Org {
	id: string;
	name: string;
	parentId: string | null;
}

export type Scope = 'node' | 'subtree' | 'master';

export interface Grant {
	userId: string;
	orgId: string | null;
	scope: Scope;
}

/**
 * `filter`이지 `find`가 아니다. 그리고 부모 id가 목록에 없는 노드도 루트로 본다 —
 * 부모가 삭제된 노드를 숨기면 트리에서 접근할 방법이 사라져 고칠 수도 없다.
 */
export function roots(orgs: Org[]): Org[] {
	const ids = new Set(orgs.map((o) => o.id));
	return orgs.filter((o) => o.parentId === null || !ids.has(o.parentId));
}

/**
 * 방문 집합이 순환 방어다. 노드를 자기 후손 밑으로 옮기는 실수 하나로 데이터에
 * 순환이 생기고, 그러면 이 함수가 무한히 돌아 요청이 서버를 잡아먹는다.
 * 빈 결과를 주는 것과 서버가 죽는 것은 성질이 다른 실패다.
 */
export function descendants(orgs: Org[], orgId: string): Org[] {
	const childrenOf = new Map<string, Org[]>();
	for (const o of orgs) {
		if (o.parentId === null) continue;
		const list = childrenOf.get(o.parentId) ?? [];
		list.push(o);
		childrenOf.set(o.parentId, list);
	}

	const out: Org[] = [];
	const seen = new Set<string>([orgId]);
	const queue = [...(childrenOf.get(orgId) ?? [])];
	while (queue.length > 0) {
		const node = queue.shift()!;
		if (seen.has(node.id)) continue;
		seen.add(node.id);
		out.push(node);
		queue.push(...(childrenOf.get(node.id) ?? []));
	}
	return out;
}

/** 자신부터 루트까지의 id들 (순환이 있어도 멈춘다). */
function selfAndAncestors(orgs: Org[], orgId: string): string[] {
	const byId = new Map(orgs.map((o) => [o.id, o]));
	const chain: string[] = [];
	const seen = new Set<string>();
	let cur: string | null = orgId;
	while (cur !== null && byId.has(cur) && !seen.has(cur)) {
		seen.add(cur);
		chain.push(cur);
		cur = byId.get(cur)!.parentId;
	}
	return chain;
}

/**
 * 범위를 함께 보는 것이 이 함수의 요점이다.
 *
 * 조상 사슬만 따라 올라가며 "권한이 있나"를 물으면 `node` 범위가 `subtree`처럼
 * 동작해, 팀장이 팀 밑의 모든 조직을 관리하게 된다. 그래서 **자기 노드에는 두
 * 범위 모두**, **조상 노드에는 `subtree`만** 인정한다.
 *
 * `subtree`가 후손을 계산해서 판정하는 대신 조상을 거슬러 올라가 확인하는 이유는
 * 성능이 아니라 **의미**다 — 나중에 생긴 노드도 자동으로 포함되어야 하고, 조상
 * 사슬은 그것을 공짜로 만족한다.
 */
export function isAdminOf(orgs: Org[], grants: Grant[], userId: string, targetOrgId: string): boolean {
	const mine = grants.filter((g) => g.userId === userId);
	if (mine.some((g) => g.scope === 'master')) return true;

	const chain = selfAndAncestors(orgs, targetOrgId);
	if (chain.length === 0) return false;

	return mine.some((g) => {
		if (g.orgId === null) return false;
		if (g.scope === 'node') return g.orgId === targetOrgId;
		// subtree — 자기 노드이거나 조상이면 된다
		return chain.includes(g.orgId);
	});
}

/**
 * 가장 가까운 조상의 할당이 이긴다. 합집합을 만들면 하위 조직을 좁히려는 설정이
 * 무력화된다 — "인사팀은 이것만 써야 돼"가 상위 할당에 덮여 버린다.
 *
 * `has`로 확인하는 이유: **미설정과 빈 배열은 다른 결정**이다. 빈 배열은 "이
 * 조직은 아무것도 못 쓴다"는 명시적 차단이므로 부모를 물려받아선 안 된다.
 *
 * 어디에도 없으면 빈 배열이다(기본 거부). 전체 허용으로 두면 새 모델을 등록할
 * 때마다 지정하지 않은 모든 조직에 열린다.
 */
export function allowedPresets(
	orgs: Org[],
	assignments: Map<string, string[]>,
	orgId: string,
): string[] {
	for (const id of selfAndAncestors(orgs, orgId)) {
		if (assignments.has(id)) return [...assignments.get(id)!];
	}
	return [];
}

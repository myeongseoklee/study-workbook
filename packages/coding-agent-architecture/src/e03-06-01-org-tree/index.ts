/**
 * 과제 e03-06-01 — 조직 트리와 모델 라우팅
 *
 * 강의가 직접 지목한 실수로 시작한다 — **"조직도 만들 때 가장 많이 한 실수가
 * 루트를 하나밖에 안 되게 만드는 것"**. 지사 A·지사 B가 서로의 하위가 아니면서
 * 나란히 존재한다. 그 위에 관리자 권한 범위와 조직별 모델 접근이 얹힌다.
 *
 * 명세:  tests/e03-06-01-org-tree/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e03-06-01
 * 막히면: docs/ep03-admin-implementation/06-org-tree-and-routing.md
 */

export interface Org {
	id: string;
	name: string;
	/** null이면 최상위. 이런 노드가 **여럿** 있을 수 있다. */
	parentId: string | null;
}

/** 관리자 권한의 범위. */
export type Scope = 'node' | 'subtree' | 'master';

export interface Grant {
	userId: string;
	/** master 범위는 특정 조직에 매이지 않으므로 null이다. */
	orgId: string | null;
	scope: Scope;
}

/**
 * 최상위 조직들.
 *
 * 힌트: `find`로 하나만 돌려주면 이 과제의 요점을 놓친다. 그리고 부모 id가
 *       목록에 없는 노드(고아)를 숨기면 트리로 접근할 방법이 사라진다.
 */
export function roots(orgs: Org[]): Org[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: roots');
}

/**
 * 그 노드의 모든 후손 (자신은 제외).
 *
 * 힌트: 데이터가 깨져 부모 관계에 순환이 생기면 재귀가 무한히 돈다. 방문한
 *       노드를 기억해라 — 서버가 죽는 것과 빈 결과를 주는 것은 다른 문제다.
 */
export function descendants(orgs: Org[], orgId: string): Org[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: descendants');
}

/**
 * 이 사용자가 그 조직의 관리자인가.
 *
 * 힌트: 범위 셋이 각각 다르게 동작한다. `node`는 그 노드에서만, `subtree`는
 *       그 노드와 모든 후손에서, `master`는 트리와 무관하게. 조상을 따라
 *       올라가면서 범위를 함께 봐야 팀장이 팀 밑까지 관리하는 일이 없다.
 */
export function isAdminOf(orgs: Org[], grants: Grant[], userId: string, targetOrgId: string): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: isAdminOf');
}

/**
 * 그 조직이 쓸 수 있는 모델 프리셋 이름들.
 *
 * 힌트: 자기 할당이 없으면 위로 올라가되 **가장 가까운 조상의 할당이 이긴다**
 *       (합집합이 아니다 — 그러면 하위를 좁히려는 설정이 무력화된다). 그리고
 *       "할당이 없다"와 "빈 배열을 할당했다"는 다른 결정이다. 어디에도 없으면
 *       전체 허용이 아니라 **빈 배열**이다.
 */
export function allowedPresets(
	orgs: Org[],
	assignments: Map<string, string[]>,
	orgId: string,
): string[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: allowedPresets');
}

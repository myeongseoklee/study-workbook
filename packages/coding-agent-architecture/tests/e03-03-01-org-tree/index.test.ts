// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e03-03-01-org-tree/index.ts를 고쳐라.
//
// "조직도 만들 때 가장 많이 한 실수가 루트를 하나밖에 안 되게 만드는 것"이라는 지적이
// 이 과제의 첫 테스트다. 그리고 관리자 권한 범위(노드 단독 / 하위 전체)와 조직별 모델
// 접근이 그 위에 얹힌다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	allowedPresets,
	descendants,
	isAdminOf,
	roots,
	type Grant,
	type Org,
} from '../../src/e03-03-01-org-tree';

//  A-글로벌사업 ──┬── A-영업          ── A-영업1팀
//                 └── A-개발
//  B-국내사업   ──┬── B-인사
//  (루트가 둘이다 — 지사 A / 지사 B)
const orgs: Org[] = [
	{ id: 'a', name: 'A-글로벌사업', parentId: null },
	{ id: 'a-sales', name: 'A-영업', parentId: 'a' },
	{ id: 'a-sales-1', name: 'A-영업1팀', parentId: 'a-sales' },
	{ id: 'a-dev', name: 'A-개발', parentId: 'a' },
	{ id: 'b', name: 'B-국내사업', parentId: null },
	{ id: 'b-hr', name: 'B-인사', parentId: 'b' },
];

describe('roots — 최상위는 여러 개일 수 있다', () => {
	it('parentId가 null인 노드를 모두 준다', () => {
		retrace(
			'루트를 하나로 전제하면(find로 첫 번째만 반환) 지사 B가 화면에서 사라진다. ' +
				'실무에서 지사·법인·인수한 자회사가 나란히 존재한다.',
			() => {
				expect(roots(orgs).map((o) => o.id)).toEqual(['a', 'b']);
			},
		);
	});

	it('빈 목록이면 빈 배열이다', () => {
		expect(roots([])).toEqual([]);
	});

	it('부모 id가 목록에 없는 노드도 루트로 본다 (고아 노드)', () => {
		retrace('부모가 삭제된 노드를 숨기면 트리에서 접근할 방법이 사라진다', () => {
			const orphan: Org[] = [{ id: 'x', name: 'X', parentId: 'gone' }];
			expect(roots(orphan).map((o) => o.id)).toEqual(['x']);
		});
	});
});

describe('descendants — 하위 전체', () => {
	it('자신을 포함하지 않는다', () => {
		expect(descendants(orgs, 'a').map((o) => o.id).sort()).toEqual(['a-dev', 'a-sales', 'a-sales-1']);
	});

	it('손자까지 재귀적으로 내려간다', () => {
		expect(descendants(orgs, 'a-sales').map((o) => o.id)).toEqual(['a-sales-1']);
	});

	it('잎 노드는 빈 배열이다', () => {
		expect(descendants(orgs, 'a-sales-1')).toEqual([]);
	});

	it('다른 루트의 노드는 섞이지 않는다', () => {
		expect(descendants(orgs, 'b').map((o) => o.id)).toEqual(['b-hr']);
	});

	it('부모 관계에 순환이 있어도 멈춘다', () => {
		retrace(
			'데이터가 깨져 순환이 생기면(노드를 자기 후손 밑으로 옮기는 실수) 재귀가 무한히 돈다. ' +
				'방문한 노드를 기억해 서버가 죽지 않게 만들어라.',
			() => {
				const cyclic: Org[] = [
					{ id: 'p', name: 'P', parentId: 'q' },
					{ id: 'q', name: 'Q', parentId: 'p' },
				];
				expect(descendants(cyclic, 'p').map((o) => o.id)).toEqual(['q']);
			},
		);
	});
});

describe('isAdminOf — 권한 범위가 두 종류다', () => {
	const grants: Grant[] = [
		{ userId: 'team-lead', orgId: 'a-sales', scope: 'node' },
		{ userId: 'branch-head', orgId: 'a', scope: 'subtree' },
	];

	it('node 범위는 그 노드에서만 관리자다', () => {
		expect(isAdminOf(orgs, grants, 'team-lead', 'a-sales')).toBe(true);
	});

	it('node 범위는 자기 하위 노드의 관리자가 아니다', () => {
		retrace('scope를 무시하고 조상만 따라 올라가면 팀장이 팀 밑의 모든 조직을 관리하게 된다', () => {
			expect(isAdminOf(orgs, grants, 'team-lead', 'a-sales-1')).toBe(false);
		});
	});

	it('subtree 범위는 그 노드에서도 관리자다', () => {
		expect(isAdminOf(orgs, grants, 'branch-head', 'a')).toBe(true);
	});

	it('subtree 범위는 모든 후손에서 관리자다', () => {
		expect(isAdminOf(orgs, grants, 'branch-head', 'a-sales')).toBe(true);
		expect(isAdminOf(orgs, grants, 'branch-head', 'a-sales-1')).toBe(true);
	});

	it('subtree 범위도 다른 루트에는 미치지 않는다', () => {
		expect(isAdminOf(orgs, grants, 'branch-head', 'b')).toBe(false);
		expect(isAdminOf(orgs, grants, 'branch-head', 'b-hr')).toBe(false);
	});

	it('나중에 생긴 하위 노드에도 권한이 자동으로 미친다', () => {
		retrace(
			'하위 전체 범위가 존재하는 이유가 이것이다. 노드마다 개별 부여로 흉내내면 조직을 새로 ' +
				'만들 때마다 다시 부여해야 하고, 그러면 권한이 조직 변경을 따라오지 못한다.',
			() => {
				const grown = [...orgs, { id: 'a-dev-2', name: 'A-개발2팀', parentId: 'a-dev' }];
				expect(isAdminOf(grown, grants, 'branch-head', 'a-dev-2')).toBe(true);
			},
		);
	});

	it('권한이 없는 사용자는 어디서도 false다', () => {
		expect(isAdminOf(orgs, grants, 'nobody', 'a')).toBe(false);
	});

	it('마스터는 트리와 무관하게 모든 노드의 관리자다', () => {
		const withMaster: Grant[] = [...grants, { userId: 'root-admin', orgId: null, scope: 'master' }];
		expect(isAdminOf(orgs, withMaster, 'root-admin', 'b-hr')).toBe(true);
		expect(isAdminOf(orgs, withMaster, 'root-admin', 'a-sales-1')).toBe(true);
	});
});

describe('allowedPresets — 기본은 거부다', () => {
	const assignments = new Map<string, string[]>([
		['a', ['gemma-coding', 'qwen-coding']],
		['a-sales', ['gemma-coding']],
	]);

	it('할당된 조직은 그 목록을 쓴다', () => {
		expect(allowedPresets(orgs, assignments, 'a-sales')).toEqual(['gemma-coding']);
	});

	it('할당이 없으면 부모의 할당을 물려받는다', () => {
		expect(allowedPresets(orgs, assignments, 'a-dev')).toEqual(['gemma-coding', 'qwen-coding']);
	});

	it('가장 가까운 조상의 할당이 이긴다', () => {
		retrace('루트까지 올라가 합집합을 만들면 하위 조직을 좁히려는 설정이 무력화된다', () => {
			expect(allowedPresets(orgs, assignments, 'a-sales-1')).toEqual(['gemma-coding']);
		});
	});

	it('조상 어디에도 할당이 없으면 빈 배열이다 — 전체 허용이 아니다', () => {
		retrace(
			'"내가 이렇게 다 지정해 줘야지만 쓸 수 있는 거지" — 지정하지 않은 조직이 모든 모델을 ' +
				'쓰게 되면, 새 모델을 등록할 때마다 전 조직에 열린다.',
			() => {
				expect(allowedPresets(orgs, assignments, 'b-hr')).toEqual([]);
			},
		);
	});

	it('빈 배열을 명시적으로 할당한 조직은 부모를 물려받지 않는다', () => {
		retrace('빈 배열은 "아무것도 못 쓴다"는 결정이다. 미설정과 구별해야 차단이 가능하다', () => {
			const withBlock = new Map(assignments).set('a-dev', []);
			expect(allowedPresets(orgs, withBlock, 'a-dev')).toEqual([]);
		});
	});

	it('없는 조직 id는 빈 배열이다', () => {
		expect(allowedPresets(orgs, assignments, 'nope')).toEqual([]);
	});
});

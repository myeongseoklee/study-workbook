/**
 * 과제 3-3 — 기반 컨텍스트 조립기
 *
 * 세션이 시작되기 전에 끝내야 하는 계산을 구현한다. 도구·스킬 목록은 상수가
 * 아니라 여러 입력이 겹친 계산 결과이고, 같은 이름이 여러 곳에 있으면 우선순위
 * 규칙이 필요하다.
 *
 * 명세:  tests/e02-03-01-context-assembler/index.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test e02-03-01
 * 막히면: docs/ep02-business-agent/03-context-assembly.md
 */

/** 스킬·도구가 존재할 수 있는 위치. */
export type Scope = 'system' | 'global' | 'project';

/**
 * 이름이 충돌할 때 누가 이기는가.
 *
 * 강의의 요점은 "어느 순서가 정답인가"가 아니라 **규칙을 한 곳에 명시해야
 * 한다**는 것이다. 순서를 바꿔도 테스트는 통과한다 — 단, resolveSkills가 이
 * 상수를 실제로 참조해야 한다.
 *
 * 🎯 TODO: 우선순위를 정하라 (앞이 이긴다)
 */
export const SCOPE_PRIORITY: readonly Scope[] = [];

export interface Skill {
	name: string;
	scope: Scope;
	/** 이 스킬이 쓸 수 있는 도구를 한정한다. 비어 있으면 한정하지 않는다. */
	allowedTools?: string[];
}

/**
 * 스코프별 스킬 목록을 하나로 합친다. 같은 이름은 SCOPE_PRIORITY에 따라 하나만 남긴다.
 *
 * 힌트: 입력에 SCOPE_PRIORITY에 없는 스코프가 섞여 들어올 수도 있다.
 */
export function resolveSkills(sources: Skill[]): Skill[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: resolveSkills');
}

/**
 * 실제로 모델에게 넘길 도구 목록.
 *
 * 세 입력이 겹쳐 결과가 정해진다 — 전체 도구, 퍼미션이 막은 도구,
 * 활성 스킬이 허용한 도구.
 */
export function resolveTools(
	allTools: string[],
	blockedByPermission: string[],
	skillAllowedTools?: string[],
): string[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: resolveTools');
}

/**
 * 기반 컨텍스트가 예산(컨텍스트 윈도우의 5%)을 넘었는가.
 *
 * 넘으면 주인공인 실제 작업이 자리를 잃는다. 경계값(정확히 5%)은 초과가 아니다.
 */
export function exceedsBudget(baseTokens: number, contextWindow: number): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: exceedsBudget');
}

// 직접 실행하면 조립 결과 요약을 출력한다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const skills = resolveSkills([
		{ name: 'web-scaffold', scope: 'global' },
		{ name: 'web-scaffold', scope: 'project' },
		{ name: 'deploy', scope: 'system' },
	]);
	console.log('스킬:', skills.map((s) => `${s.name}(${s.scope})`).join(', '));
	console.log('도구:', resolveTools(['read', 'write', 'bash'], ['bash'], ['read', 'bash']).join(', '));
	console.log('예산 초과:', exceedsBudget(20_000, 262_144));
}

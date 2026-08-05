/**
 * 과제 3-3의 참고 구현.
 *
 * 판정은 `tests/3-3-context-assembler.test.ts`가 한다.
 *
 * 📍 되짚기: docs/ep02-business-agent/03-context-assembly.md § 왜 리스트를 "계산"해야 하는가
 */

/** 스킬·도구가 존재할 수 있는 위치. */
export type Scope = 'system' | 'global' | 'project';

/**
 * 이름이 충돌할 때 누가 이기는가.
 *
 * 여기 쓴 순서 자체가 정답인 것은 아니다 — 프로젝트가 시스템을 덮어쓰는
 * 설계도 흔하다. 중요한 것은 규칙이 **한 곳에** 있다는 사실이고, 해소 코드가
 * 이 배열을 읽는다는 점이다. 규칙이 여러 함수에 흩어지면 나중에 순서를
 * 바꿀 때 어디를 고쳐야 하는지 알 수 없게 된다.
 */
export const SCOPE_PRIORITY: readonly Scope[] = ['project', 'global', 'system'];

export interface Skill {
	name: string;
	scope: Scope;
	/** 이 스킬이 쓸 수 있는 도구를 한정한다. 비어 있으면 한정하지 않는다. */
	allowedTools?: string[];
}

/**
 * 스코프별 스킬 목록을 하나로 합친다. 같은 이름은 SCOPE_PRIORITY에 따라 하나만 남긴다.
 *
 * 입력 순서에 기대지 않는 것이 핵심이다. "먼저 온 것을 남긴다"나 "나중 것으로
 * 덮어쓴다"는 둘 다 입력 순서에 의존하는 규칙이라, 소스를 모으는 순서가 바뀌면
 * 결과가 조용히 달라진다.
 *
 * SCOPE_PRIORITY에 없는 스코프가 섞여 들어오면 indexOf가 −1을 준다. 그대로 쓰면
 * 가장 우선순위가 높은 것으로 취급되므로, 알 수 없는 스코프는 맨 뒤로 보낸다.
 */
export function resolveSkills(sources: Skill[]): Skill[] {
	const rank = (scope: Scope): number => {
		const index = SCOPE_PRIORITY.indexOf(scope);
		return index === -1 ? Number.MAX_SAFE_INTEGER : index;
	};

	const winners = new Map<string, Skill>();
	for (const skill of sources) {
		const current = winners.get(skill.name);
		if (!current || rank(skill.scope) < rank(current.scope)) {
			winners.set(skill.name, skill);
		}
	}
	return [...winners.values()];
}

/**
 * 실제로 모델에게 넘길 도구 목록.
 *
 * 세 입력이 겹쳐 결과가 정해진다. 퍼미션 차단은 **빼기**이고 스킬 허용은
 * **교집합**인데, 둘의 성격이 다르다는 게 요점이다 — 차단은 언제나 적용되지만,
 * 허용 목록은 없을 수도 있다. `undefined`(한정하지 않음)와 `[]`(아무것도
 * 허용하지 않음)를 같게 다루면 스킬이 붙는 순간 도구가 전부 사라진다.
 */
export function resolveTools(
	allTools: string[],
	blockedByPermission: string[],
	skillAllowedTools?: string[],
): string[] {
	const blocked = new Set(blockedByPermission);
	const allowed = skillAllowedTools ? new Set(skillAllowedTools) : undefined;

	return allTools.filter((tool) => !blocked.has(tool) && (!allowed || allowed.has(tool)));
}

/**
 * 기반 컨텍스트가 예산(컨텍스트 윈도우의 5%)을 넘었는가.
 *
 * 절대 토큰 수가 아니라 비율로 판정하는 이유는, 같은 기반 컨텍스트라도 윈도우가
 * 크면 부담이 아니기 때문이다. 넘으면 주인공인 실제 작업이 자리를 잃는다.
 */
export function exceedsBudget(baseTokens: number, contextWindow: number): boolean {
	return baseTokens / contextWindow > 0.05;
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

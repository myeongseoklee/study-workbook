/**
 * 과제 3-3의 정답 — 테스트 코드
 *
 * 참고 구현(완성 골격)은 주지 않는다. 읽으면 베끼게 되고 그 순간 과제가
 * 독해로 바뀐다. 대신 당신의 구현을 돌려 판정한다.
 *
 * 실행: npm run test:3-3
 *
 * 각 check는 src/3-3-context-assembler.ts 상단의 성공 기준과 1:1로 대응한다.
 */
import {
	SCOPE_PRIORITY,
	resolveSkills,
	resolveTools,
	exceedsBudget,
	type Scope,
} from '../src/3-3-context-assembler.js';

let pass = 0;
let total = 0;

function check(label: string, cond: boolean, detail = ''): void {
	total++;
	if (cond) pass++;
	console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? `\n    ${detail}` : ''}`);
}

// 기준 1 — SCOPE_PRIORITY가 명시돼 있다
const scopes: Scope[] = ['system', 'global', 'project'];
check(
	'SCOPE_PRIORITY에 세 스코프가 모두 명시됨',
	SCOPE_PRIORITY.length === 3 && scopes.every((s) => SCOPE_PRIORITY.includes(s)),
	`실제: [${SCOPE_PRIORITY.join(', ')}] — system·global·project 세 개를 순서대로 넣어야 합니다`,
);

// 기준 2 — 이름 충돌 시 하나만 남고, 그 선택이 SCOPE_PRIORITY를 따른다
const winner = SCOPE_PRIORITY[0];
const loser = SCOPE_PRIORITY[SCOPE_PRIORITY.length - 1];
const conflict = resolveSkills([
	{ name: 'dup', scope: loser as Scope },
	{ name: 'dup', scope: winner as Scope },
]);
check(
	'같은 이름은 하나만 남는다',
	conflict.length === 1,
	`실제 ${conflict.length}개: ${JSON.stringify(conflict)} — 이름 해소를 하지 않았습니다`,
);
check(
	'남는 쪽이 SCOPE_PRIORITY 앞선 스코프',
	conflict.length === 1 && conflict[0]?.scope === winner,
	`기대 scope=${winner}, 실제 ${conflict[0]?.scope} — 입력 순서가 아니라 SCOPE_PRIORITY를 봐야 합니다`,
);

// 기준 3 — 겹치지 않는 스킬은 모두 살아남는다
const mixed = resolveSkills([
	{ name: 'a', scope: 'global' },
	{ name: 'b', scope: 'project' },
	{ name: 'a', scope: 'system' },
	{ name: 'c', scope: 'system' },
]);
check(
	'겹치지 않는 스킬은 모두 유지 (a, b, c)',
	mixed.length === 3 && ['a', 'b', 'c'].every((n) => mixed.some((s) => s.name === n)),
	`실제 ${mixed.length}개: ${mixed.map((s) => s.name).join(',')} — 충돌하지 않는 것까지 지웠는지 확인`,
);

// 기준 4 — resolveTools: (전체 − 차단) ∩ 스킬 허용
const tools = resolveTools(['read', 'write', 'bash', 'web'], ['bash'], ['read', 'bash', 'web']);
check(
	'퍼미션 차단과 스킬 한정이 모두 반영됨',
	tools.length === 2 && tools.includes('read') && tools.includes('web'),
	`기대 [read, web], 실제 [${tools.join(', ')}] — 차단(bash)과 한정(write 제외)이 함께 걸려야 합니다`,
);

// 기준 5 — 스킬 허용 목록이 없으면 한정하지 않는다
const unbounded = resolveTools(['read', 'write', 'bash'], ['bash']);
check(
	'스킬 허용 목록이 없으면 (전체 − 차단)',
	unbounded.length === 2 && unbounded.includes('read') && unbounded.includes('write'),
	`기대 [read, write], 실제 [${unbounded.join(', ')}] — undefined를 "아무것도 허용 안 함"으로 처리했는지 확인`,
);

// 기준 6 — 5% 예산. 경계값은 초과가 아니다.
const win = 262_144;
check(
	'5% 초과를 잡아낸다',
	exceedsBudget(Math.floor(win * 0.06), win) === true,
	'6%를 초과로 판정하지 못했습니다',
);
check(
	'5% 이하는 초과가 아니다 (경계 포함)',
	exceedsBudget(Math.floor(win * 0.05), win) === false && exceedsBudget(Math.floor(win * 0.04), win) === false,
	'정확히 5%이거나 그 이하인데 초과로 판정했습니다 — 부등호 방향을 확인하세요',
);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);

// 📍 되짚기: docs/ep02-business-agent/03-context-assembly.md § 왜 리스트를 "계산"해야 하는가

/**
 * 과제 3-5의 정답 — 테스트 코드
 *
 * 참고 구현은 주지 않는다. 당신의 구현을 돌려 판정한다.
 *
 * 실행: npm run test:3-5
 *
 * 각 check는 src/3-5-compact-replay.ts 상단의 성공 기준과 1:1로 대응한다.
 */
import { buildModelInput, type Entry } from '../src/3-5-compact-replay.js';

let pass = 0;
let total = 0;

function check(label: string, cond: boolean, detail = ''): void {
	total++;
	if (cond) pass++;
	console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? `\n    ${detail}` : ''}`);
}

const base: Entry[] = [{ kind: 'request', id: 'base' }];
const ids = (es: Entry[]): string => es.map((e) => e.id).join(',');

// 기준 1 — 컴팩트가 없으면 전체를 쓴다
const noCompact: Entry[] = [
	{ kind: 'request', id: 'r1' },
	{ kind: 'response', id: 'a1' },
];
check(
	'컴팩트가 없으면 전체 로그',
	ids(buildModelInput(noCompact, base)) === 'base,r1,a1',
	`실제: ${ids(buildModelInput(noCompact, base))} — 컴팩트가 없을 때 빈 배열을 반환했는지 확인`,
);

// 기준 2 — 컴팩트가 하나면 그 이후만 (컴팩트 레코드 포함)
const one: Entry[] = [
	{ kind: 'request', id: 'r1' },
	{ kind: 'response', id: 'a1' },
	{ kind: 'compact', id: 'c1' },
	{ kind: 'request', id: 'r2' },
];
check(
	'컴팩트 이후만 쓴다 (컴팩트 레코드 자체는 포함)',
	ids(buildModelInput(one, base)) === 'base,c1,r2',
	`기대 base,c1,r2 / 실제 ${ids(buildModelInput(one, base))} — 컴팩트 레코드는 요약을 담고 있으므로 포함해야 합니다`,
);

// 기준 3 — 컴팩트가 여러 개면 마지막 기준
const many: Entry[] = [
	{ kind: 'request', id: 'r1' },
	{ kind: 'compact', id: 'c1' },
	{ kind: 'request', id: 'r2' },
	{ kind: 'compact', id: 'c2' },
	{ kind: 'request', id: 'r3' },
	{ kind: 'response', id: 'a3' },
];
check(
	'컴팩트가 여러 개면 마지막 것 기준',
	ids(buildModelInput(many, base)) === 'base,c2,r3,a3',
	`기대 base,c2,r3,a3 / 실제 ${ids(buildModelInput(many, base))} — 첫 컴팩트를 찾았다면 findLast 방향을 확인하세요`,
);

// 기준 4 — 컴팩트가 마지막 항목이어도 동작한다
const trailing: Entry[] = [
	{ kind: 'request', id: 'r1' },
	{ kind: 'compact', id: 'c1' },
];
check(
	'컴팩트가 로그 끝에 있어도 동작',
	ids(buildModelInput(trailing, base)) === 'base,c1',
	`기대 base,c1 / 실제 ${ids(buildModelInput(trailing, base))}`,
);

// 기준 5 — baseContext가 항상 앞
check(
	'baseContext가 맨 앞에 온다',
	buildModelInput(many, base)[0]?.id === 'base',
	'기반 컨텍스트가 앞에 붙지 않았습니다 — 프리픽스 캐시는 앞부분이 불변이어야 삽니다',
);

// 기준 6 — 입력을 변형하지 않는다
const original: Entry[] = [
	{ kind: 'request', id: 'r1' },
	{ kind: 'compact', id: 'c1' },
	{ kind: 'request', id: 'r2' },
];
const snapshot = ids(original);
buildModelInput(original, base);
check(
	'입력 로그를 변형하지 않는다',
	ids(original) === snapshot,
	`로그가 ${snapshot} → ${ids(original)}로 변했습니다 — splice 대신 slice를 쓰세요. 로그는 감사 기록입니다`,
);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);

// 📍 되짚기: docs/ep02-business-agent/04-compaction.md § 컴팩트 레코드와 불변 리스트

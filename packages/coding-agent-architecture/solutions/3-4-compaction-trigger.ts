/**
 * 과제 3-4의 정답 — 테스트 코드
 *
 * 참고 구현은 주지 않는다. 당신의 구현을 돌려 판정한다.
 *
 * 실행: npm run test:3-4
 *
 * 각 check는 src/3-4-compaction-trigger.ts 상단의 성공 기준과 1:1로 대응한다.
 */
import {
	COMPACT_THRESHOLD,
	shouldCompact,
	runTurn,
	type Entry,
	type Model,
} from '../src/3-4-compaction-trigger.js';

let pass = 0;
let total = 0;

function check(label: string, cond: boolean, detail = ''): void {
	total++;
	if (cond) pass++;
	console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? `\n    ${detail}` : ''}`);
}

const model: Model = { contextWindow: 1000 };

// 기준 1 — 임계값이 0.8로 분리돼 있다
check(
	'COMPACT_THRESHOLD = 0.8',
	COMPACT_THRESHOLD === 0.8,
	`실제 ${COMPACT_THRESHOLD} — 80% 지점이 최적 트리거입니다`,
);

// 기준 2 — 임계값 이상일 때만 true
check(
	'70% + 여유 0 → 컴팩트 불필요',
	shouldCompact([{ kind: 'request', tokens: 700 }], model, 0) === false,
	'70%인데 컴팩트가 필요하다고 판정했습니다',
);
check(
	'80% + 여유 0 → 컴팩트 필요 (경계 포함)',
	shouldCompact([{ kind: 'request', tokens: 800 }], model, 0) === true,
	'정확히 80%를 놓쳤습니다 — 부등호에 등호를 포함하세요',
);

// 기준 3 — 여유가 판정을 바꾼다
const log70: Entry[] = [{ kind: 'request', tokens: 700 }];
check(
	'여유를 넣으면 70%도 걸린다',
	shouldCompact(log70, model, 0) === false && shouldCompact(log70, model, 150) === true,
	'headroom을 계산에 넣지 않았습니다 — 이번 응답이 쓸 자리를 미리 빼야 합니다',
);

// 기준 4 — 판정이 도구 결과 보고 지점에서도 일어난다.
//   턴 시작 시점(200)에는 여유를 더해도 35%라 통과한다. 그런데 도구 결과가
//   700을 실어 오면 그 순간 90%가 된다. 턴 시작에만 판정했다면 못 잡는다.
const start: Entry[] = [{ kind: 'request', tokens: 200 }];
const burst: Entry[] = [
	{ kind: 'tool_call', tokens: 50 },
	{ kind: 'tool_result', tokens: 700 },
];
const afterBurst = runTurn(start, burst, model, { headroom: 100, compactTokens: 80 });
check(
	'도구 폭주를 턴 중간에 잡아낸다',
	afterBurst.some((e) => e.kind === 'compact'),
	`compact 레코드가 없습니다. 결과: ${afterBurst.map((e) => e.kind).join(',')} — 턴 시작에만 판정하면 못 잡습니다`,
);

// 기준 5 — compact 레코드가 append 된다 (토큰 수까지)
const compacts = afterBurst.filter((e) => e.kind === 'compact');
check(
	'compact 레코드의 tokens가 compactTokens와 같다',
	compacts.length > 0 && compacts.every((e) => e.tokens === 80),
	`실제: ${JSON.stringify(compacts)} — compactTokens를 그대로 넣어야 합니다`,
);

// 기준 6 — append-only: 기존 엔트리를 지우지 않고, 입력 배열도 변형하지 않는다
const originalLen = start.length;
const kinds = afterBurst.map((e) => e.kind);
check(
	'기존 엔트리와 이벤트가 모두 살아 있다 (append-only)',
	kinds.filter((k) => k === 'request').length === 1 &&
		kinds.filter((k) => k === 'tool_call').length === 1 &&
		kinds.filter((k) => k === 'tool_result').length === 1,
	`실제: ${kinds.join(',')} — 컴팩트하면서 앞 엔트리를 지웠습니다. 로그는 지우지 않고 재생 범위만 자릅니다(과제 3-3)`,
);
check(
	'입력 log를 변형하지 않는다',
	start.length === originalLen,
	`입력 배열이 ${originalLen} → ${start.length}로 변했습니다 — push 대신 새 배열을 만드세요`,
);

// 여유 확인 — 컴팩트가 필요 없는 턴에서는 compact가 생기지 않는다
const quiet = runTurn([{ kind: 'request', tokens: 100 }], [{ kind: 'response', tokens: 50 }], model, {
	headroom: 100,
	compactTokens: 80,
});
check(
	'필요 없을 때는 컴팩트하지 않는다',
	!quiet.some((e) => e.kind === 'compact'),
	'15%에서 컴팩트가 일어났습니다 — 매 이벤트마다 무조건 컴팩트하고 있습니다',
);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);

// 📍 되짚기: docs/ep02-business-agent/04-compaction.md § 문제 1: 언제 트리거하는가

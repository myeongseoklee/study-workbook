/**
 * 과제 3-1의 정답 — 테스트 코드
 *
 * 참고 구현은 주지 않는다. 당신의 구현을 돌려 판정한다.
 *
 * 실행: npm run test:3-1
 *
 * 각 check는 src/3-1-agent-loop.ts 상단의 성공 기준과 1:1로 대응한다.
 */
import { runTurn, type ModelStep, type ModelContext } from '../src/3-1-agent-loop.js';

let pass = 0;
let total = 0;

function check(label: string, cond: boolean, detail = ''): void {
	total++;
	if (cond) pass++;
	console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? `\n    ${detail}` : ''}`);
}

// 기준 1 — 도구 결과가 다음 호출의 입력으로 들어간다.
//   모델은 "직전 관찰 결과"를 그대로 도구에 넘긴다. 결과가 전달되지 않으면
//   inc가 받는 값이 누적되지 않는다.
const seen: string[] = [];
const chained = runTurn({
	request: 'chain',
	model: (ctx: ModelContext): ModelStep =>
		ctx.observations.length < 3
			? { type: 'tool', tool: 'inc', input: ctx.observations.at(-1) ?? '0' }
			: { type: 'done', answer: ctx.observations.join(',') },
	tools: {
		inc: (x) => {
			seen.push(x);
			return String(Number(x) + 1);
		},
	},
	maxIterations: 10,
});
check(
	'도구 결과가 다음 입력으로 전달됨',
	seen.join(',') === '0,1,2',
	`도구가 받은 입력: [${seen.join(',')}] — 기대 [0,1,2]. 관찰 결과를 컨텍스트에 쌓아 다음 호출에 넘겨야 합니다`,
);

// 기준 2 — done을 반환하면 그 시점에 멈추고 최종 응답을 돌려준다
check(
	'done 시점에 멈추고 answer를 반환',
	chained.answer === '1,2,3' && chained.exhausted === false,
	`answer="${chained.answer}", exhausted=${chained.exhausted} — 기대 answer="1,2,3", exhausted=false`,
);

// 기준 3 — maxIterations에 도달하면 멈춘다 (모델이 영원히 done을 안 줄 때)
const runaway = runTurn({
	request: 'runaway',
	model: (): ModelStep => ({ type: 'tool', tool: 'noop', input: 'x' }),
	tools: { noop: () => 'ok' },
	maxIterations: 4,
});
check(
	'maxIterations에서 종료 (무한 루프 불가)',
	runaway.trace.length === 4 && runaway.exhausted === true,
	`trace ${runaway.trace.length}회, exhausted=${runaway.exhausted} — 기대 4회, exhausted=true`,
);

// 기준 4 — 도구 에러를 삼키지 않고 관찰 결과로 모델에게 돌려준다
const observedErrors: string[] = [];
const withError = runTurn({
	request: 'error path',
	model: (ctx: ModelContext): ModelStep => {
		observedErrors.push(...ctx.observations);
		return ctx.observations.length === 0
			? { type: 'tool', tool: 'boom', input: 'x' }
			: { type: 'done', answer: 'recovered' };
	},
	tools: {
		boom: () => {
			throw new Error('tool exploded');
		},
	},
	maxIterations: 5,
});
check(
	'도구 에러가 관찰 결과로 모델에게 전달됨',
	withError.answer === 'recovered' && observedErrors.some((o) => o.includes('exploded')),
	`answer=${withError.answer}, 관찰=[${observedErrors.join(' | ')}] — 에러를 throw로 흘리거나 조용히 삼키면 모델이 고칠 기회를 잃습니다`,
);

// 기준 5 — 없는 도구를 불러도 프로그램이 죽지 않는다 (같은 에러 경로)
let crashed = false;
let missingResult = '';
try {
	const r = runTurn({
		request: 'unknown tool',
		model: (ctx: ModelContext): ModelStep =>
			ctx.observations.length === 0
				? { type: 'tool', tool: 'nope', input: 'x' }
				: { type: 'done', answer: 'handled' },
		tools: {},
		maxIterations: 5,
	});
	missingResult = r.answer;
} catch {
	crashed = true;
}
check(
	'없는 도구 호출도 에러 경로로 처리',
	!crashed && missingResult === 'handled',
	crashed ? '예외가 밖으로 튀어나왔습니다' : `answer=${missingResult} — 모델에게 알리고 계속해야 합니다`,
);

// 기준 6 — trace에 도구명과 결과가 순서대로 남는다
check(
	'trace에 도구명·결과가 순서대로 기록됨',
	chained.trace.length === 3 &&
		chained.trace.every((t) => t.tool === 'inc') &&
		chained.trace.map((t) => t.result).join(',') === '1,2,3',
	`실제: ${JSON.stringify(chained.trace)} — 기대 inc 3회, 결과 1,2,3`,
);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);

// 📍 되짚기: docs/ep01-concepts/02-agent-loop.md § 필수 지식 — 세 가지 기본 요소

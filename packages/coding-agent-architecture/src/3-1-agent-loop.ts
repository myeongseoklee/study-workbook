/**
 * 과제 3-1 — 에이전트 루프 (1강)
 *
 * 턴 안의 이터레이션을 돌리는 최소 루프를 만든다. 도구 결과가 다음 호출의
 * 입력이 되고, 종료 조건이 있고, 도구 에러에 경로가 있어야 한다.
 *
 * 이 루프가 "제어 흐름을 모델이 잡는다"는 정의의 실체다 — 몇 번 돌지, 어떤
 * 도구를 부를지를 코드가 아니라 model 함수가 결정한다.
 *
 * 명세:  tests/3-1-agent-loop.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 3-1
 * 막히면: docs/ep01-concepts/02-agent-loop.md
 */

/** 모델의 한 번의 응답. 도구를 부르거나, 끝내거나. */
export type ModelStep =
	| { type: 'tool'; tool: string; input: string }
	| { type: 'done'; answer: string };

/** 이터레이션마다 모델에게 넘기는 것: 최초 요청 + 지금까지의 관찰 결과들. */
export interface ModelContext {
	request: string;
	observations: string[];
}

export interface LoopOptions {
	request: string;
	model: (ctx: ModelContext) => ModelStep;
	tools: Record<string, (input: string) => string>;
	maxIterations: number;
}

export interface LoopResult {
	answer: string;
	/** 각 이터레이션에서 어떤 도구를 불러 무엇을 얻었는지. */
	trace: Array<{ tool: string; result: string }>;
	/** maxIterations에 걸려 끝났는가. */
	exhausted: boolean;
}

/**
 * 턴 하나를 실행한다.
 *
 * 힌트: 도구가 없는 이름을 모델이 부를 수도 있다. 그것도 에러 경로다 —
 * 프로그램을 죽이지 말고 모델에게 알려줘야 다음 이터레이션에서 고칠 수 있다.
 */
export function runTurn(opts: LoopOptions): LoopResult {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: runTurn');
}

// 직접 실행하면 도구를 두 번 부르고 끝내는 가짜 모델을 돌려본다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const result = runTurn({
		request: '3에서 시작해 두 번 증가시켜라',
		model: (ctx) =>
			ctx.observations.length < 2
				? { type: 'tool', tool: 'inc', input: String(ctx.observations.length + 3) }
				: { type: 'done', answer: `관찰: ${ctx.observations.join(' → ')}` },
		tools: { inc: (x) => String(Number(x) + 1) },
		maxIterations: 5,
	});
	console.log(result.answer);
	console.log('trace:', result.trace.map((t) => `${t.tool}=${t.result}`).join(', '));
}

/**
 * 과제 3-1의 참고 구현.
 *
 * 판정은 `tests/3-1-agent-loop.test.ts`가 한다.
 *
 * 📍 되짚기: docs/ep01-concepts/02-agent-loop.md § 필수 지식 — 세 가지 기본 요소
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
 * 루프의 뼈대는 짧다. 관찰 결과를 쌓고, 그걸 모델에게 주고, 모델이 시키는 대로
 * 도구를 부른다. 코드는 몇 번 돌지도 어떤 도구를 부를지도 정하지 않는다 —
 * 그것이 "제어 흐름을 모델이 잡는다"는 말의 실체다.
 *
 * 에러 처리가 이 과제의 핵심이다. 도구 실패는 예외 상황이 아니라 **정상적인
 * 관찰 결과**다. 파일이 없거나 명령이 실패하는 건 늘 있는 일이고, 사람이라면
 * 메시지를 읽고 다음 수를 고친다. 모델에게도 같은 기회를 줘야 하므로, throw를
 * 밖으로 흘리지 않고 문자열로 바꿔 관찰 결과에 넣는다.
 *
 * 없는 도구 이름도 같은 경로를 탄다. 모델은 도구 이름을 지어낼 수 있고, 그건
 * 도구가 실패한 것과 구분해 다룰 이유가 없다.
 */
export function runTurn(opts: LoopOptions): LoopResult {
	const { request, model, tools, maxIterations } = opts;
	const observations: string[] = [];
	const trace: Array<{ tool: string; result: string }> = [];

	for (let i = 0; i < maxIterations; i++) {
		const step = model({ request, observations });

		if (step.type === 'done') {
			return { answer: step.answer, trace, exhausted: false };
		}

		const tool = tools[step.tool];
		let result: string;
		if (!tool) {
			result = `error: 알 수 없는 도구 '${step.tool}'`;
		} else {
			try {
				result = tool(step.input);
			} catch (error) {
				result = `error: ${error instanceof Error ? error.message : String(error)}`;
			}
		}

		observations.push(result);
		trace.push({ tool: step.tool, result });
	}

	return {
		answer: `이터레이션 상한(${maxIterations})에 도달해 중단`,
		trace,
		exhausted: true,
	};
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

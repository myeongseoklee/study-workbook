/**
 * 과제 3-1의 명세 — 에이전트 루프
 *
 * 이 파일이 과제의 정의다. `src/e01-02-01-agent-loop/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다.
 *
 * 실행: pnpm test e01-02-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { runTurn, type ModelContext, type ModelStep } from '../../src/e01-02-01-agent-loop';

describe('runTurn — 도구 결과가 다음 호출로 흘러가는가', () => {
	it('직전 관찰 결과가 다음 도구 입력으로 전달된다', () => {
		const seen: string[] = [];
		runTurn({
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

		retrace(
			'도구가 받은 값이 누적되지 않으면 관찰 결과를 컨텍스트에 쌓지 않고 있다는 뜻이다. ' +
				'이 축적이 없으면 루프가 매번 처음부터 다시 시작한다.',
			() => {
				expect(seen).toEqual(['0', '1', '2']);
			},
		);
	});

	it('trace에 도구명과 결과가 순서대로 남는다', () => {
		const result = runTurn({
			request: 'chain',
			model: (ctx: ModelContext): ModelStep =>
				ctx.observations.length < 3
					? { type: 'tool', tool: 'inc', input: ctx.observations.at(-1) ?? '0' }
					: { type: 'done', answer: 'ok' },
			tools: { inc: (x) => String(Number(x) + 1) },
			maxIterations: 10,
		});

		expect(result.trace).toEqual([
			{ tool: 'inc', result: '1' },
			{ tool: 'inc', result: '2' },
			{ tool: 'inc', result: '3' },
		]);
	});
});

describe('runTurn — 종료 조건', () => {
	it('모델이 done을 반환하면 그 시점에 멈추고 answer를 돌려준다', () => {
		const result = runTurn({
			request: 'chain',
			model: (ctx: ModelContext): ModelStep =>
				ctx.observations.length < 3
					? { type: 'tool', tool: 'inc', input: ctx.observations.at(-1) ?? '0' }
					: { type: 'done', answer: ctx.observations.join(',') },
			tools: { inc: (x) => String(Number(x) + 1) },
			maxIterations: 10,
		});

		expect(result.answer).toBe('1,2,3');
		expect(result.exhausted).toBe(false);
	});

	it('모델이 영원히 done을 주지 않아도 maxIterations에서 멈춘다', () => {
		retrace(
			'제어 흐름을 모델이 잡는다는 말은 모델이 잘못 잡을 수도 있다는 뜻이다. ' +
				'상한이 없으면 이 테스트가 끝나지 않는다.',
			() => {
				const runaway = runTurn({
					request: 'runaway',
					model: (): ModelStep => ({ type: 'tool', tool: 'noop', input: 'x' }),
					tools: { noop: () => 'ok' },
					maxIterations: 4,
				});

				expect(runaway.trace).toHaveLength(4);
				expect(runaway.exhausted).toBe(true);
			},
		);
	});
});

describe('runTurn — 에러 경로', () => {
	it('도구가 던진 에러를 관찰 결과로 모델에게 돌려준다', () => {
		const observed: string[] = [];
		const result = runTurn({
			request: 'error path',
			model: (ctx: ModelContext): ModelStep => {
				observed.push(...ctx.observations);
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

		retrace(
			'에러를 밖으로 흘리면 턴이 죽고, 조용히 삼키면 모델이 같은 실수를 반복한다. ' +
				'에러 메시지를 관찰 결과로 되돌려 줘야 모델이 다음 이터레이션에서 고칠 수 있다.',
			() => {
				expect(result.answer).toBe('recovered');
				expect(observed.join(' ')).toContain('exploded');
			},
		);
	});

	it('없는 도구를 불러도 프로그램이 죽지 않는다 — 같은 에러 경로다', () => {
		retrace(
			'모델은 존재하지 않는 도구 이름을 만들어 낼 수 있다. 그것도 도구 에러와 같은 처리를 받아야 한다.',
			() => {
				const result = runTurn({
					request: 'unknown tool',
					model: (ctx: ModelContext): ModelStep =>
						ctx.observations.length === 0
							? { type: 'tool', tool: 'nope', input: 'x' }
							: { type: 'done', answer: 'handled' },
					tools: {},
					maxIterations: 5,
				});

				expect(result.answer).toBe('handled');
			},
		);
	});
});

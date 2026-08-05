/**
 * 과제 3-3의 명세 — 최소 도구 서버 코어
 *
 * 이 파일이 과제의 정의다. `src/3-3-tool-server.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 막히면 docs/06-tools.md(특히 오류 2계층)와
 * docs/09-subscriptions-utilities.md § 캐싱을 다시 읽어라.
 *
 * 실행: pnpm test 3-3
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { createToolServer, ToolExecutionError } from '../src/3-3-tool-server';

function makeServer() {
	return createToolServer(
		[
			{
				name: 'get_weather',
				description: '도시의 현재 날씨',
				inputSchema: {
					type: 'object',
					properties: { location: { type: 'string' } },
					required: ['location'],
				},
				handler: (args) => {
					if (args.location === 'Atlantis') {
						throw new ToolExecutionError('Unknown city: Atlantis. Try a real city name.');
					}
					return { content: `Weather in ${String(args.location)}: sunny` };
				},
			},
			{
				name: 'add',
				inputSchema: {
					type: 'object',
					properties: { a: { type: 'number' }, b: { type: 'number' } },
					required: ['a', 'b'],
				},
				handler: (args) => ({ content: String(Number(args.a) + Number(args.b)) }),
			},
			{
				name: 'boom',
				inputSchema: { type: 'object' },
				handler: () => {
					throw new RangeError('unexpected internal explosion');
				},
			},
		],
		{ ttlMs: 300_000, cacheScope: 'public' },
	);
}

describe('tools/list — 결정적 순서와 캐시 힌트', () => {
	it('등록 순서와 무관하게 이름순으로 정렬해 돌려준다', () => {
		retrace(
			'등록 배열을 그대로 돌려주면 실패한다. 결정적 순서(SHOULD)는 클라이언트 캐시와 ' +
				'LLM 프롬프트 캐시 적중을 위한 규칙이다 — 이름 오름차순으로 정렬하라.',
			() => {
				const res = makeServer().handle({ id: 1, method: 'tools/list' });
				expect('result' in res && res.result).toBeTruthy();
				if ('result' in res) {
					const names = (res.result.tools as Array<{ name: string }>).map((t) => t.name);
					expect(names).toEqual(['add', 'boom', 'get_weather']);
				}
			},
		);
	});

	it('두 번 호출해도 같은 순서다 (결정성)', () => {
		const server = makeServer();
		const first = server.handle({ id: 1, method: 'tools/list' });
		const second = server.handle({ id: 2, method: 'tools/list' });
		if ('result' in first && 'result' in second) {
			expect(second.result.tools).toEqual(first.result.tools);
		}
	});

	it('resultType: "complete"와 ttlMs·cacheScope 캐시 힌트를 반드시 싣는다', () => {
		retrace('tools/list는 캐시 힌트 의무 6종에 속한다 — ttlMs(>=0)와 cacheScope 필수', () => {
			const res = makeServer().handle({ id: 1, method: 'tools/list' });
			if ('result' in res) {
				expect(res.result.resultType).toBe('complete');
				expect(res.result.ttlMs).toBe(300_000);
				expect(res.result.cacheScope).toBe('public');
			}
		});
	});

	it('결과의 도구 정의에 handler 함수가 새어 나가지 않는다', () => {
		const res = makeServer().handle({ id: 1, method: 'tools/list' });
		if ('result' in res) {
			for (const tool of res.result.tools as Array<Record<string, unknown>>) {
				expect(tool.handler).toBeUndefined();
			}
		}
	});
});

describe('tools/call — 오류 2계층이 이 과제의 심장이다', () => {
	it('정상 호출은 complete + content + isError: false', () => {
		const res = makeServer().handle({
			id: 2,
			method: 'tools/call',
			params: { name: 'add', arguments: { a: 2, b: 3 } },
		});
		if ('result' in res) {
			expect(res.result.resultType).toBe('complete');
			expect(res.result.isError).toBe(false);
			expect(res.result.content).toEqual([{ type: 'text', text: '5' }]);
		}
	});

	it('모르는 도구는 프로토콜 오류 -32602다 — 모델이 이름을 고쳐도 존재하지 않으니까', () => {
		const res = makeServer().handle({
			id: 3,
			method: 'tools/call',
			params: { name: 'no_such_tool', arguments: {} },
		});
		expect('error' in res).toBe(true);
		if ('error' in res) {
			expect(res.error.code).toBe(-32602);
			expect(res.error.message).toContain('no_such_tool');
		}
	});

	it('필수 인자 누락은 프로토콜 오류가 아니라 실행 오류(isError: true)다', () => {
		retrace(
			'입력 값 검증 실패는 "모델이 인자를 고쳐 재시도하면 성공할 수 있는" 실패다 — ' +
				'JSON-RPC 에러로 내면 모델의 자가수정 루프가 끊긴다. ' +
				'isError: true + 무엇이 빠졌는지 알려주는 텍스트로 반환하라.',
			() => {
				const res = makeServer().handle({
					id: 4,
					method: 'tools/call',
					params: { name: 'get_weather', arguments: {} },
				});
				expect('result' in res).toBe(true);
				if ('result' in res) {
					expect(res.result.isError).toBe(true);
					const text = (res.result.content as Array<{ text: string }>)[0]?.text ?? '';
					expect(text).toContain('location');
				}
			},
		);
	});

	it('인자 타입이 스키마와 다르면 역시 실행 오류다', () => {
		const res = makeServer().handle({
			id: 5,
			method: 'tools/call',
			params: { name: 'get_weather', arguments: { location: 123 } },
		});
		if ('result' in res) expect(res.result.isError).toBe(true);
	});

	it('핸들러가 ToolExecutionError를 던지면 그 메시지가 실행 오류로 나간다', () => {
		const res = makeServer().handle({
			id: 6,
			method: 'tools/call',
			params: { name: 'get_weather', arguments: { location: 'Atlantis' } },
		});
		if ('result' in res) {
			expect(res.result.isError).toBe(true);
			const text = (res.result.content as Array<{ text: string }>)[0]?.text ?? '';
			expect(text).toContain('Atlantis');
		}
	});

	it('핸들러의 예기치 못한 예외는 내부 오류 -32603이다 — 실행 오류로 삼키지 않는다', () => {
		retrace(
			'서버 버그(RangeError 등)까지 isError로 포장하면 모델이 고칠 수 없는 것을 ' +
				'고치려고 무한 재시도한다. 예기치 못한 예외 = 프로토콜 오류(-32603).',
			() => {
				const res = makeServer().handle({
					id: 7,
					method: 'tools/call',
					params: { name: 'boom', arguments: {} },
				});
				expect('error' in res).toBe(true);
				if ('error' in res) expect(res.error.code).toBe(-32603);
			},
		);
	});
});

describe('그 외 메서드', () => {
	it('모르는 메서드는 -32601이다', () => {
		const res = makeServer().handle({ id: 8, method: 'resources/list' });
		expect('error' in res).toBe(true);
		if ('error' in res) expect(res.error.code).toBe(-32601);
	});

	it('응답의 id는 요청의 id를 그대로 되돌린다', () => {
		const res = makeServer().handle({ id: 'req-9', method: 'tools/list' });
		expect(res.id).toBe('req-9');
	});
});

/**
 * 과제 3-1의 명세 — 메시지 분류기와 에러 대역
 *
 * 이 파일이 과제의 정의다. `src/3-1-message-rules.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/03-messages-meta.md를 다시 읽어라.
 *
 * 실행: pnpm test 3-1
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { classifyErrorCode, classifyMessage, interpretResultType } from '../src/3-1-message-rules';

describe('classifyMessage — JSON-RPC 메시지 3종 + MCP 추가 규칙', () => {
	it('id와 method가 있으면 요청이다', () => {
		expect(classifyMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).toBe('request');
		expect(classifyMessage({ jsonrpc: '2.0', id: 'a-1', method: 'tools/call', params: {} })).toBe(
			'request',
		);
	});

	it('method만 있고 id가 없으면 알림이다', () => {
		expect(classifyMessage({ jsonrpc: '2.0', method: 'notifications/progress' })).toBe(
			'notification',
		);
	});

	it('id가 null인 요청은 invalid다 — 기본 JSON-RPC와 다른 MCP 강화 규칙', () => {
		retrace(
			'기본 JSON-RPC는 null id를 허용하지만 MCP는 금지한다(MUST NOT). ' +
				'null을 "id 없음"으로 읽어 notification으로 분류해도 틀린다.',
			() => {
				expect(classifyMessage({ jsonrpc: '2.0', id: null, method: 'tools/list' })).toBe(
					'invalid',
				);
			},
		);
	});

	it('id가 불리언·객체인 요청도 invalid다 (문자열/정수만 허용)', () => {
		expect(classifyMessage({ jsonrpc: '2.0', id: true, method: 'x' })).toBe('invalid');
		expect(classifyMessage({ jsonrpc: '2.0', id: {}, method: 'x' })).toBe('invalid');
	});

	it('id + result면 결과 응답이다', () => {
		expect(
			classifyMessage({ jsonrpc: '2.0', id: 1, result: { resultType: 'complete' } }),
		).toBe('result');
	});

	it('error 응답은 id가 없어도 error다 — 망가진 요청의 id는 읽을 수 없으므로', () => {
		retrace('에러 응답의 id는 예외적으로 생략될 수 있다(파싱 불능 케이스)', () => {
			expect(
				classifyMessage({ jsonrpc: '2.0', error: { code: -32700, message: 'parse error' } }),
			).toBe('error');
		});
		expect(
			classifyMessage({ jsonrpc: '2.0', id: 2, error: { code: -32602, message: 'bad' } }),
		).toBe('error');
	});

	it('result와 error가 동시에 있으면 invalid다', () => {
		expect(
			classifyMessage({ jsonrpc: '2.0', id: 1, result: {}, error: { code: 1, message: 'x' } }),
		).toBe('invalid');
	});

	it('jsonrpc 필드가 "2.0"이 아니면 invalid다', () => {
		expect(classifyMessage({ id: 1, method: 'tools/list' })).toBe('invalid');
		expect(classifyMessage({ jsonrpc: '1.0', id: 1, method: 'x' })).toBe('invalid');
		expect(classifyMessage(null)).toBe('invalid');
		expect(classifyMessage('str')).toBe('invalid');
	});
});

describe('interpretResultType — 부재와 미지(未知)는 다르다', () => {
	it('"complete"와 "input_required"는 그대로 통과한다', () => {
		expect(interpretResultType({ resultType: 'complete' })).toBe('complete');
		expect(interpretResultType({ resultType: 'input_required' })).toBe('input_required');
	});

	it('resultType이 없으면 complete로 간주한다 — 구버전 서버 호환', () => {
		retrace(
			'부재를 invalid로 처리하면 이전 리비전 서버와의 호환이 전부 깨진다. ' +
				'클라이언트는 부재를 "complete"로 취급해야 한다(MUST).',
			() => {
				expect(interpretResultType({ content: [] })).toBe('complete');
			},
		);
	});

	it('모르는 값은 invalid다 — 미래 확장 값을 모른 채 진행하면 위험하므로', () => {
		retrace('부재(→complete)와 미지(→invalid)를 같은 분기로 처리하면 여기서 걸린다', () => {
			expect(interpretResultType({ resultType: 'task' })).toBe('invalid');
		});
	});

	it('capability로 광고된 확장 resultType은 유효하다', () => {
		expect(interpretResultType({ resultType: 'task' }, ['task'])).toBe('task');
		expect(interpretResultType({ resultType: 'other' }, ['task'])).toBe('invalid');
	});
});

describe('classifyErrorCode — 대역 파티션', () => {
	it('-32000 ~ -32019는 레거시·구현 정의 대역이다', () => {
		expect(classifyErrorCode(-32000)).toBe('legacy-implementation');
		expect(classifyErrorCode(-32002)).toBe('legacy-implementation');
		expect(classifyErrorCode(-32019)).toBe('legacy-implementation');
	});

	it('-32020 ~ -32099는 MCP 명세 전용 대역이다', () => {
		retrace(
			'경계 -32019/-32020이 갈림길이다. 부등호 방향을 헷갈리면 ' +
				'HeaderMismatch(-32020)가 레거시로 분류된다.',
			() => {
				expect(classifyErrorCode(-32020)).toBe('mcp-spec');
				expect(classifyErrorCode(-32022)).toBe('mcp-spec');
				expect(classifyErrorCode(-32099)).toBe('mcp-spec');
			},
		);
	});

	it('그 외 JSON-RPC 예약 대역(-32768~-32000)은 json-rpc-reserved다', () => {
		expect(classifyErrorCode(-32700)).toBe('json-rpc-reserved');
		expect(classifyErrorCode(-32601)).toBe('json-rpc-reserved');
		expect(classifyErrorCode(-32100)).toBe('json-rpc-reserved');
		expect(classifyErrorCode(-32768)).toBe('json-rpc-reserved');
	});

	it('예약 대역 밖은 application이다 — 자체 에러는 여기 할당한다', () => {
		expect(classifyErrorCode(42)).toBe('application');
		expect(classifyErrorCode(-31999)).toBe('application');
		expect(classifyErrorCode(-40000)).toBe('application');
	});
});

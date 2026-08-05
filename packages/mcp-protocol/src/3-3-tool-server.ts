/**
 * 과제 3-3 — 최소 도구 서버 코어
 *
 * tools/list(결정적 순서 + 캐시 힌트)와 tools/call(오류 2계층 분기)을
 * SDK 없이 직접 구현한다.
 *
 * 명세:  tests/3-3-tool-server.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test 3-3
 * 막히면: docs/06-tools.md § 오류의 2계층, docs/09-subscriptions-utilities.md § 캐싱
 */

export interface ToolDef {
	name: string;
	description?: string;
	inputSchema: {
		type: 'object';
		properties?: Record<string, { type: string }>;
		required?: string[];
	};
	handler: (args: Record<string, unknown>) => { content: string };
}

/** 핸들러가 "모델이 고칠 수 있는 실패"를 알리는 통로. */
export class ToolExecutionError extends Error {}

export interface CallRequest {
	id: string | number;
	method: string;
	params?: { name?: string; arguments?: Record<string, unknown>; [k: string]: unknown };
}

export type Response =
	| { jsonrpc: '2.0'; id: string | number; result: Record<string, unknown> }
	| {
			jsonrpc: '2.0';
			id: string | number;
			error: { code: number; message: string; data?: unknown };
	  };

export interface ToolServerOptions {
	ttlMs?: number;
	cacheScope?: 'public' | 'private';
}

/**
 * 도구 서버를 만든다.
 *
 * 힌트: 이 과제의 심장은 실패를 어느 계층으로 내보낼지다 —
 *       모르는 도구 / 인자 값 검증 실패 / ToolExecutionError / 예기치 못한 예외.
 *       네 경우의 목적지가 전부 다르다. 기준: "모델이 인자를 고쳐
 *       재시도하면 성공할 수 있는가".
 *       tools/list는 등록 순서를 그대로 노출하면 안 된다.
 */
export function createToolServer(tools: ToolDef[], opts: ToolServerOptions = {}) {
	return {
		handle(request: CallRequest): Response {
			// 🎯 TODO: 구현하라
			throw new Error('TODO: createToolServer.handle');
		},
	};
}

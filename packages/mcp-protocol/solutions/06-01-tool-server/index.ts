/**
 * 과제 3-3의 참고 구현.
 *
 * 판정은 `tests/06-01-tool-server/index.test.ts`가 한다.
 *
 * 📍 되짚기: docs/06-tools.md § 오류의 2계층 / docs/09-subscriptions-utilities.md § 캐싱
 *           / docs/90-must-memorize.md 카드 14·17
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
 * 오류를 어느 계층으로 내보낼지가 이 구현의 전부다. 기준은
 * "모델이 인자를 고쳐 재시도하면 성공할 수 있는가":
 *
 *   모르는 도구        → -32602  (이름을 고쳐도 그 도구는 없다)
 *   인자 값 검증 실패   → isError (형식·누락은 모델이 고칠 수 있다 — SEP-1303)
 *   ToolExecutionError → isError (핸들러가 의도한, 모델에게 주는 피드백)
 *   예기치 못한 예외    → -32603  (서버 버그를 isError로 포장하면
 *                                 모델이 고칠 수 없는 것을 무한 재시도한다)
 */
export function createToolServer(tools: ToolDef[], opts: ToolServerOptions = {}) {
	const ttlMs = opts.ttlMs ?? 0;
	const cacheScope = opts.cacheScope ?? 'private';
	// 결정적 순서: 등록 순서를 노출하지 않고 이름으로 정렬해둔다.
	// (클라이언트 캐시·LLM 프롬프트 캐시가 순서 안정성에 기댄다)
	const sorted = [...tools].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	const byName = new Map(sorted.map((t) => [t.name, t]));

	function ok(id: string | number, result: Record<string, unknown>): Response {
		return { jsonrpc: '2.0', id, result };
	}
	function err(id: string | number, code: number, message: string): Response {
		return { jsonrpc: '2.0', id, error: { code, message } };
	}
	function executionError(id: string | number, text: string): Response {
		return ok(id, {
			resultType: 'complete',
			content: [{ type: 'text', text }],
			isError: true,
		});
	}

	/** 최소 스키마 검증 — required 존재와 원시 타입 일치만 본다. */
	function validateArgs(tool: ToolDef, args: Record<string, unknown>): string | null {
		for (const key of tool.inputSchema.required ?? []) {
			if (!(key in args)) return `Missing required argument: ${key}`;
		}
		for (const [key, schema] of Object.entries(tool.inputSchema.properties ?? {})) {
			if (key in args && typeof args[key] !== schema.type) {
				return `Argument ${key} must be of type ${schema.type}`;
			}
		}
		return null;
	}

	return {
		handle(request: CallRequest): Response {
			if (request.method === 'tools/list') {
				return ok(request.id, {
					resultType: 'complete',
					// handler는 서버 내부 구현 — 와이어에 새면 안 된다
					tools: sorted.map(({ name, description, inputSchema }) => ({
						name,
						...(description !== undefined ? { description } : {}),
						inputSchema,
					})),
					ttlMs,
					cacheScope,
				});
			}

			if (request.method === 'tools/call') {
				const name = request.params?.name;
				const tool = typeof name === 'string' ? byName.get(name) : undefined;
				if (!tool) return err(request.id, -32602, `Unknown tool: ${String(name)}`);

				const args = request.params?.arguments ?? {};
				const validationFailure = validateArgs(tool, args);
				if (validationFailure !== null) return executionError(request.id, validationFailure);

				try {
					const { content } = tool.handler(args);
					return ok(request.id, {
						resultType: 'complete',
						content: [{ type: 'text', text: content }],
						isError: false,
					});
				} catch (thrown) {
					if (thrown instanceof ToolExecutionError) {
						return executionError(request.id, thrown.message);
					}
					return err(request.id, -32603, 'Internal error');
				}
			}

			return err(request.id, -32601, `Method not found: ${request.method}`);
		},
	};
}

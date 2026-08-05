/**
 * 과제 3-2의 참고 구현.
 *
 * 판정은 `tests/3-2-version-gate.test.ts`가 한다.
 *
 * 📍 되짚기: docs/04-lifecycle-versioning.md / docs/03-messages-meta.md § `_meta`
 *           / docs/90-must-memorize.md 카드 3·7·8
 */

const META = 'io.modelcontextprotocol/';

export interface ServerConfig {
	/** 서버가 지원하는 프로토콜 버전 목록 */
	supportedVersions: string[];
	/** 이 요청을 처리하는 데 필요한 클라이언트 능력 이름들 */
	requiredCapabilities?: string[];
}

export type GateResult =
	| { ok: true; version: string }
	| { ok: false; error: { code: number; message: string; data?: unknown } };

/**
 * 무상태 서버의 요청 수문장. 검사 순서가 곧 명세다:
 *
 *   1) malformed(-32602): 필수 _meta 두 필드가 있는가 —
 *      "요청 자체가 성립하는가"가 그 내용(버전 값)보다 먼저다.
 *   2) 버전(-32022): 성립한 요청이 말한 버전을 내가 지원하는가.
 *      data에 supported/requested를 실어야 클라이언트가 재시도를 고를 수 있다.
 *   3) 능력(-32021): 처리에 필요한 능력을 클라이언트가 선언했는가.
 *      data.requiredCapabilities에는 "빠진 것만" — 전체 요구 목록이 아니다.
 *
 * 빈 clientCapabilities({})는 "능력 없음을 선언"한 유효한 값이다.
 * 부재(필드 없음)와 빈 선언을 구분하는 것이 1번의 함정.
 */
export function gateRequest(
	params: Record<string, unknown> | undefined,
	config: ServerConfig,
): GateResult {
	const meta = (params?._meta ?? undefined) as Record<string, unknown> | undefined;
	const version = meta?.[`${META}protocolVersion`];
	const capabilities = meta?.[`${META}clientCapabilities`];

	if (typeof version !== 'string' || typeof capabilities !== 'object' || capabilities === null) {
		return {
			ok: false,
			error: { code: -32602, message: 'Invalid params: missing required _meta fields' },
		};
	}

	if (!config.supportedVersions.includes(version)) {
		return {
			ok: false,
			error: {
				code: -32022,
				message: 'Unsupported protocol version',
				data: { supported: config.supportedVersions, requested: version },
			},
		};
	}

	const declared = capabilities as Record<string, unknown>;
	const missing = (config.requiredCapabilities ?? []).filter((cap) => !(cap in declared));
	if (missing.length > 0) {
		return {
			ok: false,
			error: {
				code: -32021,
				message: 'Missing required client capability',
				data: { requiredCapabilities: missing },
			},
		};
	}

	return { ok: true, version };
}

/**
 * 재시도 버전 선택의 주체는 클라이언트다 — 그래서 순회 기준이
 * 클라이언트의 선호 목록이고, 서버의 supported는 멤버십 검사에만 쓴다.
 */
export function selectRetryVersion(clientVersions: string[], supported: string[]): string | null {
	return clientVersions.find((v) => supported.includes(v)) ?? null;
}

export type ProbeOutcome =
	| { kind: 'discover-result'; supportedVersions: string[] }
	| { kind: 'error'; code: number }
	| { kind: 'timeout' };

export type EraVerdict =
	| { era: 'modern'; action: 'continue' | 'retry-other-version' }
	| { era: 'legacy'; action: 'fallback-initialize' };

/**
 * stdio 프로브 판정. 핵심은 폴백 조건을 "특정 코드"가 아니라
 * "인식 가능한 modern 에러인가"라는 집합으로 거는 것이다:
 *
 *   - DiscoverResult          → modern, 계속
 *   - MCP 명세 대역(-32020~-32099)의 에러 → modern, 버전만 재선택 (폴백 금지!)
 *   - 그 외 에러·타임아웃      → legacy, initialize 폴백
 *
 * 레거시 서버는 모르는 요청에 -32601이든 -32602든 침묵이든 제멋대로
 * 반응하므로, 폴백을 한 코드에 걸면(MUST NOT) 일부 레거시 서버를 놓친다.
 */
export function judgeStdioProbe(outcome: ProbeOutcome): EraVerdict {
	if (outcome.kind === 'discover-result') return { era: 'modern', action: 'continue' };
	if (outcome.kind === 'error' && outcome.code >= -32099 && outcome.code <= -32020) {
		return { era: 'modern', action: 'retry-other-version' };
	}
	return { era: 'legacy', action: 'fallback-initialize' };
}

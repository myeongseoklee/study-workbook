/**
 * 과제 3-1의 참고 구현.
 *
 * 판정은 `tests/03-01-message-rules/index.test.ts`가 한다. 같은 테스트를 이 파일에 대고
 * 돌린 것이 `pnpm test:solutions`다 — 여기 있는 코드는 "정답 하나"가 아니라
 * "성립하는 한 예"다.
 *
 * 📍 되짚기: docs/03-messages-meta.md / docs/90-must-memorize.md 카드 4·5·6
 */

export type MessageKind = 'request' | 'notification' | 'result' | 'error' | 'invalid';

/**
 * MCP의 id는 기본 JSON-RPC보다 좁다: 문자열 또는 숫자만, null 금지.
 * "null 금지"가 이 과제의 첫 함정이다 — null은 '값이 있는데 무효'이지
 * '없음'이 아니므로, null id를 notification으로 읽으면 안 된다.
 */
function isValidId(id: unknown): id is string | number {
	return typeof id === 'string' || typeof id === 'number';
}

export function classifyMessage(msg: unknown): MessageKind {
	if (typeof msg !== 'object' || msg === null) return 'invalid';
	const m = msg as Record<string, unknown>;
	if (m.jsonrpc !== '2.0') return 'invalid';

	if (typeof m.method === 'string') {
		// method가 있으면 요청 또는 알림. id 키의 "존재"와 "유효성"을 구분한다.
		if (!('id' in m)) return 'notification';
		return isValidId(m.id) ? 'request' : 'invalid';
	}

	// method가 없으면 응답이어야 한다. result와 error는 상호 배타.
	const hasResult = 'result' in m;
	const hasError = 'error' in m;
	if (hasResult && hasError) return 'invalid';
	if (hasResult) return isValidId(m.id) ? 'result' : 'invalid';
	// 에러 응답만은 id가 없을 수 있다 — 요청이 망가져 id를 읽지 못한 경우.
	if (hasError) return 'id' in m && !isValidId(m.id) ? 'invalid' : 'error';
	return 'invalid';
}

/**
 * 부재와 미지를 다르게 다루는 것이 전부다:
 *   부재  → "complete" (resultType이 없던 구버전 서버와의 호환, MUST)
 *   미지  → "invalid"  (모르는 확장 값을 아는 척 진행하면 위험)
 * 확장 값은 capability로 광고된 것만 유효하다.
 */
export function interpretResultType(
	result: Record<string, unknown>,
	supportedExtensionTypes: string[] = [],
): string {
	const t = result.resultType;
	if (t === undefined) return 'complete';
	if (t === 'complete' || t === 'input_required') return t;
	if (typeof t === 'string' && supportedExtensionTypes.includes(t)) return t;
	return 'invalid';
}

export type ErrorBand = 'json-rpc-reserved' | 'legacy-implementation' | 'mcp-spec' | 'application';

/**
 * 파티션의 경계(음수라서 부등호가 헷갈리기 쉽다):
 *   -32019 <= code <= -32000  → 레거시·구현 정의 (신규 할당 금지)
 *   -32099 <= code <= -32020  → MCP 명세 전용
 *   -32768 <= code <= -32000 나머지 → JSON-RPC 예약 (-32700, -32600~-32603 등)
 *   그 밖 → 애플리케이션 자유 영역
 */
export function classifyErrorCode(code: number): ErrorBand {
	if (code >= -32019 && code <= -32000) return 'legacy-implementation';
	if (code >= -32099 && code <= -32020) return 'mcp-spec';
	if (code >= -32768 && code <= -32000) return 'json-rpc-reserved';
	return 'application';
}

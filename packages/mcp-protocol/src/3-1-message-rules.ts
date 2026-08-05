/**
 * 과제 3-1 — 메시지 분류기와 에러 대역
 *
 * JSON-RPC 메시지를 MCP 강화 규칙으로 분류하고, resultType의 부재/미지 규칙과
 * 에러 코드 대역 파티션을 구현한다.
 *
 * 명세:  tests/3-1-message-rules.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 3-1
 * 막히면: docs/03-messages-meta.md
 */

export type MessageKind = 'request' | 'notification' | 'result' | 'error' | 'invalid';

/**
 * 메시지를 request / notification / result / error / invalid로 분류한다.
 *
 * 힌트: "id 키가 존재하는가"와 "id 값이 유효한가(문자열/숫자, null 금지)"는
 *       다른 질문이다. 에러 응답만은 id가 없어도 된다 — 왜인지 생각해 보라.
 */
export function classifyMessage(msg: unknown): MessageKind {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: classifyMessage');
}

/**
 * result의 resultType을 해석한다.
 *
 * 힌트: 부재(undefined)와 미지(모르는 문자열)의 처리가 다르다.
 *       capability로 광고된 확장 타입(supportedExtensionTypes)은 유효하다.
 */
export function interpretResultType(
	result: Record<string, unknown>,
	supportedExtensionTypes: string[] = [],
): string {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: interpretResultType');
}

export type ErrorBand = 'json-rpc-reserved' | 'legacy-implementation' | 'mcp-spec' | 'application';

/**
 * 에러 코드가 속한 대역을 판정한다.
 *
 * 힌트: 음수 범위라 부등호 방향이 함정이다. "-32000 ~ -32019"는
 *       -32019 <= code <= -32000이라는 뜻이다.
 */
export function classifyErrorCode(code: number): ErrorBand {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: classifyErrorCode');
}

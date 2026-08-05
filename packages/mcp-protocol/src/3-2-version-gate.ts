/**
 * 과제 3-2 — 버전·능력 게이트와 세대(era) 판정
 *
 * 무상태 서버의 요청 수문장(필수 _meta → 버전 → 능력 순 검사)과,
 * 클라이언트의 재시도 버전 선택, stdio 프로브 세대 판정을 구현한다.
 *
 * 명세:  tests/3-2-version-gate.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test 3-2
 * 막히면: docs/04-lifecycle-versioning.md, docs/03-messages-meta.md § `_meta`
 */

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
 * 요청 params를 검사해 통과/거부를 결정한다.
 *
 * 힌트: 세 가지 거부(-32602 / -32022 / -32021)의 **순서**가 명세다.
 *       "빈 clientCapabilities({})"와 "clientCapabilities 부재"는 다르다.
 *       _meta 키의 정확한 이름은 테스트 상단의 META 상수를 참고.
 */
export function gateRequest(
	params: Record<string, unknown> | undefined,
	config: ServerConfig,
): GateResult {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: gateRequest');
}

/**
 * -32022의 data.supported를 받아 재시도할 버전을 고른다.
 *
 * 힌트: 선택의 주체는 누구인가? 순회 기준이 그 답이다.
 */
export function selectRetryVersion(clientVersions: string[], supported: string[]): string | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: selectRetryVersion');
}

export type ProbeOutcome =
	| { kind: 'discover-result'; supportedVersions: string[] }
	| { kind: 'error'; code: number }
	| { kind: 'timeout' };

export type EraVerdict =
	| { era: 'modern'; action: 'continue' | 'retry-other-version' }
	| { era: 'legacy'; action: 'fallback-initialize' };

/**
 * server/discover 프로브 결과로 서버 세대를 판정한다.
 *
 * 힌트: 폴백 조건을 특정 에러 코드 하나에 걸면 안 된다(MUST NOT).
 *       "인식 가능한 modern 에러"를 집합(대역)으로 정의하라.
 */
export function judgeStdioProbe(outcome: ProbeOutcome): EraVerdict {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: judgeStdioProbe');
}

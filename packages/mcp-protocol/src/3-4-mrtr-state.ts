/**
 * 과제 3-4 — MRTR requestState의 봉인과 검증
 *
 * 무상태 서버가 다회 왕복 대화를 이어가기 위한 requestState를
 * 봉인(pack)하고, 공격자 통제 입력으로 취급해 검증(unpack)한다.
 *
 * 명세:  tests/3-4-mrtr-state.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test 3-4
 * 막히면: docs/08-mrtr-client-features.md § requestState 보안
 */

export interface StatePayload {
	/** 이 상태를 발급받은 인증 주체 */
	principal: string;
	/** 만료 시각(epoch ms) */
	expiresAt: number;
	/** 원 요청 식별자(메서드+파라미터 다이제스트) */
	requestKey: string;
	/** 서버가 이어가는 데 필요한 임의 문맥 */
	data: Record<string, unknown>;
}

export type Signer = (input: string) => string;

/**
 * payload를 클라이언트에게 불투명한 문자열로 봉인한다.
 *
 * 힌트: `본문.서명` 형태를 권한다. 본문은 base64url — 클라이언트에게
 *       원문 JSON이 보이면 안 된다. 서명은 무엇에 대해 계산해야
 *       검증 쪽과 맞아떨어질지 생각하라.
 */
export function packRequestState(payload: StatePayload, sign: Signer): string {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: packRequestState');
}

export type UnpackResult =
	| { ok: true; payload: StatePayload }
	| { ok: false; reason: 'malformed' | 'tampered' | 'wrong-principal' | 'wrong-request' | 'expired' };

/**
 * 클라이언트가 에코해온 state를 검증한다.
 *
 * 힌트: 검증 **순서**가 보안이다 — 어떤 검사를 통과하기 전의 payload는
 *       한 글자도 믿을 수 없는가? 만료 경계(now === expiresAt)도 명세다.
 */
export function unpackRequestState(
	state: string,
	ctx: { principal: string; requestKey: string; now: number },
	sign: Signer,
): UnpackResult {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: unpackRequestState');
}

export interface InputRequiredShape {
	resultType: 'input_required';
	inputRequests?: Record<string, unknown>;
	requestState?: string;
}

/**
 * InputRequiredResult를 조립한다.
 *
 * 힌트: 명세가 요구하는 최소 구성 조건이 있다.
 */
export function buildInputRequired(opts: {
	inputRequests?: Record<string, unknown>;
	requestState?: string;
}): InputRequiredShape {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: buildInputRequired');
}

/**
 * 재시도 id가 규칙(원 요청과 달라야 함)을 지키는지 판정한다.
 */
export function validateRetryIds(originalId: string | number, retryId: string | number): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: validateRetryIds');
}

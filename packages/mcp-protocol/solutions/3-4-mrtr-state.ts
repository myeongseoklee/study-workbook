/**
 * 과제 3-4의 참고 구현.
 *
 * 판정은 `tests/3-4-mrtr-state.test.ts`가 한다.
 *
 * 📍 되짚기: docs/08-mrtr-client-features.md § requestState 보안
 *           / docs/90-must-memorize.md 카드 15
 */

export interface StatePayload {
	/** 이 상태를 발급받은 인증 주체 — 다른 주체의 제시를 거부하기 위해 */
	principal: string;
	/** 만료 시각(epoch ms). 유효 조건은 now < expiresAt */
	expiresAt: number;
	/** 원 요청 식별자(메서드+파라미터 다이제스트) — 다른 요청에의 재사용 거부 */
	requestKey: string;
	/** 서버가 이어가는 데 필요한 임의 문맥 */
	data: Record<string, unknown>;
}

export type Signer = (input: string) => string;

/**
 * payload를 base64url 본문 + 서명으로 봉인한다.
 *
 * base64url인 이유: 클라이언트에게 불투명해야 하고(들여다보지 말라는 계약을
 * 형태로도 강제), JSON 특수문자가 전송·헤더를 오염시키지 않아야 한다.
 * 서명은 "원문 JSON"에 대해 계산한다 — 검증 쪽과 같은 입력이어야 하니까.
 */
export function packRequestState(payload: StatePayload, sign: Signer): string {
	const json = JSON.stringify(payload);
	const body = Buffer.from(json, 'utf8').toString('base64url');
	return `${body}.${sign(json)}`;
}

export type UnpackResult =
	| { ok: true; payload: StatePayload }
	| { ok: false; reason: 'malformed' | 'tampered' | 'wrong-principal' | 'wrong-request' | 'expired' };

/**
 * 검증 순서가 보안이다:
 *
 *   ① 형식      → malformed
 *   ② 무결성    → tampered     (서명이 깨진 payload의 내용은 한 글자도 못 믿는다)
 *   ③ 주체      → wrong-principal
 *   ④ 요청 바인딩 → wrong-request
 *   ⑤ 만료      → expired      (경계: now === expiresAt이면 이미 만료)
 *
 * ②보다 ③④⑤를 먼저 하면 조작된 값으로 판정하는 셈이다.
 * 그리고 이 다섯 개를 다 통과해도 "단일 사용"은 보장되지 않는다 —
 * 1회성 소비가 필요하면 서버가 소비 기록으로 따로 강제해야 한다(MUST).
 */
export function unpackRequestState(
	state: string,
	ctx: { principal: string; requestKey: string; now: number },
	sign: Signer,
): UnpackResult {
	const dot = state.indexOf('.');
	if (dot <= 0 || dot === state.length - 1) return { ok: false, reason: 'malformed' };

	const body = state.slice(0, dot);
	const sig = state.slice(dot + 1);
	const json = Buffer.from(body, 'base64url').toString('utf8');
	if (sign(json) !== sig) return { ok: false, reason: 'tampered' };

	let payload: StatePayload;
	try {
		payload = JSON.parse(json) as StatePayload;
	} catch {
		return { ok: false, reason: 'malformed' };
	}

	if (payload.principal !== ctx.principal) return { ok: false, reason: 'wrong-principal' };
	if (payload.requestKey !== ctx.requestKey) return { ok: false, reason: 'wrong-request' };
	if (ctx.now >= payload.expiresAt) return { ok: false, reason: 'expired' };

	return { ok: true, payload };
}

export interface InputRequiredShape {
	resultType: 'input_required';
	inputRequests?: Record<string, unknown>;
	requestState?: string;
}

/**
 * InputRequiredResult 조립기. 명세: inputRequests·requestState 중
 * 최소 하나는 필수(MUST) — 둘 다 없는 "빈 미완"은 성립하지 않는다.
 */
export function buildInputRequired(opts: {
	inputRequests?: Record<string, unknown>;
	requestState?: string;
}): InputRequiredShape {
	if (opts.inputRequests === undefined && opts.requestState === undefined) {
		throw new Error('InputRequiredResult requires at least one of inputRequests or requestState');
	}
	return {
		resultType: 'input_required',
		...(opts.inputRequests !== undefined ? { inputRequests: opts.inputRequests } : {}),
		...(opts.requestState !== undefined ? { requestState: opts.requestState } : {}),
	};
}

/**
 * 재시도는 독립적인 새 요청이다 — id가 원 요청과 같으면
 * "미해결 요청 간 id 중복 금지" 규칙을 어긴다. 타입까지 같아야 같은 id다
 * (1과 "1"은 다른 id).
 */
export function validateRetryIds(originalId: string | number, retryId: string | number): boolean {
	return originalId !== retryId;
}

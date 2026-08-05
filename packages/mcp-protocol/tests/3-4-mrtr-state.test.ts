/**
 * 과제 3-4의 명세 — MRTR requestState의 봉인과 검증
 *
 * 이 파일이 과제의 정의다. `src/3-4-mrtr-state.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 막히면 docs/08-mrtr-client-features.md
 * § requestState 보안을 다시 읽어라.
 *
 * 서명은 진짜 HMAC 대신 테스트가 주입하는 결정적 가짜 서명 함수를 쓴다 —
 * 검증 "구조"(순서·바인딩·만료)가 과제의 대상이지 암호 구현이 아니다.
 *
 * 실행: pnpm test 3-4
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	buildInputRequired,
	packRequestState,
	unpackRequestState,
	validateRetryIds,
} from '../src/3-4-mrtr-state';

/** 결정적 가짜 서명 — 내용이 1바이트라도 다르면 다른 값이 나온다. */
const sign = (input: string): string => {
	let h = 7;
	for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) % 1_000_000_007;
	return `sig-${h}`;
};

const basePayload = {
	principal: 'user-42',
	expiresAt: 10_000,
	requestKey: 'tools/call:get_weather#abc',
	data: { step: 'awaiting-username' },
};
const baseCtx = { principal: 'user-42', requestKey: 'tools/call:get_weather#abc', now: 5_000 };

describe('pack → unpack 왕복', () => {
	it('봉인한 상태를 같은 문맥에서 풀면 payload가 그대로 돌아온다', () => {
		const state = packRequestState(basePayload, sign);
		expect(typeof state).toBe('string');
		const result = unpackRequestState(state, baseCtx, sign);
		expect(result).toEqual({ ok: true, payload: basePayload });
	});

	it('클라이언트 입장에서 상태는 불투명하다 — 원문 JSON이 그대로 보이면 안 된다', () => {
		retrace('payload JSON을 평문으로 이어붙이지 말고 base64url 등으로 감싸라', () => {
			const state = packRequestState(basePayload, sign);
			expect(state).not.toContain('user-42');
			expect(state).not.toContain('{');
		});
	});
});

describe('무결성 — requestState는 공격자 통제 입력이다', () => {
	it('본문이 1글자라도 조작되면 tampered다', () => {
		const state = packRequestState(basePayload, sign);
		const [body = '', sig = ''] = state.split('.');
		const flipped = (body[0] === 'A' ? 'B' : 'A') + body.slice(1);
		expect(unpackRequestState(`${flipped}.${sig}`, baseCtx, sign)).toEqual({
			ok: false,
			reason: 'tampered',
		});
	});

	it('서명이 조작돼도 tampered다', () => {
		const state = packRequestState(basePayload, sign);
		const [body = ''] = state.split('.');
		expect(unpackRequestState(`${body}.sig-0`, baseCtx, sign)).toEqual({
			ok: false,
			reason: 'tampered',
		});
	});

	it('형식 자체가 아니면 malformed다', () => {
		expect(unpackRequestState('not-a-state', baseCtx, sign)).toEqual({
			ok: false,
			reason: 'malformed',
		});
	});

	it('검증 순서: 서명이 깨졌으면 내용 검사보다 tampered가 먼저다', () => {
		retrace(
			'서명 검증 전의 payload는 신뢰할 수 없다 — 만료·주체 판정을 조작된 값으로 ' +
				'해버리는 셈이다. 항상 무결성 → 내용(주체·요청·만료) 순서로 검사하라.',
			() => {
				// 만료된 payload를 만들고 서명을 깨뜨린다: expired가 아니라 tampered여야 한다
				const expired = packRequestState({ ...basePayload, expiresAt: 1 }, sign);
				const [body = ''] = expired.split('.');
				expect(unpackRequestState(`${body}.sig-0`, { ...baseCtx, now: 99_999 }, sign)).toEqual({
					ok: false,
					reason: 'tampered',
				});
			},
		);
	});
});

describe('바인딩과 만료 — 재사용(replay) 창을 좁힌다', () => {
	it('다른 주체가 제시하면 wrong-principal이다', () => {
		const state = packRequestState(basePayload, sign);
		expect(unpackRequestState(state, { ...baseCtx, principal: 'user-99' }, sign)).toEqual({
			ok: false,
			reason: 'wrong-principal',
		});
	});

	it('다른 요청에 제시하면 wrong-request다', () => {
		const state = packRequestState(basePayload, sign);
		expect(
			unpackRequestState(state, { ...baseCtx, requestKey: 'tools/call:delete_all#zzz' }, sign),
		).toEqual({ ok: false, reason: 'wrong-request' });
	});

	it('TTL이 지나면 expired다 — 경계: now === expiresAt이면 이미 만료다', () => {
		retrace('유효 조건은 now < expiresAt이다. `<=`로 구현하면 경계에서 하루살이가 산다', () => {
			const state = packRequestState(basePayload, sign);
			expect(unpackRequestState(state, { ...baseCtx, now: 10_000 }, sign)).toEqual({
				ok: false,
				reason: 'expired',
			});
			expect(unpackRequestState(state, { ...baseCtx, now: 9_999 }, sign)).toMatchObject({
				ok: true,
			});
		});
	});
});

describe('InputRequiredResult 조립과 재시도 규칙', () => {
	it('inputRequests 또는 requestState 중 최소 하나는 있어야 한다 — 둘 다 없으면 던진다', () => {
		retrace('명세: InputRequiredResult에는 둘 중 최소 하나가 필수(MUST)다', () => {
			expect(() => buildInputRequired({})).toThrow(/inputRequests|requestState/);
			expect(() => buildInputRequired({ requestState: 'x.y' })).not.toThrow();
		});
	});

	it('resultType: "input_required"와 전달된 필드만 담는다', () => {
		const withBoth = buildInputRequired({
			inputRequests: { q1: { method: 'elicitation/create', params: {} } },
			requestState: 'abc.def',
		});
		expect(withBoth.resultType).toBe('input_required');
		expect(withBoth.inputRequests).toEqual({ q1: { method: 'elicitation/create', params: {} } });
		expect(withBoth.requestState).toBe('abc.def');

		const stateOnly = buildInputRequired({ requestState: 'abc.def' });
		expect(stateOnly.resultType).toBe('input_required');
		expect('inputRequests' in stateOnly).toBe(false);
	});

	it('재시도의 JSON-RPC id는 원 요청과 달라야 한다', () => {
		retrace('재시도는 독립적인 새 요청이다 — 같은 id 재사용은 상관관계 규칙 위반', () => {
			expect(validateRetryIds(1, 1)).toBe(false);
			expect(validateRetryIds(1, 2)).toBe(true);
			expect(validateRetryIds('a', 'a')).toBe(false);
			expect(validateRetryIds(1, '1')).toBe(true); // 타입이 다르면 다른 id다
		});
	});
});

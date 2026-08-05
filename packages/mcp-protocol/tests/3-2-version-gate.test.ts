/**
 * 과제 3-2의 명세 — 버전·능력 게이트와 세대(era) 판정
 *
 * 이 파일이 과제의 정의다. `src/3-2-version-gate.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 막히면 docs/04-lifecycle-versioning.md와
 * docs/03-messages-meta.md § `_meta`를 다시 읽어라.
 *
 * 실행: pnpm test 3-2
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { gateRequest, judgeStdioProbe, selectRetryVersion } from '../src/3-2-version-gate';

const META = 'io.modelcontextprotocol/';
const config = { supportedVersions: ['2026-07-28', '2025-11-25'] };

function params(meta: Record<string, unknown>) {
	return { _meta: meta };
}

describe('gateRequest — 무상태 서버의 요청 수문장', () => {
	it('필수 _meta 두 필드가 있고 버전이 맞으면 통과한다', () => {
		const result = gateRequest(
			params({ [`${META}protocolVersion`]: '2026-07-28', [`${META}clientCapabilities`]: {} }),
			config,
		);
		expect(result).toEqual({ ok: true, version: '2026-07-28' });
	});

	it('protocolVersion이 없으면 -32602다 — -32022가 아니다', () => {
		retrace(
			'"버전 문제니까 -32022"가 흔한 오답. 필수 _meta 필드 누락은 malformed 요청이라 ' +
				'-32602(Invalid params)다. -32022는 "버전을 말했는데 서버가 미지원"일 때다.',
			() => {
				const result = gateRequest(params({ [`${META}clientCapabilities`]: {} }), config);
				expect(result.ok).toBe(false);
				if (!result.ok) expect(result.error.code).toBe(-32602);
			},
		);
	});

	it('clientCapabilities가 없어도 -32602다 (빈 객체 {}는 유효한 선언이다)', () => {
		const missing = gateRequest(params({ [`${META}protocolVersion`]: '2026-07-28' }), config);
		expect(missing.ok).toBe(false);
		if (!missing.ok) expect(missing.error.code).toBe(-32602);

		const empty = gateRequest(
			params({ [`${META}protocolVersion`]: '2026-07-28', [`${META}clientCapabilities`]: {} }),
			config,
		);
		expect(empty.ok).toBe(true);
	});

	it('_meta 자체가 없거나 params가 없으면 -32602다', () => {
		expect(gateRequest({}, config)).toMatchObject({ ok: false, error: { code: -32602 } });
		expect(gateRequest(undefined, config)).toMatchObject({ ok: false, error: { code: -32602 } });
	});

	it('미지원 버전이면 -32022 + data.supported/requested를 담는다', () => {
		retrace('클라이언트가 재시도 버전을 고르려면 data.supported가 반드시 있어야 한다', () => {
			const result = gateRequest(
				params({ [`${META}protocolVersion`]: '1900-01-01', [`${META}clientCapabilities`]: {} }),
				config,
			);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe(-32022);
				expect(result.error.data).toEqual({
					supported: ['2026-07-28', '2025-11-25'],
					requested: '1900-01-01',
				});
			}
		});
	});

	it('필요 능력이 선언되지 않으면 -32021 + 빠진 것만 나열한다', () => {
		retrace(
			'data.requiredCapabilities에는 "빠진 능력만" 담는다 — 전체 요구 목록이 아니다',
			() => {
				const result = gateRequest(
					params({
						[`${META}protocolVersion`]: '2026-07-28',
						[`${META}clientCapabilities`]: { elicitation: {} },
					}),
					{ ...config, requiredCapabilities: ['elicitation', 'sampling'] },
				);
				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.code).toBe(-32021);
					expect(result.error.data).toEqual({ requiredCapabilities: ['sampling'] });
				}
			},
		);
	});

	it('검사 순서: malformed(-32602)가 버전(-32022)보다 먼저다', () => {
		// clientCapabilities도 없고 버전도 미지원 — malformed가 우선
		const result = gateRequest(params({ [`${META}protocolVersion`]: '1900-01-01' }), config);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe(-32602);
	});
});

describe('selectRetryVersion — 클라이언트의 재시도 선택', () => {
	it('클라이언트 선호 순서대로 첫 교집합을 고른다 — 서버 목록 순서가 아니다', () => {
		retrace(
			'서버의 supported 순서를 따르면 이 검사에서 걸린다. ' +
				'선택 주체는 클라이언트고, 기준은 클라이언트의 선호 순서다.',
			() => {
				expect(
					selectRetryVersion(['2025-11-25', '2026-07-28'], ['2026-07-28', '2025-11-25']),
				).toBe('2025-11-25');
			},
		);
	});

	it('교집합이 없으면 null — 사용자에게 에러를 표시할 차례다', () => {
		expect(selectRetryVersion(['2026-07-28'], ['2024-11-05'])).toBeNull();
	});
});

describe('judgeStdioProbe — server/discover 프로브 결과로 세대 판정', () => {
	it('DiscoverResult가 오면 modern, 그대로 계속한다', () => {
		expect(judgeStdioProbe({ kind: 'discover-result', supportedVersions: ['2026-07-28'] })).toEqual(
			{ era: 'modern', action: 'continue' },
		);
	});

	it('-32022(인식 가능한 modern 에러)면 modern이다 — initialize로 폴백하면 안 된다', () => {
		retrace(
			'버전 에러 = "modern인데 버전만 안 맞음"이다. 여기서 legacy로 폴백하면 ' +
				'modern 서버를 legacy로 강등시킨다. supported에서 골라 재시도해야 한다.',
			() => {
				expect(judgeStdioProbe({ kind: 'error', code: -32022 })).toEqual({
					era: 'modern',
					action: 'retry-other-version',
				});
			},
		);
	});

	it('-32601 같은 그 외 에러는 legacy다 — 특정 코드 하나에 폴백을 걸지 말 것', () => {
		retrace(
			'레거시 서버의 pre-initialize 에러는 구현마다 다르다(-32601, -32602, 침묵…). ' +
				'"인식 가능한 modern 에러(-32020~-32099)인가"로만 갈라야 한다.',
			() => {
				expect(judgeStdioProbe({ kind: 'error', code: -32601 })).toEqual({
					era: 'legacy',
					action: 'fallback-initialize',
				});
				expect(judgeStdioProbe({ kind: 'error', code: -32602 })).toEqual({
					era: 'legacy',
					action: 'fallback-initialize',
				});
			},
		);
	});

	it('타임아웃(무응답)도 legacy다', () => {
		expect(judgeStdioProbe({ kind: 'timeout' })).toEqual({
			era: 'legacy',
			action: 'fallback-initialize',
		});
	});
});

/**
 * 과제 07-01의 명세 — 에러 예산 소진율 알림
 *
 * 이 파일이 과제의 정의다. `src/07-01-burn-rate-alert/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/07-slo-and-error-budget.md를 다시 읽어라.
 *
 * 실행: pnpm test 07-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	STANDARD_RULES,
	budgetMinutes,
	burnRate,
	errorBudget,
	evaluateAlerts,
	timeToExhaustionHours,
} from '../../src/07-01-burn-rate-alert';
import type { WindowMeasurement } from '../../src/07-01-burn-rate-alert';

describe('errorBudget · budgetMinutes', () => {
	it('예산은 1 - SLO다', () => {
		expect(errorBudget(0.999)).toBeCloseTo(0.001, 10);
		expect(errorBudget(0.99)).toBeCloseTo(0.01, 10);
	});

	it('99.9% SLO의 30일 예산은 43.2분이다', () => {
		retrace(
			'30일 × 24시간 × 60분 × 0.001 = 43.2분. 이 절대 크기를 모르면 소진율 숫자에 ' +
				'감각이 붙지 않는다 — 완전 장애에서 43분이라는 것이 감지 속도의 기준이 된다.',
			() => {
				expect(budgetMinutes(0.999, 30)).toBeCloseTo(43.2, 6);
			},
		);
	});
});

describe('burnRate · timeToExhaustionHours', () => {
	it('소진율은 실제 에러율 ÷ 허용 에러율이다', () => {
		expect(burnRate(0.001, 0.999)).toBeCloseTo(1, 10);
		expect(burnRate(0.01, 0.999)).toBeCloseTo(10, 10);
		expect(burnRate(1, 0.999)).toBeCloseTo(1000, 10);
	});

	it('워크북 표를 재현한다 — 소진율 1이면 30일, 10이면 3일, 1000이면 43.2분', () => {
		retrace(
			'고갈 시간 = 기간 / 소진율이다. 소진율 1이 "기간이 끝나는 순간 정확히 다 쓴다"를 ' +
				'뜻하므로 분모에 온다. 곱하면 방향이 반대가 된다.',
			() => {
				expect(timeToExhaustionHours(1, 30)).toBeCloseTo(720, 6);
				expect(timeToExhaustionHours(10, 30)).toBeCloseTo(72, 6);
				expect(timeToExhaustionHours(1000, 30)).toBeCloseTo(0.72, 6);
			},
		);
	});

	it('소진율이 0 이하면 예산은 고갈되지 않는다', () => {
		expect(timeToExhaustionHours(0, 30)).toBe(Number.POSITIVE_INFINITY);
	});
});

describe('STANDARD_RULES — 99.9% SLO 권장 파라미터', () => {
	it('세 규칙의 창·소진율·심각도가 문서와 같다', () => {
		expect(STANDARD_RULES).toEqual([
			{
				name: 'fast-burn',
				severity: 'page',
				longWindowHours: 1,
				shortWindowHours: 5 / 60,
				burnRateThreshold: 14.4,
			},
			{
				name: 'medium-burn',
				severity: 'page',
				longWindowHours: 6,
				shortWindowHours: 0.5,
				burnRateThreshold: 6,
			},
			{
				name: 'slow-burn',
				severity: 'ticket',
				longWindowHours: 72,
				shortWindowHours: 6,
				burnRateThreshold: 1,
			},
		]);
	});

	it('짧은 창은 긴 창의 1/12이다', () => {
		retrace(
			'권장 비율이 1/12다. 너무 짧으면 노이즈가 게이트를 흔들고, 너무 길면 알림 해제가 ' +
				'느려진다. 세 규칙이 모두 같은 비율을 지키는지 확인하라.',
			() => {
				// 길이를 먼저 못박는다 — 빈 배열에서 for 루프는 아무것도 검사하지 않고 통과한다
				expect(STANDARD_RULES).toHaveLength(3);
				for (const r of STANDARD_RULES) {
					expect(r.shortWindowHours).toBeCloseTo(r.longWindowHours / 12, 9);
				}
			},
		);
	});

	it('각 규칙이 태우는 예산 비율이 문서와 같다 — 2% / 5% / 10%', () => {
		const periodHours = 30 * 24;
		retrace(
			'긴 창에서 소진율 R이 유지되면 태우는 예산은 R × (창 길이 / 기간)이다. ' +
				'14.4 × (1/720) = 2%, 6 × (6/720) = 5%, 1 × (72/720) = 10%.',
			() => {
				const consumed = STANDARD_RULES.map(
					(r) => r.burnRateThreshold * (r.longWindowHours / periodHours),
				);
				expect(consumed[0]).toBeCloseTo(0.02, 6);
				expect(consumed[1]).toBeCloseTo(0.05, 6);
				expect(consumed[2]).toBeCloseTo(0.1, 6);
			},
		);
	});
});

describe('evaluateAlerts — 두 창이 모두 참일 때만 발화', () => {
	const SLO = 0.999;

	/** 긴 창·짧은 창의 에러율을 소진율로 지정해 만든다. */
	function m(longBurn: number, shortBurn: number): WindowMeasurement {
		const allowed = 1 - SLO;
		return { longErrorRate: longBurn * allowed, shortErrorRate: shortBurn * allowed };
	}

	it('긴 창과 짧은 창이 모두 임계를 넘으면 발화한다', () => {
		const firing = evaluateAlerts(SLO, { 'fast-burn': m(20, 20) }, STANDARD_RULES);
		expect(firing).toEqual(['fast-burn']);
	});

	it('긴 창만 넘고 짧은 창이 식었으면 발화하지 않는다 — 복구된 장애다', () => {
		retrace(
			'짧은 창의 역할은 "지금도 타는 중인가"다. 이 게이트가 없으면 5분 만에 복구된 ' +
				'장애의 알림이 긴 창 길이만큼(55분 더) 계속 울리고, 사람은 "고쳤는데 왜 아직 ' +
				'빨간가"를 의심하며 시간을 쓴다.',
			() => {
				expect(evaluateAlerts(SLO, { 'fast-burn': m(20, 0.5) }, STANDARD_RULES)).toEqual([]);
			},
		);
	});

	it('짧은 창만 넘고 긴 창이 낮으면 발화하지 않는다 — 아직 심각하지 않다', () => {
		expect(evaluateAlerts(SLO, { 'fast-burn': m(0.5, 20) }, STANDARD_RULES)).toEqual([]);
	});

	it('경계값은 발화한다 (임계 이상)', () => {
		expect(evaluateAlerts(SLO, { 'fast-burn': m(14.4, 14.4) }, STANDARD_RULES)).toEqual([
			'fast-burn',
		]);
	});

	it('측정값이 없는 규칙은 건너뛴다 — 없는 것을 정상으로도 이상으로도 보지 않는다', () => {
		expect(evaluateAlerts(SLO, {}, STANDARD_RULES)).toEqual([]);
	});

	it('여러 규칙이 걸리면 page가 먼저, 같은 심각도에서는 소진율 임계가 높은 것이 먼저다', () => {
		const measured = {
			'fast-burn': m(20, 20),
			'medium-burn': m(20, 20),
			'slow-burn': m(20, 20),
		};
		retrace(
			'심각도 순서를 두는 이유는 사람이 목록의 첫 줄부터 읽기 때문이다. ticket이 위에 ' +
				'오면 새벽에 깨어난 사람이 할 일 없는 항목을 먼저 본다.',
			() => {
				expect(evaluateAlerts(SLO, measured, STANDARD_RULES)).toEqual([
					'fast-burn',
					'medium-burn',
					'slow-burn',
				]);
			},
		);
	});

	it('완전 장애에서 fast-burn이 즉시 걸린다 — 43분 예산을 지키는 유일한 경로', () => {
		const measured = { 'fast-burn': { longErrorRate: 1, shortErrorRate: 1 } };
		retrace(
			'에러율 100%면 소진율 1000이다. 30분 창 임계값 알림은 43분 예산의 70%를 감지에 ' +
				'쓰지만, 5분 짧은 창은 그 전에 걸린다.',
			() => {
				expect(evaluateAlerts(SLO, measured, STANDARD_RULES)).toContain('fast-burn');
			},
		);
	});
});

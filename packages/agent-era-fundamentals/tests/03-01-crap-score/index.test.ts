/**
 * 과제 03-01의 명세 — CRAP 점수 계산기
 *
 * 이 파일이 과제의 정의다. `src/03-01-crap-score/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/03-revived-quality-tools.md의 "CRAP 점수가 재는 것"을 다시 읽어라.
 *
 * 실행: pnpm --filter agent-era-fundamentals test 03-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { coverageNeeded, crapScore, findCrapFunctions } from '../../src/03-01-crap-score';

describe('crapScore — 복잡도와 커버리지를 하나의 위험 점수로', () => {
	it('커버리지가 100%면 점수는 순환 복잡도 그 자체다', () => {
		retrace(
			'(1 − cov)가 0이 되어 제곱 항이 통째로 사라진다. 이 성질이 밥의 임계값 4·6·8이 ' +
				'사실상 복잡도 상한으로 작동하는 이유다. 값이 다르면 뒷항의 + CC를 빠뜨렸는지 확인하라.',
			() => {
				expect(crapScore(6, 1)).toBe(6);
				expect(crapScore(1, 1)).toBe(1);
				expect(crapScore(30, 1)).toBe(30);
			},
		);
	});

	it('커버리지가 0%면 CC² + CC다', () => {
		retrace('(1 − 0)³ = 1이므로 제곱 항이 그대로 남는다', () => {
			expect(crapScore(6, 0)).toBe(42);
			expect(crapScore(1, 0)).toBe(2);
		});
	});

	it('덮이지 않은 비율이 세제곱이라 커버리지를 조금만 올려도 크게 떨어진다', () => {
		retrace(
			'지수를 뒤집어 CC³ × (1−cov)²로 쓰면 이 값들이 전부 어긋난다. ' +
				'복잡도가 제곱, 덮이지 않은 비율이 세제곱이다.',
			() => {
				expect(crapScore(6, 0.8)).toBeCloseTo(6.288, 3);
				expect(crapScore(6, 0.5)).toBeCloseTo(10.5, 6);
			},
		);
	});

	it('단순한 함수는 전혀 안 덮여도 위험하지 않다', () => {
		// 복잡도 1짜리 함수의 최악값(2)이 복잡도 6짜리의 최선값(6)보다 낮다.
		expect(crapScore(1, 0)).toBeLessThan(crapScore(6, 1));
	});

	it('복잡한 함수일수록 커버리지 한 단위가 더 큰 일을 한다', () => {
		const 단순한함수의개선 = crapScore(2, 0) - crapScore(2, 0.5);
		const 복잡한함수의개선 = crapScore(20, 0) - crapScore(20, 0.5);
		expect(복잡한함수의개선).toBeGreaterThan(단순한함수의개선);
	});

	it('측정값이 깨져 있으면 점수를 내지 않고 RangeError를 던진다', () => {
		retrace(
			'깨진 측정값으로 낸 점수는 그것을 근거로 한 판단을 조용히 오염시킨다. ' +
				'복잡도는 1 이상의 정수, 커버리지는 0~1이다.',
			() => {
				expect(() => crapScore(0, 0.5)).toThrow(RangeError);
				expect(() => crapScore(-1, 0.5)).toThrow(RangeError);
				expect(() => crapScore(2.5, 0.5)).toThrow(RangeError);
				expect(() => crapScore(5, 1.2)).toThrow(RangeError);
				expect(() => crapScore(5, -0.1)).toThrow(RangeError);
			},
		);
	});
});

describe('findCrapFunctions — 임계값을 넘긴 것만 골라낸다', () => {
	const metrics = [
		{ name: 'parseConfig', complexity: 12, coverage: 0.3 },
		{ name: 'formatDate', complexity: 2, coverage: 1 },
		{ name: 'resolveRoute', complexity: 8, coverage: 0.9 },
		{ name: 'validateInput', complexity: 15, coverage: 0 },
	];

	it('임계값을 초과한 것만 남긴다 — 같은 값은 통과다', () => {
		retrace('경계는 "초과"다. 정확히 임계값인 함수는 남기지 않는다', () => {
			const 경계 = [{ name: 'exact', complexity: 6, coverage: 1 }];
			expect(findCrapFunctions(경계, 6)).toEqual([]);
			expect(findCrapFunctions(경계, 5.9)).toHaveLength(1);
		});
	});

	it('점수 내림차순으로 돌려준다 — 가장 위험한 것이 먼저다', () => {
		const result = findCrapFunctions(metrics, 6);
		expect(result.map((m) => m.name)).toEqual(['validateInput', 'parseConfig', 'resolveRoute']);
	});

	it('점수가 같으면 이름의 사전순이다', () => {
		const 동점 = [
			{ name: 'zebra', complexity: 4, coverage: 1 },
			{ name: 'alpha', complexity: 4, coverage: 1 },
		];
		expect(findCrapFunctions(동점, 3).map((m) => m.name)).toEqual(['alpha', 'zebra']);
	});

	it('원본 배열을 훼손하지 않는다', () => {
		const 원본순서 = metrics.map((m) => m.name);
		findCrapFunctions(metrics, 6);
		expect(metrics.map((m) => m.name)).toEqual(원본순서);
	});

	it('커버리지가 높은 복잡한 함수는 걸러지지 않는다', () => {
		// resolveRoute(복잡도 8, 커버리지 90%)는 임계값 9에서는 통과한다.
		expect(findCrapFunctions(metrics, 9).map((m) => m.name)).toEqual([
			'validateInput',
			'parseConfig',
		]);
	});
});

describe('coverageNeeded — 임계값 이하로 내리려면 얼마나 덮어야 하나', () => {
	it('임계값이 복잡도보다 작으면 도달할 수 없다', () => {
		retrace(
			'커버리지 100%에서 CRAP은 복잡도와 같아진다. 그러므로 임계값이 복잡도보다 낮으면 ' +
				'테스트를 아무리 붙여도 내려가지 않는다 — 함수를 쪼개는 수밖에 없다. ' +
				'이 판정을 빠뜨리면 아래에서 세제곱근이 음수가 되어 이상한 값이 나온다.',
			() => {
				expect(coverageNeeded(10, 6)).toBeNull();
				expect(coverageNeeded(7, 6.999)).toBeNull();
			},
		);
	});

	it('임계값이 복잡도와 같으면 100%를 요구한다', () => {
		expect(coverageNeeded(6, 6)).toBeCloseTo(1, 10);
	});

	it('구한 커버리지를 넣으면 실제로 임계값에 닿는다', () => {
		for (const [cc, threshold] of [
			[6, 8],
			[12, 20],
			[3, 5],
		] as const) {
			const needed = coverageNeeded(cc, threshold);
			expect(needed).not.toBeNull();
			expect(crapScore(cc, needed as number)).toBeCloseTo(threshold, 6);
		}
	});

	it('임계값이 최악값보다 크면 커버리지가 전혀 필요 없다', () => {
		// 복잡도 3의 최악값은 3² + 3 = 12다. 임계값이 그보다 높으면 0%로도 통과한다.
		expect(coverageNeeded(3, 12)).toBe(0);
		expect(coverageNeeded(3, 100)).toBe(0);
	});

	it('같은 임계값이라도 복잡한 함수일수록 더 많은 커버리지를 요구한다', () => {
		const 낮은복잡도 = coverageNeeded(5, 30) as number;
		const 높은복잡도 = coverageNeeded(20, 30) as number;
		expect(높은복잡도).toBeGreaterThan(낮은복잡도);
	});
});

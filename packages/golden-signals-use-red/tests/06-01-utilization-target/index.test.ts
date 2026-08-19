/**
 * 과제 06-01의 명세 — 목표 사용률 계산기
 *
 * 이 파일이 과제의 정의다. `src/06-01-utilization-target/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/06-saturation-and-queueing.md를 다시 읽어라.
 *
 * 실행: pnpm test 06-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	capacityFactorFor,
	latencyMultiplier,
	responseTimeMs,
	utilizationTarget,
} from '../../src/06-01-utilization-target';

describe('latencyMultiplier — 1/(1-ρ)', () => {
	it('암기 카드 13의 표를 재현한다', () => {
		expect(latencyMultiplier(0.5)).toBeCloseTo(2, 10);
		expect(latencyMultiplier(0.7)).toBeCloseTo(3.3333, 4);
		expect(latencyMultiplier(0.8)).toBeCloseTo(5, 10);
		expect(latencyMultiplier(0.9)).toBeCloseTo(10, 10);
		expect(latencyMultiplier(0.95)).toBeCloseTo(20, 10);
		expect(latencyMultiplier(0.99)).toBeCloseTo(100, 10);
	});

	it('부하가 없으면 배수는 1이다', () => {
		expect(latencyMultiplier(0)).toBe(1);
	});

	it('ρ ≥ 1이면 무한이다 — 큐가 발산한다', () => {
		retrace(
			'M/M/1의 안정 조건은 λ < μ다. ρ = 1은 "도착과 처리가 같은 속도"인데, 도착이 ' +
				'무작위라 겹치는 순간이 반드시 오고 그때 쌓인 큐는 절대 비워지지 않는다. ' +
				'1/(1-1) = 1/0을 그대로 두면 Infinity가 나오는데, 그것이 수학적으로도 맞는 답이다.',
			() => {
				expect(latencyMultiplier(1)).toBe(Number.POSITIVE_INFINITY);
				expect(latencyMultiplier(1.2)).toBe(Number.POSITIVE_INFINITY);
			},
		);
	});

	it('ρ가 음수면 NaN이 아니라 1이다 (측정 잡음 방어)', () => {
		expect(latencyMultiplier(-0.1)).toBe(1);
	});
});

describe('utilizationTarget — 1 - 1/k 역산', () => {
	it('허용 지연 배수에서 목표 사용률을 낸다', () => {
		expect(utilizationTarget(2)).toBeCloseTo(0.5, 10);
		expect(utilizationTarget(3)).toBeCloseTo(0.6667, 4);
		expect(utilizationTarget(4)).toBeCloseTo(0.75, 10);
		expect(utilizationTarget(5)).toBeCloseTo(0.8, 10);
		expect(utilizationTarget(10)).toBeCloseTo(0.9, 10);
	});

	it('latencyMultiplier의 역함수다', () => {
		for (const rho of [0.3, 0.5, 0.75, 0.9]) {
			expect(utilizationTarget(latencyMultiplier(rho))).toBeCloseTo(rho, 10);
		}
	});

	it('허용 배수가 1 이하면 목표 사용률은 0이다', () => {
		retrace(
			'"지연이 전혀 늘어나면 안 된다"(k=1)는 요구는 사용률 0에서만 성립한다. ' +
				'음수를 내면 임계값 계산에 그대로 흘러들어가므로 0으로 자른다.',
			() => {
				expect(utilizationTarget(1)).toBe(0);
				expect(utilizationTarget(0.5)).toBe(0);
			},
		);
	});
});

describe('responseTimeMs — S/(1-ρ)', () => {
	it('무부하 처리 시간과 사용률에서 응답 시간을 낸다', () => {
		expect(responseTimeMs(40, 0.8)).toBeCloseTo(200, 10);
		expect(responseTimeMs(300, 0.8)).toBeCloseTo(1_500, 10);
	});

	it('같은 사용률에서도 무부하 처리 시간에 따라 타임아웃 안팎이 갈린다', () => {
		const timeoutMs = 1_000;
		retrace(
			'사용률 80%는 두 시스템에 같은 값이지만 결과가 반대다 — p50이 40ms인 서비스에서 ' +
				'5배는 200ms로 여유롭고, 300ms인 서비스에서 5배는 1.5초로 이미 타임아웃 밖이다. ' +
				'"CPU 80% 알림"을 조직 표준으로 전부에 적용하면 안 되는 이유가 이것이다.',
			() => {
				expect(responseTimeMs(40, 0.8)).toBeLessThan(timeoutMs);
				expect(responseTimeMs(300, 0.8)).toBeGreaterThan(timeoutMs);
			},
		);
	});
});

describe('capacityFactorFor — 목표까지 필요한 처리 용량 배수', () => {
	it('도착률이 같을 때 필요한 용량 배수는 현재 ρ ÷ 목표 ρ다', () => {
		retrace(
			'ρ = λ/μ이므로 λ가 그대로면 μ를 (현재 ρ / 목표 ρ)배로 올려야 목표 ρ에 닿는다. ' +
				'차(0.9 - 0.6)나 비율의 역수(0.6/0.9)로 쓰면 방향이 뒤집힌다.',
			() => {
				expect(capacityFactorFor(0.9, 0.6)).toBeCloseTo(1.5, 10);
				expect(capacityFactorFor(0.95, 0.5)).toBeCloseTo(1.9, 10);
			},
		);
	});

	it('이미 목표 이하면 증설이 필요 없다 (1 미만으로 내려가지 않는다)', () => {
		retrace(
			'0.8을 내서 "20% 줄이라"고 말하면 축소 판단이 되는데, 이 함수의 책임이 아니다. ' +
				'축소는 비용·여유·버스트 내성을 함께 봐야 하는 별개 결정이다.',
			() => {
				expect(capacityFactorFor(0.4, 0.6)).toBe(1);
			},
		);
	});

	it('포화 근처에서는 배수가 작아도 지연 개선이 크다', () => {
		const before = latencyMultiplier(0.9);
		const after = latencyMultiplier(0.9 / 2); // 인스턴스 2배 → ρ 절반
		retrace(
			'지연 10배에서 1.8배로 떨어진다 — 용량을 2배 늘렸는데 지연은 5.5배 개선된다. ' +
				'비선형성이 반대 방향으로도 작동하는 것이고, 반대로 ρ=0.3에서 2배 증설하면 ' +
				'1.43배 → 1.18배로 17%밖에 개선되지 않는다.',
			() => {
				expect(before).toBeCloseTo(10, 10);
				expect(after).toBeCloseTo(1.8182, 4);
				expect(before / after).toBeGreaterThan(5);
			},
		);
	});
});

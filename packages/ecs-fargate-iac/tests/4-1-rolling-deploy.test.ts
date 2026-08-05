/**
 * 과제 4-1의 명세 — 롤링 배포 범위와 서킷 브레이커 임계값
 *
 * 이 파일이 과제의 정의다. `src/4-1-rolling-deploy.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 docs/04-ecs-fargate.md § 롤링 배포의 산수를 다시 읽어라.
 *
 * 실행: pnpm test 4-1
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	circuitBreakerThreshold,
	deployRange,
	isDeadlocked,
	isZeroDowntime,
} from '../src/4-1-rolling-deploy';

describe('deployRange — 배포 중 태스크 수의 범위', () => {
	it('기본값은 100 / 200이다 (DesiredCount 1 → 최소 1, 최대 2)', () => {
		retrace(
			'ECS 레플리카 서비스의 기본값이 100/200이다. 인자 기본값을 다르게 두면 ' +
				'"명시하지 않은 템플릿"의 동작을 잘못 계산한다.',
			() => {
				expect(deployRange(1)).toEqual({ min: 1, max: 2 });
			},
		);
	});

	it('최소는 올림한다', () => {
		retrace(
			'최소를 내림하면 가용성 하한이 실제보다 낮게 계산된다. ' +
				'd=3에서 75%는 2.25이고, 올림한 3이 정답이다.',
			() => {
				expect(deployRange(3, 75, 100).min).toBe(3);
				expect(deployRange(3, 50, 125).min).toBe(2);
				expect(deployRange(1, 50, 100).min).toBe(1);
			},
		);
	});

	it('최대는 내림한다', () => {
		retrace(
			'최대를 올림하면 여유 자리가 있는 것처럼 잘못 판정된다. ' +
				'd=3에서 125%는 3.75이고, 내림한 3이 정답이다 — 즉 여유가 없다.',
			() => {
				expect(deployRange(3, 50, 125).max).toBe(3);
				expect(deployRange(3, 75, 100).max).toBe(3);
			},
		);
	});

	it('d=4, 50/100 → 최소 2, 최대 4', () => {
		expect(deployRange(4, 50, 100)).toEqual({ min: 2, max: 4 });
	});

	it('최소 비율 0이면 최소가 0이다', () => {
		expect(deployRange(4, 0, 200).min).toBe(0);
	});
});

describe('isDeadlocked — 배포가 진행되지 못하는 설정', () => {
	it('⭐ d=1, 100/100은 교착이다', () => {
		retrace(
			'최소 1·최대 1이라 하나도 멈출 수 없고 하나도 시작할 수 없다. ' +
				'증상은 "배포가 멈춤"이고, ECS가 설정 문제를 알리는 서비스 이벤트를 낸다.',
			() => {
				expect(isDeadlocked(1, 100, 100)).toBe(true);
			},
		);
	});

	it('⭐ d=1, 50/100도 교착이다 (최소가 올림으로 1이 되므로)', () => {
		retrace(
			'ceil(0.5) = 1 이라 100/100과 결과가 같다. 최소를 내림하는 구현은 ' +
				'여기서 "멈출 여유가 있다"고 잘못 판정한다.',
			() => {
				expect(isDeadlocked(1, 50, 100)).toBe(true);
			},
		);
	});

	it('d=4, 100/100도 교착이다', () => {
		expect(isDeadlocked(4, 100, 100)).toBe(true);
	});

	it('d=1, 100/200은 교착이 아니다 (이 템플릿의 설정)', () => {
		expect(isDeadlocked(1, 100, 200)).toBe(false);
	});

	it('d=4, 50/100은 교착이 아니다 — 2개씩 멈춰가며 교체된다', () => {
		expect(isDeadlocked(4, 50, 100)).toBe(false);
	});

	it('d=1, 0/100은 교착이 아니다 — 중단은 발생하지만 진행된다', () => {
		expect(isDeadlocked(1, 0, 100)).toBe(false);
	});
});

describe('isZeroDowntime — 용량이 줄지 않으면서 진행 가능한가', () => {
	it('d=1, 100/200은 무중단이다 (이 템플릿의 설정)', () => {
		expect(isZeroDowntime(1, 100, 200)).toBe(true);
	});

	it('d=4, 100/200은 무중단이다', () => {
		expect(isZeroDowntime(4, 100, 200)).toBe(true);
	});

	it('d=4, 100/125도 무중단이다 — 하나씩 교체할 자리가 있다', () => {
		retrace('최소 4·최대 5. 여유가 하나뿐이어도 무중단은 성립한다', () => {
			expect(isZeroDowntime(4, 100, 125)).toBe(true);
		});
	});

	it('교착 설정은 무중단이 아니다', () => {
		retrace(
			'min >= desiredCount만 보면 100/100을 무중단으로 잘못 판정한다. ' +
				'진행 가능성(max > desiredCount)도 함께 필요하다.',
			() => {
				expect(isZeroDowntime(1, 100, 100)).toBe(false);
				expect(isZeroDowntime(4, 100, 100)).toBe(false);
			},
		);
	});

	it('용량이 줄어드는 설정은 무중단이 아니다', () => {
		retrace(
			'max > desiredCount만 보면 50/100을 무중단으로 잘못 판정한다. ' +
				'배포 중 처리 용량이 절반으로 떨어지는 것은 무중단이 아니다.',
			() => {
				expect(isZeroDowntime(4, 50, 100)).toBe(false);
				expect(isZeroDowntime(1, 0, 100)).toBe(false);
			},
		);
	});
});

describe('circuitBreakerThreshold — 배포 실패 판정 횟수', () => {
	describe('BOUNDED_PERCENT (기본)', () => {
		it('⭐ d=1은 0.5이지만 최소값 3이 된다', () => {
			retrace(
				'이 템플릿의 실제 임계값이다. clamp 하한을 빠뜨리면 0 또는 1이 되어 ' +
					'"몇 번 실패하면 배포가 포기되는가"를 잘못 예측한다.',
				() => {
					expect(circuitBreakerThreshold(1)).toBe(3);
				},
			);
		});

		it('d=25는 12.5를 올림해 13이 된다', () => {
			expect(circuitBreakerThreshold(25)).toBe(13);
		});

		it('경계값은 그대로 쓴다 (d=6 → 3, d=400 → 200)', () => {
			retrace(
				'문서는 "3보다 작으면 3, 200보다 크면 200"이라고 말한다. ' +
					'경계값 자체는 clamp 대상이 아니다.',
				() => {
					expect(circuitBreakerThreshold(6)).toBe(3);
					expect(circuitBreakerThreshold(400)).toBe(200);
				},
			);
		});

		it('d=800은 400이지만 최대값 200이 된다', () => {
			expect(circuitBreakerThreshold(800)).toBe(200);
		});

		it('d=7은 3.5를 올림해 4가 된다', () => {
			retrace(
				'내림하면 3이 되어 "최소값에 걸린 경우"와 구분되지 않는다. ' +
					'비율 계산 결과는 올림이다.',
				() => {
					expect(circuitBreakerThreshold(7)).toBe(4);
				},
			);
		});

		it('비율을 명시하면 그 값을 쓰고, 생략하면 50이다', () => {
			expect(circuitBreakerThreshold(100, { type: 'BOUNDED_PERCENT', value: 20 })).toBe(20);
			expect(circuitBreakerThreshold(100, { type: 'BOUNDED_PERCENT' })).toBe(50);
		});
	});

	describe('UNBOUNDED_PERCENT — clamp하지 않는다', () => {
		it('상한이 없다 (d=800, 50% → 400)', () => {
			expect(circuitBreakerThreshold(800, { type: 'UNBOUNDED_PERCENT', value: 50 })).toBe(400);
		});

		it('하한도 없다 (d=1, 50% → 올림한 1)', () => {
			retrace('BOUNDED와 달리 최소 3으로 올리지 않는다', () => {
				expect(circuitBreakerThreshold(1, { type: 'UNBOUNDED_PERCENT', value: 50 })).toBe(1);
			});
		});
	});

	describe('COUNT — DesiredCount와 무관한 고정값', () => {
		it('DesiredCount가 변해도 같은 값이다', () => {
			expect(circuitBreakerThreshold(1, { type: 'COUNT', value: 5 })).toBe(5);
			expect(circuitBreakerThreshold(999, { type: 'COUNT', value: 5 })).toBe(5);
		});

		it('3보다 작아도 clamp하지 않는다', () => {
			expect(circuitBreakerThreshold(10, { type: 'COUNT', value: 1 })).toBe(1);
		});
	});
});

/**
 * 과제 3-2의 명세 — KV 세션 예산 계산기
 *
 * 이 파일이 과제의 정의다. `src/3-2-kv-session-budget.ts`를 채워 여기를
 * 통과시켜라. 이 파일은 고치지 않는다.
 *
 * 실행: pnpm test 3-2
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	concurrentSessions,
	developerCapacity,
	meetsFloors,
	modelFootprintGb,
	PARAM_FLOOR_B,
	QUANT_FLOOR_BITS,
} from '../src/3-2-kv-session-budget';

describe('modelFootprintGb — 적재 용량', () => {
	it('460B를 Q5로 적재하면 약 287.5GB다', () => {
		retrace('파라미터당 바이트 = bits / 8. 1B 파라미터를 8비트로 적재하면 약 1GB다.', () => {
			expect(modelFootprintGb(460, 5)).toBeCloseTo(287.5, 1);
		});
	});

	it('비트폭 항이 실제로 작동한다 — 70B fp16 = 140GB', () => {
		retrace('비트폭을 상수로 굳혀 두면 여기서 걸린다', () => {
			expect(modelFootprintGb(70, 16)).toBeCloseTo(140, 1);
		});
	});

	it('비트폭이 절반이면 용량도 절반이다', () => {
		expect(modelFootprintGb(460, 4)).toBeCloseTo(modelFootprintGb(460, 8) / 2, 1);
	});
});

describe('concurrentSessions — 동시 세션 수', () => {
	it('500GB 노드에 287.5GB 모델, 세션당 10GB → 21개', () => {
		retrace('(500 − 287.5) / 10 = 21.25 → 내림 21. Math.floor를 빠뜨렸는지 확인하라.', () => {
			expect(concurrentSessions(500, 287.5, 10)).toBe(21);
		});
	});

	it('모델이 노드보다 크면 0이다 — 음수 세션은 존재하지 않는다', () => {
		expect(concurrentSessions(100, 200, 10)).toBe(0);
	});

	it('남는 메모리가 세션 하나에도 못 미치면 0이다', () => {
		expect(concurrentSessions(100, 95, 10)).toBe(0);
	});
});

describe('developerCapacity — 수용 인원', () => {
	it('세션 21개를 1인 7세션으로 나누면 3명이다', () => {
		expect(developerCapacity(21, 7)).toBe(3);
	});

	it('나머지는 버린다 — 20 / 7은 2명이다', () => {
		retrace('2.86명을 3명으로 올리면 세 번째 사람은 자리가 없다', () => {
			expect(developerCapacity(20, 7)).toBe(2);
		});
	});
});

describe('두 개의 마지노선', () => {
	it('QUANT_FLOOR_BITS는 5다 — Q4는 원본 분포에서 벗어난다', () => {
		expect(QUANT_FLOOR_BITS).toBe(5);
	});

	it('PARAM_FLOOR_B는 200이다 — 30B·120B로는 제품 수준 코딩이 안 된다', () => {
		expect(PARAM_FLOOR_B).toBe(200);
	});

	it('460B Q5는 두 하한을 모두 넘는다', () => {
		expect(meetsFloors(460, 5)).toBe(true);
	});

	it('120B Q5는 크기 하한에서 걸린다', () => {
		expect(meetsFloors(120, 5)).toBe(false);
	});

	it('460B Q4는 양자화 하한에서 걸린다', () => {
		retrace('크기만 보면 Q4도 통과한다. 두 하한이 AND로 묶여 있어야 한다.', () => {
			expect(meetsFloors(460, 4)).toBe(false);
		});
	});

	it('하한값 자체는 통과다 (경계 포함)', () => {
		expect(meetsFloors(PARAM_FLOOR_B, QUANT_FLOOR_BITS)).toBe(true);
	});
});

// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e05-12-01-vram-budget/index.ts를 고쳐라.
//
// 12장의 판단 순서가 이 명세다:
//   ① 어떤 작업인가 → ② 그 작업에 쓸 모델의 Q5 기준 크기 → ③ KV 캐시 자리를 더한다
//   → ④ 그 합보다 큰 메모리를 고르되 바로 위 구간이 비어 있으면 더 사지 않는다
//
// 카탈로그는 12장이 관측한 "용량 공백"(37GB 다음이 82GB)을 본떠 만들었다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	EPSILON,
	kvCacheGb,
	requiredGb,
	screen,
	bestFit,
	upgradeVerdict,
	type ModelEntry,
	type Workload,
} from '../../src/e05-12-01-vram-budget';

const catalog: ModelEntry[] = [
	{ name: 'small-q4', quant: 4, weightsGb: 18, multimodal: true, mtpGb: 0.4 },
	{ name: 'small-q5', quant: 5, weightsGb: 22, multimodal: true, mtpGb: 0.4 },
	{ name: 'mid-q5-text', quant: 5, weightsGb: 37, multimodal: false, mtpGb: 0 },
	{ name: 'mid-q5', quant: 5, weightsGb: 37, multimodal: true, mtpGb: 1 },
	// ← 37 다음이 82. 이 사이가 비어 있다는 것이 12장의 관측이다.
	{ name: 'big-q5', quant: 5, weightsGb: 82, multimodal: true, mtpGb: 1 },
	{ name: 'huge-q5', quant: 5, weightsGb: 130, multimodal: true, mtpGb: 1 },
];

/** 동시 세션 4개 × 128K 컨텍스트 × 토큰당 8KB. */
const coding: Workload = {
	concurrentSessions: 4,
	maxContextTokens: 131_072,
	kvBytesPerToken: 8 * 1024,
	forCoding: true,
	useMtp: false,
};

describe('kvCacheGb — 빼먹으면 견적이 통째로 틀린다', () => {
	it('세션 × 컨텍스트 × 토큰당 바이트를 GB로 환산한다', () => {
		retrace(
			'4 × 131072 × 8192 바이트 = 4 GiB. 항 하나를 빠뜨리면 자릿수가 어긋난다.',
			() => {
				expect(kvCacheGb(coding)).toBeCloseTo(4, 6);
			},
		);
	});

	it('🔴 1GB는 1024³이다 — 10⁹으로 나누면 약 7% 적게 나온다', () => {
		retrace(
			'10억으로 나누면 4.295가 나온다. 그 7% 차이가 빠듯한 견적에서 로딩 실패를 만든다.',
			() => {
				expect(kvCacheGb(coding)).toBeLessThan(4.1);
			},
		);
	});

	it('세션이 늘면 선형으로 는다', () => {
		expect(kvCacheGb({ ...coding, concurrentSessions: 8 })).toBeCloseTo(8, 6);
	});

	it('세션이 0이면 0이다', () => {
		expect(kvCacheGb({ ...coding, concurrentSessions: 0 })).toBe(0);
	});
});

describe('requiredGb — 무엇을 더해야 하나', () => {
	const mid = catalog.find((m) => m.name === 'mid-q5')!;

	it('가중치 + KV 캐시', () => {
		expect(requiredGb(mid, coding)).toBeCloseTo(41, 6);
	});

	it('🔴 KV 캐시를 빼먹으면 가중치와 같아진다 — 그게 가장 흔한 실수다', () => {
		retrace(
			'12장: "KV 캐시 자리를 빼고 계산하면 항상 틀린다. 코딩 에이전트는 컨텍스트가 길어 그 자리가 크다."',
			() => {
				expect(requiredGb(mid, coding)).toBeGreaterThan(mid.weightsGb + EPSILON);
			},
		);
	});

	it('MTP를 쓰기로 했으면 그만큼 더 든다', () => {
		expect(requiredGb(mid, { ...coding, useMtp: true })).toBeCloseTo(42, 6);
	});

	it('MTP를 안 쓰면 동봉돼 있어도 안 더한다', () => {
		retrace(
			'파일에 들어 있는 것과 메모리에 올리는 것은 다르다. 11장: VRAM이 빠듯하면 ' +
				'속도를 위해 1GB를 쓰는 교환이 성립하지 않는다.',
			() => {
				expect(requiredGb(mid, { ...coding, useMtp: false })).toBeCloseTo(41, 6);
			},
		);
	});
});

describe('screen — 걸러내는 순서가 규정이다', () => {
	it('Q5 미만은 코딩 용도에서 탈락한다', () => {
		retrace(
			'12장: "Q4는 다 갖다 버려. Q4 쓰면 안 돼." 상수는 MIN_QUANT_FOR_CODING이다.',
			() => {
				const r = screen(catalog, coding, 200).find((c) => c.model.name === 'small-q4')!;
				expect(r.rejected).toBe('quant-too-low');
			},
		);
	});

	it('멀티모달이 아니면 코딩 용도에서 탈락한다', () => {
		retrace(
			'11장의 1차 필터. "스크린샷 던지기가 안 되는 게 바이브 코딩한테 나쁜 점"이다.',
			() => {
				const r = screen(catalog, coding, 200).find((c) => c.model.name === 'mid-q5-text')!;
				expect(r.rejected).toBe('no-multimodal');
			},
		);
	});

	it('메모리를 넘으면 탈락한다', () => {
		const r = screen(catalog, coding, 64).find((c) => c.model.name === 'big-q5')!;
		expect(r.rejected).toBe('out-of-memory');
	});

	it('🔴 판정 순서 — Q4이면서 텍스트 전용이어도 이유는 quant-too-low다', () => {
		retrace(
			'순서를 바꾸면 같은 모델의 탈락 이유가 달라진다. 12장이 Q5 하한을 1차 필터로 둔 것은 ' +
				'그것이 가장 싸게 판정되는 조건이기 때문이다 — 메모리 계산은 마지막이다.',
			() => {
				const odd: ModelEntry[] = [
					{ name: 'x', quant: 4, weightsGb: 500, multimodal: false, mtpGb: 0 },
				];
				expect(screen(odd, coding, 16)[0]!.rejected).toBe('quant-too-low');
			},
		);
	});

	it('코딩 용도가 아니면 Q5·멀티모달 조건이 안 걸린다', () => {
		retrace(
			'12장: "어떤 작업을 하는가 — 코딩·로그 분석이면 하한이 올라간다. 요약·분류면 내려간다."',
			() => {
				const summarize: Workload = { ...coding, forCoding: false };
				const r = screen(catalog, summarize, 200);
				expect(r.find((c) => c.model.name === 'small-q4')!.rejected).toBeNull();
				expect(r.find((c) => c.model.name === 'mid-q5-text')!.rejected).toBeNull();
			},
		);
	});

	it('통과한 후보의 rejected는 null이다 (false나 undefined가 아니다)', () => {
		const r = screen(catalog, coding, 200).find((c) => c.model.name === 'mid-q5')!;
		expect(r.rejected).toBeNull();
	});

	it('입력 순서를 유지하고 필요량도 함께 돌려준다', () => {
		const r = screen(catalog, coding, 200);
		expect(r.map((c) => c.model.name)).toEqual(catalog.map((m) => m.name));
		expect(r[1]!.requiredGb).toBeCloseTo(26, 6);
	});

	it('경계에서 딱 맞으면 통과다 — 부동소수 때문에 밀려나면 안 된다', () => {
		retrace(
			'필요량이 정확히 가용량과 같을 때 탈락시키면 견적이 한 칸씩 보수적으로 밀린다. ' +
				'EPSILON을 쓰라.',
			() => {
				const mid = catalog.find((m) => m.name === 'mid-q5')!;
				const need = requiredGb(mid, coding);
				const r = screen([mid], coding, need)[0]!;
				expect(r.rejected).toBeNull();
			},
		);
	});
});

describe('bestFit — 통과한 것 중 가장 큰 가중치', () => {
	it('64GB에서는 mid-q5가 최선이다', () => {
		expect(bestFit(catalog, coding, 64)?.name).toBe('mid-q5');
	});

	it('128GB로 올려도 여전히 big-q5까지다', () => {
		retrace(
			'12장의 핵심 관측. big-q5(82) + KV(4) = 86이라 128에 들어가지만, 그다음 칸인 ' +
				'huge-q5(130)는 안 들어간다. 그래서 "128기가에 돈 들여 봤자"가 된다.',
			() => {
				expect(bestFit(catalog, coding, 128)?.name).toBe('big-q5');
			},
		);
	});

	it('아무것도 안 들어가면 null이다', () => {
		expect(bestFit(catalog, coding, 8)).toBeNull();
	});

	it('총 필요량이 아니라 가중치로 고른다', () => {
		retrace(
			'MTP가 동봉돼 총량이 큰 모델이 가중치는 작을 수 있다. 같은 자리를 쓴다면 ' +
				'모델이 큰 쪽이 낫다.',
			() => {
				const pair: ModelEntry[] = [
					{ name: 'heavy-total', quant: 5, weightsGb: 30, multimodal: true, mtpGb: 5 },
					{ name: 'bigger-weights', quant: 5, weightsGb: 33, multimodal: true, mtpGb: 0 },
				];
				expect(bestFit(pair, { ...coding, useMtp: true }, 64)?.name).toBe('bigger-weights');
			},
		);
	});

	it('가중치가 같으면 카탈로그에서 먼저 나온 것', () => {
		const pair: ModelEntry[] = [
			{ name: 'first', quant: 5, weightsGb: 30, multimodal: true, mtpGb: 0 },
			{ name: 'second', quant: 5, weightsGb: 30, multimodal: true, mtpGb: 0 },
		];
		expect(bestFit(pair, coding, 64)?.name).toBe('first');
	});
});

describe('upgradeVerdict — 메모리를 늘리면 실익이 있나', () => {
	it('🔴 64 → 128은 실익이 있다 (big-q5가 열린다)', () => {
		const v = upgradeVerdict(catalog, coding, 64, 128);
		expect(v.worthIt).toBe(true);
		expect(v.unlocked).toEqual(['big-q5']);
	});

	it('🔴 128 → 256도 huge-q5 하나뿐이다 — 그 사이가 비어 있다', () => {
		retrace(
			'용량 공백은 "아무것도 안 열린다"로만 나타나지 않는다. "하나만 열린다"도 같은 신호다 — ' +
				'12장이 128GB를 애매하다고 부른 이유가 이것이다.',
			() => {
				const v = upgradeVerdict(catalog, coding, 128, 256);
				expect(v.unlocked).toEqual(['huge-q5']);
				expect(v.before).toBe(3);
				expect(v.after).toBe(4);
			},
		);
	});

	it('공백 구간에서는 아무것도 안 열린다', () => {
		retrace(
			'41(mid-q5+KV)과 86(big-q5+KV) 사이에는 모델이 없다. 그 구간에서 메모리를 사는 것은 ' +
				'그냥 돈을 쓰는 것이다.',
			() => {
				const v = upgradeVerdict(catalog, coding, 48, 80);
				expect(v.worthIt).toBe(false);
				expect(v.unlocked).toEqual([]);
				expect(v.before).toBe(v.after);
			},
		);
	});

	it('unlocked는 카탈로그 순서를 유지한다', () => {
		const v = upgradeVerdict(catalog, coding, 8, 256);
		expect(v.unlocked).toEqual(['small-q5', 'mid-q5', 'big-q5', 'huge-q5']);
	});

	it('줄이는 방향도 계산은 된다 (열리는 것이 없을 뿐)', () => {
		const v = upgradeVerdict(catalog, coding, 128, 64);
		expect(v.unlocked).toEqual([]);
		expect(v.after).toBeLessThan(v.before);
	});
});


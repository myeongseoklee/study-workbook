/**
 * 과제 05-01의 명세 — 히스토그램 분위수
 *
 * 이 파일이 과제의 정의다. `src/05-01-histogram-quantile/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/05-percentiles-and-histograms.md를 다시 읽어라.
 *
 * 실행: pnpm test 05-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	histogramQuantile,
	mergeBuckets,
	ratioWithin,
} from '../../src/05-01-histogram-quantile';
import type { Bucket } from '../../src/05-01-histogram-quantile';

/** 문서 § 손으로 해 보기와 같은 히스토그램. */
const DOC_BUCKETS: Bucket[] = [
	{ le: 0.1, count: 900 },
	{ le: 0.5, count: 980 },
	{ le: 1.0, count: 995 },
	{ le: Number.POSITIVE_INFINITY, count: 1000 },
];

describe('histogramQuantile — 선형 보간', () => {
	it('문서의 예시와 같은 값을 낸다 (p99 ≈ 0.833)', () => {
		retrace(
			'N=1000, rank=990. 990을 처음 넘는 버킷은 le=1.0(누적 995)이고, 구간 [0.5, 1.0]에 ' +
				'15건이 있다. 0.5 + 0.5 × (990-980)/15 = 0.8333…이다. ' +
				'분모를 995로 쓰면(누적을 그대로) 값이 크게 틀린다 — 구간 건수는 995-980이다.',
			() => {
				expect(histogramQuantile(0.99, DOC_BUCKETS)).toBeCloseTo(0.8333, 4);
			},
		);
	});

	it('첫 버킷 안에 분위수가 있으면 하한을 0으로 본다', () => {
		retrace(
			'rank=500이면 le=0.1 버킷(누적 900) 안이다. 그 버킷의 구간은 [0, 0.1]이므로 ' +
				'0 + 0.1 × 500/900 ≈ 0.0556이다. 이전 버킷이 없을 때 lower를 어떻게 잡는지가 함정이다.',
			() => {
				expect(histogramQuantile(0.5, DOC_BUCKETS)).toBeCloseTo(0.0556, 4);
			},
		);
	});

	it('경계 버킷에 정확히 걸리면 그 경계값을 낸다', () => {
		const buckets: Bucket[] = [
			{ le: 0.3, count: 990 },
			{ le: 1.0, count: 1000 },
			{ le: Number.POSITIVE_INFINITY, count: 1000 },
		];
		retrace(
			'rank = 0.99 × 1000 = 990이고 le=0.3 버킷의 누적이 정확히 990이다. ' +
				'이 경우 보간할 여지가 없이 0.3이다 — 이것이 "SLO 경계에 버킷 경계를 두라"는 규칙의 이득이다.',
			() => {
				expect(histogramQuantile(0.99, buckets)).toBeCloseTo(0.3, 10);
			},
		);
	});

	it('분위수가 마지막 유한 버킷을 넘어가면 그 유한 버킷의 상한을 낸다', () => {
		const buckets: Bucket[] = [
			{ le: 1.0, count: 900 },
			{ le: Number.POSITIVE_INFINITY, count: 1000 },
		];
		retrace(
			'rank=990은 +Inf 버킷 안이다. +Inf로 보간하려 하면 Infinity가 나오고 그래프가 깨진다. ' +
				'실제 값은 1.0보다 크다는 것만 알 수 있으므로, 알 수 있는 최대한인 1.0을 낸다.',
			() => {
				expect(histogramQuantile(0.99, buckets)).toBe(1.0);
			},
		);
	});

	it('정렬되지 않은 버킷 입력도 받는다', () => {
		const shuffled = [DOC_BUCKETS[2], DOC_BUCKETS[0], DOC_BUCKETS[3], DOC_BUCKETS[1]].filter(
			(b): b is Bucket => b !== undefined,
		);
		expect(histogramQuantile(0.99, shuffled)).toBeCloseTo(0.8333, 4);
	});

	it('+Inf 버킷이 없으면 null이다 — 전체 건수를 모르기 때문이다', () => {
		const noInf: Bucket[] = [
			{ le: 0.1, count: 900 },
			{ le: 1.0, count: 995 },
		];
		retrace(
			'마지막 유한 버킷의 카운트를 N으로 쓰면 1.0초를 넘은 요청이 존재하지 않는 것처럼 ' +
				'계산된다 — 즉 꼬리를 통째로 잘라내고 분위수를 구하는 것이다.',
			() => {
				expect(histogramQuantile(0.99, noInf)).toBeNull();
			},
		);
	});

	it('관측이 없으면 null이다', () => {
		expect(histogramQuantile(0.99, [{ le: Number.POSITIVE_INFINITY, count: 0 }])).toBeNull();
	});

	it('phi가 [0, 1] 밖이면 null이다', () => {
		expect(histogramQuantile(-0.1, DOC_BUCKETS)).toBeNull();
		expect(histogramQuantile(1.5, DOC_BUCKETS)).toBeNull();
	});
});

describe('ratioWithin — 보간하지 않는 정확한 비율', () => {
	it('경계가 존재하면 누적 ÷ 전체를 그대로 낸다', () => {
		expect(ratioWithin(0.5, DOC_BUCKETS)).toBeCloseTo(0.98, 10);
	});

	it('경계가 없으면 보간하지 않고 null을 낸다', () => {
		retrace(
			'0.3 경계가 없을 때 0.1과 0.5 사이를 보간해 "대략 0.96쯤"을 내놓으면, 그 짐작이 ' +
				'조용히 SLO 판정에 섞인다. 추정치를 내놓지 않고 결과 없음을 내는 편이 안전하다 — ' +
				'Prometheus도 같은 선택을 한다.',
			() => {
				expect(ratioWithin(0.3, DOC_BUCKETS)).toBeNull();
			},
		);
	});

	it('관측이 없으면 null이다', () => {
		expect(
			ratioWithin(0.5, [
				{ le: 0.5, count: 0 },
				{ le: Number.POSITIVE_INFINITY, count: 0 },
			]),
		).toBeNull();
	});
});

describe('mergeBuckets — 인스턴스 간 합산은 버킷에서만 가능하다', () => {
	it('같은 경계의 카운트를 더하고, 없는 경계는 만들어 채운다', () => {
		const a: Bucket[] = [
			{ le: 0.1, count: 10 },
			{ le: 1.0, count: 20 },
			{ le: Number.POSITIVE_INFINITY, count: 20 },
		];
		const b: Bucket[] = [
			{ le: 1.0, count: 5 },
			{ le: Number.POSITIVE_INFINITY, count: 8 },
		];
		retrace(
			'b에는 le=0.1이 없다. 누적 버킷에서 "없는 경계"는 0이 아니라 **더 작은 경계의 값**을 ' +
				'물려받아야 한다 — 여기서는 b에 0.1 이하 관측이 없으므로 0이 맞지만, 순서가 ' +
				'반대인 경우(a에 없고 b에 있는 상위 경계)를 같은 규칙으로 처리하는지 확인하라.',
			() => {
				expect(mergeBuckets([a, b])).toEqual([
					{ le: 0.1, count: 10 },
					{ le: 1.0, count: 25 },
					{ le: Number.POSITIVE_INFINITY, count: 28 },
				]);
			},
		);
	});

	it('합친 버킷의 p99는 개별 p99의 평균과 다르다', () => {
		// A: 빠른 인스턴스에 트래픽 대부분 / B: 느린 인스턴스에 소량
		const fast: Bucket[] = [
			{ le: 0.1, count: 9_900 },
			{ le: 1.0, count: 10_000 },
			{ le: Number.POSITIVE_INFINITY, count: 10_000 },
		];
		const slow: Bucket[] = [
			{ le: 0.1, count: 0 },
			{ le: 1.0, count: 10 },
			{ le: Number.POSITIVE_INFINITY, count: 10 },
		];
		const merged = mergeBuckets([fast, slow]);
		const trueP99 = histogramQuantile(0.99, merged);
		const fastP99 = histogramQuantile(0.99, fast) ?? 0;
		const slowP99 = histogramQuantile(0.99, slow) ?? 0;
		const avgOfP99 = (fastP99 + slowP99) / 2;

		retrace(
			'느린 인스턴스의 요청은 전체의 0.1%뿐이므로 전체 p99는 빠른 쪽에 거의 붙는다. ' +
				'그런데 avg(p99)는 두 값의 중간을 낸다 — 트래픽 배분을 모르는 연산이라 그렇다. ' +
				'이것이 avg(p99)를 쓰면 안 되는 이유이고, 틀린 것이 그래프상 보이지 않는 이유다.',
			() => {
				expect(trueP99).not.toBeNull();
				expect(trueP99 ?? 0).toBeLessThan(0.2);
				expect(avgOfP99).toBeGreaterThan(0.4);
			},
		);
	});

	it('빈 입력은 빈 배열이다', () => {
		expect(mergeBuckets([])).toEqual([]);
	});
});

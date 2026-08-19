/**
 * 과제 04-01의 명세 — RED 집계기
 *
 * 이 파일이 과제의 정의다. `src/04-01-red-aggregator/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/04-red-method.md를 다시 읽어라.
 *
 * 실행: pnpm test 04-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { aggregateRed, findMissingServices, percentile } from '../../src/04-01-red-aggregator';
import type { Span } from '../../src/04-01-red-aggregator';

function span(service: string, durationMs: number, failed = false): Span {
	return { service, durationMs, failed };
}

describe('percentile — 최근접 순위(nearest-rank) 방식', () => {
	it('정렬된 표본에서 순위 index = ceil(phi × n) - 1 위치의 값이다', () => {
		const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
		retrace(
			'p50에서 ceil(0.5 × 10) - 1 = 4 → xs[4] = 50이다. 6이 나왔다면 ceil 대신 round나 ' +
				'floor를 썼거나 -1을 빠뜨린 것이다 — off-by-one이 이 함수의 유일한 함정이다.',
			() => {
				expect(percentile(xs, 0.5)).toBe(50);
				expect(percentile(xs, 0.9)).toBe(90);
				expect(percentile(xs, 0.99)).toBe(100);
			},
		);
	});

	it('phi가 0이거나 표본이 1개면 첫 값이다', () => {
		expect(percentile([7, 8, 9], 0)).toBe(7);
		expect(percentile([42], 0.99)).toBe(42);
	});

	it('정렬되지 않은 입력도 받는다', () => {
		expect(percentile([50, 10, 30], 0.5)).toBe(30);
	});

	it('빈 표본은 null이다', () => {
		expect(percentile([], 0.99)).toBeNull();
	});
});

describe('aggregateRed — 서비스별 세 지표', () => {
	const spans = [
		span('order', 100),
		span('order', 200),
		span('order', 900, true),
		span('order', 150),
		span('payment', 50),
		span('payment', 60, true),
	];

	it('Rate는 창 길이로 나눈 초당 요청 수다', () => {
		const rows = aggregateRed(spans, 10);
		expect(rows.find((r) => r.service === 'order')?.rate).toBe(0.4);
		expect(rows.find((r) => r.service === 'payment')?.rate).toBe(0.2);
	});

	it('Errors와 errorRatio는 같은 스팬 집합에서 나온다', () => {
		const rows = aggregateRed(spans, 10);
		const order = rows.find((r) => r.service === 'order');
		retrace(
			'요청 수를 로드밸런서에서 세고 에러 수를 애플리케이션에서 세면 분모가 달라 ' +
				'에러율이 틀리고, 틀린 것이 그래프상 보이지 않는다. 두 값은 같은 관측 지점에서 나온다.',
			() => {
				expect(order?.errors).toBe(1);
				expect(order?.errorRatio).toBeCloseTo(0.25, 10);
			},
		);
	});

	it('Duration은 실패 스팬까지 포함한 p99다', () => {
		const rows = aggregateRed(spans, 10);
		retrace(
			'RED의 Duration은 "그 요청들이 걸린 시간"이다 — 소비자가 기다린 시간이므로 ' +
				'실패한 요청도 기다린 시간이 있다. Golden Signals의 성공/실패 분리는 ' +
				'감지 계층의 규율이고, RED 테이블은 서비스 비교용이라 하나의 값으로 둔다.',
			() => {
				expect(rows.find((r) => r.service === 'order')?.durationP99Ms).toBe(900);
			},
		);
	});

	it('행은 서비스명 사전순으로 정렬된다 — 심각도 순이 아니다', () => {
		const rows = aggregateRed(
			[span('zebra', 10), span('alpha', 10, true), span('mango', 10)],
			1,
		);
		retrace(
			'동형 대시보드는 순서가 흔들리면 눈이 위치를 기억할 수 없다. 심각도 순으로 정렬하면 ' +
				'행이 매 갱신마다 움직여서, "세 번째 줄이 결제 서비스"라는 감각이 생기지 않는다. ' +
				'심각도는 색으로 표시하고 위치는 고정한다.',
			() => {
				expect(rows.map((r) => r.service)).toEqual(['alpha', 'mango', 'zebra']);
			},
		);
	});

	it('스팬이 없으면 빈 배열이다', () => {
		expect(aggregateRed([], 10)).toEqual([]);
	});
});

describe('findMissingServices — 동형성이 깨진 곳을 찾는다', () => {
	it('기대 목록에 있는데 지표를 내지 않는 서비스를 사전순으로 낸다', () => {
		const rows = aggregateRed([span('order', 10), span('payment', 10)], 1);
		retrace(
			'RED의 값은 전면 적용에서 나온다. 절반만 계측하면 두 그룹을 비교할 수 없고, ' +
				'계측 안 된 서비스는 "요청이 0"과 구별되지 않는다 — 조용히 사라진다.',
			() => {
				expect(findMissingServices(rows, ['payment', 'order', 'ship', 'auth'])).toEqual([
					'auth',
					'ship',
				]);
			},
		);
	});

	it('전부 계측되어 있으면 빈 배열이다', () => {
		const rows = aggregateRed([span('order', 10)], 1);
		expect(findMissingServices(rows, ['order'])).toEqual([]);
	});
});

describe('랙(lag)은 RED에 나타나지 않는다 — 이 사실의 재현', () => {
	it('세 지표가 전부 건강해도 소비자가 뒤처질 수 있다', () => {
		// 컨슈머가 초당 1000건을 오류 없이 10ms에 처리한다
		const spans = Array.from({ length: 1000 }, () => span('consumer', 10));
		const rows = aggregateRed(spans, 1);
		const row = rows[0];

		retrace(
			'Rate 1000, Errors 0, Duration 10ms — 세 지표가 완벽하다. 그런데 프로듀서가 초당 ' +
				'5000건을 넣고 있으면 지체는 초당 4000건씩 커진다. RED는 요청-응답 모델 전용이고, ' +
				'큐 소비자에는 랙을 별도로 봐야 한다는 것이 이 계산이다.',
			() => {
				expect(row?.rate).toBe(1000);
				expect(row?.errors).toBe(0);
				expect(row?.durationP99Ms).toBe(10);
				// RED 어디에도 "프로듀서가 5000건을 넣는다"는 정보가 없다
				expect(Object.keys(row ?? {})).not.toContain('lag');
			},
		);
	});
});

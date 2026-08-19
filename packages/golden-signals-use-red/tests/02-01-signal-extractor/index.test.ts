/**
 * 과제 02-01의 명세 — 네 신호 추출기
 *
 * 이 파일이 과제의 정의다. `src/02-01-signal-extractor/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/02-golden-signals.md를 다시 읽어라.
 *
 * 실행: pnpm test 02-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { extractSignals } from '../../src/02-01-signal-extractor';
import type { RequestEvent } from '../../src/02-01-signal-extractor';

/** 요청 하나를 짧게 만드는 헬퍼. 테스트 의도만 남기고 잡음을 줄인다. */
function req(durationMs: number, status = 200, contentValid?: boolean): RequestEvent {
	return contentValid === undefined
		? { durationMs, status }
		: { durationMs, status, contentValid };
}

const OPTS = { windowMs: 10_000, latencySloMs: 1_000 };

describe('extractSignals — Traffic', () => {
	it('트래픽은 창 길이로 나눈 초당 요청 수다', () => {
		const events = Array.from({ length: 250 }, () => req(50));
		expect(extractSignals(events, { windowMs: 10_000, latencySloMs: 1_000 }).traffic).toBe(25);
	});

	it('요청이 없으면 트래픽은 0이고, 에러율도 0이다 (0으로 나누지 않는다)', () => {
		const s = extractSignals([], OPTS);
		retrace('0/0을 NaN으로 흘리면 대시보드의 그래프가 끊긴다. 빈 창은 정상 상태다.', () => {
			expect(s.traffic).toBe(0);
			expect(s.errorRate).toBe(0);
		});
	});
});

describe('extractSignals — 세 종류의 실패', () => {
	it('명시적 실패는 5xx다. 4xx는 실패로 세지 않는다', () => {
		const events = [req(10, 200), req(10, 400), req(10, 404), req(10, 500), req(10, 503)];
		const s = extractSignals(events, OPTS);
		retrace(
			'4xx는 클라이언트가 잘못 보낸 것이라 서비스의 실패가 아니다. ' +
				'4xx를 5xx와 함께 세면 봇 트래픽이 우리 에러율을 태운다.',
			() => {
				expect(s.errorCounts.explicit).toBe(2);
			},
		);
	});

	it('묵시적 실패는 성공 상태 코드인데 내용이 틀린 것이다', () => {
		const events = [req(10, 200, true), req(10, 200, false), req(10, 500, false)];
		const s = extractSignals(events, OPTS);
		retrace(
			'contentValid=false인데 status가 500이면 그것은 이미 명시적 실패다. ' +
				'묵시적 실패는 "성공으로 보이는데 틀린 것"만 뜻한다 — 2xx·3xx에만 성립한다.',
			() => {
				expect(s.errorCounts.implicit).toBe(1);
			},
		);
	});

	it('contentValid가 없으면 검증하지 않은 것이므로 묵시적 실패가 아니다', () => {
		const s = extractSignals([req(10, 200), req(10, 200)], OPTS);
		expect(s.errorCounts.implicit).toBe(0);
	});

	it('정책적 실패는 SLO를 초과한 요청이다 (경계값은 실패가 아니다)', () => {
		const events = [req(999), req(1_000), req(1_001), req(5_000)];
		const s = extractSignals(events, OPTS);
		retrace(
			'"1초 안에 응답"이라는 약속은 정확히 1000ms를 성공으로 본다. ' +
				'>= 로 쓰면 경계에 걸친 요청이 전부 실패로 뒤집힌다.',
			() => {
				expect(s.errorCounts.policy).toBe(2);
			},
		);
	});

	it('한 요청은 여러 범주에 동시에 해당할 수 있고, 범주별 카운트는 중복 계상된다', () => {
		// 5초 걸려서 500을 반환한 요청 하나 — 명시적이면서 정책적이다
		const s = extractSignals([req(5_000, 500)], OPTS);
		expect(s.errorCounts.explicit).toBe(1);
		expect(s.errorCounts.policy).toBe(1);
	});

	it('에러율은 범주 합이 아니라 실패한 요청의 비율이다 (중복 제거)', () => {
		// 요청 4건: 정상 / 느린 500(2범주) / 묵시적 실패 / 정상
		const events = [req(10, 200), req(5_000, 500), req(10, 200, false), req(10, 200)];
		const s = extractSignals(events, OPTS);
		retrace(
			'범주별 카운트를 그냥 더하면 explicit 1 + implicit 1 + policy 1 = 3/4 = 0.75가 나온다. ' +
				'실제로 실패한 요청은 2건이므로 0.5다. 중복 계상된 에러율은 1을 넘을 수도 있다.',
			() => {
				expect(s.errorRate).toBe(0.5);
			},
		);
	});
});

describe('extractSignals — 성공/실패 레이턴시 분리', () => {
	it('분리 기준은 전달 실패(명시적·묵시적)이며, 정책적 실패는 성공 쪽에 남는다', () => {
		const events = [
			req(20, 200), //  정상 → 성공
			req(5_000, 200), //  느리지만 응답은 정상 → 정책적 실패이지만 성공 레이턴시
			req(1, 503), //  빠른 실패 → 실패 레이턴시
			req(30, 200, false), //  묵시적 실패 → 실패 레이턴시
		];
		const s = extractSignals(events, OPTS);
		retrace(
			'정책적 실패까지 빼면 반대 방향의 왜곡이 생긴다 — 느린 요청만 골라 제외하므로 ' +
				'성공 레이턴시의 p99가 항상 SLO 이하로 보인다. 분리의 목적은 "빠른 실패가 ' +
				'레이턴시를 좋게 보이게 하는 것"을 막는 것이지, 느린 것을 숨기는 것이 아니다.',
			() => {
				expect(s.successLatencyMs).toEqual([20, 5_000]);
				expect(s.failureLatencyMs).toEqual([1, 30]);
			},
		);
	});

	it('레이턴시 배열은 오름차순으로 정렬되어 나온다 (분위수를 바로 뽑을 수 있게)', () => {
		const s = extractSignals([req(300), req(10), req(80)], OPTS);
		expect(s.successLatencyMs).toEqual([10, 80, 300]);
	});

	it('4xx는 실패로 세지 않으므로 성공 레이턴시에 남는다', () => {
		const s = extractSignals([req(7, 404)], OPTS);
		retrace(
			'4xx를 실패로 세지 않기로 했으면 레이턴시 분리에서도 일관되어야 한다. ' +
				'에러 카운트에서는 빼고 레이턴시에서는 빼면 두 지표가 서로 다른 모집단을 본다.',
			() => {
				expect(s.successLatencyMs).toEqual([7]);
				expect(s.failureLatencyMs).toEqual([]);
			},
		);
	});
});

describe('extractSignals — 빠른 실패가 만드는 왜곡의 재현', () => {
	it('실패를 섞으면 전체 레이턴시가 좋아 보인다 — 분리했을 때만 진실이 남는다', () => {
		// 정상 요청 10건은 500ms, 서킷 브레이커가 즉시 거부한 90건은 1ms
		const events = [
			...Array.from({ length: 10 }, () => req(500, 200)),
			...Array.from({ length: 90 }, () => req(1, 503)),
		];
		const s = extractSignals(events, OPTS);
		const mixedMean =
			[...s.successLatencyMs, ...s.failureLatencyMs].reduce((a, b) => a + b, 0) / 100;
		const successMean = s.successLatencyMs.reduce((a, b) => a + b, 0) / s.successLatencyMs.length;

		retrace(
			'섞은 평균은 50.9ms로 "빨라졌다"고 말하고, 성공만 본 평균은 500ms로 변화가 없다고 말한다. ' +
				'장애 중 레이턴시 그래프가 개선되는 것이 이 계산이다.',
			() => {
				expect(mixedMean).toBeLessThan(60);
				expect(successMean).toBe(500);
			},
		);
	});
});

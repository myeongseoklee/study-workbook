/**
 * 과제 08-01의 명세 — 인과 사슬 트리아지
 *
 * 이 파일이 과제의 정의다. `src/08-01-chain-triage/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/02-golden-signals.md § 인과 사슬과 docs/08-composing-the-three.md를
 * 다시 읽어라.
 *
 * 실행: pnpm test 08-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { detectFirstMove, triage } from '../../src/08-01-chain-triage';
import type { SignalSeries } from '../../src/08-01-chain-triage';

/** 평탄한 기준선 뒤에 지정 인덱스부터 값이 뛰는 시계열을 만든다. */
function series(length: number, base: number, spikeFrom: number | null, spikeTo: number): number[] {
	return Array.from({ length }, (_, i) =>
		spikeFrom !== null && i >= spikeFrom ? spikeTo : base,
	);
}

/** 네 신호가 전부 평탄한 시계열. 필요한 것만 덮어쓴다. */
function flat(over: Partial<SignalSeries> = {}): SignalSeries {
	return {
		traffic: series(12, 100, null, 0),
		saturation: series(12, 0.3, null, 0),
		latencyP99: series(12, 200, null, 0),
		errorRate: series(12, 0.001, null, 0),
		...over,
	};
}

describe('detectFirstMove — 기준선 대비 첫 이탈 시점', () => {
	it('기준선 구간 뒤에서 μ + kσ를 처음 넘는 인덱스를 낸다', () => {
		const s = [10, 11, 9, 10, 10, 11, 9, 10, 60, 60];
		retrace(
			'기준선은 앞 baselineCount개로만 만든다. 전체 평균을 쓰면 스파이크가 기준선을 ' +
				'끌어올려 자기 자신을 정상으로 만든다 — 큰 이상일수록 감지가 어려워지는 역전이 생긴다.',
			() => {
				expect(detectFirstMove(s, 8, 3)).toBe(8);
			},
		);
	});

	it('기준선 구간 안의 값은 판정 대상이 아니다', () => {
		const s = [10, 99, 9, 10, 10, 10];
		retrace(
			'인덱스 1의 99는 기준선을 만드는 데 쓰인 값이다. 기준선 자체를 이상으로 판정하면 ' +
				'무엇과 비교하는지가 순환한다.',
			() => {
				expect(detectFirstMove(s, 4, 3)).toBeNull();
			},
		);
	});

	it('이탈이 없으면 null이다', () => {
		expect(detectFirstMove(series(12, 100, null, 0), 6, 3)).toBeNull();
	});

	it('기준선의 표준편차가 0이면 평균보다 크기만 하면 이탈이다', () => {
		const s = [50, 50, 50, 50, 50, 51];
		retrace(
			'σ=0이면 μ + kσ = μ가 되어 "평균보다 크면 이탈"이 된다. 이 처리를 빼면 완전히 ' +
				'평탄한 기준선에서 어떤 변화도 감지되지 않는다 — 합성 부하나 저트래픽 환경에서 실제로 생긴다. ' +
				'경계는 > μ이므로 50은 이탈이 아니다.',
			() => {
				expect(detectFirstMove(s, 5, 3)).toBe(5);
				expect(detectFirstMove([50, 50, 50, 50, 50, 50], 5, 3)).toBeNull();
			},
		);
	});

	it('하강은 이탈로 보지 않는다 — 네 신호 모두 상승이 이상이다', () => {
		const s = [100, 100, 100, 100, 1, 1];
		expect(detectFirstMove(s, 4, 3)).toBeNull();
	});

	it('기준선이 시계열보다 길면 null이다', () => {
		expect(detectFirstMove([1, 2], 5, 3)).toBeNull();
	});
});

describe('triage — 처음 움직인 신호가 원인 방향이다', () => {
	it('Traffic이 먼저 튀고 사슬을 따라 전파되면 과부하다', () => {
		const s = flat({
			traffic: series(12, 100, 6, 900),
			saturation: series(12, 0.3, 7, 0.97),
			latencyP99: series(12, 200, 8, 3_000),
			errorRate: series(12, 0.001, 9, 0.4),
		});
		const t = triage(s);
		expect(t.origin).toBe('overload');
		expect(t.firstMoved).toBe('traffic');
		expect(t.movedAtIndex).toBe(6);
		expect(t.action).toBe('scale-out');
	});

	it('Traffic은 그대로인데 Saturation이 먼저 오르면 처리 능력이 줄어든 것이다', () => {
		const s = flat({
			saturation: series(12, 0.3, 6, 0.95),
			latencyP99: series(12, 200, 7, 2_000),
		});
		const t = triage(s);
		retrace(
			'부하는 그대로인데 포화가 올랐다면 μ가 떨어진 것이다 — 배포, 인스턴스 축소, ' +
				'이웃 워크로드의 자원 침범. 스케일 아웃이 답일 수도 있지만 먼저 무엇이 바뀌었는지 본다.',
			() => {
				expect(t.origin).toBe('capacity-loss');
				expect(t.action).toBe('check-recent-change');
			},
		);
	});

	it('Traffic·Saturation 정상인데 Latency가 오르면 우리 자원 밖이다', () => {
		const s = flat({
			latencyP99: series(12, 200, 6, 2_500),
			errorRate: series(12, 0.001, 8, 0.2),
		});
		const t = triage(s);
		expect(t.origin).toBe('dependency');
		expect(t.action).toBe('check-dependencies');
	});

	it('Errors만 튀면 사슬 밖이고, 스케일 아웃을 권하지 않는다', () => {
		const s = flat({ errorRate: series(12, 0.001, 6, 0.35) });
		const t = triage(s);
		retrace(
			'트래픽 증가 없는 에러 급증은 부하 문제가 아니라는 강한 신호다 — 배포, DB 데드락, ' +
				'외부 API 장애, 인증 만료. 이때 스케일 아웃하면 실패하는 요청을 더 많이 만든다. ' +
				'사슬을 무조건 적용하면 이 경우를 과부하로 오진한다.',
			() => {
				expect(t.origin).toBe('off-chain');
				expect(t.firstMoved).toBe('errors');
				expect(t.action).toBe('check-deploy-and-locks');
				expect(t.action).not.toBe('scale-out');
			},
		);
	});

	it('아무 신호도 움직이지 않으면 none이다', () => {
		const t = triage(flat());
		expect(t).toEqual({
			origin: 'none',
			firstMoved: null,
			movedAtIndex: null,
			action: 'none',
		});
	});

	it('같은 인덱스에서 여러 신호가 움직이면 사슬 앞쪽이 원인이다', () => {
		const s = flat({
			traffic: series(12, 100, 7, 900),
			saturation: series(12, 0.3, 7, 0.95),
			errorRate: series(12, 0.001, 7, 0.3),
		});
		retrace(
			'해상도가 거칠면 여러 신호가 같은 버킷에서 튄다. 그때 사슬 순서 ' +
				'(traffic → saturation → latency → errors)가 동점을 가른다 — 뒤쪽을 골라 버리면 ' +
				'전파의 끝을 원인으로 지목한다.',
			() => {
				expect(triage(s).firstMoved).toBe('traffic');
			},
		);
	});

	it('임계 배수를 올리면 같은 데이터에서 감지가 사라진다 — 파라미터가 판정을 바꾼다', () => {
		// 기준선에 약간의 흔들림이 있어야 sigma가 실제로 작동한다 (σ ≈ 8.2e-5)
		const s = flat({
			errorRate: [0.001, 0.0011, 0.0009, 0.001, 0.0011, 0.0009, 0.0012, 0.0012],
		});
		retrace(
			'작은 흔들림은 sigma 값에 따라 이상이거나 정상이다. 트리아지 결과를 사실로 읽기 ' +
				'전에 어떤 파라미터로 나온 판정인지 봐야 한다는 뜻이다.',
			() => {
				expect(triage(s, { baselineCount: 6, sigma: 1 }).origin).toBe('off-chain');
				expect(triage(s, { baselineCount: 6, sigma: 50 }).origin).toBe('none');
			},
		);
	});
});

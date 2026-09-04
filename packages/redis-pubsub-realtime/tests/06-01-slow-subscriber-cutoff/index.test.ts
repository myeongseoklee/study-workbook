/**
 * 과제 06-01의 명세: 느린 구독자의 강제 종료 판정
 *
 * 이 파일이 과제의 정의입니다. `src/06-01-slow-subscriber-cutoff/index.ts`를 채워서
 * 여기를 통과시키십시오.
 *
 * **이 파일은 고치지 않는다**가 이 명세의 규칙입니다. 명세를 고쳐서 통과시키는 것은
 * 과제를 푸는 것이 아닙니다. 고쳐야 할 것 같다고 느껴진다면 구현이 아니라 이해가
 * 틀렸을 가능성을 먼저 의심하십시오. `docs/06-operations-and-failure.md`의
 * 「hard 판정과 soft 판정은 규칙이 다르다」 절을 다시 읽으십시오.
 *
 * **이 명세의 전제**: 판정은 표본 지점에서만 일어납니다. 표본과 표본 사이에 버퍼가
 * 어떻게 변했는지는 관측되지 않았으므로 보간하거나 추정하지 않습니다. 예를 들어
 * 0초와 100초 두 표본만 주어졌다면, 그 사이의 어느 시점에 버퍼가 한계를 넘었는지는
 * 알 수 없으므로 판정 시각의 후보는 0초와 100초뿐입니다.
 *
 * **범위 밖**: `softBytes`가 0이 아니면서 `softSeconds`만 0인 설정은 이 과제가 판정하지
 * 않습니다. 구간이 시작되는 첫 표본을 그 자리에서 끊어야 하는지를 공식 문서로 확인하지
 * 못했으므로, 확인하지 않은 동작을 명세로 못박지 않습니다. 그 설정을 어떻게 다루든
 * 이 명세의 통과 여부는 달라지지 않으니 고민하지 말고 넘어가십시오.
 *
 * 실행: pnpm test 06-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { PUBSUB_DEFAULT_LIMIT, evaluateCutoff } from '../../src/06-01-slow-subscriber-cutoff';
import type { BufferLimit, Sample } from '../../src/06-01-slow-subscriber-cutoff';

const MB = 1024 * 1024;

/** 표본 하나를 짧게 적기 위한 헬퍼입니다. 시험의 의도만 남기고 잡음을 줄입니다. */
function at(atSeconds: number, omemBytes: number): Sample {
	return { atSeconds, omemBytes };
}

/** 시험마다 값을 바꾸어 쓰는 한계 설정입니다. 기본값은 pubsub 클래스와 같게 잡았습니다. */
function limit(overrides: Partial<BufferLimit> = {}): BufferLimit {
	return { hardBytes: 32 * MB, softBytes: 8 * MB, softSeconds: 60, ...overrides };
}

describe('PUBSUB_DEFAULT_LIMIT: 기본값이 실제 판정에 쓰인다', () => {
	it('hard 기본값은 정확히 32MB이고, 그 경계가 판정에서 실제로 작동한다', () => {
		expect(PUBSUB_DEFAULT_LIMIT.hardBytes).toBe(32 * MB);

		retrace(
			'32MB는 32 * 1024 * 1024바이트입니다. 32 * 1000 * 1000으로 계산하면 경계가 약 174만 바이트만큼 ' +
				'낮아지고, 경계를 정확히 짚는 이 시험만 조용히 어긋납니다.',
			() => {
				expect(evaluateCutoff([at(4, 32 * MB)], PUBSUB_DEFAULT_LIMIT)).toEqual({
					disconnected: true,
					atSeconds: 4,
					reason: 'hard',
				});
				expect(evaluateCutoff([at(4, 32 * MB - 1)], PUBSUB_DEFAULT_LIMIT)).toEqual({
					disconnected: false,
				});
			},
		);
	});

	it('soft 기본값은 정확히 8MB이고 유지 시간은 60초이며, 그 두 값이 판정에서 실제로 작동한다', () => {
		expect(PUBSUB_DEFAULT_LIMIT.softBytes).toBe(8 * MB);
		expect(PUBSUB_DEFAULT_LIMIT.softSeconds).toBe(60);

		const onTheLine = [at(0, 8 * MB), at(60, 8 * MB)];
		const justBelow = [at(0, 8 * MB - 1), at(600, 8 * MB - 1)];

		retrace(
			'soft limit은 「도달하면」 재기 시작하는 값이므로 한계와 정확히 같은 값도 구간을 시작시킵니다. ' +
				'비교를 `>`로 쓰면 경계에 정확히 붙어 있는 구독자를 영원히 놓칩니다. 반대로 8MB보다 ' +
				'1바이트 적은 상태는 10분을 유지해도 판정 대상이 아닙니다.',
			() => {
				expect(evaluateCutoff(onTheLine, PUBSUB_DEFAULT_LIMIT)).toEqual({
					disconnected: true,
					atSeconds: 60,
					reason: 'soft',
				});
				expect(evaluateCutoff(justBelow, PUBSUB_DEFAULT_LIMIT)).toEqual({ disconnected: false });
			},
		);
	});
});

describe('hard 판정: 도달하면 즉시 끊는다', () => {
	it('hard 판정은 유지 시간을 보지 않는다: 표본 하나만으로도 그 시각에 끊긴다', () => {
		expect(evaluateCutoff([at(7, 40 * MB)], limit())).toEqual({
			disconnected: true,
			atSeconds: 7,
			reason: 'hard',
		});
	});

	it('hardBytes와 정확히 같은 값도 끊는다: 비교는 초과가 아니라 이상이다', () => {
		retrace(
			'설정 파일의 주석은 hard limit에 「도달하면」 끊는다고 규정합니다. 그러므로 한계와 정확히 같은 ' +
				'값은 이미 도달한 것입니다. 부등호를 `>`로 쓰면 이 시험만 실패합니다.',
			() => {
				expect(evaluateCutoff([at(3, 20 * MB)], limit({ hardBytes: 20 * MB }))).toEqual({
					disconnected: true,
					atSeconds: 3,
					reason: 'hard',
				});
			},
		);
	});

	it('한계에 못 미치면 끊지 않으며, 그때는 atSeconds와 reason이 없다', () => {
		const verdict = evaluateCutoff([at(0, 1 * MB), at(30, 7 * MB), at(90, 2 * MB)], limit());
		expect(verdict.disconnected).toBe(false);
		retrace(
			'끊기지 않은 판정에 시각이나 사유를 채워 두면, 호출한 쪽이 `verdict.reason`만 보고 ' +
				'끊긴 것으로 오해합니다. 끊기지 않았다는 사실은 두 값이 비어 있는 것으로 표현합니다.',
			() => {
				expect(verdict.atSeconds).toBeUndefined();
				expect(verdict.reason).toBeUndefined();
			},
		);
	});
});

describe('soft 판정: 연속으로 유지된 시간을 잰다', () => {
	it('soft 이상인 상태가 유지되면 그 조건을 처음 만족한 표본의 시각에 끊긴다', () => {
		const samples = [at(0, 9 * MB), at(30, 9 * MB), at(61, 9 * MB), at(90, 9 * MB)];
		expect(evaluateCutoff(samples, limit())).toEqual({
			disconnected: true,
			atSeconds: 61,
			reason: 'soft',
		});
	});

	it('경과 시간이 softSeconds와 정확히 같을 때 끊긴다: 비교는 초과가 아니라 이상이다', () => {
		retrace(
			'60초를 「채우면」 끊는 규칙이므로 차이가 정확히 60일 때 이미 성립합니다. 경과 시간 비교를 ' +
				'`>`로 쓰면 60초 표본을 넘기고 그다음 표본에서야 끊는 판정이 되어, 판정 시각이 뒤로 밀립니다.',
			() => {
				expect(evaluateCutoff([at(0, 9 * MB), at(60, 9 * MB)], limit())).toEqual({
					disconnected: true,
					atSeconds: 60,
					reason: 'soft',
				});
			},
		);
	});

	it('경과 시간이 softSeconds에 1초 못 미치면 끊지 않는다', () => {
		expect(evaluateCutoff([at(0, 9 * MB), at(59, 9 * MB)], limit())).toEqual({
			disconnected: false,
		});
	});

	it('첫 표본부터 soft 이상이면 그 표본이 구간의 시작이다: 관측 시각 자체를 경과 시간으로 쓰지 않는다', () => {
		const samples = [at(100, 9 * MB), at(150, 9 * MB), at(160, 9 * MB)];
		retrace(
			'구간의 시작은 관측을 시작한 시각이 아니라 버퍼가 soft limit에 도달한 첫 표본의 시각입니다. ' +
				'`atSeconds`를 그대로 경과 시간으로 쓰면 100초 표본에서 이미 60초를 넘긴 것으로 계산되어, ' +
				'관측을 늦게 시작했다는 이유만으로 멀쩡한 구독자를 끊게 됩니다.',
			() => {
				expect(evaluateCutoff(samples, limit())).toEqual({
					disconnected: true,
					atSeconds: 160,
					reason: 'soft',
				});
			},
		);
	});
});

describe('연속과 누적의 구별: 이 과제에서 가장 자주 틀리는 지점이다', () => {
	it('중간에 soft 아래로 내려가면 경과 시간이 초기화된다: 누적이었다면 끊겼을 입력이 끊기지 않는다', () => {
		// soft 이상이었던 구간은 0초부터 50초까지(50초)와 60초부터 100초까지(40초)입니다.
		const samples = [at(0, 9 * MB), at(50, 9 * MB), at(51, 1 * MB), at(60, 9 * MB), at(100, 9 * MB)];
		retrace(
			'soft 이상이었던 시간을 모두 더하면 50 + 40 = 90초가 되어 60초를 넘깁니다. 그러나 규칙은 ' +
				'누적이 아니라 연속입니다. 51초 표본에서 버퍼가 1MB로 내려갔으므로 그때까지의 경과 시간은 ' +
				'사라지고, 두 번째 구간은 40초밖에 되지 않아 아직 끊을 조건이 아닙니다. 누적으로 세면 ' +
				'잠깐씩 튀는 정상 구독자를 끊게 됩니다.',
			() => {
				expect(evaluateCutoff(samples, limit())).toEqual({ disconnected: false });
			},
		);
	});

	it('초기화된 뒤 다시 올라가면 그 시점부터 처음부터 다시 세고, 거기서 60초를 채우면 끊긴다', () => {
		// 두 번째 구간은 40초에 시작하므로 100초 표본에서 정확히 60초를 채웁니다.
		const samples = [at(0, 9 * MB), at(30, 1 * MB), at(40, 9 * MB), at(70, 9 * MB), at(100, 9 * MB)];
		retrace(
			'구간의 시작을 갱신하지 않으면 70초 표본에서 0초를 기준으로 70초가 경과한 것으로 계산되어 ' +
				'거기서 끊는 판정이 나옵니다. 올바른 기준은 다시 올라간 40초이므로, 끊기는 시각은 100초입니다.',
			() => {
				expect(evaluateCutoff(samples, limit())).toEqual({
					disconnected: true,
					atSeconds: 100,
					reason: 'soft',
				});
			},
		);
	});
});

describe('판정의 우선순위와 순서', () => {
	it('같은 표본에서 hard와 soft가 모두 성립하면 사유는 hard다', () => {
		// 0초부터 soft 이상이 유지된 채로, 60초 표본에서 hard limit에도 도달했습니다.
		const samples = [at(0, 10 * MB), at(60, 32 * MB)];
		retrace(
			'같은 표본에서 두 조건이 겹치면 즉시 끊는 쪽이 사유입니다. Redis가 그 클라이언트를 끊은 ' +
				'직접적인 이유가 hard limit 도달이기 때문이며, 사유를 soft로 적으면 운영자가 유지 시간을 ' +
				'늘리는 방향으로 잘못된 처방을 하게 됩니다.',
			() => {
				expect(evaluateCutoff(samples, limit())).toEqual({
					disconnected: true,
					atSeconds: 60,
					reason: 'hard',
				});
			},
		);
	});

	it('조건이 여러 표본에서 성립하면 가장 이른 시각의 판정을 돌려준다', () => {
		// 60초에 soft 조건이 먼저 성립하고, 70초에 hard 조건이 뒤이어 성립합니다.
		const samples = [at(0, 9 * MB), at(60, 9 * MB), at(70, 40 * MB)];
		retrace(
			'hard를 전체 표본에서 먼저 훑고 나서 soft를 보면 70초의 hard가 답으로 나옵니다. 그러나 연결은 ' +
				'60초에 이미 끊어졌고, 끊긴 뒤에는 버퍼가 40MB까지 자랄 일도 없습니다. 표본을 시각 순서대로 ' +
				'한 번만 훑으면서 처음 성립하는 조건에서 멈추십시오.',
			() => {
				expect(evaluateCutoff(samples, limit())).toEqual({
					disconnected: true,
					atSeconds: 60,
					reason: 'soft',
				});
			},
		);
	});

	it('판정이 확정된 뒤의 표본은 보지 않는다: 이후에 버퍼가 회복해도 결과는 그대로다', () => {
		const samples = [at(10, 40 * MB), at(20, 0)];
		retrace(
			'끝까지 훑으면서 마지막 상태로 결과를 덮어쓰면 회복한 것처럼 보입니다. 그러나 10초에 연결이 ' +
				'닫혔으므로 그 뒤의 관측은 이미 다른 이야기입니다.',
			() => {
				expect(evaluateCutoff(samples, limit())).toEqual({
					disconnected: true,
					atSeconds: 10,
					reason: 'hard',
				});
			},
		);
	});
});

describe('한계 해제: 값이 0이면 그 한계는 적용하지 않는다', () => {
	it('hardBytes가 0이면 아무리 큰 값이 와도 hard로 끊지 않으며, soft 판정은 그대로 살아 있다', () => {
		const disabledHard = limit({ hardBytes: 0 });
		retrace(
			'0을 한계값으로 그대로 비교하면 「0 이상」이 항상 참이라서 첫 표본에서 무조건 끊는 판정이 ' +
				'나옵니다. 0은 가장 낮은 한계가 아니라 한계가 없다는 뜻이므로, 비교하기 전에 해제 여부를 ' +
				'먼저 가려내야 합니다.',
			() => {
				expect(evaluateCutoff([at(0, 100 * MB), at(30, 100 * MB)], disabledHard)).toEqual({
					disconnected: false,
				});
				expect(evaluateCutoff([at(0, 100 * MB), at(60, 100 * MB)], disabledHard)).toEqual({
					disconnected: true,
					atSeconds: 60,
					reason: 'soft',
				});
			},
		);
	});

	it('softBytes가 0이면 soft 판정을 하지 않으며, hard 판정은 그대로 살아 있다', () => {
		const disabledSoft = limit({ softBytes: 0 });
		const longAndHigh = [at(0, 31 * MB), at(600, 31 * MB), at(1_200, 31 * MB)];
		expect(evaluateCutoff(longAndHigh, disabledSoft)).toEqual({ disconnected: false });
		expect(evaluateCutoff([...longAndHigh, at(1_300, 32 * MB)], disabledSoft)).toEqual({
			disconnected: true,
			atSeconds: 1_300,
			reason: 'hard',
		});
	});

	it('둘 다 0이면(normal 클래스의 기본값) 어떤 표본이 와도 끊지 않는다', () => {
		const normalClass: BufferLimit = { hardBytes: 0, softBytes: 0, softSeconds: 0 };
		retrace(
			'redis.conf의 normal 클래스 기본값이 이 설정이며, 일반 클라이언트에는 사실상 한계가 없다는 ' +
				'뜻입니다. pubsub 클래스에만 한계가 붙어 있는 이유는 구독자가 데이터를 밀어 넣는 방식으로 ' +
				'받기 때문입니다.',
			() => {
				expect(evaluateCutoff([at(0, 1_000 * MB), at(3_600, 1_000 * MB)], normalClass)).toEqual({
					disconnected: false,
				});
			},
		);
	});
});

describe('입력의 경계', () => {
	it('표본이 하나도 없으면 끊기지 않는다', () => {
		expect(evaluateCutoff([], limit())).toEqual({ disconnected: false });
	});
});

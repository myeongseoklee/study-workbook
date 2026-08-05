/**
 * 과제 7-1의 명세 — CloudWatch 알람 상태 평가기
 *
 * 이 파일이 과제의 정의다. `src/07-01-alarm-eval/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 docs/07-observability.md § TreatMissingData를 다시 읽어라.
 *
 * 핵심 검증 데이터는 AWS 공식 문서의 알람 평가 예시 표를 그대로 옮긴 것이다.
 * (docs/99-references.md → "알람의 결손 데이터 처리")
 *
 * 실행: pnpm test 07-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	evaluateAlarm,
	type AlarmState,
	type Datapoint,
	type MissingDataTreatment,
} from '../../src/07-01-alarm-eval';

/** '0 - X - X' 표기를 데이터 포인트 배열로. 왼쪽이 오래된 것, 오른쪽이 최신. */
function dp(pattern: string): Datapoint[] {
	return pattern
		.trim()
		.split(/\s+/)
		.map((c) => (c === '0' ? 'ok' : c === 'X' ? 'breach' : 'missing'));
}

const TREATMENTS: MissingDataTreatment[] = ['missing', 'ignore', 'breaching', 'notBreaching'];

describe('기본값', () => {
	it('⭐ treatMissingData 기본값은 missing — 전부 결손이면 INSUFFICIENT_DATA', () => {
		retrace(
			'INSUFFICIENT_DATA는 ALARM이 아니라서 알람 액션이 발동하지 않는다. ' +
				'즉 태스크 전멸처럼 지표가 멈추는 최악의 상황에서 기본값은 조용하다.',
			() => {
				expect(evaluateAlarm(dp('- - -'), { evaluationPeriods: 3, datapointsToAlarm: 3 })).toBe('INSUFFICIENT_DATA');
			},
		);
	});

	it('datapointsToAlarm을 생략하면 M = N이 된다', () => {
		retrace('M을 1로 기본값 두면 훨씬 민감해져 정상 배포에도 알람이 울린다', () => {
			expect(evaluateAlarm(dp('X X 0'), { evaluationPeriods: 3 })).toBe('OK');
			expect(evaluateAlarm(dp('X X X'), { evaluationPeriods: 3 })).toBe('ALARM');
		});
	});
});

describe('실제 데이터가 N개 이상이면 결손 설정을 쓰지 않는다', () => {
	it('⭐ breaching이어도 실제 데이터가 충분하면 그것으로 판정한다', () => {
		retrace(
			'문서가 명시하는 규칙이다. 이걸 빠뜨리면 breaching이 결손만 보고 항상 알람을 울려 ' +
				'"결손을 나쁘게 본다"가 "데이터가 좀 빠지면 무조건 알람"이 된다.',
			() => {
				expect(
					evaluateAlarm(dp('0 0 0 - -'), { evaluationPeriods: 3, datapointsToAlarm: 3, treatMissingData: 'breaching' }),
				).toBe('OK');
			},
		);
	});

	it('최신 N개만 본다 — 오래된 위반은 평가 범위 밖으로 밀려난다', () => {
		expect(
			evaluateAlarm(dp('X X X 0 0 0'), { evaluationPeriods: 3, datapointsToAlarm: 1, treatMissingData: 'breaching' }),
		).toBe('OK');
	});
});

/**
 * 공식 문서 표의 한 행을 네 옵션 모두에 대해 검증한다.
 *
 * N과 M을 이름으로 받는다 — 위치 인자로 두면 "M out of N"이라는 관용 표현과
 * 순서가 뒤집혀 호출부에서 바꿔 넣기 쉽다.
 */
function tableRow(
	pattern: string,
	{ n, m }: { n: number; m: number },
	expected: Record<MissingDataTreatment, AlarmState>,
): void {
	for (const treatMissingData of TREATMENTS) {
		it(`[${pattern}] ${treatMissingData} → ${expected[treatMissingData]}`, () => {
			expect(
				evaluateAlarm(dp(pattern), { evaluationPeriods: n, datapointsToAlarm: m, treatMissingData }),
			).toBe(expected[treatMissingData]);
		});
	}
}

describe('공식 문서 표 1 — M = N = 3 (평가 범위 5)', () => {
	tableRow('0 - X - X', { n: 3, m: 3 }, { missing: 'OK', ignore: 'OK', breaching: 'OK', notBreaching: 'OK' });
	tableRow('0 - - - -', { n: 3, m: 3 }, { missing: 'OK', ignore: 'OK', breaching: 'OK', notBreaching: 'OK' });
	tableRow('- - - - -', { n: 3, m: 3 }, {
		missing: 'INSUFFICIENT_DATA',
		ignore: 'RETAIN',
		breaching: 'ALARM',
		notBreaching: 'OK',
	});
	tableRow('0 X X - X', { n: 3, m: 3 }, { missing: 'ALARM', ignore: 'ALARM', breaching: 'ALARM', notBreaching: 'ALARM' });

	// 표의 마지막 행 `- - X - -`은 문서의 "premature alarm state" 특수 규칙에 해당한다.
	// 그 규칙은 과제 범위 밖이라(src 파일 상단에 명시) 규칙과 무관한 두 옵션만 검사한다.
	it('[- - X - -] breaching → ALARM (채운 결손 2개 + 실제 위반 1개)', () => {
		expect(evaluateAlarm(dp('- - X - -'), { evaluationPeriods: 3, datapointsToAlarm: 3, treatMissingData: 'breaching' })).toBe('ALARM');
	});

	it('[- - X - -] notBreaching → OK', () => {
		expect(evaluateAlarm(dp('- - X - -'), { evaluationPeriods: 3, datapointsToAlarm: 3, treatMissingData: 'notBreaching' })).toBe('OK');
	});
});

describe('공식 문서 표 2 — M = 2, N = 3 ("2 out of 3" 알람)', () => {
	tableRow('0 - X - X', { n: 3, m: 2 }, { missing: 'ALARM', ignore: 'ALARM', breaching: 'ALARM', notBreaching: 'ALARM' });
	tableRow('0 0 X 0 X', { n: 3, m: 2 }, { missing: 'ALARM', ignore: 'ALARM', breaching: 'ALARM', notBreaching: 'ALARM' });
	tableRow('0 - X - -', { n: 3, m: 2 }, { missing: 'OK', ignore: 'OK', breaching: 'ALARM', notBreaching: 'OK' });
	tableRow('- - - - 0', { n: 3, m: 2 }, { missing: 'OK', ignore: 'OK', breaching: 'ALARM', notBreaching: 'OK' });
});

describe('ignore 옵션의 경계', () => {
	it('전부 결손일 때만 현재 상태를 유지한다', () => {
		expect(evaluateAlarm(dp('- - - - -'), { evaluationPeriods: 3, datapointsToAlarm: 3, treatMissingData: 'ignore' })).toBe('RETAIN');
	});

	it('실제 데이터가 하나라도 있으면 그것으로 판정한다', () => {
		retrace(
			'결손이 있으면 항상 RETAIN을 내는 구현이면 여기서 틀린다. ' +
				"'ignore'는 판단할 실제 데이터가 전혀 없을 때만 현재 상태를 유지한다.",
			() => {
				expect(evaluateAlarm(dp('- - - - 0'), { evaluationPeriods: 3, datapointsToAlarm: 3, treatMissingData: 'ignore' })).toBe('OK');
			},
		);
	});
});

describe('학습 대상 템플릿의 알람 세 개', () => {
	describe('① healthy 호스트 0 — 2/2, breaching (연속 지표)', () => {
		const config = { evaluationPeriods: 2, datapointsToAlarm: 2, treatMissingData: 'breaching' as const };

		it('2분 연속 healthy 0이면 ALARM', () => {
			expect(evaluateAlarm(dp('0 0 X X'), config)).toBe('ALARM');
		});

		it('배포 중 한 번 흔들리는 것은 무시한다', () => {
			retrace('1/1로 잡으면 정상 배포마다 알람이 울려 사람이 알람을 무시하게 된다', () => {
				expect(evaluateAlarm(dp('0 0 X 0'), config)).toBe('OK');
			});
		});

		it('⭐ 지표가 끊기면 ALARM — breaching을 고른 이유', () => {
			retrace('타겟그룹이 사라지거나 태스크가 전멸하면 지표가 멈춘다. 그때 조용하면 안 된다', () => {
				expect(evaluateAlarm(dp('- - - -'), config)).toBe('ALARM');
			});
		});
	});

	describe('② 태스크 부족 — 3/5, breaching (관대한 민감도)', () => {
		const config = { evaluationPeriods: 5, datapointsToAlarm: 3, treatMissingData: 'breaching' as const };

		it('배포 중 2분 부족은 통과한다', () => {
			retrace('배포 중 running < desired는 정상이다. 2/2로 잡으면 정상 배포마다 울린다', () => {
				expect(evaluateAlarm(dp('0 0 X X 0'), config)).toBe('OK');
			});
		});

		it('5분 중 3분 부족하면 ALARM', () => {
			expect(evaluateAlarm(dp('0 X X 0 X'), config)).toBe('ALARM');
		});
	});

	describe('③ 5xx 에러 — 1/1, notBreaching (이벤트 지표)', () => {
		const config = { evaluationPeriods: 1, datapointsToAlarm: 1, treatMissingData: 'notBreaching' as const };

		it('⭐ 에러가 없어 데이터가 없으면 OK — notBreaching을 고른 이유', () => {
			retrace(
				'5xx 건수는 에러가 있을 때만 데이터가 생기는 이벤트 지표다. ' +
					'결손이 정상 상태의 표현이므로 침묵을 정상으로 봐야 한다.',
				() => {
					expect(evaluateAlarm(dp('- - -'), config)).toBe('OK');
				},
			);
		});

		it('한 건이라도 발생하면 ALARM', () => {
			expect(evaluateAlarm(dp('- - X'), config)).toBe('ALARM');
		});

		it('⭐ 같은 설정에 breaching을 쓰면 평온할 때 ALARM이 된다 (반례)', () => {
			retrace(
				'이벤트 지표에 breaching을 붙이면 서비스가 완벽히 동작할 때 알람이 울린다. ' +
					'몇 번 겪으면 사람이 알람을 끄고, 진짜 에러가 났을 때도 아무도 모른다.',
				() => {
					expect(evaluateAlarm(dp('- - -'), { evaluationPeriods: 1, datapointsToAlarm: 1, treatMissingData: 'breaching' })).toBe('ALARM');
				},
			);
		});
	});
});

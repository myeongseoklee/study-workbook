// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e04-08-01-abortable-worker/index.ts를 고쳐라.
//
// 4강 슬라이드 「워커쓰레드」 3번 항목 마지막 줄이 이 명세의 중심이다 —
//   "다만 이게 가능하려면 작업이 잘게 쪼개져 있어서 중간에 멈출 지점이 있어야 함"
//
// 그래서 테스트는 "취소됐다고 보고하는가"만 보지 않는다. **실제로 몇 조각을
// 실행했는가**(stepsRun)를 본다. AbortSignal을 받기만 하고 조각 사이에서 확인하지
// 않는 구현은 이 숫자에서 걸린다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import { Slot, runSteps, type Step } from '../../src/e04-08-01-abortable-worker';

/** 실행되면 자기 번호를 기록하는 조각들을 만든다. */
function makeSteps(count: number, log: number[] = []): { steps: Step<number>[]; log: number[] } {
	const steps = Array.from({ length: count }, (_, i) => () => {
		log.push(i);
		return i;
	});
	return { steps, log };
}

function fakeClock() {
	let now = 0;
	return {
		now: () => now,
		advance(ms: number) {
			now += ms;
		},
	};
}

describe('runSteps — 정상 실행', () => {
	it('모든 조각을 순서대로 실행하고 completed를 준다', () => {
		const { steps, log } = makeSteps(3);
		expect(runSteps({ steps })).toEqual({
			reason: 'completed',
			values: [0, 1, 2],
			stepsRun: 3,
		});
		expect(log).toEqual([0, 1, 2]);
	});

	it('조각이 없으면 바로 completed다', () => {
		expect(runSteps({ steps: [] })).toEqual({ reason: 'completed', values: [], stepsRun: 0 });
	});

	it('취소되지 않은 신호는 방해하지 않는다', () => {
		const { steps } = makeSteps(3);
		const controller = new AbortController();
		expect(runSteps({ steps, signal: controller.signal }).reason).toBe('completed');
	});

	it('조각마다 진행을 알린다 (하트비트 자리)', () => {
		retrace(
			'6장: 처리가 길어지는 작업은 가시성 타임아웃을 연장해야 한다. 쪼개진 틈이 ' +
				'그 하트비트를 보낼 자리다 — 쪼개기는 취소만을 위한 것이 아니다.',
			() => {
				const { steps } = makeSteps(3);
				const seen: number[] = [];
				runSteps({ steps, onProgress: (n) => seen.push(n) });
				expect(seen).toEqual([1, 2, 3]);
			},
		);
	});
});

describe('runSteps — 취소는 조각 사이에서만 일어난다', () => {
	it('시작 전에 이미 취소됐으면 한 조각도 실행하지 않는다', () => {
		retrace(
			'8장: 실제 코드가 addEventListener보다 signal.aborted를 먼저 검사한다. ' +
				'등록보다 먼저 abort가 왔으면 리스너는 영원히 안 불리고, 이미 취소된 작업이 ' +
				'그대로 실행된다.',
			() => {
				const { steps, log } = makeSteps(3);
				const controller = new AbortController();
				controller.abort();
				const result = runSteps({ steps, signal: controller.signal });
				expect(result.reason).toBe('aborted');
				expect(result.stepsRun).toBe(0);
				expect(log).toEqual([]);
			},
		);
	});

	it('중간에 취소되면 그 지점에서 멈춘다', () => {
		retrace(
			'이 테스트가 이 과제의 전부다. 조각 사이에서 신호를 확인하지 않으면 stepsRun이 ' +
				'5가 되고 — 취소를 보고했지만 실제로는 다 실행한 것이다.',
			() => {
				const log: number[] = [];
				const controller = new AbortController();
				const steps: Step<number>[] = Array.from({ length: 5 }, (_, i) => () => {
					log.push(i);
					if (i === 1) controller.abort(); // 두 번째 조각이 끝나며 취소가 온다
					return i;
				});
				const result = runSteps({ steps, signal: controller.signal });
				expect(result.reason).toBe('aborted');
				expect(result.stepsRun).toBe(2);
				expect(log).toEqual([0, 1]);
			},
		);
	});

	it('마지막 조각 직후 취소되면 completed다', () => {
		retrace(
			'남은 조각이 없으면 취소가 아무것도 막지 못했다. 그걸 aborted로 보고하면 ' +
				'끝난 일이 재시도된다 — 5장에서 cancelled는 자동 재시도 대상이 아니다.',
			() => {
				const controller = new AbortController();
				const steps: Step<number>[] = [
					() => 0,
					() => {
						controller.abort();
						return 1;
					},
				];
				const result = runSteps({ steps, signal: controller.signal });
				expect(result.reason).toBe('completed');
				expect(result.stepsRun).toBe(2);
			},
		);
	});

	it('취소되면 values를 채우지 않는다', () => {
		retrace(
			'부분 결과를 성공처럼 넘기면 수신자가 잘린 답을 완성된 답으로 쓴다',
			() => {
				const controller = new AbortController();
				controller.abort();
				expect(runSteps({ steps: makeSteps(3).steps, signal: controller.signal }).values).toEqual(
					[],
				);
			},
		);
	});
});

describe('runSteps — 시간 제한도 조각 사이에서 걸린다', () => {
	it('제한을 넘으면 timed_out으로 멈춘다', () => {
		retrace(
			'슬라이드: "정해진 시간 안에 안 끝나면 자동으로 중단시킴 - 한 작업이 무한정 ' +
				'자리를 차지하지 않게 함"',
			() => {
				const clock = fakeClock();
				const log: number[] = [];
				const steps: Step<number>[] = Array.from({ length: 5 }, (_, i) => () => {
					log.push(i);
					clock.advance(40); // 조각마다 40ms
					return i;
				});
				const result = runSteps({ steps, timeoutMs: 100, now: clock.now });
				expect(result.reason).toBe('timed_out');
				expect(result.stepsRun).toBe(3); // 0,40,80 시점엔 통과, 120에서 걸림
				expect(log).toEqual([0, 1, 2]);
			},
		);
	});

	it('제한 안에 끝나면 completed다', () => {
		const clock = fakeClock();
		const steps: Step<number>[] = Array.from({ length: 2 }, (_, i) => () => {
			clock.advance(10);
			return i;
		});
		expect(runSteps({ steps, timeoutMs: 100, now: clock.now }).reason).toBe('completed');
	});

	it('now를 주지 않으면 시간 제한을 검사하지 않는다', () => {
		const { steps } = makeSteps(3);
		expect(runSteps({ steps, timeoutMs: 0 }).reason).toBe('completed');
	});

	it('제한이 0이어도 첫 조각은 실행한다', () => {
		retrace(
			'제한 검사를 조각 실행 전에만 하면 timeoutMs: 0에서 아무것도 못 한다. ' +
				'경계에서 "하나도 안 함"과 "하나는 함"의 차이는 정책이고, 여기서는 ' +
				'경과 시간이 제한을 **넘었을 때** 멈추는 규약이다.',
			() => {
				const clock = fakeClock();
				const log: number[] = [];
				const steps: Step<number>[] = Array.from({ length: 3 }, (_, i) => () => {
					log.push(i);
					clock.advance(1);
					return i;
				});
				const result = runSteps({ steps, timeoutMs: 0, now: clock.now });
				expect(result.stepsRun).toBe(1);
				expect(result.reason).toBe('timed_out');
			},
		);
	});

	it('취소와 시간초과가 겹치면 취소가 이긴다', () => {
		retrace(
			'5장: cancelled는 사용자가 명시적으로 끊은 것이라 자동 재시도 대상이 아니고, ' +
				'timed_out은 재시도 여지가 있다. 둘을 섞으면 사용자가 끊은 작업이 되살아난다.',
			() => {
				const clock = fakeClock();
				const controller = new AbortController();
				const steps: Step<number>[] = Array.from({ length: 5 }, (_, i) => () => {
					clock.advance(200); // 즉시 제한 초과
					if (i === 0) controller.abort();
					return i;
				});
				const result = runSteps({
					steps,
					signal: controller.signal,
					timeoutMs: 100,
					now: clock.now,
				});
				expect(result.reason).toBe('aborted');
			},
		);
	});
});

describe('runSteps — 조각이 던지면 멈춘다', () => {
	it('failed를 주고 남은 조각을 실행하지 않는다', () => {
		const log: number[] = [];
		const steps: Step<number>[] = [
			() => {
				log.push(0);
				return 0;
			},
			() => {
				throw new Error('조각 실패');
			},
			() => {
				log.push(2);
				return 2;
			},
		];
		const result = runSteps({ steps });
		expect(result.reason).toBe('failed');
		expect(result.stepsRun).toBe(1);
		expect(result.error?.message).toBe('조각 실패');
		expect(log).toEqual([0]);
	});

	it('실패해도 values는 채우지 않는다', () => {
		const steps: Step<number>[] = [
			() => 0,
			() => {
				throw new Error('boom');
			},
		];
		expect(runSteps({ steps }).values).toEqual([]);
	});

	it('던진 것이 Error가 아니어도 Error로 감싼다', () => {
		retrace(
			'수신자가 error.message를 읽는다. 문자열이 그대로 오면 undefined가 된다.',
			() => {
				const steps: Step<number>[] = [
					() => {
						throw '문자열 예외';
					},
				];
				const result = runSteps({ steps });
				expect(result.reason).toBe('failed');
				expect(result.error).toBeInstanceOf(Error);
				expect(result.error?.message).toContain('문자열 예외');
			},
		);
	});
});

describe('Slot — 배정과 허용 목록', () => {
	it('새 슬롯은 idle이다', () => {
		const slot = new Slot(['turn.start']);
		expect(slot.state).toBe('idle');
		expect(slot.currentTaskId).toBeNull();
	});

	it('허용된 액션을 배정하면 busy가 된다', () => {
		const slot = new Slot(['turn.start']);
		expect(slot.assign({ id: 'a' }, 'turn.start')).toBe(true);
		expect(slot.state).toBe('busy');
		expect(slot.currentTaskId).toBe('a');
	});

	it('허용 목록에 없는 액션은 시도조차 하지 않는다', () => {
		retrace(
			'슬라이드 4번: "목록에 없는 낯선 작업이 오면 시도조차 하지 않고 바로 실패로 처리". ' +
				'일단 배정해 놓고 실패시키면 그 사이에 슬롯이 점유되고, 무엇보다 워커가 ' +
				'임의 작업 실행 지점이 된다.',
			() => {
				const slot = new Slot(['turn.start']);
				expect(slot.assign({ id: 'a' }, 'rm.-rf')).toBe(false);
				expect(slot.state).toBe('idle');
				expect(slot.currentTaskId).toBeNull();
			},
		);
	});

	it('바쁜 슬롯에는 배정되지 않는다', () => {
		const slot = new Slot(['turn.start']);
		slot.assign({ id: 'a' }, 'turn.start');
		expect(slot.assign({ id: 'b' }, 'turn.start')).toBe(false);
		expect(slot.currentTaskId).toBe('a');
	});

	it('완료되면 다시 idle이 되어 배정받는다', () => {
		const slot = new Slot(['turn.start']);
		slot.assign({ id: 'a' }, 'turn.start');
		expect(slot.receive('a', true)).toBe(true);
		expect(slot.state).toBe('idle');
		expect(slot.assign({ id: 'b' }, 'turn.start')).toBe(true);
	});
});

describe('Slot — 늦게 온 응답을 무시한다', () => {
	it('현재 작업과 다른 id의 응답은 무시한다', () => {
		retrace(
			'실제 코드의 `if (!slot.task || slot.task.id !== message.id) return;`. 이게 없으면 ' +
				'취소된 작업의 늦은 결과가 새 작업의 결과로 들어온다 — 4강의 재정렬 문제가 ' +
				'워커 층에서 같은 모양으로 나타난다.',
			() => {
				const slot = new Slot(['turn.start']);
				slot.assign({ id: 'a' }, 'turn.start');
				expect(slot.receive('ghost', true)).toBe(false);
				expect(slot.state).toBe('busy');
				expect(slot.currentTaskId).toBe('a');
			},
		);
	});

	it('idle 슬롯에 온 응답은 무시한다', () => {
		const slot = new Slot(['turn.start']);
		expect(slot.receive('a', true)).toBe(false);
		expect(slot.state).toBe('idle');
	});

	it('실패 응답도 슬롯을 비운다 (슬롯은 죽지 않는다)', () => {
		retrace(
			'슬라이드 1번: "처리 도중 에러가 나도 창구 자체는 안 죽고". 작업 실패와 ' +
				'워커 사망은 다른 사건이다 — 전자는 슬롯을 비우고, 후자는 은퇴시킨다.',
			() => {
				const slot = new Slot(['turn.start']);
				slot.assign({ id: 'a' }, 'turn.start');
				expect(slot.receive('a', false)).toBe(true);
				expect(slot.state).toBe('idle');
			},
		);
	});
});

describe('Slot — 죽으면 은퇴하고 교체된다', () => {
	it('fail하면 retired가 되고 교체 수가 늘어난다', () => {
		const slot = new Slot(['turn.start']);
		slot.assign({ id: 'a' }, 'turn.start');
		slot.fail();
		expect(slot.state).toBe('retired');
		expect(slot.retiredCount).toBe(1);
		expect(slot.currentTaskId).toBeNull();
	});

	it('은퇴한 슬롯에는 배정되지 않는다', () => {
		const slot = new Slot(['turn.start']);
		slot.fail();
		expect(slot.assign({ id: 'a' }, 'turn.start')).toBe(false);
	});

	it('은퇴한 슬롯에 오류가 또 와도 교체 수가 늘지 않는다', () => {
		retrace(
			'실제 코드의 `worker.on("error", ...)` 첫 줄이 `if (slot.retired) return;`이다. ' +
				'error와 exit이 연달아 오는 것은 정상이고, 그때마다 교체하면 워커가 두 배로 뜬다.',
			() => {
				const slot = new Slot(['turn.start']);
				slot.assign({ id: 'a' }, 'turn.start');
				slot.fail();
				slot.fail();
				slot.fail();
				expect(slot.retiredCount).toBe(1);
			},
		);
	});

	it('은퇴한 슬롯에 온 응답은 무시한다', () => {
		const slot = new Slot(['turn.start']);
		slot.assign({ id: 'a' }, 'turn.start');
		slot.fail();
		expect(slot.receive('a', true)).toBe(false);
		expect(slot.state).toBe('retired');
	});
});

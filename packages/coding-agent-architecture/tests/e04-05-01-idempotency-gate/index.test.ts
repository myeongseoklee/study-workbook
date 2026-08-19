// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e04-05-01-idempotency-gate/index.ts를 고쳐라.
//
// 4강 슬라이드 「멱등성 실제 구현」의 세 갈래 판정이 이 명세다. 그리고 강의자가
// 직접 정정한 문장이 이 과제의 기준선이다 —
//   "이건 엄밀히 말하면 동작이 멱등해진 게 아니라, 실행 여부가 키라는 인자에
//    의해 결정되는 것. 인자 기반 분기이지 멱등은 아님."
// 그래서 테스트가 검사하는 것은 "동작이 멱등한가"가 아니라 "몇 번 실행됐는가"다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	Gate,
	executeOnce,
	payloadHash,
	type Request,
} from '../../src/e04-05-01-idempotency-gate';

const req = (transactionKey: string, eventId: string, payload: unknown): Request => ({
	transactionKey,
	eventId,
	payload,
});

describe('payloadHash — 같은 내용이면 같은 값이어야 한다', () => {
	it('같은 객체는 같은 해시다', () => {
		expect(payloadHash({ a: 1, b: 'x' })).toBe(payloadHash({ a: 1, b: 'x' }));
	});

	it('키 순서가 달라도 같은 해시다', () => {
		retrace(
			'JSON.stringify를 그냥 쓰면 키 순서가 해시를 바꾼다. 클라이언트가 재시도하며 ' +
				'직렬화 순서를 바꾸는 것은 흔한 일이고, 그때마다 payload_mismatch 오류가 나면 ' +
				'정상 재시도가 오류로 취급된다 — 5장에서 conflict는 "실행하면 안 되는 상황"이다.',
			() => {
				expect(payloadHash({ a: 1, b: 2 })).toBe(payloadHash({ b: 2, a: 1 }));
			},
		);
	});

	it('중첩된 객체의 키 순서도 무시한다', () => {
		expect(payloadHash({ outer: { x: 1, y: 2 } })).toBe(payloadHash({ outer: { y: 2, x: 1 } }));
	});

	it('배열 순서는 의미이므로 다른 해시다', () => {
		retrace(
			'객체 키를 정렬한다고 배열까지 정렬하면 [도구A, 도구B] 호출과 [도구B, 도구A] 호출이 ' +
				'같다고 판정된다. 순서가 다른 도구 호출은 다른 요청이다.',
			() => {
				expect(payloadHash([1, 2])).not.toBe(payloadHash([2, 1]));
			},
		);
	});

	it('내용이 다르면 다른 해시다', () => {
		expect(payloadHash({ a: 1 })).not.toBe(payloadHash({ a: 2 }));
	});

	it('타입이 달라 겉모양만 같은 값은 구분한다', () => {
		retrace(
			'문자열 "1"과 숫자 1을 같은 것으로 판정하면 페이로드 검사가 헐거워진다',
			() => {
				expect(payloadHash({ a: 1 })).not.toBe(payloadHash({ a: '1' }));
			},
		);
	});

	it('null과 undefined 필드를 구분한다', () => {
		expect(payloadHash({ a: null })).not.toBe(payloadHash({}));
	});
});

describe('Gate#claim — 처음 보는 키는 점유된다', () => {
	it('첫 요청은 claimed다', () => {
		const gate = new Gate();
		expect(gate.claim(req('t1', 'e1', { n: 1 }))).toEqual({ kind: 'claimed' });
	});

	it('점유하면 표에 등록된다', () => {
		const gate = new Gate();
		gate.claim(req('t1', 'e1', { n: 1 }));
		expect(gate.size).toBe(1);
	});

	it('서로 다른 키는 각각 점유된다', () => {
		const gate = new Gate();
		expect(gate.claim(req('t1', 'e1', {})).kind).toBe('claimed');
		expect(gate.claim(req('t2', 'e2', {})).kind).toBe('claimed');
		expect(gate.size).toBe(2);
	});

	it('페이로드가 달라도 키가 다르면 각각 점유된다', () => {
		const gate = new Gate();
		expect(gate.claim(req('t1', 'e1', { n: 1 })).kind).toBe('claimed');
		expect(gate.claim(req('t2', 'e2', { n: 99 })).kind).toBe('claimed');
	});
});

describe('Gate#claim — 처리 중이면 기다린다', () => {
	it('같은 키·같은 페이로드가 다시 오면 running이다', () => {
		retrace(
			'슬라이드 2번 두 번째 갈래: "아직 처리 중이면 → 끝날 때까지 기다림". ' +
				'이걸 claimed로 주면 같은 일이 두 번 실행된다.',
			() => {
				const gate = new Gate();
				gate.claim(req('t1', 'e1', { n: 1 }));
				expect(gate.claim(req('t1', 'e2', { n: 1 }))).toEqual({ kind: 'running' });
			},
		);
	});

	it('eventId가 달라도 running 판정은 바뀌지 않는다', () => {
		retrace(
			'재시도는 새 이벤트다 — eventId는 바뀌고 transactionKey는 유지된다(3장). ' +
				'eventId로 판정하면 모든 재시도가 새 요청으로 통과한다.',
			() => {
				const gate = new Gate();
				gate.claim(req('t1', 'first', { n: 1 }));
				expect(gate.claim(req('t1', 'second', { n: 1 })).kind).toBe('running');
				expect(gate.claim(req('t1', 'third', { n: 1 })).kind).toBe('running');
			},
		);
	});

	it('처리 중인 키가 표를 늘리지 않는다', () => {
		const gate = new Gate();
		gate.claim(req('t1', 'e1', { n: 1 }));
		gate.claim(req('t1', 'e2', { n: 1 }));
		expect(gate.size).toBe(1);
	});
});

describe('Gate#claim — 끝난 것은 저장된 결과를 돌려준다', () => {
	it('completed면 duplicate로 결과가 나온다', () => {
		const gate = new Gate();
		gate.claim(req('t1', 'e1', { n: 1 }));
		gate.complete('t1', 'completed', { ok: 42 });
		expect(gate.claim(req('t1', 'e2', { n: 1 }))).toEqual({
			kind: 'duplicate',
			status: 'completed',
			result: { ok: 42 },
		});
	});

	it('failed도 종결이다 — 저장된 실패를 그대로 돌려준다', () => {
		retrace(
			'성공만 종결로 취급하면 실패한 요청이 재시도마다 다시 실행된다. 5장의 실제 코드는 ' +
				'["completed","failed","timed_out","cancelled"] 넷을 모두 종결로 본다.',
			() => {
				const gate = new Gate();
				gate.claim(req('t1', 'e1', {}));
				gate.complete('t1', 'failed', { message: 'boom' });
				expect(gate.claim(req('t1', 'e2', {}))).toEqual({
					kind: 'duplicate',
					status: 'failed',
					result: { message: 'boom' },
				});
			},
		);
	});

	it('timed_out과 cancelled도 종결이다', () => {
		retrace(
			'cancelled를 종결로 안 보면 사용자가 명시적으로 끊은 작업을 시스템이 다시 실행한다 — ' +
				'사용자 의도를 뒤집는다(5장 3번 항목).',
			() => {
				const gate = new Gate();
				gate.claim(req('t1', 'e1', {}));
				gate.complete('t1', 'timed_out', null);
				expect(gate.claim(req('t1', 'e2', {})).kind).toBe('duplicate');

				gate.claim(req('t2', 'e3', {}));
				gate.complete('t2', 'cancelled', null);
				const again = gate.claim(req('t2', 'e4', {}));
				expect(again).toEqual({ kind: 'duplicate', status: 'cancelled', result: null });
			},
		);
	});

	it('결과가 undefined여도 duplicate로 판정한다', () => {
		retrace(
			'result가 없다고 "종결 안 됨"으로 보면, 반환값 없는 작업이 매번 재실행된다',
			() => {
				const gate = new Gate();
				gate.claim(req('t1', 'e1', {}));
				gate.complete('t1', 'completed', undefined);
				expect(gate.claim(req('t1', 'e2', {})).kind).toBe('duplicate');
			},
		);
	});

	it('보관된 결과는 호출자가 바꿔도 오염되지 않는다', () => {
		retrace(
			'저장된 결과를 참조로 돌려주면 수신자가 그것을 수정해 다음 재시도의 응답이 바뀐다. ' +
				'같은 키에는 항상 같은 결과가 나가야 한다.',
			() => {
				const gate = new Gate();
				gate.claim(req('t1', 'e1', {}));
				gate.complete('t1', 'completed', { list: [1, 2] });

				const first = gate.claim(req('t1', 'e2', {}));
				if (first.kind !== 'duplicate') throw new Error('duplicate여야 한다');
				(first.result as { list: number[] }).list.push(3);

				const second = gate.claim(req('t1', 'e3', {}));
				expect(second).toEqual({ kind: 'duplicate', status: 'completed', result: { list: [1, 2] } });
			},
		);
	});
});

describe('Gate#claim — 같은 키에 다른 내용은 오류다', () => {
	it('처리 중인 키에 다른 페이로드면 payload_mismatch다', () => {
		retrace(
			'4장 마지막의 2차원 판정표 오른쪽 아래 칸. 이걸 running이나 duplicate로 삼키면 ' +
				'클라이언트의 두 번째 요청이 조용히 사라지고 클라이언트는 처리됐다고 믿는다 — ' +
				'유실보다 나쁘다(알아챌 수 없으므로).',
			() => {
				const gate = new Gate();
				gate.claim(req('t1', 'e1', { n: 1 }));
				expect(gate.claim(req('t1', 'e2', { n: 2 }))).toEqual({
					kind: 'conflict',
					reason: 'payload_mismatch',
				});
			},
		);
	});

	it('종결된 키에 다른 페이로드여도 payload_mismatch다', () => {
		retrace(
			'키가 이미 소진됐다는 사실보다 "내용이 다르다"가 먼저 판정돼야 한다. ' +
				'duplicate로 응답하면 다른 요청에 남의 결과를 돌려준다.',
			() => {
				const gate = new Gate();
				gate.claim(req('t1', 'e1', { n: 1 }));
				gate.complete('t1', 'completed', { ok: 1 });
				expect(gate.claim(req('t1', 'e2', { n: 2 }))).toEqual({
					kind: 'conflict',
					reason: 'payload_mismatch',
				});
			},
		);
	});

	it('충돌 판정이 저장된 결과를 훼손하지 않는다', () => {
		const gate = new Gate();
		gate.claim(req('t1', 'e1', { n: 1 }));
		gate.complete('t1', 'completed', { ok: 1 });
		gate.claim(req('t1', 'e2', { n: 2 }));
		expect(gate.claim(req('t1', 'e3', { n: 1 }))).toEqual({
			kind: 'duplicate',
			status: 'completed',
			result: { ok: 1 },
		});
	});
});

describe('Gate#complete — 점유하지 않은 키는 종결할 수 없다', () => {
	it('점유 없이 종결하면 던진다', () => {
		retrace(
			'조용히 넘기면 표에 종결 기록만 생기고, 실제로 아무도 실행하지 않은 요청이 ' +
				'"이미 처리됨"으로 남는다. 5장의 규율: 모르는 것을 조용히 통과시키지 않는다.',
			() => {
				const gate = new Gate();
				expect(() => gate.complete('t1', 'completed', null)).toThrow();
				// 던지고 끝이 아니다 — 표가 오염되지 않아야 다음 요청이 정상 점유한다.
				expect(gate.size).toBe(0);
				expect(gate.claim(req('t1', 'e1', {}))).toEqual({ kind: 'claimed' });
			},
		);
	});

	it('이미 종결된 키를 다시 종결하면 던진다', () => {
		retrace(
			'덮어쓰기를 허용하면 늦게 도착한 워커의 결과가 먼저 끝난 결과를 갈아치운다. ' +
				'4강의 시뮬레이션대로 응답 도착 순서는 보장되지 않는다.',
			() => {
				const gate = new Gate();
				gate.claim(req('t1', 'e1', {}));
				gate.complete('t1', 'completed', { first: true });
				expect(() => gate.complete('t1', 'completed', { second: true })).toThrow();
			},
		);
	});
});

describe('Gate#abandon — 점유를 버리면 다시 점유할 수 있다', () => {
	it('버린 뒤에는 새로 claimed다', () => {
		retrace(
			'6장: 워커가 죽으면 가시성 타임아웃이 만료돼 메시지가 다시 보인다. 그때 검문소에 ' +
				'running이 그대로 남아 있으면 다음 워커가 영원히 대기한다 — 1장의 "영원히 멈춤".',
			() => {
				const gate = new Gate();
				gate.claim(req('t1', 'e1', { n: 1 }));
				gate.abandon('t1');
				expect(gate.claim(req('t1', 'e2', { n: 1 }))).toEqual({ kind: 'claimed' });
			},
		);
	});

	it('버리면 표에서 사라진다', () => {
		const gate = new Gate();
		gate.claim(req('t1', 'e1', {}));
		gate.abandon('t1');
		expect(gate.size).toBe(0);
	});

	it('종결된 것은 버릴 수 없다 — 저장된 결과가 사라지면 안 된다', () => {
		retrace(
			'종결 기록을 지우면 그 뒤의 재시도가 duplicate가 아니라 claimed가 되어 재실행된다. ' +
				'멱등이 깨지는 지점이다.',
			() => {
				const gate = new Gate();
				gate.claim(req('t1', 'e1', {}));
				gate.complete('t1', 'completed', { ok: 1 });
				expect(() => gate.abandon('t1')).toThrow();
				expect(gate.claim(req('t1', 'e2', {})).kind).toBe('duplicate');
			},
		);
	});

	it('없는 키를 버리면 던진다', () => {
		const gate = new Gate();
		gate.claim(req('t1', 'e1', {}));
		expect(() => gate.abandon('nope')).toThrow();
		// 엉뚱한 키를 버리려 했다고 남의 점유가 사라지면 안 된다.
		expect(gate.size).toBe(1);
	});
});

describe('executeOnce — 몇 번 요청해도 실행은 한 번이다', () => {
	it('첫 호출은 실행하고 claimed를 준다', async () => {
		const gate = new Gate();
		let calls = 0;
		const claim = await executeOnce(gate, req('t1', 'e1', { n: 1 }), async () => {
			calls += 1;
			return { doubled: 2 };
		});
		expect(calls).toBe(1);
		expect(claim).toEqual({ kind: 'claimed' });
	});

	it('같은 키로 세 번 보내도 실행은 한 번이다', async () => {
		await retrace(
			'4강 시뮬레이션: 타임아웃 5초에 서버가 15초 걸리면 클라이언트는 이미 3번 보냈다. ' +
				'그 3번이 3번 실행되면 "송금이 3배"가 된다.',
			async () => {
				const gate = new Gate();
				let calls = 0;
				const run = async () => {
					calls += 1;
					return { ok: calls };
				};
				await executeOnce(gate, req('t1', 'e1', { n: 1 }), run);
				await executeOnce(gate, req('t1', 'e2', { n: 1 }), run);
				await executeOnce(gate, req('t1', 'e3', { n: 1 }), run);
				expect(calls).toBe(1);
			},
		);
	});

	it('두 번째부터는 저장된 결과가 나온다', async () => {
		const gate = new Gate();
		const run = async () => ({ value: 'first' });
		await executeOnce(gate, req('t1', 'e1', {}), run);
		const second = await executeOnce(gate, req('t1', 'e2', {}), run);
		expect(second).toEqual({ kind: 'duplicate', status: 'completed', result: { value: 'first' } });
	});

	it('run이 던지면 failed로 종결하고 재실행하지 않는다', async () => {
		await retrace(
			'실패를 종결로 남기지 않으면 그 키는 running으로 영원히 남고, 재시도는 계속 ' +
				'"기다려"만 받는다 — 검문소 층에서 재현되는 "영원히 멈춤". 실패도 종결이다.',
			async () => {
				const gate = new Gate();
				let calls = 0;
				const run = async () => {
					calls += 1;
					throw new Error('boom');
				};
				const first = await executeOnce(gate, req('t1', 'e1', {}), run);
				expect(first.kind).toBe('duplicate');
				if (first.kind === 'duplicate') expect(first.status).toBe('failed');

				const second = await executeOnce(gate, req('t1', 'e2', {}), run);
				expect(calls).toBe(1);
				expect(second.kind).toBe('duplicate');
			},
		);
	});

	it('실패 결과에 원인이 남는다', async () => {
		const gate = new Gate();
		const claim = await executeOnce(gate, req('t1', 'e1', {}), async () => {
			throw new Error('inference timeout');
		});
		if (claim.kind !== 'duplicate') throw new Error('duplicate여야 한다');
		expect(JSON.stringify(claim.result)).toContain('inference timeout');
	});

	it('키가 다르면 각각 실행된다', async () => {
		const gate = new Gate();
		let calls = 0;
		const run = async () => {
			calls += 1;
			return calls;
		};
		await executeOnce(gate, req('t1', 'e1', { n: 1 }), run);
		await executeOnce(gate, req('t2', 'e2', { n: 1 }), run);
		expect(calls).toBe(2);
	});

	it('같은 키에 다른 페이로드면 실행하지 않고 conflict다', async () => {
		await retrace(
			'conflict는 "실행하면 안 되는 상황"이다. 실행해 버리면 남의 키로 다른 일을 한다.',
			async () => {
				const gate = new Gate();
				let calls = 0;
				const run = async () => {
					calls += 1;
					return calls;
				};
				await executeOnce(gate, req('t1', 'e1', { n: 1 }), run);
				const second = await executeOnce(gate, req('t1', 'e2', { n: 2 }), run);
				expect(second).toEqual({ kind: 'conflict', reason: 'payload_mismatch' });
				expect(calls).toBe(1);
			},
		);
	});

	it('처리 중에 같은 키가 오면 실행하지 않고 running이다', async () => {
		await retrace(
			'동시에 도착한 두 요청 중 하나만 실행돼야 한다. running을 받은 쪽이 run을 부르면 ' +
				'검문소를 세운 의미가 없다.',
			async () => {
				const gate = new Gate();
				let calls = 0;
				let release: (() => void) | undefined;
				const gateOpen = new Promise<void>((resolve) => {
					release = resolve;
				});
				const slowRun = async () => {
					calls += 1;
					await gateOpen;
					return 'done';
				};

				const first = executeOnce(gate, req('t1', 'e1', { n: 1 }), slowRun);
				const second = await executeOnce(gate, req('t1', 'e2', { n: 1 }), slowRun);
				expect(second).toEqual({ kind: 'running' });
				expect(calls).toBe(1);

				release?.();
				await first;
			},
		);
	});
});

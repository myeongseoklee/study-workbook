// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e04-06-01-queue-visibility/index.ts를 고쳐라.
//
// 4강 슬라이드 「큐처리」 4번 항목이 이 명세다. 그리고 강의자가 메모장으로 재현한
// 두 시나리오가 테스트 둘로 들어 있다 —
//   "워커1이 이벤트1을 가져감 큐상태 [이벤트2,이벤트3] / 워커1이 사고나면 이벤트1은 어찌됨?"
//   "워커1이 이벤트1을 가져감 큐상태 [이벤트1(워커1이 처리중),이벤트2,이벤트3] / ..."
// 차이는 큐 상태 한 줄이고, 그 한 줄이 유실과 중복을 가른다.
import { beforeEach, describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	Queue,
	processOne,
	type Message,
	type Outcome,
} from '../../src/e04-06-01-queue-visibility';

/** 테스트가 직접 진행시키는 시계. */
function fakeClock() {
	let now = 1_000;
	return {
		now: () => now,
		advance(ms: number) {
			now += ms;
		},
	};
}

describe('Queue — 꺼내도 지우지 않는다', () => {
	it('넣은 순서대로 꺼낸다 (선입선출)', () => {
		const clock = fakeClock();
		const q = new Queue<string>(clock.now);
		q.send('a');
		q.send('b');
		expect(q.read(1_000)?.body).toBe('a');
		expect(q.read(1_000)?.body).toBe('b');
	});

	it('빈 큐는 null이다', () => {
		const clock = fakeClock();
		expect(new Queue<string>(clock.now).read(1_000)).toBeNull();
	});

	it('꺼내도 큐에서 사라지지 않는다', () => {
		retrace(
			'이 한 줄이 이 과제의 전부다. 꺼낼 때 지우면 워커가 죽는 순간 이벤트가 통째로 ' +
				'사라지고 아무도 모른다 — 강의: "유실됐잖아. 아무도 모른단 말이야."',
			() => {
				const clock = fakeClock();
				const q = new Queue<string>(clock.now);
				q.send('a');
				q.read(1_000);
				expect(q.length).toBe(1);
			},
		);
	});

	it('숨겨진 메시지는 다시 꺼내지지 않는다', () => {
		retrace(
			'숨기지 않으면 여러 워커가 같은 일을 동시에 집는다 — 1장의 "동시성 충돌"',
			() => {
				const clock = fakeClock();
				const q = new Queue<string>(clock.now);
				q.send('a');
				expect(q.read(1_000)?.body).toBe('a');
				expect(q.read(1_000)).toBeNull();
			},
		);
	});

	it('숨겨진 것도 length에는 들어가고 visibleLength에는 안 들어간다', () => {
		const clock = fakeClock();
		const q = new Queue<string>(clock.now);
		q.send('a');
		q.send('b');
		q.read(1_000);
		expect(q.length).toBe(2);
		expect(q.visibleLength).toBe(1);
	});

	it('숨겨진 것을 건너뛰고 다음 것을 꺼낸다', () => {
		const clock = fakeClock();
		const q = new Queue<string>(clock.now);
		q.send('a');
		q.send('b');
		q.read(1_000);
		expect(q.read(1_000)?.body).toBe('b');
	});
});

describe('Queue — 가시성 타임아웃이 지나면 다시 보인다', () => {
	it('만료되면 재출현한다', () => {
		retrace(
			'이것이 워커 사망 시 자동 복구의 유일한 메커니즘이다. 만료가 없으면 죽은 워커가 ' +
				'집어간 메시지는 영원히 멈춘다 — 1장의 두 번째 문제.',
			() => {
				const clock = fakeClock();
				const q = new Queue<string>(clock.now);
				q.send('a');
				q.read(1_000);
				clock.advance(1_001);
				expect(q.read(1_000)?.body).toBe('a');
			},
		);
	});

	it('만료 직전에는 아직 보이지 않는다', () => {
		const clock = fakeClock();
		const q = new Queue<string>(clock.now);
		q.send('a');
		q.read(1_000);
		clock.advance(999);
		expect(q.read(1_000)).toBeNull();
	});

	it('재출현하면 readCount가 늘어난다', () => {
		retrace(
			'재시도 횟수를 세지 못하면 영원히 실패하는 메시지(poison message)를 걸러낼 수 없다',
			() => {
				const clock = fakeClock();
				const q = new Queue<string>(clock.now);
				q.send('a');
				expect(q.read(1_000)?.readCount).toBe(1);
				clock.advance(1_001);
				expect(q.read(1_000)?.readCount).toBe(2);
			},
		);
	});

	it('재출현해도 id는 같다', () => {
		retrace(
			'id가 바뀌면 같은 일인지 알아볼 수 없고, 검문소의 트랜잭션 키와도 연결이 끊긴다',
			() => {
				const clock = fakeClock();
				const q = new Queue<string>(clock.now);
				const id = q.send('a');
				expect(q.read(1_000)?.id).toBe(id);
				clock.advance(1_001);
				expect(q.read(1_000)?.id).toBe(id);
			},
		);
	});
});

describe('Queue#extend — 살아 있다고 계속 알린다', () => {
	it('연장하면 만료가 미뤄진다', () => {
		retrace(
			'슬라이드: "화장실 칸의 사용 중 표시를 계속 갱신하지 않으면 남이 문을 열고 들어옴". ' +
				'추론처럼 처리 시간 편차가 큰 작업은 고정 vt로 못 맞춘다.',
			() => {
				const clock = fakeClock();
				const q = new Queue<string>(clock.now);
				const id = q.send('a');
				q.read(1_000);
				clock.advance(900);
				expect(q.extend(id, 1_000)).toBe(true);
				clock.advance(900);
				expect(q.read(1_000)).toBeNull();
			},
		);
	});

	it('이미 만료돼 재출현한 메시지는 연장할 수 없다', () => {
		retrace(
			'조용히 성공시키면 두 워커가 같은 메시지를 점유했다고 믿는다. 죽은 줄 알았던 ' +
				'워커가 살아나 결과를 쓰면 새 워커의 결과와 충돌한다.',
			() => {
				const clock = fakeClock();
				const q = new Queue<string>(clock.now);
				const id = q.send('a');
				q.read(1_000);
				clock.advance(1_001);
				expect(q.extend(id, 1_000)).toBe(false);
			},
		);
	});

	it('없는 id를 연장하면 false다', () => {
		const clock = fakeClock();
		const q = new Queue<string>(clock.now);
		q.send('a');
		expect(q.extend(9_999, 1_000)).toBe(false);
		expect(q.length).toBe(1);
	});

	it('꺼내지 않은 메시지는 연장할 수 없다', () => {
		retrace('점유하지 않은 것을 점유 연장하는 것은 말이 안 된다', () => {
			const clock = fakeClock();
			const q = new Queue<string>(clock.now);
			const id = q.send('a');
			expect(q.extend(id, 1_000)).toBe(false);
		});
	});
});

describe('Queue#remove — 여기서만 사라진다', () => {
	it('지우면 length가 줄어든다', () => {
		const clock = fakeClock();
		const q = new Queue<string>(clock.now);
		const id = q.send('a');
		q.read(1_000);
		expect(q.remove(id)).toBe(true);
		expect(q.length).toBe(0);
	});

	it('지운 것은 만료 후에도 재출현하지 않는다', () => {
		const clock = fakeClock();
		const q = new Queue<string>(clock.now);
		const id = q.send('a');
		q.read(1_000);
		q.remove(id);
		clock.advance(10_000);
		expect(q.read(1_000)).toBeNull();
	});

	it('없는 id를 지우면 false다', () => {
		const clock = fakeClock();
		const q = new Queue<string>(clock.now);
		q.send('a');
		expect(q.remove(9_999)).toBe(false);
		expect(q.length).toBe(1);
	});
});

describe('processOne — 순서가 채점표다', () => {
	let clock: ReturnType<typeof fakeClock>;
	let q: Queue<string>;
	let persisted: string[];

	beforeEach(() => {
		clock = fakeClock();
		q = new Queue<string>(clock.now);
		persisted = [];
	});

	const persist = (m: Message<string>) => {
		persisted.push(m.body);
	};

	it('처리할 것이 없으면 null이다', () => {
		expect(processOne({ queue: q, visibilityMs: 1_000, handle: () => 'ok', persist })).toBeNull();
	});

	it('정상 처리하면 저장하고 큐에서 지운다', () => {
		q.send('a');
		const outcome = processOne({ queue: q, visibilityMs: 1_000, handle: () => 'ok', persist });
		expect(outcome).toBe('ok');
		expect(persisted).toEqual(['a']);
		expect(q.length).toBe(0);
	});

	it('저장 전에 지우지 않는다', () => {
		retrace(
			'슬라이드: "순서를 앞당기면 중간에 죽었을 때 일은 했는데 기록이 통째로 사라지는 사고가 남". ' +
				'persist가 던지는 순간 remove가 이미 됐다면 그 일은 흔적 없이 사라진다.',
			() => {
				q.send('a');
				expect(() =>
					processOne({
						queue: q,
						visibilityMs: 1_000,
						handle: () => 'ok',
						persist: () => {
							throw new Error('디스크 오류');
						},
					}),
				).toThrow();
				// 저장이 실패했으므로 메시지가 남아 있어야 한다.
				expect(q.length).toBe(1);
			},
		);
	});

	it('저장이 실패한 메시지는 만료 후 재처리된다', () => {
		retrace('남아 있기만 하고 재출현하지 않으면 결국 유실과 같다', () => {
			q.send('a');
			try {
				processOne({
					queue: q,
					visibilityMs: 1_000,
					handle: () => 'ok',
					persist: () => {
						throw new Error('디스크 오류');
					},
				});
			} catch {
				/* 위 테스트에서 이미 검사했다 */
			}
			clock.advance(1_001);
			expect(processOne({ queue: q, visibilityMs: 1_000, handle: () => 'ok', persist })).toBe('ok');
			expect(persisted).toEqual(['a']);
			expect(q.length).toBe(0);
		});
	});

	it('워커가 죽으면 저장도 삭제도 하지 않는다', () => {
		retrace(
			'메모장 시나리오: "워커1이 사고나거나 뻗어버리면 이벤트1은 어찌됨?" — ' +
				'삭제했으면 유실이고, 남겼으면 재처리된다',
			() => {
				q.send('a');
				const outcome = processOne({
					queue: q,
					visibilityMs: 1_000,
					handle: () => 'crashed',
					persist,
				});
				expect(outcome).toBe('crashed');
				expect(persisted).toEqual([]);
				expect(q.length).toBe(1);
			},
		);
	});

	it('죽은 워커의 일은 만료 후 다른 워커가 집는다', () => {
		retrace(
			'강의: "워커는 죽어도 괜찮거든요, 스레드일 뿐이니까. (…) 이벤트가 없어졌잖아." — ' +
				'실행 주체는 대체 가능하고 기록은 대체 불가능하다',
			() => {
				q.send('a');
				processOne({ queue: q, visibilityMs: 1_000, handle: () => 'crashed', persist });
				// 만료되기 전에는 아무도 못 집는다.
				expect(processOne({ queue: q, visibilityMs: 1_000, handle: () => 'ok', persist })).toBeNull();
				clock.advance(1_001);
				expect(processOne({ queue: q, visibilityMs: 1_000, handle: () => 'ok', persist })).toBe('ok');
				expect(persisted).toEqual(['a']);
			},
		);
	});

	it('여러 건을 순서대로 비운다', () => {
		q.send('a');
		q.send('b');
		q.send('c');
		const handle = (): Outcome => 'ok';
		while (processOne({ queue: q, visibilityMs: 1_000, handle, persist }) !== null) {
			/* 다 비울 때까지 */
		}
		expect(persisted).toEqual(['a', 'b', 'c']);
		expect(q.length).toBe(0);
	});
});

describe('중복이 실제로 생기고, 그 중복이 흡수된다', () => {
	// 이 블록이 6장의 결론을 증명한다:
	//   유실(못 고침) → 삭제를 늦춘다 → 중복(고칠 수 있음) → 멱등 키로 흡수
	it('워커 사망 후 재처리는 같은 일을 두 번 실행한다', () => {
		retrace(
			'삭제를 늦춘 대가가 중복이라는 사실을 눈으로 확인하는 테스트다. 이 중복이 ' +
				'없다면 유실이 있는 것이고, 둘 중 하나는 반드시 있다.',
			() => {
				const clock = fakeClock();
				const q = new Queue<string>(clock.now);
				q.send('송금');

				const executed: string[] = [];
				// 첫 워커: 실행은 했지만 저장 전에 죽었다.
				processOne({
					queue: q,
					visibilityMs: 1_000,
					handle: (m) => {
						executed.push(m.body);
						return 'crashed';
					},
					persist: () => {
						throw new Error('여기까지 오지 않는다');
					},
				});
				clock.advance(1_001);
				// 두 번째 워커: 같은 일을 다시 실행한다.
				processOne({
					queue: q,
					visibilityMs: 1_000,
					handle: (m) => {
						executed.push(m.body);
						return 'ok';
					},
					persist: () => {},
				});

				expect(executed).toEqual(['송금', '송금']);
			},
		);
	});

	it('멱등 게이트를 앞에 세우면 실제 처리는 한 번이다', () => {
		retrace(
			'슬라이드 4번 마지막 줄: "같은 일이 중복 처리될 수도 있는데, 그건 멱등성 키의 ' +
				'검문이 걸러줌". 큐만 고쳐도, 검문소만 세워도 안 된다 — 둘이 짝이다.',
			() => {
				const clock = fakeClock();
				const q = new Queue<string>(clock.now);
				q.send('송금');

				// 최소 검문소: 메시지 id를 멱등 키로 쓴다.
				const done = new Set<number>();
				let sideEffects = 0;
				const handle = (m: Message<string>): Outcome => {
					if (done.has(m.id)) return 'ok'; // 이미 처리했다 — 실행하지 않는다
					sideEffects += 1;
					done.add(m.id);
					return m.readCount === 1 ? 'crashed' : 'ok';
				};

				processOne({ queue: q, visibilityMs: 1_000, handle, persist: () => {} });
				clock.advance(1_001);
				processOne({ queue: q, visibilityMs: 1_000, handle, persist: () => {} });

				expect(sideEffects).toBe(1);
				expect(q.length).toBe(0);
			},
		);
	});
});

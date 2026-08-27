// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e05-04-01-queue-vs-log/index.ts를 고쳐라.
//
// 5강 슬라이드 「큐로 읽기와 로그로 읽기」가 이 명세다. 슬라이드의 왼쪽 칸(큐 · 경쟁 소비)이
// readAsQueue고 오른쪽 칸(로그 · 팬아웃 tail)이 readAsLog다. 슬라이드가 그린 상황 —
//   "브로커 A가 먼저 read → msg 3(ch: B)을 집으면 B는 자기 것을 못 본다"
// 이 한 줄이 아래 `missed` 테스트다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	readAsQueue,
	readAsLog,
	patchVerdict,
	type Broker,
	type StoredEvent,
} from '../../src/e05-04-01-queue-vs-log';

// 슬라이드의 예시를 그대로 옮긴 것: msg1(A) msg2(C) msg3(B) msg4(A) msg5(B)
const events: StoredEvent[] = [
	{ position: 101, channel: 'A' },
	{ position: 102, channel: 'C' },
	{ position: 103, channel: 'B' },
	{ position: 104, channel: 'A' },
	{ position: 105, channel: 'B' },
];

const brokers: Broker[] = [
	{ brokerId: 'A', channels: ['A'] },
	{ brokerId: 'B', channels: ['B'] },
	{ brokerId: 'C', channels: ['C'] },
];

describe('readAsQueue — 하나가 집으면 남에게서 사라진다', () => {
	it('브로커 셋이 번갈아 하나씩 집는다', () => {
		// 라운드 로빈: A→101, B→102, C→103, A→104, B→105
		// A가 집은 둘(101·104)은 마침 둘 다 채널 A라 그대로 전달된다.
		const r = readAsQueue(events, brokers);
		const byId = Object.fromEntries(r.results.map((x) => [x.brokerId, x]));
		expect(byId.A!.delivered).toEqual([101, 104]);
	});

	it('집었는데 자기 채널이 아니면 버린다 — 그리고 그 이벤트는 이제 아무 데도 없다', () => {
		retrace(
			'B가 집은 102(ch: C)는 C의 것이다. 버려지고 C는 영원히 못 본다. ' +
				'슬라이드: "B는 자기 것(ch B)을 못 본다"의 반대 방향 사례.',
			() => {
				const byId = Object.fromEntries(
					readAsQueue(events, brokers).results.map((x) => [x.brokerId, x]),
				);
				expect(byId.B!.delivered).toEqual([105]);
			},
		);
	});

	it('🔴 내 채널인데 남이 집어간 것을 missed로 센다', () => {
		retrace(
			'이것이 이 과제의 핵심 관측이다. 유실이 아니라 "남에게 갔다"인데, ' +
				'구독자 입장에서는 구분할 방법이 없다 — 그냥 안 온다.',
			() => {
				const byId = Object.fromEntries(
					readAsQueue(events, brokers).results.map((x) => [x.brokerId, x]),
				);
				// A는 101을 받고 104는 자기가 집었으므로 받는다 → missed 없음
				expect(byId.A!.missed).toEqual([]);
				// B는 103을 C가 집어가 버렸다
				expect(byId.B!.missed).toEqual([103]);
				// C는 102를 B가 집어가 버렸다
				expect(byId.C!.missed).toEqual([102]);
			},
		);
	});

	it('delivered와 missed는 오름차순이다', () => {
		const r = readAsQueue(events, brokers);
		for (const x of r.results) {
			expect(x.delivered).toEqual([...x.delivered].sort((a, b) => a - b));
			expect(x.missed).toEqual([...x.missed].sort((a, b) => a - b));
		}
	});

	it('🔴 읽기가 쓰기다 — 집은 건수 × 2', () => {
		retrace(
			'read는 가시성 타임아웃을 거는 UPDATE, delete는 DELETE. 그래서 브로커를 늘리면 ' +
				'DB 쓰기 부하가 같이 는다 — 4장의 "브로커를 N대로 늘리면 write도 N배".',
			() => {
				expect(readAsQueue(events, brokers).writes).toBe(10);
			},
		);
	});

	it('큐 모드에는 커서가 없다 — 전부 0이다', () => {
		expect(readAsQueue(events, brokers).cursors).toEqual({ A: 0, B: 0, C: 0 });
	});

	it('브로커가 하나뿐이면 아무도 못 보는 일이 없다', () => {
		retrace(
			'경쟁 소비의 문제는 소비자가 둘 이상일 때만 나타난다. 그래서 개발 중에는 ' +
				'안 보이고 브로커를 늘린 뒤에 드러난다.',
			() => {
				const solo = readAsQueue(events, [{ brokerId: 'A', channels: ['A', 'B', 'C'] }]);
				expect(solo.results[0]!.delivered).toEqual([101, 102, 103, 104, 105]);
				expect(solo.results[0]!.missed).toEqual([]);
			},
		);
	});

	it('브로커가 없으면 아무것도 집히지 않는다', () => {
		expect(readAsQueue(events, [])).toEqual({ results: [], writes: 0, cursors: {} });
	});
});

describe('readAsLog — 아무도 아무것도 숨기지 않는다', () => {
	it('구독한 것은 모두 받는다', () => {
		retrace(
			'같은 입력·같은 브로커인데 큐 모드와 결과가 다르다. 그 차이가 이 과제의 전부다.',
			() => {
				const byId = Object.fromEntries(
					readAsLog(events, brokers, 10).results.map((x) => [x.brokerId, x]),
				);
				expect(byId.A!.delivered).toEqual([101, 104]);
				expect(byId.B!.delivered).toEqual([103, 105]);
				expect(byId.C!.delivered).toEqual([102]);
			},
		);
	});

	it('missed가 항상 비어 있다', () => {
		for (const x of readAsLog(events, brokers, 10).results) {
			expect(x.missed).toEqual([]);
		}
	});

	it('🔴 읽기는 읽기다 — writes가 0이다', () => {
		retrace(
			'브로커를 몇 대로 늘려도 이 값은 0이다. 모두 같은 꼬리를 읽으므로 그 페이지는 ' +
				'이미 공유 버퍼에 있다 — 4장.',
			() => {
				expect(readAsLog(events, brokers, 10).writes).toBe(0);
			},
		);
	});

	it('커서는 훑은 만큼 전진한다 — 버린 것도 읽은 것이다', () => {
		retrace(
			'자기 채널만 세면 커서가 남의 이벤트 앞에서 멈춰 같은 것을 계속 다시 읽는다.',
			() => {
				expect(readAsLog(events, brokers, 10).cursors).toEqual({ A: 105, B: 105, C: 105 });
			},
		);
	});

	it('limit이 페이지를 자른다', () => {
		const r = readAsLog(events, brokers, 3);
		const byId = Object.fromEntries(r.results.map((x) => [x.brokerId, x]));
		expect(byId.A!.delivered).toEqual([101]);
		expect(byId.B!.delivered).toEqual([103]);
		expect(r.cursors.A).toBe(103);
	});

	it('limit이 0이면 아무것도 안 읽고 커서도 안 움직인다', () => {
		const r = readAsLog(events, brokers, 0);
		expect(r.results.every((x) => x.delivered.length === 0)).toBe(true);
		expect(r.cursors).toEqual({ A: 0, B: 0, C: 0 });
	});

	it('빈 로그에서도 커서가 0이다', () => {
		expect(readAsLog([], brokers, 10).cursors).toEqual({ A: 0, B: 0, C: 0 });
	});

	it('브로커를 늘려도 쓰기 부하가 안 는다 (큐와 대조)', () => {
		retrace(
			'같은 입력으로 큐 모드는 브로커 수와 무관하게 집은 건수 × 2만큼 쓰지만, ' +
				'로그 모드는 브로커를 몇 대로 늘려도 0이다.',
			() => {
				const many: Broker[] = Array.from({ length: 12 }, (_, i) => ({
					brokerId: `b${i}`,
					channels: ['A', 'B', 'C'],
				}));
				expect(readAsLog(events, many, 10).writes).toBe(0);
				expect(readAsQueue(events, many).writes).toBe(10);
			},
		);
	});
});

describe('patchVerdict — 봉합 비용 판정', () => {
	it('장치 목록이 문제보다 길면 선택을 다시 본다', () => {
		retrace(
			'슬라이드가 나열한 다섯: 라우터 프로세스 · 브로커별 전용 큐 · 두 번째 outbox · ' +
				'identity lease · 전용 테이블 셋. 원래 문제는 "결과를 여럿에게 전달한다" 하나였다.',
			() => {
				expect(
					patchVerdict(
						['결과를 여럿에게 전달'],
						['라우터', '전용 큐', '두 번째 outbox', 'identity lease', '전용 테이블 3개'],
					),
				).toBe('reconsider');
			},
		);
	});

	it('같은 수면 유지다 — 경계는 초과에서만 넘어간다', () => {
		expect(patchVerdict(['p1', 'p2'], ['a', 'b'])).toBe('keep');
	});

	it('장치가 없으면 유지다', () => {
		expect(patchVerdict(['p1'], [])).toBe('keep');
	});
});

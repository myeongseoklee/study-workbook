// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e05-02-01-event-routing/index.ts를 고쳐라.
//
// 5강 슬라이드 「참가자 구성」과 「워크플로우」가 이 명세다.
//   - 워커: "PGMQ에 접속하여 자신이 처리해야 하는 이벤트를 가져간 뒤 처리 후 다시 이벤트 등록"
//   - 클라이언트: "원하는 이벤트 카테고리(채널)만 수신"
// 두 줄이 같은 필드(이벤트 타입) 하나를 읽는다는 것이 이 과제의 전부다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	route,
	dispatch,
	backlogIfWorkerRemoved,
	type ClientSubscription,
	type EventEnvelope,
	type WorkerRegistration,
} from '../../src/e05-02-01-event-routing';

const workers: WorkerRegistration[] = [
	{ workerId: 'w-turn', handles: ['turn.start', 'turn.stop'] },
	{ workerId: 'w-tool', handles: ['tool.call'] },
	{ workerId: 'w-turn-2', handles: ['turn.start'] },
];

const clients: ClientSubscription[] = [
	{ clientId: 'c1', channels: ['turn.final', 'tool.stdout'] },
	{ clientId: 'c2', channels: ['turn.final'] },
	{ clientId: 'c3', channels: ['session.created'] },
];

describe('route — 타입 하나가 두 가지를 동시에 정한다', () => {
	it('워커가 등록한 타입이면 그 워커가 집는다', () => {
		expect(route({ type: 'tool.call' }, workers, clients).workerId).toBe('w-tool');
	});

	it('같은 타입을 여러 워커가 등록했으면 등록 순서상 첫 번째만 집는다 — 작업 경로는 경쟁 소비다', () => {
		retrace(
			'결과 경로(팬아웃)와 작업 경로(경쟁 소비)를 같은 규칙으로 처리하면 여기서 갈린다. ' +
				'한 작업을 두 워커가 하면 그것이 곧 중복 실행이다 — 4강 4장.',
			() => {
				const r = route({ type: 'turn.start' }, workers, clients);
				expect(r.workerId).toBe('w-turn');
			},
		);
	});

	it('구독한 클라이언트는 모두 받는다 — 결과 경로는 팬아웃이다', () => {
		retrace(
			'첫 번째 구독자에게만 주면 큐로 읽은 것과 같아진다. 4장: "큐는 정확히 한 명에게 ' +
				'주려고 만들어졌고 로그는 여럿이 보라고 만들어졌다."',
			() => {
				expect(route({ type: 'turn.final' }, workers, clients).clientIds).toEqual(['c1', 'c2']);
			},
		);
	});

	it('구독 순서를 유지한다', () => {
		const reversed = [...clients].reverse();
		expect(route({ type: 'turn.final' }, workers, reversed).clientIds).toEqual(['c2', 'c1']);
	});

	it('워커가 없으면 workerId는 null이다 (빈 문자열이나 undefined가 아니다)', () => {
		expect(route({ type: 'turn.final' }, workers, clients).workerId).toBeNull();
	});

	it('클라이언트가 없으면 빈 배열이다 (null이 아니다)', () => {
		expect(route({ type: 'tool.call' }, workers, clients).clientIds).toEqual([]);
	});

	it('워커도 클라이언트도 없는 타입도 판정을 돌려준다 — 던지지 않는다', () => {
		retrace(
			'모르는 타입에 예외를 던지면 이벤트 하나가 브로커를 멈춘다. 브로커는 내용을 ' +
				'모르는 계층이므로 모르는 타입은 정상 입력이다 — 4장.',
			() => {
				const r = route({ type: 'unknown.thing' }, workers, clients);
				expect(r).toEqual({ type: 'unknown.thing', workerId: null, clientIds: [] });
			},
		);
	});

	it('타입은 정확히 일치해야 한다 — 접두 일치나 와일드카드가 아니다', () => {
		retrace(
			'`turn.`으로 시작한다고 집으면 `turn.final`(결과)을 워커가 다시 집어 무한 루프가 된다.',
			() => {
				expect(route({ type: 'turn.startle' }, workers, clients).workerId).toBeNull();
			},
		);
	});
});

describe('dispatch — 배치를 흘렸을 때', () => {
	const batch: EventEnvelope[] = [
		{ type: 'turn.start' },
		{ type: 'tool.call' },
		{ type: 'turn.final' },
		{ type: 'turn.start' },
		{ type: 'session.created' },
		{ type: 'unknown.thing' },
	];

	it('판정을 입력 순서대로 돌려준다', () => {
		const r = dispatch(batch, workers, clients);
		expect(r.routings.map((x) => x.type)).toEqual(batch.map((x) => x.type));
	});

	it('워커별 처리 건수를 센다', () => {
		expect(dispatch(batch, workers, clients).workload).toEqual({
			'w-turn': 2,
			'w-tool': 1,
			'w-turn-2': 0,
		});
	});

	it('한 건도 안 집은 워커도 0으로 들어간다', () => {
		retrace(
			'등장한 워커만 세면 "이 워커는 놀고 있다"를 관측할 수 없다. 관심사별 배치가 ' +
				'맞는지 확인하려면 0이 보여야 한다 — 5장.',
			() => {
				expect(dispatch(batch, workers, clients).workload['w-turn-2']).toBe(0);
			},
		);
	});

	it('워커가 없는 이벤트는 pending에 남는다 — 구독자가 있어도 마찬가지다', () => {
		retrace(
			'`turn.final`은 c1·c2가 구독하지만 집어갈 워커가 없다. 결과 이벤트를 만들어 줄 ' +
				'주체가 없으므로 적체다 — 5장 "워커를 내리는 것은 적체시키는 것이다."',
			() => {
				const pending = dispatch(batch, workers, clients).pending.map((e) => e.type);
				expect(pending).toEqual(['turn.final', 'session.created', 'unknown.thing']);
			},
		);
	});

	it('아무도 안 보는 타입만 orphanTypes에 들어간다', () => {
		retrace(
			'`turn.final`·`session.created`는 구독자가 있으므로 고아가 아니다. pending과 ' +
				'orphan을 같은 것으로 보면 "받을 사람은 있는데 만들 사람이 없다"는 상태가 사라진다.',
			() => {
				expect(dispatch(batch, workers, clients).orphanTypes).toEqual(['unknown.thing']);
			},
		);
	});

	it('orphanTypes는 중복을 제거하고 처음 나타난 순서를 유지한다', () => {
		const r = dispatch(
			[{ type: 'b.x' }, { type: 'a.y' }, { type: 'b.x' }],
			workers,
			clients,
		);
		expect(r.orphanTypes).toEqual(['b.x', 'a.y']);
	});

	it('빈 배치도 처리한다', () => {
		expect(dispatch([], workers, clients)).toEqual({
			routings: [],
			workload: { 'w-turn': 0, 'w-tool': 0, 'w-turn-2': 0 },
			pending: [],
			orphanTypes: [],
		});
	});

	it('워커를 하나도 등록하지 않으면 전부 적체된다', () => {
		retrace(
			'브로커와 MQ만 띄우고 워커를 안 올린 상태다. 이벤트는 흐르지만 아무 일도 ' +
				'일어나지 않는다 — 그리고 큐는 계속 찬다.',
			() => {
				const r = dispatch(batch, [], clients);
				expect(r.pending).toHaveLength(batch.length);
				expect(r.workload).toEqual({});
			},
		);
	});
});

describe('backlogIfWorkerRemoved — 끄는 것과 적체시키는 것', () => {
	it('생산이 계속되면 시간에 비례해 쌓인다', () => {
		expect(backlogIfWorkerRemoved('tool.call', 30, 10, false)).toBe(300);
	});

	it('생산을 멈췄으면 0이다', () => {
		retrace(
			'5장의 결론이 이 한 줄이다 — 진짜로 끄려면 소비가 아니라 생산을 막는다.',
			() => {
				expect(backlogIfWorkerRemoved('tool.call', 30, 10, true)).toBe(0);
			},
		);
	});

	it('0분이면 0이다', () => {
		expect(backlogIfWorkerRemoved('tool.call', 30, 0, false)).toBe(0);
	});
});

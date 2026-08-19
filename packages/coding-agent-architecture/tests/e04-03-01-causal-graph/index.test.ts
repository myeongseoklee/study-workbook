// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e04-03-01-causal-graph/index.ts를 고쳐라.
//
// 4강: "그 순서 보장을 해주는 인과관계를 그래프로 이해하려면 이벤트 자체의
// 엔벨로프에 저런 키 같은 게 포함될 수밖에 없어." — 이 명세는 그 "저런 키"가
// 실제로 무슨 일을 하는지 하나씩 확인한다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	flatten,
	missingSequences,
	restore,
	scopeViolations,
	type Envelope,
	type Scope,
} from '../../src/e04-03-01-causal-graph';

let counter = 0;
function ev(
	eventKey: string,
	parentEventKey: string | null,
	scope: Scope,
	extra: Partial<Envelope> = {},
): Envelope {
	counter += 1;
	return {
		eventKey,
		transactionKey: extra.transactionKey ?? 't1',
		parentEventKey,
		scope,
		sequence: extra.sequence ?? null,
		action: extra.action ?? `${scope}.${counter}`,
	};
}

//  s1 (session)
//   └ turn1 (turn)
//      ├ it1 (iteration, sequence 0)
//      │   └ tool1 (tool)
//      └ it2 (iteration, sequence 1)
//
// 이터레이션 둘에 sequence를 붙인 것이 의도다 — 도착 순서가 어떻게 뒤집혀도
// 복원 결과가 하나로 정해지려면 순번이 있어야 한다. 순번 없는 형제의 정렬은
// 아래 '형제 정렬' 블록에서 따로 다룬다.
const tree = (): Envelope[] => [
	ev('s1', null, 'session', { action: 'session.create' }),
	ev('turn1', 's1', 'turn', { action: 'turn.start' }),
	ev('it1', 'turn1', 'iteration', { action: 'iteration.start', sequence: 0 }),
	ev('tool1', 'it1', 'tool', { action: 'tool.call' }),
	ev('it2', 'turn1', 'iteration', { action: 'iteration.start', sequence: 1 }),
];

describe('restore — 도착 순서를 믿지 않는다', () => {
	it('정상 순서로 도착하면 트리가 된다', () => {
		const { roots, orphans } = restore(tree());
		expect(orphans).toEqual([]);
		expect(roots).toHaveLength(1);
		expect(roots[0]!.envelope.eventKey).toBe('s1');
		expect(roots[0]!.children.map((c) => c.envelope.eventKey)).toEqual(['turn1']);
		expect(roots[0]!.children[0]!.children.map((c) => c.envelope.eventKey)).toEqual(['it1', 'it2']);
	});

	it('완전히 거꾸로 도착해도 같은 트리가 된다', () => {
		retrace(
			'입력 순서를 그대로 순회하며 붙이면 부모가 아직 없어서 자식이 고아가 된다. ' +
				'4강 시뮬레이션대로 도착 순서는 세 번 뒤집힌다 — 네트워크·처리시간·게시시간.',
			() => {
				const { roots, orphans } = restore([...tree()].reverse());
				expect(orphans).toEqual([]);
				expect(roots).toHaveLength(1);
				expect(flatten(roots).map((e) => e.eventKey)).toEqual([
					's1',
					'turn1',
					'it1',
					'tool1',
					'it2',
				]);
			},
		);
	});

	it('무작위로 섞여 도착해도 같은 트리가 된다', () => {
		const shuffled = [tree()[3]!, tree()[1]!, tree()[4]!, tree()[0]!, tree()[2]!];
		const { roots, orphans } = restore(shuffled);
		expect(orphans).toEqual([]);
		expect(flatten(roots).map((e) => e.eventKey)).toEqual(['s1', 'turn1', 'it1', 'tool1', 'it2']);
	});

	it('루트가 여러 개일 수 있다', () => {
		retrace(
			'세션이 여럿이면 트리도 여럿이다. 첫 루트만 반환하면 나머지 세션이 사라진다.',
			() => {
				const events = [
					...tree(),
					ev('s2', null, 'session', { transactionKey: 't2', action: 'session.create' }),
				];
				expect(restore(events).roots.map((r) => r.envelope.eventKey)).toEqual(['s1', 's2']);
			},
		);
	});

	it('빈 입력은 빈 결과다', () => {
		expect(restore([])).toEqual({ roots: [], orphans: [] });
	});
});

describe('restore — 붙지 못한 이벤트를 버리지 않는다', () => {
	it('부모가 없는 이벤트는 orphans로 간다', () => {
		retrace(
			'조용히 버리면 "이벤트가 사라졌는데 아무도 모른다" — 6장에서 유실을 그렇게 ' +
				'경계했는데 복원 단계에서 같은 일을 하면 안 된다. 부모가 아직 안 온 것일 수도 있다.',
			() => {
				const events = [ev('x', 'gone', 'tool', { action: 'tool.call' })];
				const { roots, orphans } = restore(events);
				expect(roots).toEqual([]);
				expect(orphans.map((e) => e.eventKey)).toEqual(['x']);
			},
		);
	});

	it('고아의 자식도 트리에 붙지 않는다', () => {
		const events = [
			ev('x', 'gone', 'iteration', { action: 'iteration.start' }),
			ev('y', 'x', 'tool', { action: 'tool.call' }),
		];
		const { roots, orphans } = restore(events);
		expect(roots).toEqual([]);
		expect(orphans.map((e) => e.eventKey).sort()).toEqual(['x', 'y']);
	});

	it('정상 트리와 고아가 섞여 있어도 트리는 온전하다', () => {
		const events = [...tree(), ev('x', 'gone', 'tool', { action: 'tool.call' })];
		const { roots, orphans } = restore(events);
		expect(flatten(roots)).toHaveLength(5);
		expect(orphans.map((e) => e.eventKey)).toEqual(['x']);
	});
});

describe('restore — 깨진 데이터에 무한히 돌지 않는다', () => {
	it('부모 관계에 순환이 있으면 그 이벤트들은 고아로 처리한다', () => {
		retrace(
			'a→b→a 같은 순환은 인과 키가 잘못 채워지면 생긴다. 재귀로 순회하면 스택이 터진다 — ' +
				'서버가 죽는 것과 "이 이벤트들은 트리에 못 붙었다"고 보고하는 것은 다른 문제다.',
			() => {
				const events: Envelope[] = [
					{ ...ev('a', 'b', 'iteration'), eventKey: 'a', parentEventKey: 'b' },
					{ ...ev('b', 'a', 'iteration'), eventKey: 'b', parentEventKey: 'a' },
				];
				const { roots, orphans } = restore(events);
				expect(roots).toEqual([]);
				expect(orphans.map((e) => e.eventKey).sort()).toEqual(['a', 'b']);
			},
		);
	});

	it('자기 자신을 부모로 가리켜도 죽지 않는다', () => {
		const self: Envelope = { ...ev('a', 'a', 'tool'), eventKey: 'a', parentEventKey: 'a' };
		const { roots, orphans } = restore([self]);
		expect(roots).toEqual([]);
		expect(orphans.map((e) => e.eventKey)).toEqual(['a']);
	});

	it('순환이 있어도 정상 트리는 복원된다', () => {
		const events: Envelope[] = [
			...tree(),
			{ ...ev('a', 'b', 'iteration'), eventKey: 'a', parentEventKey: 'b' },
			{ ...ev('b', 'a', 'iteration'), eventKey: 'b', parentEventKey: 'a' },
		];
		const { roots, orphans } = restore(events);
		expect(flatten(roots).map((e) => e.eventKey)).toEqual(['s1', 'turn1', 'it1', 'tool1', 'it2']);
		expect(orphans.map((e) => e.eventKey).sort()).toEqual(['a', 'b']);
	});
});

describe('restore — 형제 정렬은 sequence가 있으면 그것으로', () => {
	it('sequence가 있으면 도착 순서를 무시하고 순번으로 정렬한다', () => {
		retrace(
			'3장: 모델 응답은 토큰마다 이벤트로 흐르고, 그 순서는 sequence만 알고 있다. ' +
				'도착 순서로 이으면 문장이 뒤섞인다.',
			() => {
				const events: Envelope[] = [
					ev('s1', null, 'session'),
					ev('c', 's1', 'turn', { sequence: 2 }),
					ev('a', 's1', 'turn', { sequence: 0 }),
					ev('b', 's1', 'turn', { sequence: 1 }),
				];
				expect(restore(events).roots[0]!.children.map((c) => c.envelope.eventKey)).toEqual([
					'a',
					'b',
					'c',
				]);
			},
		);
	});

	it('sequence가 없으면 도착 순서를 유지한다', () => {
		retrace(
			'순번이 없는 이벤트에 대해 우리가 가진 유일한 정보가 도착 순서다. ' +
				'eventKey로 정렬해 버리면 그 정보까지 버린다.',
			() => {
				const events: Envelope[] = [
					ev('s1', null, 'session'),
					ev('zebra', 's1', 'turn'),
					ev('apple', 's1', 'turn'),
				];
				expect(restore(events).roots[0]!.children.map((c) => c.envelope.eventKey)).toEqual([
					'zebra',
					'apple',
				]);
			},
		);
	});

	it('sequence가 있는 것과 없는 것이 섞이면 있는 쪽이 앞이다', () => {
		const events: Envelope[] = [
			ev('s1', null, 'session'),
			ev('plain', 's1', 'turn'),
			ev('seq1', 's1', 'turn', { sequence: 1 }),
			ev('seq0', 's1', 'turn', { sequence: 0 }),
		];
		expect(restore(events).roots[0]!.children.map((c) => c.envelope.eventKey)).toEqual([
			'seq0',
			'seq1',
			'plain',
		]);
	});
});

describe('missingSequences — 빠진 조각을 찾는다', () => {
	const stream = (seqs: Array<number | null>, transactionKey = 't1'): Envelope[] =>
		seqs.map((s, i) => ev(`e${i}`, null, 'iteration', { sequence: s, transactionKey }));

	it('빠진 것이 없으면 빈 배열이다', () => {
		expect(missingSequences(stream([0, 1, 2]), 't1')).toEqual([]);
	});

	it('중간이 빠지면 찾아낸다', () => {
		expect(missingSequences(stream([0, 1, 3, 4]), 't1')).toEqual([2]);
	});

	it('여러 개가 빠지면 오름차순으로 전부 준다', () => {
		expect(missingSequences(stream([0, 3, 5]), 't1')).toEqual([1, 2, 4]);
	});

	it('맨 앞이 빠진 것도 찾아낸다', () => {
		retrace(
			'받은 것 중 최소값부터 세면 0이 빠진 것을 못 본다. 스트림의 첫 조각이 유실되는 것은 ' +
				'가장 흔하고 가장 아픈 경우다 — 앞이 없으면 뒤를 이어붙일 수 없다.',
			() => {
				expect(missingSequences(stream([2, 3]), 't1')).toEqual([0, 1]);
			},
		);
	});

	it('도착 순서가 뒤섞여 있어도 결과는 같다', () => {
		expect(missingSequences(stream([4, 0, 3]), 't1')).toEqual([1, 2]);
	});

	it('다른 트랜잭션의 순번에 오염되지 않는다', () => {
		retrace(
			'트랜잭션마다 스트림이 따로다. 섞어 세면 "다른 응답의 토큰"이 이 응답의 구멍을 메운다.',
			() => {
				const events = [...stream([0, 2], 't1'), ...stream([1], 't2')];
				expect(missingSequences(events, 't1')).toEqual([1]);
			},
		);
	});

	it('sequence가 null인 이벤트는 세지 않는다', () => {
		expect(missingSequences(stream([0, null, 1]), 't1')).toEqual([]);
	});

	it('해당 트랜잭션에 스트림이 없으면 빈 배열이다', () => {
		expect(missingSequences(stream([0, 1], 't1'), 'nope')).toEqual([]);
	});

	it('중복 도착한 순번이 있어도 구멍 판정은 흔들리지 않는다', () => {
		retrace(
			'6장에서 만든 중복이 스트림에도 온다. 같은 순번이 두 번 오는 것은 정상이고, ' +
				'그걸 구멍으로 세면 있지도 않은 유실을 보고한다.',
			() => {
				expect(missingSequences(stream([0, 1, 1, 3]), 't1')).toEqual([2]);
			},
		);
	});
});

describe('scopeViolations — 계층이 뒤집힌 간선을 찾는다', () => {
	it('정상 트리에는 위반이 없다', () => {
		expect(scopeViolations(tree())).toEqual([]);
	});

	it('같은 층끼리 잇는 것은 정상이다', () => {
		retrace(
			'이터레이션이 이터레이션을 잇는 것은 정상이다 — 턴 안에서 이터레이션이 연속된다. ' +
				'이걸 위반으로 잡으면 정상 그래프가 오류로 보고된다.',
			() => {
				const events = [
					ev('s1', null, 'session'),
					ev('it1', 's1', 'iteration'),
					ev('it2', 'it1', 'iteration'),
				];
				expect(scopeViolations(events)).toEqual([]);
			},
		);
	});

	it('아래 층이 위 층의 부모면 위반이다', () => {
		retrace(
			'tool 이벤트의 자식이 turn 이벤트라면 인과 키가 잘못 채워진 것이다. ' +
				'그래도 그래프는 그려지지만 의미가 없는 그래프다.',
			() => {
				const events = [
					ev('s1', null, 'session'),
					ev('tool1', 's1', 'tool'),
					ev('turn1', 'tool1', 'turn'),
				];
				expect(scopeViolations(events)).toEqual([{ child: 'turn1', parent: 'tool1' }]);
			},
		);
	});

	it('여러 층 건너뛰는 것은 위반이 아니다', () => {
		retrace(
			'session의 자식이 바로 tool인 것은 층을 건너뛴 것이지 뒤집힌 것이 아니다. ' +
				'모든 층이 항상 존재한다고 전제하면 정상 그래프가 걸린다.',
			() => {
				const events = [ev('s1', null, 'session'), ev('tool1', 's1', 'tool')];
				expect(scopeViolations(events)).toEqual([]);
			},
		);
	});

	it('부모가 없는 이벤트는 검사 대상이 아니다', () => {
		expect(scopeViolations([ev('x', 'gone', 'session')])).toEqual([]);
		expect(scopeViolations([ev('r', null, 'tool')])).toEqual([]);
	});

	it('위반이 여러 개면 전부 준다', () => {
		const events = [
			ev('s1', null, 'session'),
			ev('tool1', 's1', 'tool'),
			ev('turn1', 'tool1', 'turn'),
			ev('it1', 'tool1', 'iteration'),
		];
		expect(scopeViolations(events)).toEqual([
			{ child: 'turn1', parent: 'tool1' },
			{ child: 'it1', parent: 'tool1' },
		]);
	});
});

describe('flatten — 인과 순서로 펴낸다', () => {
	it('부모가 자식보다 먼저 온다 (깊이 우선)', () => {
		expect(flatten(restore(tree()).roots).map((e) => e.eventKey)).toEqual([
			's1',
			'turn1',
			'it1',
			'tool1',
			'it2',
		]);
	});

	it('빈 트리는 빈 배열이다', () => {
		expect(flatten([])).toEqual([]);
	});

	it('루트가 여럿이면 순서대로 이어붙인다', () => {
		const events = [
			ev('s1', null, 'session'),
			ev('t1e', 's1', 'turn'),
			ev('s2', null, 'session'),
			ev('t2e', 's2', 'turn'),
		];
		expect(flatten(restore(events).roots).map((e) => e.eventKey)).toEqual([
			's1',
			't1e',
			's2',
			't2e',
		]);
	});

	it('너비 우선이 아니다 — 형제보다 자손이 먼저다', () => {
		retrace(
			'너비 우선으로 펴면 [s1, turn1, it1, it2, tool1]이 되어 tool1이 it2 뒤로 밀린다. ' +
				'실제로는 it1의 도구 호출이 it2 시작보다 먼저 일어났다 — 인과가 뒤집힌다.',
			() => {
				expect(flatten(restore(tree()).roots).map((e) => e.eventKey)).toEqual([
					's1',
					'turn1',
					'it1',
					'tool1',
					'it2',
				]);
			},
		);
	});
});

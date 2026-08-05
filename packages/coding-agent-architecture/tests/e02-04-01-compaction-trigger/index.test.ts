/**
 * 과제 3-4의 명세 — 컴팩션 트리거 판정기
 *
 * 이 파일이 과제의 정의다. `src/e02-04-01-compaction-trigger/index.ts`를 채워 여기를
 * 통과시켜라. 이 파일은 고치지 않는다.
 *
 * 실행: pnpm test e02-04-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	COMPACT_THRESHOLD,
	runTurn,
	shouldCompact,
	type Entry,
	type Model,
} from '../../src/e02-04-01-compaction-trigger';

const model: Model = { contextWindow: 1000 };

describe('shouldCompact — 언제 트리거하는가', () => {
	it('임계값이 0.8로 상수 분리돼 있다', () => {
		expect(COMPACT_THRESHOLD).toBe(0.8);
	});

	it('70%는 아직 컴팩트하지 않는다', () => {
		expect(shouldCompact([{ kind: 'request', tokens: 700 }], model, 0)).toBe(false);
	});

	it('정확히 80%면 컴팩트한다 (경계 포함)', () => {
		retrace('부등호에 등호를 포함해야 한다', () => {
			expect(shouldCompact([{ kind: 'request', tokens: 800 }], model, 0)).toBe(true);
		});
	});

	it('여유(headroom)가 판정을 바꾼다 — 같은 70%도 여유를 넣으면 걸린다', () => {
		retrace(
			'이번 응답이 얼마나 길어질지 모르는 상태에서 판정해야 한다. 응답이 쓸 자리를 미리 ' +
				'빼 두지 않으면, 판정 시점에는 여유가 있었는데 응답을 받다가 잘린다.',
			() => {
				const log: Entry[] = [{ kind: 'request', tokens: 700 }];
				expect(shouldCompact(log, model, 0)).toBe(false);
				expect(shouldCompact(log, model, 150)).toBe(true);
			},
		);
	});

	it('로그 전체의 토큰을 합산한다 — 마지막 엔트리만 보지 않는다', () => {
		const spread: Entry[] = [
			{ kind: 'request', tokens: 300 },
			{ kind: 'tool_result', tokens: 300 },
			{ kind: 'response', tokens: 200 },
		];
		expect(shouldCompact(spread, model, 0)).toBe(true);
	});
});

describe('runTurn — 턴 중간에도 판정하는가', () => {
	const start: Entry[] = [{ kind: 'request', tokens: 200 }];
	const burst: Entry[] = [
		{ kind: 'tool_call', tokens: 50 },
		{ kind: 'tool_result', tokens: 700 },
	];
	const opts = { headroom: 100, compactTokens: 80 };

	it('도구 폭주를 턴 중간에 잡아낸다', () => {
		retrace(
			'턴 시작 시점(200 + 여유 100 = 30%)에는 통과한다. 그런데 도구 결과가 700을 실어 오면 ' +
				'그 순간 105%다. 턴 시작에만 판정하는 구현은 이 지점을 지나쳐 잘림에 도달한다.',
			() => {
				const out = runTurn(start, burst, model, opts);
				expect(out.some((e) => e.kind === 'compact')).toBe(true);
			},
		);
	});

	it('compact 레코드의 tokens가 compactTokens와 같다', () => {
		const compacts = runTurn(start, burst, model, opts).filter((e) => e.kind === 'compact');
		expect(compacts.length).toBeGreaterThan(0);
		for (const c of compacts) expect(c.tokens).toBe(80);
	});

	it('필요 없을 때는 컴팩트하지 않는다', () => {
		const quiet = runTurn([{ kind: 'request', tokens: 100 }], [{ kind: 'response', tokens: 50 }], model, opts);
		expect(quiet.some((e) => e.kind === 'compact')).toBe(false);
	});
});

describe('runTurn — append-only', () => {
	const start: Entry[] = [{ kind: 'request', tokens: 200 }];
	const burst: Entry[] = [
		{ kind: 'tool_call', tokens: 50 },
		{ kind: 'tool_result', tokens: 700 },
	];
	const opts = { headroom: 100, compactTokens: 80 };

	it('기존 엔트리와 이벤트가 모두 살아남는다', () => {
		retrace(
			'컴팩트한다고 앞 엔트리를 지우면 안 된다. 로그는 감사 기록이고, 컴팩션은 로그를 ' +
				'줄이는 게 아니라 재생 범위를 자르는 것이다 (과제 3-5).',
			() => {
				const kinds = runTurn(start, burst, model, opts).map((e) => e.kind);
				expect(kinds.filter((k) => k === 'request')).toHaveLength(1);
				expect(kinds.filter((k) => k === 'tool_call')).toHaveLength(1);
				expect(kinds.filter((k) => k === 'tool_result')).toHaveLength(1);
			},
		);
	});

	it('입력 log를 변형하지 않는다', () => {
		const input: Entry[] = [{ kind: 'request', tokens: 200 }];
		runTurn(input, burst, model, opts);
		expect(input).toEqual([{ kind: 'request', tokens: 200 }]);
	});

	it('이벤트가 로그에 들어간 순서가 보존된다', () => {
		const out = runTurn(start, burst, model, opts).filter((e) => e.kind !== 'compact');
		expect(out.map((e) => e.kind)).toEqual(['request', 'tool_call', 'tool_result']);
	});
});

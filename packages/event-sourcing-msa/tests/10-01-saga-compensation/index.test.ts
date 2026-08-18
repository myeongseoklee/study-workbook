// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/10-01-saga-compensation/index.ts를 고쳐라.
//
// 사가는 **낙관성을 전제**한다. 대부분 성공한다는 가정이 없으면 보상 절차가 본 작업보다
// 비싸진다. 그래서 이 과제의 판정 대상은 "성공 경로"가 아니라 **실패했을 때 어디까지
// 되돌리는가**와 **응답하지 않는 참가자를 어떻게 끊는가**다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import { runSaga, type Step } from '../../src/10-01-saga-compensation';

/** 실행 순서를 기록하는 헬퍼. 보상 순서를 검증하는 데 쓴다. */
function trace() {
	const log: string[] = [];
	const step = (name: string, opts: { fail?: boolean; delay?: number } = {}): Step => ({
		name,
		invoke: async () => {
			log.push(`do:${name}`);
			if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay));
			if (opts.fail) throw new Error(`${name} failed`);
		},
		compensate: async () => {
			log.push(`undo:${name}`);
		},
	});
	return { log, step };
}

describe('성공 경로', () => {
	it('모든 단계를 순서대로 실행한다', async () => {
		const t = trace();
		const r = await runSaga([t.step('a'), t.step('b'), t.step('c')]);
		expect(r.ok).toBe(true);
		expect(t.log).toEqual(['do:a', 'do:b', 'do:c']);
	});

	it('성공하면 보상하지 않는다', async () => {
		const t = trace();
		await runSaga([t.step('a'), t.step('b')]);
		expect(t.log.filter((l) => l.startsWith('undo:'))).toEqual([]);
	});

	it('단계가 없으면 성공이다', async () => {
		const r = await runSaga([]);
		expect(r.ok).toBe(true);
		expect(r.completed).toEqual([]);
	});
});

describe('실패 — 성공한 것만 역순으로 되돌린다', () => {
	it('실패한 단계 자신은 보상하지 않는다', async () => {
		await retrace(
			'실패한 단계는 효과를 내지 못했으므로 되돌릴 것이 없다. 보상하면 없던 일을 ' +
				'취소하려 들어 부작용이 생긴다 — 재고를 두 번 되돌리는 식이다.',
			async () => {
				const t = trace();
				await runSaga([t.step('a'), t.step('b', { fail: true }), t.step('c')]);
				expect(t.log).toEqual(['do:a', 'do:b', 'undo:a']);
			},
		);
	});

	it('보상은 역순이다', async () => {
		await retrace('나중에 만든 것을 먼저 치운다. 앞 단계가 뒤 단계의 전제였을 수 있기 때문이다', async () => {
			const t = trace();
			await runSaga([t.step('a'), t.step('b'), t.step('c', { fail: true })]);
			expect(t.log).toEqual(['do:a', 'do:b', 'do:c', 'undo:b', 'undo:a']);
		});
	});

	it('실패 이후 단계는 실행하지 않는다', async () => {
		const t = trace();
		await runSaga([t.step('a', { fail: true }), t.step('b')]);
		expect(t.log).not.toContain('do:b');
	});

	it('결과에 실패한 단계 이름과 이유가 담긴다', async () => {
		const t = trace();
		const r = await runSaga([t.step('a'), t.step('b', { fail: true })]);
		expect(r.ok).toBe(false);
		expect(r.failedAt).toBe('b');
		expect(r.reason).toBe('error');
	});

	it('보상까지 끝났으면 compensated에 역순으로 기록된다', async () => {
		const t = trace();
		const r = await runSaga([t.step('a'), t.step('b'), t.step('c', { fail: true })]);
		expect(r.compensated).toEqual(['b', 'a']);
	});
});

describe('데드라인 — 응답하지 않는 참가자를 내가 끊는다', () => {
	it('데드라인을 넘기면 실패로 판정한다', async () => {
		await retrace(
			'메시지 시스템은 타임아웃을 알려주지 않는다. 상대가 진짜 죽었는지 늦은 것인지 ' +
				'모른 채 **내가 판단**하는 것이고, 그래서 약한 페널티 구간에만 쓸 수 있다.',
			async () => {
				const t = trace();
				const r = await runSaga([t.step('slow', { delay: 60 })], { deadlineMs: 10 });
				expect(r.ok).toBe(false);
				expect(r.failedAt).toBe('slow');
				expect(r.reason).toBe('deadline');
			},
		);
	});

	it('데드라인으로 끊긴 단계도 자신은 보상하지 않는다', async () => {
		await retrace(
			'여기가 미묘하다 — 타임아웃은 "완료를 확인하지 못한 것"이지 "실행되지 않은 것"이 ' +
				'아니다. 다만 이 명세는 확인된 것만 되돌린다는 규칙을 택한다. 실무에서는 ' +
				'그 불확실성 때문에 멱등한 보상을 따로 설계한다.',
			async () => {
				const t = trace();
				await runSaga([t.step('a'), t.step('slow', { delay: 60 })], { deadlineMs: 10 });
				expect(t.log.filter((l) => l.startsWith('undo:'))).toEqual(['undo:a']);
			},
		);
	});

	it('데드라인 안에 끝나면 정상 성공이다', async () => {
		const t = trace();
		const r = await runSaga([t.step('quick', { delay: 5 })], { deadlineMs: 100 });
		expect(r.ok).toBe(true);
	});

	it('데드라인은 단계마다 적용된다 (전체 합이 아니다)', async () => {
		const t = trace();
		const r = await runSaga([t.step('a', { delay: 15 }), t.step('b', { delay: 15 })], {
			deadlineMs: 40,
		});
		expect(r.ok).toBe(true);
	});

	it('데드라인이 없으면 기다린다', async () => {
		const t = trace();
		const r = await runSaga([t.step('slow', { delay: 30 })]);
		expect(r.ok).toBe(true);
	});
});

describe('보상이 실패하면 숨기지 않는다', () => {
	it('보상 실패를 결과에 남긴다', async () => {
		await retrace(
			'보상이 실패하면 시스템은 어긋난 상태로 남는다. 조용히 넘기면 아무도 모르는 ' +
				'불일치가 생기므로, 사람이 개입할 수 있게 반드시 보고한다.',
			async () => {
				const log: string[] = [];
				const steps: Step[] = [
					{
						name: 'a',
						invoke: async () => void log.push('do:a'),
						compensate: async () => {
							throw new Error('undo a failed');
						},
					},
					{ name: 'b', invoke: async () => { throw new Error('b failed'); }, compensate: async () => {} },
				];
				const r = await runSaga(steps);
				expect(r.ok).toBe(false);
				expect(r.compensationFailed).toEqual(['a']);
			},
		);
	});

	it('한 보상이 실패해도 나머지 보상은 계속한다', async () => {
		const log: string[] = [];
		const steps: Step[] = [
			{
				name: 'a',
				invoke: async () => void log.push('do:a'),
				compensate: async () => void log.push('undo:a'),
			},
			{
				name: 'b',
				invoke: async () => void log.push('do:b'),
				compensate: async () => {
					throw new Error('undo b failed');
				},
			},
			{ name: 'c', invoke: async () => { throw new Error('c failed'); }, compensate: async () => {} },
		];
		const r = await runSaga(steps);
		expect(log).toEqual(['do:a', 'do:b', 'undo:a']);
		expect(r.compensationFailed).toEqual(['b']);
		expect(r.compensated).toEqual(['a']);
	});
});

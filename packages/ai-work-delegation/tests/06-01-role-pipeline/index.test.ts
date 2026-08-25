/**
 * 과제 06-01의 명세 — 역할 파이프라인의 불변식
 *
 * 이 파일이 과제의 정의다. `src/06-01-role-pipeline/index.ts`를 채워 여기를
 * 통과시켜라. 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라
 * 이해가 틀렸을 가능성이 먼저다 — docs/06-delegation-and-role-separation.md의
 * "역할별로 무엇을 주고 무엇을 감추는가"를 다시 읽어라.
 *
 * 실행: pnpm --filter ai-work-delegation test 06-01
 */
import { retrace, scripted } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	type Draft,
	type Role,
	type RoleContext,
	contextFor,
	runPipeline,
} from '../../src/06-01-role-pipeline';

const 완성된작업물 = (): Draft => ({
	question: '왜 잘 팔리는데 주가는 빠졌나',
	evidence: ['출하량 +30%', '재고 회전 둔화'],
	conclusion: '선반영이다',
	report: '이미 쓴 보고서',
});

/** 대본을 받아 RoleCall을 만든다. 호출 인자가 기록되므로 격리를 검사할 수 있다. */
const 대본 = (steps: Partial<Draft>[]) =>
	scripted<[Role, RoleContext], Partial<Draft>>(steps, 'roleCall');

describe('contextFor — 역할마다 무엇을 주고 무엇을 감추는가', () => {
	it('연구원은 질문만 받는다', () => {
		expect(contextFor('researcher', 완성된작업물())).toEqual({
			question: '왜 잘 팔리는데 주가는 빠졌나',
		});
	});

	it('🔴 비평가는 질문과 근거를 받되 결론은 받지 않는다', () => {
		retrace(
			'이 과제의 핵심이다. 결론을 알면 비평가는 공격하는 대신 반론의 강도를 ' +
				'거기 맞춘다. 작업물을 통째로 넘기고 "결론은 보지 마"라고 적는 것은 ' +
				'격리가 아니다 — 조립 시점에 빼야 한다.',
			() => {
				const ctx = contextFor('skeptic', 완성된작업물());
				expect(Object.keys(ctx).sort()).toEqual(['evidence', 'question']);
			},
		);
	});

	it('🔴 감추는 것은 키 자체를 넣지 않는다 — undefined를 담지 않는다', () => {
		retrace(
			"{ ...draft, conclusion: undefined }로 지우면 키가 남는다. " +
				"직렬화 경로에 따라 되살아나고, 'conclusion' in ctx로 확인하는 쪽에서는 " +
				'있는 것으로 읽힌다.',
			() => {
				const ctx = contextFor('skeptic', 완성된작업물());
				expect('conclusion' in ctx).toBe(false);
			},
		);
	});

	it('감사는 근거만 받는다 — 질문도 결론도 아니다', () => {
		const ctx = contextFor('auditor', 완성된작업물());
		expect(Object.keys(ctx)).toEqual(['evidence']);
		expect(ctx.evidence).toEqual(['출하량 +30%', '재고 회전 둔화']);
	});

	it('편집자는 셋 다 받는다 — 검증이 끝난 뒤이므로 감출 것이 없다', () => {
		const ctx = contextFor('reporter', 완성된작업물());
		expect(Object.keys(ctx).sort()).toEqual(['conclusion', 'evidence', 'question']);
	});

	it('어느 역할에게도 report는 넘기지 않는다', () => {
		retrace(
			'이미 쓴 보고서가 컨텍스트에 들어가면 그 문장이 앵커가 된다 — ' +
				'06장이 "글이 예뻐지면 사람도 그 이야기에 설득된다"고 한 것의 모델 판이다.',
			() => {
				for (const role of ['researcher', 'skeptic', 'auditor', 'reporter'] as Role[]) {
					expect('report' in contextFor(role, 완성된작업물())).toBe(false);
				}
			},
		);
	});

	it('작업물에 없는 항목은 키를 만들지 않는다', () => {
		const 결론전 = { question: 'q', evidence: ['e'] };
		expect('conclusion' in contextFor('reporter', 결론전)).toBe(false);
	});

	it('컨텍스트는 작업물과 상태를 공유하지 않는다', () => {
		retrace(
			'evidence를 그대로 넘기면 역할 쪽에서 배열을 건드릴 때 원본이 함께 바뀐다. ' +
				'격리는 "무엇을 주지 않는가"만이 아니라 "준 것이 원본과 이어져 있는가"이기도 하다.',
			() => {
				const draft = 완성된작업물();
				const ctx = contextFor('auditor', draft);
				ctx.evidence?.push('몰래 끼워 넣은 근거');
				expect(draft.evidence).toHaveLength(2);
			},
		);
	});
});

describe('runPipeline — 순서 불변식', () => {
	const 초안 = (): Draft => ({ question: '왜 이런 일이 벌어졌나', evidence: [] });

	it('역할을 적힌 순서대로 부른다', () => {
		const call = 대본([{ evidence: ['e1'] }, {}, {}, { report: '완성' }]);
		runPipeline(['researcher', 'skeptic', 'auditor', 'reporter'], 초안(), call);
		expect(call.calls.map(([role]) => role)).toEqual([
			'researcher',
			'skeptic',
			'auditor',
			'reporter',
		]);
	});

	it('각 역할은 그 시점까지 누적된 작업물로 만든 컨텍스트를 받는다', () => {
		retrace(
			'연구원이 근거를 채웠으면 비평가는 그 근거를 봐야 한다. ' +
				'컨텍스트를 처음 draft로 한 번만 만들어 두고 돌려 쓰면 여기서 빈 배열이 나온다.',
			() => {
				const call = 대본([{ evidence: ['연구원이 찾은 근거'] }, {}]);
				runPipeline(['researcher', 'skeptic'], 초안(), call);
				expect(call.calls[1]![1].evidence).toEqual(['연구원이 찾은 근거']);
			},
		);
	});

	it('각 역할의 반환이 작업물에 누적된다', () => {
		const call = 대본([{ evidence: ['e1'] }, { conclusion: 'c1' }, {}, { report: 'r1' }]);
		const 결과 = runPipeline(['researcher', 'skeptic', 'auditor', 'reporter'], 초안(), call);
		expect(결과).toEqual({
			question: '왜 이런 일이 벌어졌나',
			evidence: ['e1'],
			conclusion: 'c1',
			report: 'r1',
		});
	});

	it('원본 작업물을 훼손하지 않는다', () => {
		const 원본 = 초안();
		const call = 대본([{ evidence: ['e1'] }]);
		runPipeline(['researcher'], 원본, call);
		expect(원본).toEqual({ question: '왜 이런 일이 벌어졌나', evidence: [] });
	});

	it('🔴 편집자가 마지막이 아니면 거부한다', () => {
		retrace(
			'글을 먼저 예쁘게 만들면 이후 검증이 그 산출물을 지키는 방향으로 기운다. ' +
				'이 규칙은 주석이 아니라 코드가 강제해야 한다 — 주석은 실행되지 않는다.',
			() => {
				expect(() =>
					runPipeline(['reporter', 'skeptic', 'auditor'], 초안(), 대본([{}, {}, {}])),
				).toThrow(RangeError);
				expect(() =>
					runPipeline(['skeptic', 'auditor', 'reporter', 'researcher'], 초안(), 대본([{}, {}, {}, {}])),
				).toThrow(RangeError);
			},
		);
	});

	it('🔴 편집자 앞에 비평가와 감사가 둘 다 있어야 한다', () => {
		retrace(
			'"모든 검증이 끝난 뒤에만 산출물을 만든다"의 실제 조건이다. ' +
				'둘 중 하나만 있어도 검증이 끝난 것이 아니다.',
			() => {
				expect(() => runPipeline(['researcher', 'reporter'], 초안(), 대본([{}, {}]))).toThrow(
					RangeError,
				);
				expect(() => runPipeline(['skeptic', 'reporter'], 초안(), 대본([{}, {}]))).toThrow(
					RangeError,
				);
				expect(() => runPipeline(['auditor', 'reporter'], 초안(), 대본([{}, {}]))).toThrow(
					RangeError,
				);
			},
		);
	});

	it('편집자가 없는 파이프라인은 허용된다 — 검증만 하고 끝낼 수 있다', () => {
		const call = 대본([{}, {}]);
		expect(() => runPipeline(['skeptic', 'auditor'], 초안(), call)).not.toThrow();
	});

	it('빈 역할 목록은 거부한다', () => {
		expect(() => runPipeline([], 초안(), 대본([]))).toThrow(RangeError);
	});

	it('🔴 불변식을 어기면 역할을 하나도 부르지 않는다', () => {
		retrace(
			'검사를 루프 안에서 하면 앞쪽 역할이 이미 돌아 버린다. 그러면 ' +
				'절반쯤 채워진 작업물이 남고, 그것이 완결된 것처럼 다음으로 흘러간다. ' +
				'검사는 실행 전에 한 번에 끝낸다.',
			() => {
				const call = 대본([{ evidence: ['부작용'] }, {}, {}]);
				expect(() => runPipeline(['researcher', 'reporter', 'skeptic'], 초안(), call)).toThrow(
					RangeError,
				);
				expect(call.calls).toHaveLength(0);
			},
		);
	});

	it('비평가는 파이프라인 안에서도 결론을 받지 않는다', () => {
		retrace(
			'contextFor가 맞아도 runPipeline이 작업물을 통째로 넘기면 격리가 무너진다. ' +
				'두 함수가 실제로 연결돼 있는지 확인하는 검사다.',
			() => {
				const call = 대본([{ conclusion: '연구원이 먼저 낸 결론' }, {}]);
				runPipeline(['researcher', 'skeptic'], 초안(), call);
				expect('conclusion' in call.calls[1]![1]).toBe(false);
			},
		);
	});
});

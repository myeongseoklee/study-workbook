/**
 * 과제 03-02의 명세 — 뮤테이션 분석기
 *
 * 이 파일이 과제의 정의다. `src/03-02-mutation-score/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/03-revived-quality-tools.md의 "뮤테이션 테스팅이 재는 것"을
 * 다시 읽어라. 특히 pass와 fail 중 어느 쪽이 변종을 죽인 것인지를.
 *
 * 실행: pnpm --filter agent-era-fundamentals test 03-02
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	analyze,
	generateMutants,
	weakestTargets,
	type MutationTarget,
	type TestOutcome,
} from '../../src/03-02-mutation-score';

const targets: MutationTarget[] = [
	{ id: 'checkAge:12', operator: '<' },
	{ id: 'isEqual:30', operator: '==' },
	{ id: 'sum:44', operator: '+' },
];

describe('generateMutants — 원본 하나에서 변종 여럿을', () => {
	it('관계 연산자는 둘, 등가와 산술은 하나씩 만든다', () => {
		expect(generateMutants(targets)).toHaveLength(2 + 1 + 1);
	});

	it('id는 `대상id~바뀐연산자` 형식이다', () => {
		const ids = generateMutants(targets).map((m) => m.id);
		expect(ids).toEqual(['checkAge:12~<=', 'checkAge:12~>=', 'isEqual:30~!=', 'sum:44~-']);
	});

	it('원본 연산자를 함께 담는다 — 보고서에서 무엇이 바뀌었는지 읽을 수 있어야 한다', () => {
		const first = generateMutants(targets)[0];
		expect(first).toMatchObject({ targetId: 'checkAge:12', original: '<', mutated: '<=' });
	});

	it('경계를 옮기는 변이와 방향을 뒤집는 변이를 모두 만든다', () => {
		retrace(
			'경계 조건만 검사하는 테스트와 방향만 검사하는 테스트는 서로 다른 변종을 놓친다. ' +
				'한쪽만 만들면 그 구멍이 보이지 않는다.',
			() => {
				const mutated = generateMutants([{ id: 'x', operator: '<' }]).map((m) => m.mutated);
				expect(mutated).toContain('<='); // 경계 이동
				expect(mutated).toContain('>='); // 방향 반전
			},
		);
	});

	it('빈 목록에는 빈 배열이다', () => {
		expect(generateMutants([])).toEqual([]);
	});
});

describe('analyze — 살아남은 변종을 가려낸다', () => {
	it('테스트가 실패하면 변종이 죽은 것이다', () => {
		retrace(
			'여기가 이 과제에서 가장 뒤집히기 쉬운 곳이다. 코드를 망가뜨렸는데 테스트가 ' +
				'실패했다면 그것은 테스트가 제 일을 한 것이다. 반대로 통과했다면 그 변경을 ' +
				'아무도 잡아내지 못했다는 뜻이라 변종이 살아남았다.',
			() => {
				const report = analyze([{ id: 'x', operator: '==' }], { 'x~!=': 'fail' });
				expect(report.killed).toEqual(['x~!=']);
				expect(report.survived).toEqual([]);
			},
		);
	});

	it('테스트가 통과하면 변종이 살아남은 것이다', () => {
		const report = analyze([{ id: 'x', operator: '==' }], { 'x~!=': 'pass' });
		expect(report.survived).toEqual(['x~!=']);
		expect(report.killed).toEqual([]);
	});

	it('결과가 없는 변종은 판정하지 않고 따로 센다', () => {
		retrace(
			'돌리지 않은 것을 죽었다고 세면 점수가 부풀고, 살아남았다고 세면 없는 구멍을 ' +
				'좇게 된다. 판정하지 못한 것은 판정하지 못한 채로 남긴다.',
			() => {
				const report = analyze([{ id: 'x', operator: '<' }], { 'x~<=': 'fail' });
				expect(report.killed).toEqual(['x~<=']);
				expect(report.notRun).toEqual(['x~>=']);
				expect(report.complete).toBe(false);
			},
		);
	});

	it('점수는 판정된 것만으로 낸다', () => {
		// 판정된 변종 둘 중 하나가 죽었다. 미실행 하나는 분모에 넣지 않는다.
		const report = analyze(
			[
				{ id: 'a', operator: '==' },
				{ id: 'b', operator: '==' },
				{ id: 'c', operator: '==' },
			],
			{ 'a~!=': 'fail', 'b~!=': 'pass' },
		);
		expect(report.score).toBe(0.5);
		expect(report.complete).toBe(false);
	});

	it('판정된 변종이 하나도 없으면 점수는 0이 아니라 null이다', () => {
		retrace(
			'0점은 "전부 살아남았다"는 사실이고 null은 "아직 모른다"는 상태다. ' +
				'둘을 같은 값으로 만들면 아무것도 돌리지 않은 코드가 최악의 코드로 보고된다.',
			() => {
				const report = analyze([{ id: 'x', operator: '==' }], {});
				expect(report.score).toBeNull();
			},
		);
	});

	it('전부 죽으면 1이고 그때만 complete가 참이다', () => {
		const report = analyze(targets, {
			'checkAge:12~<=': 'fail',
			'checkAge:12~>=': 'fail',
			'isEqual:30~!=': 'fail',
			'sum:44~-': 'fail',
		});
		expect(report.score).toBe(1);
		expect(report.complete).toBe(true);
		expect(report.survived).toEqual([]);
	});

	it('결과 목록의 순서가 아니라 변종 생성 순서를 따른다', () => {
		const report = analyze(targets, {
			'sum:44~-': 'pass',
			'checkAge:12~>=': 'pass',
			'checkAge:12~<=': 'pass',
			'isEqual:30~!=': 'pass',
		});
		expect(report.survived).toEqual([
			'checkAge:12~<=',
			'checkAge:12~>=',
			'isEqual:30~!=',
			'sum:44~-',
		]);
	});

	it('명세에 없는 id가 결과에 섞여 있어도 무시한다', () => {
		const report = analyze([{ id: 'x', operator: '==' }], {
			'x~!=': 'fail',
			'없는변종~!=': 'pass',
		} as Record<string, TestOutcome>);
		expect(report.killed).toEqual(['x~!=']);
		expect(report.survived).toEqual([]);
	});
});

describe('weakestTargets — 테스트를 어디에 더 붙일 것인가', () => {
	it('살아남은 변종이 많은 대상이 먼저다', () => {
		const result = weakestTargets(targets, {
			'checkAge:12~<=': 'pass',
			'checkAge:12~>=': 'pass',
			'isEqual:30~!=': 'pass',
			'sum:44~-': 'fail',
		});
		expect(result).toEqual(['checkAge:12', 'isEqual:30']);
	});

	it('전부 죽은 대상은 나오지 않는다', () => {
		const result = weakestTargets(targets, {
			'checkAge:12~<=': 'fail',
			'checkAge:12~>=': 'fail',
			'isEqual:30~!=': 'fail',
			'sum:44~-': 'fail',
		});
		expect(result).toEqual([]);
	});

	it('살아남은 개수가 같으면 대상 id의 사전순이다', () => {
		const result = weakestTargets(
			[
				{ id: 'zebra:1', operator: '==' },
				{ id: 'alpha:1', operator: '==' },
			],
			{ 'zebra:1~!=': 'pass', 'alpha:1~!=': 'pass' },
		);
		expect(result).toEqual(['alpha:1', 'zebra:1']);
	});

	it('판정하지 못한 변종은 취약함의 근거가 아니다', () => {
		retrace('돌리지 않았다는 것은 구멍이 있다는 증거가 아니다. 돌려 보기 전에는 모른다', () => {
			expect(weakestTargets([{ id: 'x', operator: '==' }], {})).toEqual([]);
		});
	});
});

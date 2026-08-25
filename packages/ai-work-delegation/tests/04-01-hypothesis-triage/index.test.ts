/**
 * 과제 04-01의 명세 — 가설 등급 분류기
 *
 * 이 파일이 과제의 정의다. `src/04-01-hypothesis-triage/index.ts`를 채워
 * 여기를 통과시켜라. 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라
 * 이해가 틀렸을 가능성이 먼저다 — docs/04-what-only-humans-pick.md의
 * "세 기준은 누적적이다"를 다시 읽어라.
 *
 * 실행: pnpm --filter ai-work-delegation test 04-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	type Candidate,
	firstFailedCriterion,
	gradeCandidate,
	triage,
} from '../../src/04-01-hypothesis-triage';

const c = (id: string, surprising: boolean, novel: boolean, falsifiable: boolean): Candidate => ({
	id,
	surprising,
	novel,
	falsifiable,
});

describe('gradeCandidate — 누적 등급', () => {
	it('셋 다 통과하면 논문 주제다', () => {
		expect(gradeCandidate(c('A', true, true, true))).toBe('paper');
	});

	it('놀랍고 새롭지만 반증할 수 없으면 인사이트에서 멈춘다', () => {
		expect(gradeCandidate(c('A', true, true, false))).toBe('insight');
	});

	it('놀랍기만 하면 이야깃거리다', () => {
		expect(gradeCandidate(c('A', true, false, false))).toBe('hook');
	});

	it('놀랍지 않으면 등급이 없다', () => {
		expect(gradeCandidate(c('A', false, false, false))).toBe('none');
	});

	it('🔴 놀랍지 않으면 나머지를 다 만족해도 등급이 없다', () => {
		retrace(
			'세 기준을 세어서 등급을 매기면 여기서 "insight"나 "paper"가 나온다. ' +
				'누적 구조에서는 첫 칸(놀라움)이 비면 뒤 칸을 보지 않는다 — ' +
				'아무도 말하지 않았고 반증도 가능한데 들어도 아무것도 안 바뀐다면, ' +
				'새로운 게 아니라 무관한 것이다.',
			() => {
				expect(gradeCandidate(c('A', false, true, true))).toBe('none');
				expect(gradeCandidate(c('B', false, false, true))).toBe('none');
				expect(gradeCandidate(c('C', false, true, false))).toBe('none');
			},
		);
	});

	it('🔴 놀랍지만 새롭지 않으면 반증 가능해도 이야깃거리에서 멈춘다', () => {
		retrace(
			'두 번째 칸이 비면 세 번째 칸도 세지 않는다. 개수로 세면 여기서 ' +
				'"두 개 통과 = insight"가 나오는데, 널리 알려진 설명은 반증 가능해도 ' +
				'파고들 값이 없다.',
			() => {
				expect(gradeCandidate(c('A', true, false, true))).toBe('hook');
			},
		);
	});
});

describe('firstFailedCriterion — 어디서 걸렸는지', () => {
	it('누적 순서로 처음 걸린 기준을 돌려준다', () => {
		expect(firstFailedCriterion(c('A', false, false, false))).toBe('surprising');
		expect(firstFailedCriterion(c('B', true, false, false))).toBe('novel');
		expect(firstFailedCriterion(c('C', true, true, false))).toBe('falsifiable');
	});

	it('여러 기준이 걸려도 가장 앞의 것 하나만 말한다', () => {
		retrace(
			'"놀랍지도 새롭지도 않다"고 두 개를 알려 주면 사람이 무엇부터 고칠지 모른다. ' +
				'누적 구조에서 고칠 곳은 언제나 첫 번째로 빈 칸이다.',
			() => {
				expect(firstFailedCriterion(c('A', false, true, true))).toBe('surprising');
			},
		);
	});

	it('셋 다 통과하면 null이다', () => {
		expect(firstFailedCriterion(c('A', true, true, true))).toBeNull();
	});
});

describe('triage — 등급 순으로 상위만 남긴다', () => {
	const 후보들 = [
		c('hook1', true, false, false),
		c('paper1', true, true, true),
		c('none1', false, true, true),
		c('insight1', true, true, false),
		c('paper2', true, true, true),
		c('hook2', true, false, true),
	];

	it('등급 내림차순으로 돌려준다', () => {
		expect(triage(후보들, 6).map((x) => x.id)).toEqual([
			'paper1',
			'paper2',
			'insight1',
			'hook1',
			'hook2',
		]);
	});

	it('🔴 등급 없는 후보는 자리가 남아도 넣지 않는다', () => {
		retrace(
			'limit이 6인데 등급 있는 후보가 5개뿐이다. 마지막 자리를 none1으로 ' +
				'채우면 안 된다 — 목표 개수는 할당량이 아니다. ' +
				'등급 없는 후보에 쓰는 시간은 진짜 후보에서 빠져나간 시간이다.',
			() => {
				expect(triage(후보들, 6)).toHaveLength(5);
				expect(triage(후보들, 6).map((x) => x.id)).not.toContain('none1');
			},
		);
	});

	it('전부 등급이 없으면 빈 목록이다', () => {
		expect(triage([c('A', false, true, true), c('B', false, false, false)], 3)).toEqual([]);
	});

	it('같은 등급끼리는 입력 순서를 유지한다', () => {
		retrace(
			'안정 정렬이어야 한다. 같은 등급 안에서 순서를 뒤집으면 ' +
				'AI가 낸 순서(대개 확신이 높은 것이 앞)라는 정보가 사라진다.',
			() => {
				const 동급 = [
					c('first', true, true, true),
					c('second', true, true, true),
					c('third', true, true, true),
				];
				expect(triage(동급, 3).map((x) => x.id)).toEqual(['first', 'second', 'third']);
			},
		);
	});

	it('limit이 후보 수보다 작으면 잘라낸다', () => {
		expect(triage(후보들, 2).map((x) => x.id)).toEqual(['paper1', 'paper2']);
	});

	it('limit 0이면 빈 목록이다', () => {
		expect(triage(후보들, 0)).toEqual([]);
	});

	it('원본 배열을 훼손하지 않는다', () => {
		retrace('sort()는 제자리 정렬이다. 복사하지 않으면 호출자의 배열이 뒤바뀐다.', () => {
			const 원본순서 = 후보들.map((x) => x.id);
			triage(후보들, 3);
			expect(후보들.map((x) => x.id)).toEqual(원본순서);
		});
	});

	it('limit이 깨져 있으면 RangeError를 던진다', () => {
		expect(() => triage(후보들, -1)).toThrow(RangeError);
		expect(() => triage(후보들, 2.5)).toThrow(RangeError);
	});
});

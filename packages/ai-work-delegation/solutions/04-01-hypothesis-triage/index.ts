/**
 * 과제 04-01 참고 구현 — 가설 등급 분류기
 *
 * 📍 되짚기: docs/04-what-only-humans-pick.md — "세 기준은 누적적이다"
 *
 * 이 구현에서 판단이 갈린 곳은 셋이다.
 *
 * **①** 누적을 **조기 반환의 연쇄**로 적었다. 세 기준을 배열에 담아 통과 개수를
 * 세는 구현이 더 짧아 보이지만, 그렇게 하면 `{놀랍지 않음, 새로움, 반증 가능}`이
 * 2점을 받아 인사이트로 올라온다. 누적은 개수가 아니라 **앞 칸이 비면 멈추는
 * 구조**다. 짧은 코드가 규칙을 잘못 옮기는 전형적인 자리다.
 *
 * **②** `firstFailedCriterion`과 `gradeCandidate`가 같은 순서 배열을 공유한다.
 * 두 함수가 서로 다른 순서를 들고 있으면 "hook 등급인데 탈락 사유는 falsifiable"
 * 같은 모순된 보고가 나온다. 순서를 한 곳(`ORDER`)에만 두어 그 여지를 없앴다.
 *
 * **③** `'none'`을 등급 사다리에서 아예 빼지 않고 등급으로 두되, `triage`에서
 * 필터로 걸렀다. `'none'`도 등급으로 두어야 `gradeCandidate`가 전 영역에 대해
 * 답을 낼 수 있고(부분 함수가 되지 않고), 걸러 내는 정책은 그것을 쓰는 쪽에서
 * 정하게 된다. **판정과 정책을 한 함수에 섞지 않는 편이 낫다.**
 */

export interface Candidate {
	id: string;
	surprising: boolean;
	novel: boolean;
	falsifiable: boolean;
}

export type Grade = 'paper' | 'insight' | 'hook' | 'none';
export type Criterion = 'surprising' | 'novel' | 'falsifiable';

/** 누적 순서. 이 배열이 두 함수의 단일 진실 원천이다. */
const ORDER: readonly Criterion[] = ['surprising', 'novel', 'falsifiable'] as const;

/** 통과한 칸 수 → 등급. 인덱스가 곧 "앞에서부터 몇 칸을 통과했나"다. */
const GRADE_BY_DEPTH: readonly Grade[] = ['none', 'hook', 'insight', 'paper'] as const;

/** 누적 순서로 훑어 처음 걸린 칸의 인덱스를 돌려준다. 셋 다 통과하면 3. */
function passedDepth(candidate: Candidate): number {
	let depth = 0;
	for (const criterion of ORDER) {
		if (!candidate[criterion]) break;
		depth += 1;
	}
	return depth;
}

export function gradeCandidate(candidate: Candidate): Grade {
	return GRADE_BY_DEPTH[passedDepth(candidate)]!;
}

export function firstFailedCriterion(candidate: Candidate): Criterion | null {
	const depth = passedDepth(candidate);
	return depth === ORDER.length ? null : ORDER[depth]!;
}

/** 정렬 비교에 쓸 등급 서열. 큰 쪽이 앞이다. */
const RANK: Record<Grade, number> = { paper: 3, insight: 2, hook: 1, none: 0 };

export function triage(candidates: Candidate[], limit: number): Candidate[] {
	if (!Number.isInteger(limit) || limit < 0) {
		throw new RangeError(`limit은 0 이상의 정수여야 한다 (받은 값: ${limit})`);
	}

	return candidates
		// 등급 없는 후보를 먼저 떨군다. 자르기 전에 떨궈야 자리가 남아도 안 들어온다.
		.filter((candidate) => gradeCandidate(candidate) !== 'none')
		// Array.prototype.sort는 안정 정렬이 보장되므로(ES2019~) 같은 등급의
		// 입력 순서가 유지된다. filter가 이미 새 배열을 만들었으니 원본도 안전하다.
		.sort((a, b) => RANK[gradeCandidate(b)] - RANK[gradeCandidate(a)])
		.slice(0, limit);
}

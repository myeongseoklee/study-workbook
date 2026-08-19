/**
 * 과제 03-01 — USE 진단기
 *
 * 자원별 U/S/E 샘플을 받아 각 자원을 판정하고, 무엇을 먼저 볼지 순서를 낸다.
 * 모니터링 시스템의 "3층"(자원별 체크리스트)에 해당한다.
 *
 * 명세:  tests/03-01-use-diagnosis/index.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 03-01
 * 막히면: docs/03-use-method.md
 */

/**
 * 자원 하나의 U/S/E 샘플.
 *
 * 세 값이 `null`일 수 있는 것이 이 타입의 핵심이다 — 도구가 없어서 못 재는 칸을
 * 0으로 채우면 관측 공백이 정상으로 위장된다.
 */
export interface ResourceSample {
	name: string;
	/** 사용률(%). 시간 기반. */
	utilizationPct: number | null;
	/** 포화 — 큐 길이·대기 인원 등. */
	saturation: number | null;
	/** 이번 구간에 **늘어난** 에러 수. 누적값이 아니다. */
	errorsDelta: number | null;
	/** 병렬 처리가 가능한 자원인가 (SSD·NVMe·RAID·가상 디스크). 기본 false. */
	parallel?: boolean;
}

export type Verdict = 'ok' | 'watch' | 'problem' | 'unobserved';

export type Reason =
	| 'errors-increasing'
	| 'saturated'
	| 'utilization-high'
	| 'utilization-unreliable'
	| 'unobserved';

export interface ResourceFinding {
	name: string;
	verdict: Verdict;
	/** 판정 근거. 해석이 값싼 순서로 정렬한다. */
	reasons: Reason[];
}

/** 사용률을 의심하기 시작하는 선(%). */
export const UTILIZATION_SUSPECT_PCT = 70;

/**
 * 자원 하나를 판정한다.
 *
 * 힌트 1: 세 항목의 임계 규칙이 서로 다르다. 하나는 70, 하나는 0, 하나는 "증가 중인가"다.
 * 힌트 2: 사용률이 판정에 쓰이지 않는 경우가 있다. 그때도 근거는 남긴다.
 * 힌트 3: null은 "정상"이 아니다. 명세의 세 가지 null 케이스를 각각 확인하라.
 */
export function diagnoseResource(s: ResourceSample): ResourceFinding {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: diagnoseResource');
}

/**
 * 자원 목록을 심각도 순으로 정렬한다.
 *
 * 힌트: 네 verdict의 순서를 정하는 것이 이 함수의 전부다. 어느 것이 ok보다
 *       위에 와야 하는지 명세의 힌트를 읽어라.
 */
export function rankBottlenecks(samples: ResourceSample[]): ResourceFinding[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: rankBottlenecks');
}

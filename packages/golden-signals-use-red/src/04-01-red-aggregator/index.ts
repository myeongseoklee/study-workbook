/**
 * 과제 04-01 — RED 집계기
 *
 * 스팬 목록에서 서비스별 Rate·Errors·Duration을 만든다. 모니터링 시스템의
 * "2층"(서비스별 동형 테이블)에 해당한다 — 1층이 빨개졌을 때 범위를 좁히는 화면이다.
 *
 * 명세:  tests/04-01-red-aggregator/index.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 04-01
 * 막히면: docs/04-red-method.md
 */

/** 서비스가 처리한 요청 하나. */
export interface Span {
	service: string;
	durationMs: number;
	failed: boolean;
}

export interface RedRow {
	service: string;
	/** 초당 요청 수. */
	rate: number;
	/** 실패 건수. */
	errors: number;
	/** 실패 건수 ÷ 전체 건수. */
	errorRatio: number;
	/** p99 처리 시간(ms). */
	durationP99Ms: number;
}

/**
 * 최근접 순위 방식의 백분위수.
 *
 * 힌트: `index = ceil(phi × n) - 1`이고 0 밑으로 내려가지 않게 자른다.
 *       `noUncheckedIndexedAccess`가 켜져 있으니 인덱싱 결과가 undefined일 수 있다는
 *       것을 타입이 알려줄 것이다.
 */
export function percentile(samples: number[], phi: number): number | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: percentile');
}

/**
 * 서비스별로 묶어 RED 세 지표를 만든다.
 *
 * 힌트 1: Rate와 errorRatio의 분모가 같아야 한다. 한 번 묶은 그룹에서 둘 다 계산하라.
 * 힌트 2: Duration이 실패 스팬을 포함하는지 여부는 명세에 못 박혀 있다. 왜 그런지도.
 * 힌트 3: 정렬 기준이 심각도가 아니다. 왜인지 명세의 힌트를 읽어라.
 */
export function aggregateRed(spans: Span[], windowSec: number): RedRow[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: aggregateRed');
}

/**
 * 기대 서비스 목록 중 지표를 내지 않는 것을 찾는다 (사전순).
 */
export function findMissingServices(rows: RedRow[], expectedServices: string[]): string[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: findMissingServices');
}

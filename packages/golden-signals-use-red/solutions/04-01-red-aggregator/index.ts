/**
 * 과제 04-01의 참고 구현.
 *
 * 📍 되짚기: docs/04-red-method.md § 측정 지점, § 동형성 / docs/90-must-memorize.md 카드 4
 */

export interface Span {
	service: string;
	durationMs: number;
	failed: boolean;
}

export interface RedRow {
	service: string;
	rate: number;
	errors: number;
	errorRatio: number;
	durationP99Ms: number;
}

export function percentile(samples: number[], phi: number): number | null {
	if (samples.length === 0) return null;
	const sorted = [...samples].sort((a, b) => a - b);
	// 최근접 순위: phi 분위수는 "정렬된 표본에서 ceil(phi × n)번째 값"이다.
	// 1-based 순위를 0-based 인덱스로 바꾸느라 -1이 붙고, phi=0일 때 -1이 되지 않게 자른다.
	const rank = Math.ceil(phi * sorted.length);
	const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
	return sorted[index] ?? null;
}

export function aggregateRed(spans: Span[], windowSec: number): RedRow[] {
	// 한 번 묶어서 세 지표를 모두 그 그룹에서 만든다. 이것이 "Rate와 Errors는 같은
	// 관측 지점에서 나온다"를 코드로 지키는 방식이다 — 그룹을 두 번 만들면 필터 조건이
	// 어긋날 여지가 생기고, 어긋난 것이 값으로는 보이지 않는다.
	const groups = new Map<string, { durations: number[]; errors: number }>();
	for (const s of spans) {
		const g = groups.get(s.service) ?? { durations: [], errors: 0 };
		g.durations.push(s.durationMs);
		if (s.failed) g.errors += 1;
		groups.set(s.service, g);
	}

	const rows: RedRow[] = [];
	for (const [service, g] of groups) {
		const count = g.durations.length;
		rows.push({
			service,
			rate: windowSec > 0 ? count / windowSec : 0,
			errors: g.errors,
			errorRatio: count > 0 ? g.errors / count : 0,
			// 실패 스팬을 포함한다. RED의 Duration은 "소비자가 기다린 시간"이고,
			// 실패한 요청에도 기다린 시간이 있다. Golden Signals의 성공/실패 분리는
			// 감지 계층의 규율이라 여기와 목적이 다르다.
			durationP99Ms: percentile(g.durations, 0.99) ?? 0,
		});
	}

	// 정렬은 이름 사전순이다. 심각도 순으로 두면 행이 갱신마다 움직여서 "세 번째 줄이
	// 결제 서비스"라는 위치 기억이 생기지 않는다. 동형 테이블의 값은 "매번 같은 자리에
	// 같은 것이 있다"에서 나오므로, 심각도는 색으로 표시하고 위치는 고정한다.
	return rows.sort((a, b) => a.service.localeCompare(b.service));
}

export function findMissingServices(rows: RedRow[], expectedServices: string[]): string[] {
	const present = new Set(rows.map((r) => r.service));
	// 계측되지 않은 서비스는 "요청이 0건"과 구별되지 않는다. 그래서 기대 목록을 밖에서
	// 받아 대조하는 것이지, 지표만 보고는 빠진 것을 알 수 없다.
	return expectedServices.filter((s) => !present.has(s)).sort((a, b) => a.localeCompare(b));
}

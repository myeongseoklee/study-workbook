/**
 * 과제 3-5 — 마지막 컴팩트 기준 재생기
 *
 * 로그는 append-only인데 컴팩션은 "앞을 버린다". 이 충돌을 해소하는 방법은
 * 로그를 지우는 게 아니라 **재생 범위만 자르는** 것이다. 컴팩트 레코드가
 * 스냅샷 구분점이 된다.
 *
 * 명세:  tests/3-5-compact-replay.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 3-5
 * 막히면: docs/ep02-business-agent/04-compaction.md § 컴팩트 레코드와 불변 리스트
 */

export type EntryKind = 'request' | 'tool_call' | 'tool_result' | 'response' | 'compact';

export interface Entry {
	kind: EntryKind;
	/** 어느 엔트리인지 식별하기 위한 표식. 테스트가 순서를 확인할 때 쓴다. */
	id: string;
}

/**
 * 모델에게 보낼 입력을 만든다.
 *
 * 기반 컨텍스트 + (마지막 컴팩트 레코드 이후의 턴 로그).
 * 전체 로그에는 컴팩트 레코드가 여러 개 존재할 수 있다.
 */
export function buildModelInput(log: Entry[], baseContext: Entry[]): Entry[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: buildModelInput');
}

// 직접 실행하면 컴팩트 2개가 든 로그를 재생해 본다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const log: Entry[] = [
		{ kind: 'request', id: 'r1' },
		{ kind: 'compact', id: 'c1' },
		{ kind: 'request', id: 'r2' },
		{ kind: 'compact', id: 'c2' },
		{ kind: 'request', id: 'r3' },
	];
	const out = buildModelInput(log, [{ kind: 'request', id: 'base' }]);
	console.log(out.map((e) => e.id).join(' → '));
}

/**
 * 과제 3-5 — 마지막 컴팩트 기준 재생기
 *
 * 로그는 append-only인데 컴팩션은 "앞을 버린다". 이 충돌을 해소하는 방법은
 * 로그를 지우는 게 아니라 **재생 범위만 자르는** 것이다. 컴팩트 레코드가
 * 스냅샷 구분점이 된다.
 *
 * 판정:  npm run test:3-5
 * 막히면: docs/ep02-business-agent/04-compaction.md § 컴팩트 레코드와 불변 리스트
 *
 * 성공 기준 (테스트가 검사하는 항목)
 *  - 컴팩트가 없으면 전체 로그를 그대로 쓴다
 *  - 컴팩트가 하나면 그 레코드 **이후**만 쓴다 (컴팩트 레코드 자체는 포함)
 *  - 컴팩트가 여러 개면 **마지막** 것 기준으로 자른다
 *  - 컴팩트가 로그의 마지막 항목이어도 동작한다
 *  - baseContext가 항상 앞에 붙는다
 *  - 입력 로그를 변형하지 않는다
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

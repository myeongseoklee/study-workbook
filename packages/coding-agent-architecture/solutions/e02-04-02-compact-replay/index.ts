/**
 * 과제 3-5의 참고 구현.
 *
 * 판정은 `tests/e02-04-02-compact-replay/index.test.ts`가 한다.
 *
 * 📍 되짚기: docs/ep02-business-agent/04-compaction.md § 컴팩트 레코드와 불변 리스트
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
 * 로그는 append-only인데 컴팩션은 "앞을 버린다". 이 충돌은 로그를 지워서가
 * 아니라 **읽는 범위를 옮겨서** 풀린다. 컴팩트 레코드가 스냅샷 구분점이 되고,
 * 로그 자체는 감사 기록으로 온전히 남는다 — 이벤트 소싱에서 스냅샷이 하는 일과
 * 정확히 같다.
 *
 * 두 가지 경계에 주의한다.
 *
 *  - 컴팩트 레코드 **자체를 포함**한다. 그 안에 잘라낸 앞부분의 요약이 들어
 *    있어서, 빼면 앞 대화의 맥락이 통째로 사라진다.
 *  - **마지막** 컴팩트를 찾는다. 컴팩트는 세션이 길어지면 여러 번 일어나고,
 *    유효한 스냅샷은 늘 가장 최근 것 하나다.
 */
export function buildModelInput(log: Entry[], baseContext: Entry[]): Entry[] {
	let cut = 0;
	for (let i = log.length - 1; i >= 0; i--) {
		if (log[i]?.kind === 'compact') {
			cut = i;
			break;
		}
	}

	return [...baseContext, ...log.slice(cut)];
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

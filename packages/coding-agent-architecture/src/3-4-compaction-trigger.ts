/**
 * 과제 3-4 — 컴팩션 트리거 판정기
 *
 * 컴팩션의 어려운 쪽은 "어떻게 요약할까"가 아니라 **언제 할까**다. 이번 응답이
 * 얼마나 길어질지 모르는 상태에서, 잘림에 도달하기 전에 결정해야 한다.
 *
 * 명세:  tests/3-4-compaction-trigger.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 3-4
 * 막히면: docs/ep02-business-agent/04-compaction.md § 문제 1
 */

/** 컨텍스트 80% 지점이 최적 트리거다. 단 "80%"는 보낼 메시지의 토큰 수 기준이다. */
export const COMPACT_THRESHOLD: number = 0; // 🎯 TODO: 임계값을 정하라

export type EntryKind = 'request' | 'tool_call' | 'tool_result' | 'response' | 'compact';

export interface Entry {
	kind: EntryKind;
	tokens: number;
}

export interface Model {
	contextWindow: number;
}

/**
 * 지금 컴팩트해야 하는가.
 *
 * 컨텍스트는 실제 메모리가 아니라 **모델에게 보내는 내용**이다. 그래서 로그의
 * 토큰 수를 세야 하고, 이번 응답이 쓸 자리(headroom)를 미리 빼 둬야 한다.
 */
export function shouldCompact(log: Entry[], model: Model, headroom: number): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: shouldCompact');
}

/**
 * 한 턴을 진행하며 매 이벤트마다 컴팩트 여부를 판정한다.
 *
 * events를 순서대로 로그에 append 하되, **각 이벤트를 넣은 뒤** 컴팩트가
 * 필요한지 확인한다. 필요하면 `{ kind: 'compact', tokens: compactTokens }`를
 * append 한다(기존 엔트리는 지우지 않는다 — append-only 불변 리스트).
 *
 * 반환값은 새 로그다. 입력 log를 변형하지 않는다.
 */
export function runTurn(
	log: Entry[],
	events: Entry[],
	model: Model,
	opts: { headroom: number; compactTokens: number },
): Entry[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: runTurn');
}

// 직접 실행하면 도구 폭주 시나리오를 돌려본다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const model: Model = { contextWindow: 1000 };
	const log: Entry[] = [{ kind: 'request', tokens: 100 }];
	const events: Entry[] = [
		{ kind: 'tool_call', tokens: 50 },
		{ kind: 'tool_result', tokens: 700 },
		{ kind: 'response', tokens: 50 },
	];
	const out = runTurn(log, events, model, { headroom: 100, compactTokens: 80 });
	console.log(out.map((e) => `${e.kind}(${e.tokens})`).join(' → '));
}

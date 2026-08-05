/**
 * 과제 3-4의 참고 구현.
 *
 * 판정은 `tests/3-4-compaction-trigger.test.ts`가 한다.
 *
 * 📍 되짚기: docs/ep02-business-agent/04-compaction.md § 문제 1: 언제 트리거하는가
 */

/** 컨텍스트 80% 지점이 최적 트리거다. 단 "80%"는 보낼 메시지의 토큰 수 기준이다. */
export const COMPACT_THRESHOLD = 0.8;

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
 * 두 가지를 헷갈리지 않는 게 전부다.
 *
 * 첫째, 컨텍스트는 실제 메모리가 아니라 **모델에게 보내는 내용**이다. 그래서
 * 로그 전체의 토큰을 합산한다 — 마지막 엔트리 하나가 아니다.
 *
 * 둘째, 이번 응답이 쓸 자리(headroom)를 미리 빼 둔다. 판정 시점에 20%가 남아
 * 있어도 응답이 25%를 쓰면 잘린다. 응답 길이는 받아 보기 전에는 모르므로
 * 예상치를 선불로 계산에 넣는 수밖에 없다.
 */
export function shouldCompact(log: Entry[], model: Model, headroom: number): boolean {
	const used = log.reduce((sum, entry) => sum + entry.tokens, 0);
	return (used + headroom) / model.contextWindow >= COMPACT_THRESHOLD;
}

/**
 * 한 턴을 진행하며 매 이벤트마다 컴팩트 여부를 판정한다.
 *
 * 판정 지점이 턴 시작 하나뿐이면 도구 폭주를 놓친다. 200 토큰으로 시작한 턴에
 * 도구 결과가 700을 실어 오면 그 순간 컨텍스트를 넘기는데, 다음 턴 시작까지
 * 기다리면 이미 잘린 뒤다. 그래서 **이벤트를 넣은 직후마다** 다시 본다.
 *
 * 컴팩트할 때 앞 엔트리를 지우지 않는 것이 이 과제의 핵심이다. 로그는
 * append-only 감사 기록이고, 컴팩션이 하는 일은 로그를 줄이는 게 아니라
 * 재생 범위를 자를 지점을 표시하는 것이다 (실제로 자르는 쪽은 과제 3-5).
 */
export function runTurn(
	log: Entry[],
	events: Entry[],
	model: Model,
	opts: { headroom: number; compactTokens: number },
): Entry[] {
	let next = [...log];

	for (const event of events) {
		next = [...next, event];
		if (shouldCompact(next, model, opts.headroom)) {
			next = [...next, { kind: 'compact', tokens: opts.compactTokens }];
		}
	}

	return next;
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

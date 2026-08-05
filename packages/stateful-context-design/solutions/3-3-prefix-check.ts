/**
 * 과제 3-3의 참고 구현.
 *
 * 판정은 `tests/3-3-prefix-check.test.ts`가 한다.
 *
 * 📍 되짚기: docs/06-prompt-caching.md § 필수 지식 1~2 / docs/90-must-memorize.md 카드 11~14
 */

export interface Request {
	tools: unknown;
	system: unknown;
	messages: unknown;
}

export interface CompareResult {
	same: boolean;
	/** 다를 때 처음 갈라지는 위치 */
	offset?: number;
}

/**
 * 요청을 프리픽스 문자열로 렌더한다.
 *
 * 순서가 곧 무효화 범위를 정한다. tools가 맨 앞인 이유는 그것이 가장 안
 * 바뀌기 때문이다 — 자주 바뀌는 것을 앞에 두면 뒤 전체가 매번 무효가 된다.
 *
 * 구획 사이 개행은 형식이 아니라 안전장치다. 구분자가 없으면 한 구획의 끝과
 * 다음 구획의 시작이 맞붙어, 서로 다른 두 요청이 우연히 같은 문자열로
 * 렌더될 수 있다.
 */
export function renderPrefix(tools: unknown, system: unknown, messages: unknown): string {
	return [JSON.stringify(tools), JSON.stringify(system), JSON.stringify(messages)].join('\n');
}

/**
 * 두 요청의 프리픽스를 비교하고, 다르면 처음 갈라지는 오프셋을 돌려준다.
 *
 * ⚠️ 키를 정렬하거나 배열을 정규화하고 싶은 유혹이 있는데, 그러면 실제로
 *    캐시를 깨뜨리는 차이(도구 순서 변경 등)를 검사기가 못 본다. 검사기의
 *    직렬화는 요청 코드의 직렬화와 **같아야** 한다. 관대한 비교는 여기서
 *    미덕이 아니다.
 *
 * 오프셋이 유용한 이유는 "다르다"만으로는 고칠 수 없기 때문이다. 오프셋이
 * 앞쪽이면 tools·system이 흔들린다는 뜻이고 — 그러면 대화 전체가 매번
 * 무효다 — 뒤쪽이면 messages 꼬리만 자란 정상 동작이다.
 */
export function compare(a: Request, b: Request): CompareResult {
	const sa = renderPrefix(a.tools, a.system, a.messages);
	const sb = renderPrefix(b.tools, b.system, b.messages);

	if (sa === sb) return { same: true };

	const limit = Math.min(sa.length, sb.length);
	let offset = 0;
	while (offset < limit && sa[offset] === sb[offset]) offset++;

	return { same: false, offset };
}

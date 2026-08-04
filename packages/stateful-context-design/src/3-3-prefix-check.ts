/**
 * 과제 3-3 — 프롬프트 캐시 프리픽스 안정성 검사기
 *
 * 같은 논리적 요청을 두 번 만들었을 때 프리픽스가 바이트 단위로 같은지
 * 판정한다. 캐시 미적중은 에러를 내지 않으므로, 이런 검사기가 없으면
 * 조용히 비용만 낸다.
 *
 * 판정:  npm run test:3-3
 * 막히면: docs/06-prompt-caching.md § 필수 지식 1~2
 *
 * 성공 기준 (테스트가 검사하는 항목)
 *  - 렌더 순서가 tools → system → messages다 (tools가 위치 0)
 *  - 동일 입력이면 same=true
 *  - 다르면 same=false이고 처음 갈라지는 오프셋을 정수로 보고한다
 *  - 그 오프셋이 실제로 바뀐 구간을 가리킨다
 *  - 시스템 프롬프트에 now()가 들어가면 두 번 만든 요청을 불안정으로 판정한다
 *  - 도구 목록의 순서만 바꿔도 불안정으로 판정한다
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
 * 순서가 곧 캐시 무효화 범위를 정한다 — 앞에 있는 것이 바뀌면 뒤 전체가
 * 무효다. 실제 API의 렌더 순서를 따를 것.
 */
export function renderPrefix(tools: unknown, system: unknown, messages: unknown): string {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: renderPrefix');
}

/**
 * 두 요청의 프리픽스를 비교한다.
 *
 * ⚠️ 함정: 직렬화할 때 키나 배열을 정렬해 "정규화"하고 싶어지는데,
 *    그러면 실제로 캐시를 깨뜨리는 차이(도구 순서 변경 등)를 놓친다.
 *    검사기는 실제 요청 코드와 **같은** 직렬화를 봐야 한다.
 */
export function compare(a: Request, b: Request): CompareResult {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: compare');
}

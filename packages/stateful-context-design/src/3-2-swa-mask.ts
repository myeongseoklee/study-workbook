/**
 * 과제 3-2 — 슬라이딩 윈도우 + attention sink 마스크 생성기
 *
 * 실제 어텐션 계산은 필요 없다. 어떤 위치가 보이는지만 판정한다.
 *
 * 명세:  tests/3-2-swa-mask.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 3-2
 * 막히면: docs/07-sliding-window.md § 필수 지식 1
 */

/**
 * 토큰 i가 토큰 j를 볼 수 있는가.
 *
 * 세 가지 규칙이 겹친다. 순서가 중요하다 — 어느 규칙이 다른 규칙을
 * 덮어써야 하는지 생각해 보라.
 *
 * @param i      보는 쪽 토큰의 위치
 * @param j      보이는 쪽 토큰의 위치
 * @param W      슬라이딩 윈도우 크기
 * @param nSink  영구 고정할 앞쪽 토큰 개수 (attention sink)
 */
export function visible(i: number, j: number, W: number, nSink = 0): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: visible');
}

/**
 * n × n 마스크를 표준출력에 그린다. 보이는 자리는 '■', 가려진 자리는 '·'.
 *
 * 출력을 눈으로 확인할 것: sink 열이 **모든 행에서** 채워져 있는가?
 * 그것이 "영구 고정"의 시각적 의미다.
 */
export function render(n: number, W: number, nSink = 0): void {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: render');
}

// 직접 실행하면 W=4, nSink=2, n=10 마스크를 그린다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	render(10, 4, 2);
}

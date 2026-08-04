/**
 * 과제 3-2 — 슬라이딩 윈도우 + attention sink 마스크 생성기
 *
 * 실제 어텐션 계산은 필요 없다. 어떤 위치가 보이는지만 판정한다.
 *
 * 판정:  npm run test:3-2
 * 막히면: docs/07-sliding-window.md § 필수 지식 1
 *
 * 성공 기준 (테스트가 검사하는 항목)
 *  - (i, j, W, nSink)를 받아 boolean을 반환한다
 *  - causal 조건이 반영돼 있다 (j > i면 차단, j === i는 보임)
 *  - 창 조건이 경계까지 정확하다 (i − W < j 인지 i − W ≤ j 인지)
 *  - sink 예외가 반영돼 있다 (j < nSink면 창을 벗어나도 보임)
 *  - sink가 causal을 뚫지 않는다 (미래 토큰이 sink라도 못 봄)
 *  - W=4, nSink=2, n=10 렌더링에서 왼쪽 2열이 세로로 채워진다
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

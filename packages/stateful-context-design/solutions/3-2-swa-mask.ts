/**
 * 과제 3-2의 참고 구현.
 *
 * 판정은 `tests/3-2-swa-mask.test.ts`가 한다.
 *
 * 📍 되짚기: docs/07-sliding-window.md § 필수 지식 1 / docs/90-must-memorize.md 카드 16
 */

/**
 * 토큰 i가 토큰 j를 볼 수 있는가.
 *
 * 세 규칙이 겹치는데 **순서가 곧 의미**다.
 *
 *  1. causal이 먼저다. 미래는 무슨 일이 있어도 못 본다 — sink도 이걸 뚫지 못한다.
 *  2. 그다음 sink 예외. 앞쪽 nSink개는 창이 지나가도 남는다.
 *  3. 마지막이 창 조건. `i - W < j`이지 `<=`가 아니다 — j가 정확히 W개만
 *     살아남아야 한다.
 *
 * 2번과 3번을 바꿔 쓰면 sink가 무력해지고, 1번을 뒤로 미루면 미래가 보인다.
 */
export function visible(i: number, j: number, W: number, nSink = 0): boolean {
	if (j > i) return false;
	if (j < nSink) return true;
	return i - W < j;
}

/**
 * n × n 마스크를 표준출력에 그린다. 보이는 자리는 '■', 가려진 자리는 '·'.
 *
 * 출력을 눈으로 볼 것. 왼쪽 sink 열이 세로로 쭉 이어지고, 그 오른쪽에 대각선을
 * 따라 창이 흘러가며, 둘 사이에 빈 구간이 벌어진다. "좁은 창으로 멀리 본다"는
 * 말의 그림이 바로 이것이다 — 창은 좁지만 sink가 앵커로 남는다.
 */
export function render(n: number, W: number, nSink = 0): void {
	for (let i = 0; i < n; i++) {
		let row = '';
		for (let j = 0; j < n; j++) {
			row += visible(i, j, W, nSink) ? '■' : '·';
		}
		console.log(row);
	}
}

// 직접 실행하면 W=4, nSink=2, n=10 마스크를 그린다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	render(10, 4, 2);
}

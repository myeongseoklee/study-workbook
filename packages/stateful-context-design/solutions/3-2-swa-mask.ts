/**
 * 과제 3-2의 정답 — 테스트 코드
 *
 * 실행: npm run test:3-2
 *
 * 이 과제의 함정은 **경계 조건**이다. `i - W < j`를 `i - W <= j`로 쓰면
 * 창이 W+1이 되는데, 눈으로는 거의 구별되지 않는다. "창 경계 정확" 항목이
 * 그것만 콕 집어 잡는다.
 */
import { visible, render } from '../src/3-2-swa-mask.js';

let pass = 0;
let total = 0;

function check(label: string, cond: boolean, detail = ''): void {
	total++;
	if (cond) pass++;
	console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? `\n    ${detail}` : ''}`);
}

// 기준 1 — (i, j, W, nSink)로 가시성을 반환한다
check(
	'boolean을 반환',
	typeof visible(3, 2, 4, 0) === 'boolean',
	`반환 타입: ${typeof visible(3, 2, 4, 0)}`,
);

// 기준 2 — causal: 미래는 못 본다
check('미래 차단 (j > i)', visible(2, 5, 4) === false, 'j > i인데 true를 반환했습니다');
check('자기 자신은 봄 (j === i)', visible(5, 5, 4) === true);

// 기준 3 — 창 조건이 경계까지 정확한가 (i − W < j)
check('창 안은 보임', visible(9, 6, 4) === true, 'W=4, i=9 → j=6은 창 안(6 > 5)');
check('창 밖은 차단', visible(9, 5, 4) === false, 'W=4, i=9 → j=5는 창 밖(5 ≤ 5)');
check(
	'창 경계 정확',
	visible(9, 4, 4) === false && visible(9, 6, 4) === true,
	'경계가 i-W < j 인지 i-W <= j 인지 확인 — 하나 차이로 창 크기가 달라집니다',
);

// 기준 4 — sink 예외: 창을 벗어나도 보인다
check(
	'sink는 창 밖에서도 보임',
	visible(50, 0, 4, 2) === true,
	'i=50이면 j=0은 창을 한참 벗어나지만 sink이므로 보여야 합니다',
);
check(
	'sink 범위 밖은 여전히 차단',
	visible(50, 2, 4, 2) === false,
	'nSink=2면 j=0,1만 sink입니다',
);

// 기준 5 — sink가 causal을 뚫지 않는다
check(
	'sink가 causal을 뚫지 않음',
	visible(1, 0, 4, 2) === true && visible(0, 1, 4, 2) === false,
	'미래 토큰이 sink라도 볼 수 없어야 합니다',
);

// 기준 6 — W=4, nSink=2, n=10 렌더링에서 sink 열이 모든 행에 채워진다
const captured: string[] = [];
const originalLog = console.log;
console.log = (...args: unknown[]) => {
	captured.push(args.join(' '));
};
render(10, 4, 2);
console.log = originalLog;

const rows = captured.filter((r) => r.trim().length > 0);
check('10행 출력', rows.length === 10, `실제 ${rows.length}행`);
if (rows.length === 10) {
	const blank = (ch: string | undefined) => ch === '.' || ch === '·' || ch === ' ' || ch === undefined;
	const col0 = rows.every((r) => !blank(r[0]));
	const col1 = rows.slice(1).every((r) => !blank(r[1])); // 0행의 j=1은 미래라 제외
	check(
		'sink 열이 세로로 채워짐',
		col0 && col1,
		"왼쪽 2열이 모든 행에서 보여야 합니다 — 이것이 '영구 고정'의 시각적 의미",
	);
}

console.log(`\n${pass}/${total} 통과`);

// 📍 되짚기: docs/07-sliding-window.md § 필수 지식 1 / docs/90-must-memorize.md 카드 16
process.exit(pass === total ? 0 : 1);

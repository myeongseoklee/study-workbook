/**
 * 과제 3-2의 명세 — 슬라이딩 윈도우 + attention sink 마스크
 *
 * 이 파일이 과제의 정의다. `src/07-01-swa-mask/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다.
 *
 * 이 과제의 함정은 **경계 조건**과 **규칙의 우선순위**다. `i - W < j`를
 * `i - W <= j`로 쓰면 창이 W+1이 되는데 눈으로는 거의 구별되지 않고,
 * sink 예외를 causal보다 먼저 적용하면 미래를 보게 된다. 아래 검사들이
 * 그 두 지점을 콕 집는다.
 *
 * 실행: pnpm test 07-01
 */
import { captureStdout, retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { render, visible } from '../../src/07-01-swa-mask';

describe('visible — causal 규칙', () => {
	it('미래는 볼 수 없다 (j > i)', () => {
		expect(visible(2, 5, 4)).toBe(false);
	});

	it('자기 자신은 본다 (j === i)', () => {
		expect(visible(5, 5, 4)).toBe(true);
	});
});

describe('visible — 창 규칙', () => {
	it('창 안은 보인다 (W=4, i=9 → j=6)', () => {
		expect(visible(9, 6, 4)).toBe(true);
	});

	it('창 밖은 차단된다 (W=4, i=9 → j=5)', () => {
		expect(visible(9, 5, 4)).toBe(false);
	});

	it('창 경계가 정확하다 — 창 크기가 딱 W다', () => {
		retrace(
			'경계가 `i - W < j`인지 `i - W <= j`인지 확인하라. 하나 차이로 창이 W+1이 된다. ' +
				'i=9, W=4면 볼 수 있는 것은 j=6,7,8,9 네 개다.',
			() => {
				const seen = [4, 5, 6, 7, 8, 9].filter((j) => visible(9, j, 4));
				expect(seen).toEqual([6, 7, 8, 9]);
			},
		);
	});
});

describe('visible — attention sink 예외', () => {
	it('sink는 창을 한참 벗어나도 보인다', () => {
		retrace(
			'i=50이면 j=0은 창 밖이지만 sink라서 보여야 한다. 이 예외가 없으면 앞쪽 토큰이 축출되고 ' +
				'softmax가 갈 곳을 잃어 perplexity가 폭증한다 — 그것이 sink를 고정하는 이유다.',
			() => {
				expect(visible(50, 0, 4, 2)).toBe(true);
			},
		);
	});

	it('sink 범위 밖은 여전히 차단된다 (nSink=2면 j=0,1만 sink)', () => {
		expect(visible(50, 2, 4, 2)).toBe(false);
	});

	it('sink가 causal을 뚫지 않는다', () => {
		retrace(
			'미래 토큰이 sink 범위에 들어도 볼 수 없어야 한다. 규칙을 적용하는 순서 문제다 — ' +
				'causal이 sink보다 먼저 판정돼야 한다.',
			() => {
				expect(visible(1, 0, 4, 2)).toBe(true);
				expect(visible(0, 1, 4, 2)).toBe(false);
			},
		);
	});

	it('nSink 기본값은 0이다 (순수 슬라이딩 윈도우)', () => {
		expect(visible(50, 0, 4)).toBe(false);
	});
});

describe('render — 마스크 그리기', () => {
	const draw = () => captureStdout(() => render(10, 4, 2));

	it('n × n 격자를 그린다', () => {
		const rows = draw();
		expect(rows).toHaveLength(10);
		for (const row of rows) expect([...row]).toHaveLength(10);
	});

	it('보이는 자리는 ■, 가려진 자리는 ·다', () => {
		expect(draw().join('')).toMatch(/^[■·]+$/);
	});

	it('격자가 visible()의 판정과 한 칸도 어긋나지 않는다', () => {
		const rows = draw();
		for (let i = 0; i < 10; i++) {
			for (let j = 0; j < 10; j++) {
				expect([i, j, rows[i]![j]]).toEqual([i, j, visible(i, j, 4, 2) ? '■' : '·']);
			}
		}
	});

	it('sink 열이 세로로 이어진다 — "영구 고정"의 시각적 의미', () => {
		retrace(
			'i ≥ nSink인 모든 행에서 왼쪽 두 칸이 채워져야 한다. 이 세로줄이 끊기면 sink가 ' +
				'창과 함께 흘러가고 있다는 뜻이다.',
			() => {
				const rows = draw();
				for (let i = 2; i < 10; i++) {
					expect(rows[i]!.slice(0, 2)).toBe('■■');
				}
			},
		);
	});

	it('sink 열과 창 띠 사이에 빈 구간이 생긴다 — 창이 흐른 흔적', () => {
		// i=9, W=4, nSink=2 → 보이는 것은 j=0,1 (sink)과 j=6..9 (창). 그 사이 j=2..5는 비어야 한다.
		expect(draw()[9]).toBe('■■····■■■■');
	});
});

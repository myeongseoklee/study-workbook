/**
 * 과제 05-01의 명세 — 전제 부정 계산기
 *
 * 이 파일이 과제의 정의다. `src/05-01-premise-negation/index.ts`를 채워
 * 여기를 통과시켜라. 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라
 * 이해가 틀렸을 가능성이 먼저다 — docs/05-cutting-the-cable.md의
 * "전제를 끊었을 때의 세 답"을 다시 읽어라.
 *
 * 실행: pnpm --filter ai-work-delegation test 05-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	type Argument,
	holdsWithout,
	loadBearing,
	minimalBreakingSets,
} from '../../src/05-01-premise-negation';

const arg = (paths: string[][]): Argument => ({ conclusion: '주가가 빠졌다', paths });

describe('holdsWithout — 끊고 나서도 결론이 서는가', () => {
	it('아무것도 끊지 않으면 결론은 선다', () => {
		expect(holdsWithout(arg([['a', 'b']]), [])).toBe(true);
	});

	it('유일한 경로의 전제를 끊으면 무너진다', () => {
		expect(holdsWithout(arg([['a', 'b']]), ['a'])).toBe(false);
	});

	it('경로에 없는 전제를 끊는 것은 아무 일도 아니다', () => {
		expect(holdsWithout(arg([['a', 'b']]), ['c'])).toBe(true);
	});

	it('🔴 경로가 둘이면 하나를 끊어도 다른 경로로 결론이 선다', () => {
		retrace(
			'경로끼리는 OR다. 모든 전제를 한 덩어리로 합쳐 놓고 "부정된 것이 ' +
				'하나라도 있으면 무너진다"로 계산하면 여기서 false가 나온다. ' +
				'무너지려면 **모든 경로가** 끊겨야 한다.',
			() => {
				expect(holdsWithout(arg([['a'], ['b']]), ['a'])).toBe(true);
				expect(holdsWithout(arg([['a'], ['b']]), ['a', 'b'])).toBe(false);
			},
		);
	});

	it('한 경로 안의 전제는 AND다 — 하나만 끊겨도 그 경로는 죽는다', () => {
		expect(holdsWithout(arg([['a', 'b'], ['c']]), ['b'])).toBe(true);
		expect(holdsWithout(arg([['a', 'b'], ['c']]), ['b', 'c'])).toBe(false);
	});

	it('전제 없는 경로가 있으면 무엇을 끊어도 결론이 선다', () => {
		retrace(
			'빈 경로는 "조건 없이 성립하는 근거"다. 빈 배열을 순회할 것이 없다고 ' +
				'건너뛰면 이 경로가 사라져 결론이 무너진 것으로 계산된다.',
			() => {
				expect(holdsWithout(arg([[], ['a']]), ['a'])).toBe(true);
			},
		);
	});

	it('같은 전제가 한 경로에 두 번 적혀도 결과가 달라지지 않는다', () => {
		expect(holdsWithout(arg([['a', 'a', 'b']]), ['a'])).toBe(false);
		expect(holdsWithout(arg([['a', 'a', 'b']]), ['c'])).toBe(true);
	});

	it('지지 경로가 하나도 없으면 RangeError를 던진다', () => {
		retrace(
			'근거가 없는 결론에 "끊어도 서는가"를 물으면 답이 항상 false로 나오고, ' +
				'그것이 "모든 전제가 급소"라는 잘못된 보고로 이어진다. ' +
				'계산이 성립하지 않는 입력은 계산하지 않고 던지는 편이 정직하다.',
			() => {
				expect(() => holdsWithout(arg([]), [])).toThrow(RangeError);
			},
		);
	});
});

describe('loadBearing — 혼자 끊어도 결론이 무너지는 전제', () => {
	it('경로가 하나면 그 안의 전제가 전부 급소다', () => {
		expect(loadBearing(arg([['수요', '가격']]))).toEqual(['가격', '수요']);
	});

	it('🔴 경로가 둘이면 단독 급소가 없다', () => {
		retrace(
			'05장의 "지지 경로가 하나뿐인 결론은 그 경로가 급소다"를 뒤집은 것이다. ' +
				'경로가 둘이면 어느 하나를 끊어도 다른 쪽이 결론을 떠받친다 — ' +
				'그래서 목록이 빈다. 빈 목록은 실패가 아니라 **단단하다는 판정**이다.',
			() => {
				expect(loadBearing(arg([['a'], ['b']]))).toEqual([]);
			},
		);
	});

	it('모든 경로가 공유하는 전제만 급소가 된다', () => {
		expect(loadBearing(arg([['공통', 'x'], ['공통', 'y']]))).toEqual(['공통']);
	});

	it('사전순으로 돌려준다 — 등장 순서가 아니다', () => {
		expect(loadBearing(arg([['c', 'a', 'b']]))).toEqual(['a', 'b', 'c']);
	});

	it('전제 없는 경로가 있으면 급소가 없다', () => {
		expect(loadBearing(arg([[], ['a']]))).toEqual([]);
	});
});

describe('minimalBreakingSets — 결론을 무너뜨리는 최소 조합', () => {
	it('경로가 하나면 그 안의 각 전제가 단독으로 최소 조합이다', () => {
		expect(minimalBreakingSets(arg([['a', 'b']]), 2)).toEqual([['a'], ['b']]);
	});

	it('🔴 무너뜨리는 조합의 상위집합은 넣지 않는다', () => {
		retrace(
			'{a}가 이미 결론을 무너뜨리므로 {a,b}도 무너뜨린다. 그러나 {a,b}는 ' +
				'최소가 아니다 — b를 빼도 여전히 무너진다. 최소성 검사를 빼면 ' +
				'목록이 지수적으로 불어나면서 정보는 하나도 늘지 않는다.',
			() => {
				expect(minimalBreakingSets(arg([['a', 'b']]), 2)).not.toContainEqual(['a', 'b']);
			},
		);
	});

	it('경로가 둘이면 각 경로에서 하나씩 골라야 한다', () => {
		expect(minimalBreakingSets(arg([['a'], ['b']]), 2)).toEqual([['a', 'b']]);
	});

	it('maxSize를 넘는 조합은 찾지 않는다', () => {
		retrace(
			'경로가 셋이면 최소 세 개를 끊어야 무너진다. maxSize 2에서는 ' +
				'무너뜨릴 방법이 없으므로 빈 목록이 정답이다 — 그리고 그 빈 목록이 ' +
				'"두 개로는 못 깬다"는 유용한 보고다.',
			() => {
				expect(minimalBreakingSets(arg([['a'], ['b'], ['c']]), 2)).toEqual([]);
				expect(minimalBreakingSets(arg([['a'], ['b'], ['c']]), 3)).toEqual([['a', 'b', 'c']]);
			},
		);
	});

	it('크기 오름차순, 같은 크기끼리는 사전순으로 돌려준다', () => {
		retrace(
			'작은 조합이 앞에 와야 한다 — 하나만 확인하면 되는 값싼 공격부터 봐야 하기 ' +
				'때문이다. 여기서 {a,d}는 세 경로를 두 개로 끊고, {b,c,d}는 세 개로 끊는다.',
			() => {
				const a = arg([
					['a', 'b'],
					['a', 'c'],
					['d'],
				]);
				expect(minimalBreakingSets(a, 3)).toEqual([
					['a', 'd'],
					['b', 'c', 'd'],
				]);
			},
		);
	});

	it('각 조합 안의 전제도 사전순으로 정렬한다', () => {
		expect(minimalBreakingSets(arg([['z'], ['a']]), 2)).toEqual([['a', 'z']]);
	});

	it('전제 없는 경로가 있으면 무너뜨릴 방법이 없다', () => {
		expect(minimalBreakingSets(arg([[], ['a']]), 3)).toEqual([]);
	});

	it('loadBearing과 어긋나지 않는다 — 크기 1 조합이 곧 단독 급소다', () => {
		retrace(
			'두 함수가 같은 사실을 다른 경로로 계산한다. 어긋나면 둘 중 하나가 틀렸다.',
			() => {
				const a = arg([
					['공통', 'x'],
					['공통', 'y'],
				]);
				const 단독 = minimalBreakingSets(a, 3)
					.filter((s) => s.length === 1)
					.map((s) => s[0]);
				expect(단독).toEqual(loadBearing(a));
			},
		);
	});

	it('maxSize 0이면 빈 목록이다', () => {
		expect(minimalBreakingSets(arg([['a']]), 0)).toEqual([]);
	});

	it('maxSize가 깨져 있으면 RangeError를 던진다', () => {
		expect(() => minimalBreakingSets(arg([['a']]), -1)).toThrow(RangeError);
		expect(() => minimalBreakingSets(arg([['a']]), 1.5)).toThrow(RangeError);
	});
});

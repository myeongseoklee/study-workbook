/**
 * 과제 03-01의 명세 — 가설 다양성 판정기
 *
 * 이 파일이 과제의 정의다. `src/03-01-hypothesis-diversity/index.ts`를 채워
 * 여기를 통과시켜라. 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라
 * 이해가 틀렸을 가능성이 먼저다 — docs/03-search-space-design.md의
 * "③ 다양성을 강제한다"를 다시 읽어라.
 *
 * 실행: pnpm --filter ai-work-delegation test 03-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	type Hypothesis,
	assessDiversity,
	dedupeByMechanism,
	missingDomains,
	normalizeMechanism,
} from '../../src/03-01-hypothesis-diversity';

const h = (id: string, domain: string, mechanism: string): Hypothesis => ({ id, domain, mechanism });

describe('normalizeMechanism — 표기 차이를 지우고 인과 경로만 남긴다', () => {
	it('대소문자와 앞뒤 공백을 무시한다', () => {
		expect(normalizeMechanism('  FX Hedge Failure ')).toBe(normalizeMechanism('fx hedge failure'));
	});

	it('가운데의 연속 공백도 한 칸으로 줄인다', () => {
		retrace(
			'trim()만 해서는 "환율   변동"과 "환율 변동"이 다른 것으로 남는다. ' +
				'가운데 공백까지 접어야 표기 차이가 실제로 지워진다.',
			() => {
				expect(normalizeMechanism('환율   변동')).toBe(normalizeMechanism('환율 변동'));
			},
		);
	});

	it('서로 다른 인과 경로까지 뭉개지는 않는다', () => {
		expect(normalizeMechanism('환율 변동')).not.toBe(normalizeMechanism('금리 변동'));
	});
});

describe('dedupeByMechanism — 같은 메커니즘의 변형은 하나로 센다', () => {
	const 후보 = [
		h('A', '재무', '환율 변동'),
		h('B', '재무', '  환율   변동  '),
		h('C', '공급망', '납기 지연'),
		h('D', '재무', 'FX 변동'),
	];

	it('먼저 등장한 것을 남긴다 — 나중 것이 아니다', () => {
		retrace(
			'Map/Set에 계속 덮어쓰면 마지막 것이 남는다. 프롬프트 규칙은 ' +
				'"앞의 가설과 같은 메커니즘의 변형은 새로 세지 마라"이므로 앞의 것이 원본이다.',
			() => {
				expect(dedupeByMechanism(후보).map((x) => x.id)).toEqual(['A', 'C', 'D']);
			},
		);
	});

	it('입력 순서를 유지한다 — 정렬하지 않는다', () => {
		const 뒤섞인 = [h('Z', '규제', '규제 변경'), h('Y', '경쟁', '신규 진입'), h('X', '회계', '충당금')];
		expect(dedupeByMechanism(뒤섞인).map((x) => x.id)).toEqual(['Z', 'Y', 'X']);
	});

	it('원본 배열을 훼손하지 않는다', () => {
		const 원본순서 = 후보.map((x) => x.id);
		dedupeByMechanism(후보);
		expect(후보.map((x) => x.id)).toEqual(원본순서);
	});

	it('빈 목록은 빈 목록이다', () => {
		expect(dedupeByMechanism([])).toEqual([]);
	});

	it('영역이 달라도 메커니즘이 같으면 중복이다', () => {
		retrace(
			'중복 판정의 키는 메커니즘 하나뿐이다. domain을 키에 섞으면 ' +
				'같은 인과 경로를 영역만 바꿔 적은 후보가 살아남는다 — 그게 개수 채우기의 전형이다.',
			() => {
				const 같은경로 = [h('A', '재무', '수요 둔화'), h('B', '고객행동', '수요 둔화')];
				expect(dedupeByMechanism(같은경로).map((x) => x.id)).toEqual(['A']);
			},
		);
	});
});

describe('missingDomains — 요구 영역 중 비어 있는 칸', () => {
	const 요구 = ['회계', '재무', '공급망', '규제'];

	it('덮이지 않은 영역을 required에 적힌 순서로 돌려준다', () => {
		const 목록 = [h('A', '재무', 'm1'), h('B', '규제', 'm2')];
		expect(missingDomains(목록, 요구)).toEqual(['회계', '공급망']);
	});

	it('돌려주는 값은 required의 원래 표기다', () => {
		retrace(
			'비교는 정규화해서 하되, 결과는 호출자가 준 표기 그대로여야 보고에 쓸 수 있다.',
			() => {
				expect(missingDomains([h('A', '  재무 ', 'm1')], ['재무', '회계'])).toEqual(['회계']);
			},
		);
	});

	it('요구 영역이 없으면 빠진 것도 없다', () => {
		expect(missingDomains([h('A', '재무', 'm1')], [])).toEqual([]);
	});

	it('가설이 하나도 없으면 요구 영역이 전부 빠진 것이다', () => {
		expect(missingDomains([], 요구)).toEqual(요구);
	});

	it('요구 목록에 없는 영역을 덮어도 점수가 되지 않는다', () => {
		expect(missingDomains([h('A', '시장심리', 'm1')], ['회계'])).toEqual(['회계']);
	});
});

describe('assessDiversity — 두 제약을 함께 판정한다', () => {
	const 요구 = ['회계', '재무', '공급망'];

	it('중복을 걷어낸 개수를 센다', () => {
		const 목록 = [
			h('A', '회계', '충당금'),
			h('B', '재무', '충당금'),
			h('C', '공급망', '납기'),
		];
		const r = assessDiversity(목록, 요구, 1);
		expect(r.distinct).toBe(2);
		expect(r.dropped.map((x) => x.id)).toEqual(['B']);
	});

	it('🔴 중복으로 걷어낸 가설은 영역 커버리지에도 기여하지 않는다', () => {
		retrace(
			'이 과제의 핵심이다. B는 메커니즘이 A와 같아 "새로운 가설로 세지 않는다"고 ' +
				'판정된 것이므로, B가 유일하게 덮던 "재무"도 덮이지 않은 것이다. ' +
				'커버리지를 원본 목록으로 계산하면 여기서 missingDomains가 비어 나온다 — ' +
				'즉 판정이 실제보다 후해진다. 중복 제거 → 커버리지 계산 순서를 확인하라.',
			() => {
				const 목록 = [
					h('A', '회계', '충당금'),
					h('B', '재무', '  충당금  '),
					h('C', '공급망', '납기'),
				];
				expect(assessDiversity(목록, 요구, 1).missingDomains).toEqual(['재무']);
			},
		);
	});

	it('개수와 커버리지를 둘 다 만족해야 satisfied다', () => {
		const 완전한목록 = [
			h('A', '회계', '충당금'),
			h('B', '재무', '환율'),
			h('C', '공급망', '납기'),
		];
		expect(assessDiversity(완전한목록, 요구, 3).satisfied).toBe(true);
		expect(assessDiversity(완전한목록, 요구, 4).satisfied).toBe(false);
		expect(assessDiversity(완전한목록, [...요구, '규제'], 3).satisfied).toBe(false);
	});

	it('경계는 "이상"이다 — distinct가 minDistinct와 같으면 통과한다', () => {
		retrace('minDistinct는 하한이다. 초과가 아니라 이상에서 통과한다.', () => {
			const 목록 = [h('A', '회계', 'm1'), h('B', '재무', 'm2'), h('C', '공급망', 'm3')];
			expect(assessDiversity(목록, 요구, 3).satisfied).toBe(true);
		});
	});

	it('빈 목록에서도 던지지 않고 판정한다', () => {
		const r = assessDiversity([], 요구, 1);
		expect(r).toEqual({ distinct: 0, dropped: [], missingDomains: 요구, satisfied: false });
	});

	it('minDistinct가 깨져 있으면 판정하지 않고 RangeError를 던진다', () => {
		retrace(
			'깨진 기준으로 낸 satisfied는 그것을 근거로 한 "다음 단계로 넘어가도 된다"는 ' +
				'판단을 조용히 오염시킨다. 판정기는 자기 입력을 먼저 판정해야 한다.',
			() => {
				expect(() => assessDiversity([], 요구, -1)).toThrow(RangeError);
				expect(() => assessDiversity([], 요구, 1.5)).toThrow(RangeError);
			},
		);
	});

	it('minDistinct 0은 유효하다 — 커버리지만 보겠다는 뜻이다', () => {
		expect(assessDiversity([h('A', '회계', 'm')], ['회계'], 0).satisfied).toBe(true);
	});
});

/**
 * 과제 3-3의 명세 — 기반 컨텍스트 조립기
 *
 * 이 파일이 과제의 정의다. `src/e02-03-01-context-assembler/index.ts`를 채워 여기를
 * 통과시켜라. 이 파일은 고치지 않는다.
 *
 * 우선순위 검사에 주의하라. 테스트는 "어느 순서가 정답인지"를 묻지 않는다.
 * 당신이 SCOPE_PRIORITY에 무엇을 넣었든, resolveSkills가 **그 상수를 실제로
 * 참조하는지**를 본다. 규칙이 한 곳에 있어야 유지된다는 것이 요점이다.
 *
 * 실행: pnpm test e02-03-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	exceedsBudget,
	resolveSkills,
	resolveTools,
	SCOPE_PRIORITY,
	type Scope,
} from '../../src/e02-03-01-context-assembler';

describe('SCOPE_PRIORITY — 규칙이 한 곳에 있는가', () => {
	it('세 스코프가 모두 명시돼 있다', () => {
		const all: Scope[] = ['system', 'global', 'project'];
		expect([...SCOPE_PRIORITY].sort()).toEqual([...all].sort());
	});
});

describe('resolveSkills — 이름 충돌 해소', () => {
	const first = () => SCOPE_PRIORITY[0]!;
	const last = () => SCOPE_PRIORITY[SCOPE_PRIORITY.length - 1]!;

	it('같은 이름은 하나만 남는다', () => {
		const resolved = resolveSkills([
			{ name: 'dup', scope: last() },
			{ name: 'dup', scope: first() },
		]);
		expect(resolved).toHaveLength(1);
	});

	it('남는 쪽이 SCOPE_PRIORITY에서 앞선 스코프다 — 입력 순서가 아니다', () => {
		retrace(
			'입력에서는 우선순위가 낮은 쪽이 먼저 나온다. 먼저 온 것을 남기거나 나중 것으로 ' +
				'덮어쓰면, 둘 중 하나는 통과하고 다른 하나는 실패한다.',
			() => {
				expect(resolveSkills([
					{ name: 'dup', scope: last() },
					{ name: 'dup', scope: first() },
				])[0]?.scope).toBe(first());

				expect(resolveSkills([
					{ name: 'dup', scope: first() },
					{ name: 'dup', scope: last() },
				])[0]?.scope).toBe(first());
			},
		);
	});

	it('이름이 겹치지 않는 스킬은 모두 살아남는다', () => {
		const resolved = resolveSkills([
			{ name: 'a', scope: 'global' },
			{ name: 'b', scope: 'project' },
			{ name: 'a', scope: 'system' },
			{ name: 'c', scope: 'system' },
		]);
		expect(resolved.map((s) => s.name).sort()).toEqual(['a', 'b', 'c']);
	});

	it('빈 입력에는 빈 결과를 돌려준다', () => {
		expect(resolveSkills([])).toEqual([]);
	});
});

describe('resolveTools — 세 입력이 겹쳐 결과가 정해진다', () => {
	it('(전체 − 퍼미션 차단) ∩ 스킬 허용', () => {
		retrace(
			'차단(bash)과 한정(write 제외)이 함께 걸려야 한다. 하나만 적용하면 3개가 남는다.',
			() => {
				expect(resolveTools(['read', 'write', 'bash', 'web'], ['bash'], ['read', 'bash', 'web'])).toEqual([
					'read',
					'web',
				]);
			},
		);
	});

	it('스킬 허용 목록이 없으면 한정하지 않는다 — (전체 − 차단)', () => {
		retrace(
			'undefined를 "아무것도 허용 안 함"으로 처리하면 빈 배열이 나온다. 스킬이 도구를 ' +
				'한정하지 않는 것과 모든 도구를 금지하는 것은 정반대다.',
			() => {
				expect(resolveTools(['read', 'write', 'bash'], ['bash'])).toEqual(['read', 'write']);
			},
		);
	});

	it('퍼미션이 막은 것은 스킬이 허용해도 살아나지 않는다', () => {
		expect(resolveTools(['read', 'bash'], ['bash'], ['bash'])).toEqual([]);
	});

	it('전체 목록의 순서를 유지한다', () => {
		expect(resolveTools(['c', 'a', 'b'], [], ['a', 'b', 'c'])).toEqual(['c', 'a', 'b']);
	});
});

describe('exceedsBudget — 기반 컨텍스트가 5%를 넘는가', () => {
	const WINDOW = 262_144;

	it('6%는 초과다', () => {
		expect(exceedsBudget(Math.floor(WINDOW * 0.06), WINDOW)).toBe(true);
	});

	it('정확히 5%는 초과가 아니다 (경계 포함)', () => {
		retrace('부등호에 등호가 들어가는 방향을 확인하라', () => {
			expect(exceedsBudget(WINDOW * 0.05, WINDOW)).toBe(false);
		});
	});

	it('4%는 초과가 아니다', () => {
		expect(exceedsBudget(Math.floor(WINDOW * 0.04), WINDOW)).toBe(false);
	});

	it('판정이 절대 토큰 수가 아니라 윈도우 대비 비율로 이뤄진다', () => {
		// 같은 20,000 토큰이라도 윈도우가 크면 5% 안에 들어온다.
		expect(exceedsBudget(20_000, 262_144)).toBe(true);
		expect(exceedsBudget(20_000, 500_000)).toBe(false);
	});
});

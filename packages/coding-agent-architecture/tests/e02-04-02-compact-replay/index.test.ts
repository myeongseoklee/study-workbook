/**
 * 과제 3-5의 명세 — 마지막 컴팩트 기준 재생기
 *
 * 이 파일이 과제의 정의다. `src/e02-04-02-compact-replay/index.ts`를 채워 여기를
 * 통과시켜라. 이 파일은 고치지 않는다.
 *
 * 실행: pnpm test e02-04-02
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { buildModelInput, type Entry } from '../../src/e02-04-02-compact-replay';

const base: Entry[] = [{ kind: 'request', id: 'base' }];
const ids = (entries: Entry[]): string[] => entries.map((e) => e.id);

describe('buildModelInput — 어디부터 재생하는가', () => {
	it('컴팩트가 없으면 전체 로그를 쓴다', () => {
		const log: Entry[] = [
			{ kind: 'request', id: 'r1' },
			{ kind: 'response', id: 'a1' },
		];
		expect(ids(buildModelInput(log, base))).toEqual(['base', 'r1', 'a1']);
	});

	it('컴팩트가 하나면 그 레코드부터 쓴다 — 컴팩트 레코드 자체를 포함한다', () => {
		retrace(
			'컴팩트 레코드는 잘라낸 앞부분의 요약을 담고 있다. 그것까지 버리면 요약이 사라져 ' +
				'앞 대화의 맥락이 통째로 날아간다.',
			() => {
				const log: Entry[] = [
					{ kind: 'request', id: 'r1' },
					{ kind: 'response', id: 'a1' },
					{ kind: 'compact', id: 'c1' },
					{ kind: 'request', id: 'r2' },
				];
				expect(ids(buildModelInput(log, base))).toEqual(['base', 'c1', 'r2']);
			},
		);
	});

	it('컴팩트가 여러 개면 마지막 것을 기준으로 자른다', () => {
		retrace('첫 컴팩트를 찾았다면 탐색 방향이 반대다 — findLast 쪽이다', () => {
			const log: Entry[] = [
				{ kind: 'request', id: 'r1' },
				{ kind: 'compact', id: 'c1' },
				{ kind: 'request', id: 'r2' },
				{ kind: 'compact', id: 'c2' },
				{ kind: 'request', id: 'r3' },
				{ kind: 'response', id: 'a3' },
			];
			expect(ids(buildModelInput(log, base))).toEqual(['base', 'c2', 'r3', 'a3']);
		});
	});

	it('컴팩트가 로그의 마지막 항목이어도 동작한다', () => {
		const log: Entry[] = [
			{ kind: 'request', id: 'r1' },
			{ kind: 'compact', id: 'c1' },
		];
		expect(ids(buildModelInput(log, base))).toEqual(['base', 'c1']);
	});

	it('빈 로그면 기반 컨텍스트만 남는다', () => {
		expect(ids(buildModelInput([], base))).toEqual(['base']);
	});
});

describe('buildModelInput — 불변 규칙', () => {
	const log: Entry[] = [
		{ kind: 'request', id: 'r1' },
		{ kind: 'compact', id: 'c1' },
		{ kind: 'request', id: 'r2' },
	];

	it('baseContext가 항상 맨 앞에 온다', () => {
		retrace('프리픽스 캐시는 앞부분이 바이트 단위로 불변이어야 산다', () => {
			expect(buildModelInput(log, base)[0]?.id).toBe('base');
		});
	});

	it('입력 로그를 변형하지 않는다', () => {
		const input = [...log];
		buildModelInput(input, base);
		retrace('splice가 아니라 slice를 써야 한다. 로그는 감사 기록이다.', () => {
			expect(ids(input)).toEqual(['r1', 'c1', 'r2']);
		});
	});

	it('입력 baseContext도 변형하지 않는다', () => {
		const inputBase = [...base];
		buildModelInput(log, inputBase);
		expect(ids(inputBase)).toEqual(['base']);
	});
});

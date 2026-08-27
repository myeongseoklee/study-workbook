// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e05-08-01-pure-library/index.ts를 고쳐라.
//
// 8장의 판별식이 이 명세다: "순수 라이브러리는 의존성이 전부 외부다."
// 그리고 같은 장이 준 구분 — 도메인 패키지는 앱에 묶여 있고, agent는 안 묶여 있다.
//
// 아래 워크스페이스는 5강 화면 구성을 본떠 만든 것이다:
//   agent        순수 라이브러리여야 하는 것 (브로커 구현 + 워커 인터페이스)
//   vibe-domain  vibe 앱에 묶인 도메인 패키지
//   fmt-utils    공용처럼 보이지만 도메인 하나를 물고 있다 ← 이 과제의 함정
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	internalNames,
	classify,
	audit,
	offendingEdges,
	type PackageNode,
} from '../../src/e05-08-01-pure-library';

const ws: PackageNode[] = [
	{ name: 'agent', boundTo: null, dependencies: ['express', 'pg', 'fmt-utils'] },
	{ name: 'fmt-utils', boundTo: null, dependencies: ['date-fns', 'vibe-domain'] },
	{ name: 'vibe-domain', boundTo: 'vibe', dependencies: ['zod'] },
	{ name: 'proto', boundTo: null, dependencies: ['zod'] },
	{ name: 'lonely', boundTo: null, dependencies: [] },
];

describe('internalNames — 워크스페이스 경계', () => {
	it('워크스페이스 패키지 이름만 담는다', () => {
		expect(internalNames(ws)).toEqual(
			new Set(['agent', 'fmt-utils', 'vibe-domain', 'proto', 'lonely']),
		);
	});

	it('빈 워크스페이스면 빈 집합이다', () => {
		expect(internalNames([])).toEqual(new Set());
	});
});

describe('classify — 순수한가', () => {
	it('외부 의존만 있으면 순수하다', () => {
		expect(classify('proto', ws)).toEqual({ name: 'proto', pure: true, via: [] });
	});

	it('의존이 아예 없어도 순수하다', () => {
		expect(classify('lonely', ws)).toEqual({ name: 'lonely', pure: true, via: [] });
	});

	it('자기가 앱에 묶여 있으면 순수하지 않고 via는 자기 이름 하나다', () => {
		retrace(
			'도메인 패키지는 못 떼는 것이 정상이다. 문제는 라이브러리라고 부르면서 못 떼는 경우다 — 8장.',
			() => {
				expect(classify('vibe-domain', ws)).toEqual({
					name: 'vibe-domain',
					pure: false,
					via: ['vibe-domain'],
				});
			},
		);
	});

	it('🔴 전이로 묶인 패키지에 닿으면 순수하지 않다 — 경로가 나온다', () => {
		retrace(
			'agent의 직접 의존만 보면 express·pg·fmt-utils라 통과한다. fmt-utils가 도메인을 ' +
				'물고 있다는 사실이 한 칸 뒤에 숨어 있다 — 직접 의존만 세는 검사가 놓치는 자리다.',
			() => {
				expect(classify('agent', ws)).toEqual({
					name: 'agent',
					pure: false,
					via: ['agent', 'fmt-utils', 'vibe-domain'],
				});
			},
		);
	});

	it('묶이지 않은 워크스페이스 패키지를 통과하는 것 자체는 문제가 아니다', () => {
		retrace(
			'"워크스페이스 패키지를 하나라도 물면 불순"으로 구현하면 이 테스트가 깨진다. ' +
				'기준은 워크스페이스 소속이 아니라 **앱에 묶였는가**다.',
			() => {
				const local: PackageNode[] = [
					{ name: 'a', boundTo: null, dependencies: ['b'] },
					{ name: 'b', boundTo: null, dependencies: ['c'] },
					{ name: 'c', boundTo: null, dependencies: ['lodash'] },
				];
				expect(classify('a', local).pure).toBe(true);
			},
		);
	});

	it('가장 짧은 경로를 고른다', () => {
		retrace(
			'DFS로 짜면 먼저 파고든 가지가 답이 되어 긴 경로가 나온다. 최단 경로를 요구하므로 BFS다.',
			() => {
				const local: PackageNode[] = [
					{ name: 'root', boundTo: null, dependencies: ['long', 'short'] },
					{ name: 'long', boundTo: null, dependencies: ['mid'] },
					{ name: 'mid', boundTo: null, dependencies: ['bound'] },
					{ name: 'short', boundTo: 'app', dependencies: [] },
					{ name: 'bound', boundTo: 'app', dependencies: [] },
				];
				expect(classify('root', local).via).toEqual(['root', 'short']);
			},
		);
	});

	it('길이가 같으면 의존 배열 순서상 먼저 발견된 것을 고른다', () => {
		const local: PackageNode[] = [
			{ name: 'root', boundTo: null, dependencies: ['x', 'y'] },
			{ name: 'x', boundTo: 'app1', dependencies: [] },
			{ name: 'y', boundTo: 'app2', dependencies: [] },
		];
		expect(classify('root', local).via).toEqual(['root', 'x']);
	});

	it('순환 의존이 있어도 멈춘다', () => {
		retrace(
			'visited 없이 짜면 여기서 무한 루프다. 실제 모노레포에 순환은 드물지 않다.',
			() => {
				const cyclic: PackageNode[] = [
					{ name: 'a', boundTo: null, dependencies: ['b'] },
					{ name: 'b', boundTo: null, dependencies: ['a'] },
				];
				expect(classify('a', cyclic)).toEqual({ name: 'a', pure: true, via: [] });
			},
		);
	});

	it('순환이 있으면서 묶인 패키지에도 닿으면 경로를 찾아낸다', () => {
		const cyclic: PackageNode[] = [
			{ name: 'a', boundTo: null, dependencies: ['b'] },
			{ name: 'b', boundTo: null, dependencies: ['a', 'd'] },
			{ name: 'd', boundTo: 'app', dependencies: [] },
		];
		expect(classify('a', cyclic).via).toEqual(['a', 'b', 'd']);
	});

	it('워크스페이스에 없는 대상은 외부로 보고 순수하다고 한다', () => {
		retrace(
			'"알 수 없는 것은 외부로 본다"가 이 판별식의 전제이자 한계다. 던지면 감사 도구가 ' +
				'오탈자 하나에 멈춘다.',
			() => {
				expect(classify('express', ws)).toEqual({ name: 'express', pure: true, via: [] });
			},
		);
	});
});

describe('audit — 워크스페이스 전체', () => {
	it('입력 순서를 유지한다', () => {
		expect(audit(ws).map((v) => v.name)).toEqual(ws.map((p) => p.name));
	});

	it('전체 판정이 맞다', () => {
		expect(audit(ws).map((v) => [v.name, v.pure])).toEqual([
			['agent', false],
			['fmt-utils', false],
			['vibe-domain', false],
			['proto', true],
			['lonely', true],
		]);
	});

	it('빈 워크스페이스면 빈 배열이다', () => {
		expect(audit([])).toEqual([]);
	});
});

describe('offendingEdges — 무엇을 끊어야 하는가', () => {
	it('직접 물고 있는 것 중 불순한 것만 돌려준다', () => {
		retrace(
			'agent가 끊을 수 있는 것은 fmt-utils다. vibe-domain은 한 칸 뒤라 직접 끊을 수 없다.',
			() => {
				expect(offendingEdges('agent', ws)).toEqual(['fmt-utils']);
			},
		);
	});

	it('외부 의존은 끊을 대상이 아니다', () => {
		expect(offendingEdges('proto', ws)).toEqual([]);
	});

	it('묶인 패키지를 직접 물었으면 그것이 나온다', () => {
		expect(offendingEdges('fmt-utils', ws)).toEqual(['vibe-domain']);
	});

	it('중복 의존은 한 번만 나온다', () => {
		const local: PackageNode[] = [
			{ name: 'a', boundTo: null, dependencies: ['b', 'b'] },
			{ name: 'b', boundTo: 'app', dependencies: [] },
		];
		expect(offendingEdges('a', local)).toEqual(['b']);
	});

	it('워크스페이스에 없는 대상이면 빈 배열이다', () => {
		expect(offendingEdges('nope', ws)).toEqual([]);
	});
});

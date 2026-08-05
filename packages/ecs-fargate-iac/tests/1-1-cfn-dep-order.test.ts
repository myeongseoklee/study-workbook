/**
 * 과제 1-1의 명세 — CloudFormation 의존성 순서 계산기
 *
 * 이 파일이 과제의 정의다. `src/1-1-cfn-dep-order.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/01-iac-and-cloudformation.md § 의존 순서를 다시 읽어라.
 *
 * 실행: pnpm test 1-1
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { findCycle, resolveWaves, type Resource } from '../src/1-1-cfn-dep-order';

describe('resolveWaves — 생성 순서를 배치 단위로', () => {
	it('의존이 없는 리소스는 모두 첫 배치에 들어간다', () => {
		const flat: Resource[] = [{ name: 'LogGroup' }, { name: 'Cluster' }, { name: 'Secret' }];
		expect(resolveWaves(flat)).toEqual([['Cluster', 'LogGroup', 'Secret']]);
	});

	it('같은 배치는 이름 알파벳 순으로 정렬된다', () => {
		retrace(
			'정렬을 빠뜨리면 결과가 입력 순서에 의존해, 파일에 적은 순서가 의미를 갖는 것처럼 보인다. ' +
				'CloudFormation에서 파일 순서는 아무 의미가 없다.',
			() => {
				const same: Resource[] = [{ name: 'Zeta' }, { name: 'Alpha' }, { name: 'Mu' }];
				expect(resolveWaves(same)).toEqual([['Alpha', 'Mu', 'Zeta']]);
			},
		);
	});

	it('refs로 표현된 의존이 배치를 가른다', () => {
		const chain: Resource[] = [
			{ name: 'Alb', refs: ['AlbSg'] },
			{ name: 'AlbSg' },
			{ name: 'Listener', refs: ['Alb', 'Tg'] },
			{ name: 'Tg' },
		];
		expect(resolveWaves(chain)).toEqual([['AlbSg', 'Tg'], ['Alb'], ['Listener']]);
	});

	it('DependsOn만 있고 refs가 없는 의존도 반영된다', () => {
		retrace(
			'refs만 보는 구현은 여기서 두 리소스를 같은 배치에 넣는다. ' +
				'DependsOn은 "코드에 드러나지 않는 실제 의존"을 사람이 알려주는 자리다.',
			() => {
				const onlyDependsOn: Resource[] = [
					{ name: 'Service', dependsOn: ['Listener'] },
					{ name: 'Listener' },
				];
				expect(resolveWaves(onlyDependsOn)).toEqual([['Listener'], ['Service']]);
			},
		);
	});

	it('refs와 DependsOn을 함께 고려한다', () => {
		const both: Resource[] = [
			{ name: 'Service', refs: ['Cluster'], dependsOn: ['Listener'] },
			{ name: 'Cluster' },
			{ name: 'Listener', refs: ['Alb'] },
			{ name: 'Alb' },
		];
		expect(resolveWaves(both)).toEqual([['Alb', 'Cluster'], ['Listener'], ['Service']]);
	});

	it('입력 순서를 섞어도 결과가 같다', () => {
		const ordered: Resource[] = [
			{ name: 'Alb', refs: ['AlbSg'] },
			{ name: 'AlbSg' },
			{ name: 'Listener', refs: ['Alb', 'Tg'] },
			{ name: 'Tg' },
		];
		const shuffled: Resource[] = [
			{ name: 'Listener', refs: ['Alb', 'Tg'] },
			{ name: 'Tg' },
			{ name: 'AlbSg' },
			{ name: 'Alb', refs: ['AlbSg'] },
		];
		expect(resolveWaves(shuffled)).toEqual(resolveWaves(ordered));
	});

	it('존재하지 않는 리소스를 참조하면 그 이름과 함께 던진다', () => {
		retrace(
			'조용히 무시하면 오타 난 참조가 통과해, 배포 중에야 발견된다. ' +
				'CloudFormation은 이런 실패를 리소스 생성 전에 낸다.',
			() => {
				expect(() => resolveWaves([{ name: 'Service', refs: ['NoSuchThing'] }])).toThrow(
					/NoSuchThing/,
				);
			},
		);
	});

	it('순환 의존이면 관여한 리소스 이름과 함께 던진다', () => {
		const cyclic: Resource[] = [
			{ name: 'A', refs: ['B'] },
			{ name: 'B', refs: ['C'] },
			{ name: 'C', refs: ['A'] },
			{ name: 'Standalone' },
		];
		retrace('벗길 수 있는 배치가 없는데 남은 리소스가 있으면 순환이다', () => {
			expect(() => resolveWaves(cyclic)).toThrow(/A/);
			expect(() => resolveWaves(cyclic)).toThrow(/B/);
			expect(() => resolveWaves(cyclic)).toThrow(/C/);
		});
	});

	it('자기 자신을 참조하는 것도 순환이다', () => {
		retrace('자기 참조는 "의존이 0이 되는 순간"이 오지 않으므로 순환으로 걸린다', () => {
			expect(() => resolveWaves([{ name: 'Loop', refs: ['Loop'] }])).toThrow(/Loop/);
		});
	});
});

describe('findCycle — 순환에 얽힌 리소스 조사', () => {
	it('순환이 없으면 null', () => {
		const chain: Resource[] = [{ name: 'Alb', refs: ['AlbSg'] }, { name: 'AlbSg' }];
		expect(findCycle(chain)).toBeNull();
	});

	it('순환에 참여한 리소스만 정렬해 돌려준다', () => {
		retrace('Standalone은 순환에 얽히지 않았으므로 결과에 없어야 한다', () => {
			const cyclic: Resource[] = [
				{ name: 'A', refs: ['B'] },
				{ name: 'B', refs: ['C'] },
				{ name: 'C', refs: ['A'] },
				{ name: 'Standalone' },
			];
			expect(findCycle(cyclic)).toEqual(['A', 'B', 'C']);
		});
	});

	it('존재하지 않는 참조는 순환이 아니므로 던지지 않고 무시한다', () => {
		retrace(
			'resolveWaves와 달리 이 함수는 조사용이다. 없는 참조 때문에 던지면 ' +
				'"순환이 있는가"에 답할 수 없다.',
			() => {
				expect(findCycle([{ name: 'Service', refs: ['NoSuchThing'] }])).toBeNull();
			},
		);
	});
});

describe('학습 대상 템플릿의 부분집합', () => {
	const real: Resource[] = [
		{
			name: 'Service',
			refs: ['Cluster', 'TaskDefinition', 'TargetGroup', 'ServiceSecurityGroup'],
			dependsOn: ['AlbListener'],
		},
		{ name: 'AlbListener', refs: ['Alb', 'TargetGroup'] },
		{ name: 'TargetGroup' },
		{ name: 'Alb', refs: ['AlbSecurityGroup'] },
		{ name: 'AlbSecurityGroup' },
		{ name: 'ServiceSecurityGroup', refs: ['AlbSecurityGroup'] },
		{ name: 'Cluster' },
		{ name: 'TaskDefinition', refs: ['LogGroup', 'TaskRole'] },
		{ name: 'LogGroup' },
		{ name: 'Secret' },
		{ name: 'TaskRole', refs: ['Secret'] },
	];

	it('Service가 홀로 마지막 배치에 온다', () => {
		const waves = resolveWaves(real);
		expect(waves.at(-1)).toEqual(['Service']);
	});

	it('보안 그룹은 그것을 참조하는 ALB보다 앞선 배치에 있다', () => {
		const waves = resolveWaves(real);
		const sgWave = waves.findIndex((w) => w.includes('AlbSecurityGroup'));
		const albWave = waves.findIndex((w) => w.includes('Alb'));
		expect(sgWave).toBeLessThan(albWave);
	});

	it('시크릿 → 태스크 롤 → 태스크 정의 순서가 지켜진다', () => {
		const waves = resolveWaves(real);
		const at = (name: string) => waves.findIndex((w) => w.includes(name));
		expect(at('Secret')).toBeLessThan(at('TaskRole'));
		expect(at('TaskRole')).toBeLessThan(at('TaskDefinition'));
	});
});

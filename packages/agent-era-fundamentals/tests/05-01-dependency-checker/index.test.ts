/**
 * 과제 05-01의 명세 — 의존 규칙 체커
 *
 * 이 파일이 과제의 정의다. `src/05-01-dependency-checker/index.ts`를 채워 여기를
 * 통과시켜라. 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가
 * 틀렸을 가능성이 먼저다 — docs/05-module-structure-as-leverage.md의
 * "의존 규칙 명세와 체커"를 다시 읽어라.
 *
 * 실행: pnpm --filter agent-era-fundamentals test 05-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import {
	checkDependencies,
	findCycles,
	type DependencySpec,
} from '../../src/05-01-dependency-checker';

/** 안쪽으로만 흐르는 네 겹 구조. */
const spec: DependencySpec = {
	modules: ['domain', 'usecase', 'adapter', 'infra'],
	allowed: [
		['usecase', 'domain'],
		['adapter', 'usecase'],
		['adapter', 'domain'],
		['infra', 'adapter'],
	],
};

describe('checkDependencies — 명세에 없는 의존을 잡아낸다', () => {
	it('명세를 지키는 그래프에는 위반이 없다', () => {
		expect(
			checkDependencies(spec, {
				domain: [],
				usecase: ['domain'],
				adapter: ['usecase', 'domain'],
				infra: ['adapter'],
			}),
		).toEqual([]);
	});

	it('허용 목록에 없는 의존은 not-allowed다', () => {
		retrace(
			'명세는 허용 목록이지 금지 목록이 아니다. 적히지 않은 관계는 전부 위반이다. ' +
				'금지 목록으로 구현하면 새 모듈이 생길 때마다 조용히 통과한다.',
			() => {
				expect(checkDependencies(spec, { domain: ['infra'] })).toEqual([
					{ from: 'domain', to: 'infra', kind: 'not-allowed' },
				]);
			},
		);
	});

	it('허용된 방향의 반대는 허용된 것이 아니다', () => {
		// usecase → domain은 허용이지만 domain → usecase는 아니다.
		expect(checkDependencies(spec, { domain: ['usecase'] })).toEqual([
			{ from: 'domain', to: 'usecase', kind: 'not-allowed' },
		]);
	});

	it('명세에 없는 모듈은 unknown-module이다 — 어느 쪽에 있든', () => {
		expect(checkDependencies(spec, { legacy: ['domain'] })).toEqual([
			{ from: 'legacy', to: 'domain', kind: 'unknown-module' },
		]);
		expect(checkDependencies(spec, { adapter: ['legacy'] })).toEqual([
			{ from: 'adapter', to: 'legacy', kind: 'unknown-module' },
		]);
	});

	it('모르는 모듈이 끼어 있으면 허용 여부는 따지지 않는다', () => {
		retrace(
			'판정 순서를 뒤집어 not-allowed를 먼저 보면, 명세에 없는 모듈이 전부 ' +
				'"허용되지 않은 의존"으로 보고된다. 진짜 문제(모듈이 명세에서 빠졌다)가 ' +
				'가짜 문제(의존 방향이 틀렸다) 뒤에 숨는다.',
			() => {
				const violations = checkDependencies(spec, { legacy: ['legacy'] });
				expect(violations).toEqual([{ from: 'legacy', to: 'legacy', kind: 'unknown-module' }]);
			},
		);
	});

	it('자기 자신에 대한 의존은 self-dependency다', () => {
		expect(checkDependencies(spec, { adapter: ['adapter'] })).toEqual([
			{ from: 'adapter', to: 'adapter', kind: 'self-dependency' },
		]);
	});

	it('한 의존은 하나의 위반만 낳는다', () => {
		const violations = checkDependencies(spec, { domain: ['infra'] });
		expect(violations).toHaveLength(1);
	});

	it('from 사전순, 같으면 to 사전순으로 정렬한다', () => {
		const violations = checkDependencies(spec, {
			usecase: ['infra', 'adapter'],
			domain: ['usecase'],
		});
		expect(violations.map((v) => `${v.from}->${v.to}`)).toEqual([
			'domain->usecase',
			'usecase->adapter',
			'usecase->infra',
		]);
	});

	it('의존이 없는 모듈과 빈 그래프를 견딘다', () => {
		expect(checkDependencies(spec, {})).toEqual([]);
		expect(checkDependencies(spec, { domain: [], usecase: [] })).toEqual([]);
	});

	it('허용 목록이 비어 있으면 모든 의존이 위반이다', () => {
		const 금지된명세: DependencySpec = { modules: ['a', 'b'], allowed: [] };
		expect(checkDependencies(금지된명세, { a: ['b'] })).toEqual([
			{ from: 'a', to: 'b', kind: 'not-allowed' },
		]);
	});
});

describe('findCycles — 순환 의존을 찾는다', () => {
	it('순환이 없으면 빈 배열이다', () => {
		expect(findCycles({ a: ['b'], b: ['c'], c: [] })).toEqual([]);
	});

	it('두 모듈이 서로를 참조하면 순환이다', () => {
		expect(findCycles({ a: ['b'], b: ['a'] })).toEqual([['a', 'b']]);
	});

	it('시작점을 끝에 반복하지 않는다', () => {
		retrace("['a','b','a'] 형태로 돌려주면 같은 순환이 여러 표현을 갖게 된다", () => {
			expect(findCycles({ a: ['b'], b: ['a'] })[0]).toHaveLength(2);
		});
	});

	it('사전순으로 가장 작은 모듈에서 시작하도록 회전시킨다', () => {
		retrace(
			'같은 순환도 어느 노드에서 탐색을 시작했느냐에 따라 다르게 나온다. ' +
				"회전 정규화가 없으면 ['zebra','alpha']와 ['alpha','zebra']가 서로 다른 " +
				'순환으로 보고되어 같은 문제가 두 번 세어진다.',
			() => {
				expect(findCycles({ zebra: ['alpha'], alpha: ['zebra'] })).toEqual([['alpha', 'zebra']]);
			},
		);
	});

	it('세 모듈을 도는 순환도 찾는다', () => {
		expect(findCycles({ a: ['b'], b: ['c'], c: ['a'] })).toEqual([['a', 'b', 'c']]);
	});

	it('회전해도 순서는 방향을 유지한다', () => {
		// b → c → a → b 를 정규화하면 a에서 시작하되 방향은 그대로다.
		expect(findCycles({ b: ['c'], c: ['a'], a: ['b'] })).toEqual([['a', 'b', 'c']]);
	});

	it('자기 자신에 의존하면 길이 1의 순환이다', () => {
		expect(findCycles({ a: ['a'] })).toEqual([['a']]);
	});

	it('같은 순환을 두 번 세지 않는다', () => {
		// a에서 시작해도 b에서 시작해도 같은 순환이 발견된다.
		expect(findCycles({ a: ['b'], b: ['a'] })).toHaveLength(1);
	});

	it('순환이 여럿이면 전부 찾는다', () => {
		const cycles = findCycles({ a: ['b'], b: ['a', 'c'], c: ['b'] });
		expect(cycles).toEqual([
			['a', 'b'],
			['b', 'c'],
		]);
	});

	it('앞부분이 같으면 짧은 순환이 먼저다', () => {
		const cycles = findCycles({ a: ['b'], b: ['a', 'c'], c: ['a'] });
		expect(cycles).toEqual([
			['a', 'b'],
			['a', 'b', 'c'],
		]);
	});

	it('순환에 들어가지만 순환의 일부는 아닌 모듈을 포함하지 않는다', () => {
		retrace(
			'entry는 순환을 가리키지만 순환의 구성원이 아니다. 경로 전체가 아니라 ' +
				'되돌아온 지점부터가 순환이다.',
			() => {
				expect(findCycles({ entry: ['a'], a: ['b'], b: ['a'] })).toEqual([['a', 'b']]);
			},
		);
	});

	it('그래프에 키로 없는 모듈을 참조해도 견딘다', () => {
		expect(findCycles({ a: ['없는모듈'] })).toEqual([]);
	});

	it('빈 그래프를 견딘다', () => {
		expect(findCycles({})).toEqual([]);
	});
});

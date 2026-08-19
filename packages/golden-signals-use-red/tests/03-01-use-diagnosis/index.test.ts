/**
 * 과제 03-01의 명세 — USE 진단기
 *
 * 이 파일이 과제의 정의다. `src/03-01-use-diagnosis/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/03-use-method.md를 다시 읽어라.
 *
 * 실행: pnpm test 03-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { diagnoseResource, rankBottlenecks } from '../../src/03-01-use-diagnosis';
import type { ResourceSample } from '../../src/03-01-use-diagnosis';

function sample(over: Partial<ResourceSample> & { name: string }): ResourceSample {
	return { utilizationPct: 10, saturation: 0, errorsDelta: 0, ...over };
}

describe('diagnoseResource — 항목별 판정 규칙이 다르다', () => {
	it('세 값이 모두 정상이면 ok이고 근거가 없다', () => {
		expect(diagnoseResource(sample({ name: 'cpu' }))).toEqual({
			name: 'cpu',
			verdict: 'ok',
			reasons: [],
		});
	});

	it('사용률 70% 이상은 problem이 아니라 watch다 (경계값 포함)', () => {
		expect(diagnoseResource(sample({ name: 'cpu', utilizationPct: 69.9 })).verdict).toBe('ok');
		retrace(
			'Gregg는 "beyond 70%부터 문제가 될 수 있다"고 말한다 — 확정이 아니라 의심이다. ' +
				'70을 problem으로 올리면 정상 부하의 서버가 전부 빨개져서 판정이 무의미해진다. ' +
				'경계는 >= 70이다.',
			() => {
				const r = diagnoseResource(sample({ name: 'cpu', utilizationPct: 70 }));
				expect(r.verdict).toBe('watch');
				expect(r.reasons).toEqual(['utilization-high']);
			},
		);
	});

	it('포화는 0이 아니면 problem이다 — 사용률과 달리 임계선이 0이다', () => {
		const r = diagnoseResource(sample({ name: 'db-pool', saturation: 1 }));
		retrace(
			'큐에 하나라도 앉아 있으면 누군가 기다린 것이다. 포화에 "안전한 값"을 잡으려는 ' +
				'시도 자체가 오류다 — 사용률의 70% 같은 임계선을 포화에 적용하면 안 된다.',
			() => {
				expect(r.verdict).toBe('problem');
				expect(r.reasons).toContain('saturated');
			},
		);
	});

	it('에러는 증가 중일 때만 근거가 된다 — 0이면 근거가 아니다', () => {
		expect(diagnoseResource(sample({ name: 'nic', errorsDelta: 0 })).verdict).toBe('ok');
		const r = diagnoseResource(sample({ name: 'nic', errorsDelta: 3 }));
		retrace(
			'errorsDelta는 이번 구간에 늘어난 개수다. 누적 카운터를 그대로 받으면 과거의 ' +
				'에러가 영원히 현재의 장애로 보고된다 — 그래서 절대값이 아니라 증분을 본다.',
			() => {
				expect(r.verdict).toBe('problem');
				expect(r.reasons).toContain('errors-increasing');
			},
		);
	});

	it('근거는 해석이 값싼 순서로 정렬된다 — 에러, 포화, 사용률', () => {
		const r = diagnoseResource(
			sample({ name: 'disk', utilizationPct: 95, saturation: 4, errorsDelta: 2 }),
		);
		retrace(
			'Gregg는 에러를 먼저 봐도 된다고 말한다 — 해석에 판단이 거의 필요 없기 때문이다. ' +
				'"드롭 패킷 12000개"는 그 자체로 결론에 가깝지만 "CPU 68%"는 아무 결론도 아니다.',
			() => {
				expect(r.reasons).toEqual(['errors-increasing', 'saturated', 'utilization-high']);
			},
		);
	});
});

describe('diagnoseResource — 병렬 자원의 사용률은 판정 근거가 아니다', () => {
	it('parallel 자원은 사용률 100%여도 그것만으로 watch가 되지 않는다', () => {
		const r = diagnoseResource(sample({ name: 'nvme', utilizationPct: 100, parallel: true }));
		retrace(
			'시간 기반 %util 100%는 "적어도 하나가 진행 중이었다"는 뜻뿐이다. SSD·NVMe·RAID는 ' +
				'내부 병렬성 때문에 100%에서도 여유가 있고, 오히려 병렬 작업을 줘야 최고 성능이 난다.',
			() => {
				expect(r.verdict).toBe('ok');
				expect(r.reasons).toEqual(['utilization-unreliable']);
			},
		);
	});

	it('병렬 자원이라도 포화(큐 깊이)는 그대로 problem이다', () => {
		const r = diagnoseResource(
			sample({ name: 'nvme', utilizationPct: 100, saturation: 6, parallel: true }),
		);
		expect(r.verdict).toBe('problem');
		expect(r.reasons).toEqual(['saturated', 'utilization-unreliable']);
	});
});

describe('diagnoseResample — 관측 공백을 초록으로 처리하지 않는다', () => {
	it('세 값이 모두 null이면 unobserved다', () => {
		const r = diagnoseResource({
			name: 'interconnect',
			utilizationPct: null,
			saturation: null,
			errorsDelta: null,
		});
		expect(r).toEqual({ name: 'interconnect', verdict: 'unobserved', reasons: ['unobserved'] });
	});

	it('일부만 null이면 관측된 값으로 판정하되 verdict를 ok 밑으로 내리지 않는다', () => {
		const r = diagnoseResource(sample({ name: 'mem', saturation: null }));
		retrace(
			'남은 값이 전부 정상이라고 ok로 두면, 포화를 아예 못 재고 있는 자원이 대시보드에서 ' +
				'초록으로 보인다. 모르는 것은 좋은 것이 아니므로 최소 watch로 올린다.',
			() => {
				expect(r.verdict).toBe('watch');
				expect(r.reasons).toEqual(['unobserved']);
			},
		);
	});

	it('관측된 값이 problem이면 null이 있어도 problem이다', () => {
		const r = diagnoseResource(sample({ name: 'mem', saturation: 2, errorsDelta: null }));
		expect(r.verdict).toBe('problem');
		expect(r.reasons).toEqual(['saturated', 'unobserved']);
	});
});

describe('rankBottlenecks — 무엇을 먼저 볼지 순서를 낸다', () => {
	it('problem → watch → unobserved → ok 순이고, 동급은 이름 사전순이다', () => {
		const out = rankBottlenecks([
			sample({ name: 'zeta' }),
			sample({ name: 'cpu', utilizationPct: 80 }),
			{ name: 'bus', utilizationPct: null, saturation: null, errorsDelta: null },
			sample({ name: 'alpha' }),
			sample({ name: 'db-pool', saturation: 3 }),
		]);
		retrace(
			'unobserved를 ok 아래로 두면 "못 보고 있는 자원"이 목록 끝으로 밀려 영원히 안 보인다. ' +
				'모르는 것은 정상보다 위에 있어야 한다.',
			() => {
				expect(out.map((f) => f.name)).toEqual(['db-pool', 'cpu', 'bus', 'alpha', 'zeta']);
			},
		);
	});

	it('빈 목록은 빈 목록을 낸다', () => {
		expect(rankBottlenecks([])).toEqual([]);
	});
});

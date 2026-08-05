/**
 * 과제 2-1의 명세 — 보안 그룹 도달성 판정기
 *
 * 이 파일이 과제의 정의다. `src/02-01-sg-reachability/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 docs/02-network-vpc-sg.md § 보안 그룹을 다시 읽어라.
 *
 * 실행: pnpm test 02-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { canReachFromIp, canReachSg, cidrContains, type SecurityGroup } from '../../src/02-01-sg-reachability';

describe('cidrContains — CIDR 범위가 주소를 포함하는가', () => {
	it('/32는 그 주소 하나만 포함한다', () => {
		expect(cidrContains('1.2.3.4/32', '1.2.3.4')).toBe(true);
		expect(cidrContains('1.2.3.4/32', '1.2.3.5')).toBe(false);
	});

	it('/24는 마지막 옥텟만 자유롭다', () => {
		expect(cidrContains('10.1.2.0/24', '10.1.2.255')).toBe(true);
		expect(cidrContains('10.1.2.0/24', '10.1.3.1')).toBe(false);
	});

	it('/16은 뒤 두 옥텟이 자유롭다', () => {
		expect(cidrContains('10.1.0.0/16', '10.1.200.7')).toBe(true);
		expect(cidrContains('10.1.0.0/16', '10.2.0.1')).toBe(false);
	});

	it('/0은 모든 주소를 포함한다', () => {
		retrace(
			'JavaScript에서 (0xFFFFFFFF << 32)는 << 0과 같아 마스크가 통째로 남는다. ' +
				'접두사 0을 따로 처리하지 않으면 0.0.0.0/0이 아무것도 포함하지 않게 된다.',
			() => {
				expect(cidrContains('0.0.0.0/0', '8.8.8.8')).toBe(true);
				expect(cidrContains('0.0.0.0/0', '10.1.2.3')).toBe(true);
			},
		);
	});

	it('네트워크 주소가 접두사에 정렬되지 않아도 맞게 판정한다', () => {
		retrace('접두사 밖 비트는 마스킹으로 사라져야 한다 — 10.1.2.7/24는 10.1.2.0/24와 같다', () => {
			expect(cidrContains('10.1.2.7/24', '10.1.2.99')).toBe(true);
		});
	});

	it('최상위 비트가 선 주소도 부호 없이 다룬다', () => {
		retrace(
			'<< 24는 최상위 비트를 세워 음수가 된다. >>> 0 등으로 되돌리지 않으면 ' +
				'128 이상으로 시작하는 주소에서 비교가 어긋난다.',
			() => {
				expect(cidrContains('203.0.113.0/24', '203.0.113.10')).toBe(true);
				expect(cidrContains('203.0.113.0/24', '198.51.100.1')).toBe(false);
			},
		);
	});
});

describe('canReachSg — 보안 그룹 사이의 새 연결', () => {
	it('egress 미지정은 아웃바운드 전체 허용으로 취급한다', () => {
		const groups: SecurityGroup[] = [
			{ id: 'sg-a', ingress: [] },
			{ id: 'sg-b', ingress: [{ protocol: 'tcp', fromPort: 3306, toPort: 3306, sgId: 'sg-a' }] },
		];
		expect(canReachSg(groups, 'sg-a', 'sg-b', 3306)).toBe(true);
	});

	it('목적지 인그레스에 규칙이 없으면 도달하지 못한다', () => {
		const groups: SecurityGroup[] = [
			{ id: 'sg-a', ingress: [] },
			{ id: 'sg-b', ingress: [] },
		];
		expect(canReachSg(groups, 'sg-a', 'sg-b', 3306)).toBe(false);
	});

	it('인그레스의 출발지 보안 그룹이 다르면 도달하지 못한다', () => {
		const groups: SecurityGroup[] = [
			{ id: 'sg-a', ingress: [] },
			{ id: 'sg-b', ingress: [{ protocol: 'tcp', fromPort: 3306, toPort: 3306, sgId: 'sg-other' }] },
			{ id: 'sg-other', ingress: [] },
		];
		expect(canReachSg(groups, 'sg-a', 'sg-b', 3306)).toBe(false);
	});

	it('⭐ 인그레스는 허용인데 이그레스에 그 포트가 없으면 도달하지 못한다', () => {
		retrace(
			'인그레스만 확인하는 구현은 여기서 true를 반환한다. ' +
				'이그레스가 제한된 공용 SG를 재사용했을 때 실제로 일어난 조용한 차단이며, ' +
				'증상은 "/health는 200인데 비즈니스 API만 500"이었다.',
			() => {
				const groups: SecurityGroup[] = [
					{
						id: 'sg-shared',
						ingress: [],
						egress: [
							{ protocol: 'tcp', fromPort: 80, toPort: 80, cidr: '0.0.0.0/0' },
							{ protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0' },
						],
					},
					{ id: 'sg-redis', ingress: [{ protocol: 'tcp', fromPort: 6379, toPort: 6379, sgId: 'sg-shared' }] },
				];
				expect(canReachSg(groups, 'sg-shared', 'sg-redis', 6379)).toBe(false);
			},
		);
	});

	it('이그레스에 있는 포트는 통과한다', () => {
		retrace('이그레스를 확인하되 전부 막아버리는 구현이 아닌지 확인하는 항목', () => {
			const groups: SecurityGroup[] = [
				{
					id: 'sg-shared',
					ingress: [],
					egress: [{ protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0' }],
				},
				{ id: 'sg-web', ingress: [{ protocol: 'tcp', fromPort: 443, toPort: 443, sgId: 'sg-shared' }] },
			];
			expect(canReachSg(groups, 'sg-shared', 'sg-web', 443)).toBe(true);
		});
	});

	it('빈 배열 egress는 전체 차단이다 (undefined와 다르다)', () => {
		retrace(
			'egress: [] 를 미지정과 같게 처리하면 여기서 true가 된다. ' +
				'undefined는 "명시하지 않았다"(기본 전체 허용), []는 "명시했으나 아무것도 없다"(전체 차단)다.',
			() => {
				const groups: SecurityGroup[] = [
					{ id: 'sg-a', ingress: [], egress: [] },
					{ id: 'sg-b', ingress: [{ protocol: 'tcp', fromPort: 3306, toPort: 3306, sgId: 'sg-a' }] },
				];
				expect(canReachSg(groups, 'sg-a', 'sg-b', 3306)).toBe(false);
			},
		);
	});

	it('이그레스가 목적지 보안 그룹을 직접 지목해도 통과한다', () => {
		const groups: SecurityGroup[] = [
			{ id: 'sg-a', ingress: [], egress: [{ protocol: 'tcp', fromPort: 3306, toPort: 3306, sgId: 'sg-b' }] },
			{ id: 'sg-b', ingress: [{ protocol: 'tcp', fromPort: 3306, toPort: 3306, sgId: 'sg-a' }] },
		];
		expect(canReachSg(groups, 'sg-a', 'sg-b', 3306)).toBe(true);
	});

	describe('포트 범위', () => {
		const ranged: SecurityGroup[] = [
			{ id: 'sg-a', ingress: [] },
			{ id: 'sg-b', ingress: [{ protocol: 'tcp', fromPort: 8000, toPort: 8100, sgId: 'sg-a' }] },
		];

		it('범위의 두 경계를 모두 포함한다', () => {
			expect(canReachSg(ranged, 'sg-a', 'sg-b', 8000)).toBe(true);
			expect(canReachSg(ranged, 'sg-a', 'sg-b', 8100)).toBe(true);
		});

		it('범위를 벗어나면 도달하지 못한다', () => {
			expect(canReachSg(ranged, 'sg-a', 'sg-b', 7999)).toBe(false);
			expect(canReachSg(ranged, 'sg-a', 'sg-b', 8101)).toBe(false);
		});
	});

	describe('프로토콜', () => {
		it('프로토콜이 다르면 도달하지 못한다', () => {
			const tcpOnly: SecurityGroup[] = [
				{ id: 'sg-a', ingress: [] },
				{ id: 'sg-b', ingress: [{ protocol: 'tcp', fromPort: 53, toPort: 53, sgId: 'sg-a' }] },
			];
			expect(canReachSg(tcpOnly, 'sg-a', 'sg-b', 53, 'udp')).toBe(false);
		});

		it("'all'은 tcp와 udp 모두에 맞는다", () => {
			const allProto: SecurityGroup[] = [
				{ id: 'sg-a', ingress: [] },
				{ id: 'sg-b', ingress: [{ protocol: 'all', fromPort: 0, toPort: 65535, sgId: 'sg-a' }] },
			];
			expect(canReachSg(allProto, 'sg-a', 'sg-b', 53, 'tcp')).toBe(true);
			expect(canReachSg(allProto, 'sg-a', 'sg-b', 53, 'udp')).toBe(true);
		});
	});

	it('없는 보안 그룹 ID는 그 ID와 함께 던진다', () => {
		retrace(
			'조용히 false를 반환하면 오타가 "차단됨"으로 오인된다. ' +
				'메시지에 문제의 ID가 있어야 어느 쪽이 틀렸는지 즉시 안다.',
			() => {
				expect(() => canReachSg([{ id: 'sg-a', ingress: [] }], 'sg-nope', 'sg-a', 443)).toThrow(/sg-nope/);
				expect(() => canReachSg([{ id: 'sg-a', ingress: [] }], 'sg-a', 'sg-gone', 443)).toThrow(/sg-gone/);
			},
		);
	});
});

describe('canReachFromIp — VPC 밖 주소에서의 새 연결', () => {
	const albSg: SecurityGroup[] = [
		{
			id: 'sg-alb',
			ingress: [
				{ protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '203.0.113.10/32' },
				{ protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '198.51.100.20/32' },
			],
		},
	];

	it('허용된 사무실·VPN 주소는 443에 도달한다', () => {
		expect(canReachFromIp(albSg, '203.0.113.10', 'sg-alb', 443)).toBe(true);
		expect(canReachFromIp(albSg, '198.51.100.20', 'sg-alb', 443)).toBe(true);
	});

	it('⭐ 허용되지 않은 주소는 internet-facing이라도 차단된다', () => {
		retrace(
			'보안 그룹 화이트리스트가 internet-facing ALB의 안전판이라는 사실. ' +
				'이 화이트리스트를 전부 열면 그 순간 인터넷에 노출된다.',
			() => {
				expect(canReachFromIp(albSg, '1.2.3.4', 'sg-alb', 443)).toBe(false);
			},
		);
	});

	it('허용된 주소라도 다른 포트는 도달하지 못한다', () => {
		expect(canReachFromIp(albSg, '203.0.113.10', 'sg-alb', 80)).toBe(false);
	});

	it('출발지가 보안 그룹인 인그레스 규칙에는 IP가 맞지 않는다', () => {
		retrace('sgId 규칙을 IP 출발지에도 적용하면 여기서 true가 된다', () => {
			const sgOnly: SecurityGroup[] = [
				{ id: 'sg-svc', ingress: [{ protocol: 'tcp', fromPort: 8080, toPort: 8080, sgId: 'sg-alb' }] },
			];
			expect(canReachFromIp(sgOnly, '203.0.113.10', 'sg-svc', 8080)).toBe(false);
		});
	});
});

describe('학습 대상 템플릿의 SG 체인', () => {
	const chain: SecurityGroup[] = [
		{ id: 'sg-alb', ingress: [{ protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '203.0.113.10/32' }] },
		{ id: 'sg-svc', ingress: [{ protocol: 'tcp', fromPort: 8080, toPort: 8080, sgId: 'sg-alb' }] },
		{ id: 'sg-db', ingress: [{ protocol: 'tcp', fromPort: 3306, toPort: 3306, sgId: 'sg-svc' }] },
	];

	it('1단: ALB에서 태스크 8080으로 도달한다', () => {
		expect(canReachSg(chain, 'sg-alb', 'sg-svc', 8080)).toBe(true);
	});

	it('2단: 태스크에서 DB 3306으로 도달한다', () => {
		expect(canReachSg(chain, 'sg-svc', 'sg-db', 3306)).toBe(true);
	});

	it('⭐ 한 계층 건너뛴 연결은 차단된다 (ALB → DB)', () => {
		retrace('각 계층이 바로 앞 계층만 허용하는 구조의 핵심', () => {
			expect(canReachSg(chain, 'sg-alb', 'sg-db', 3306)).toBe(false);
		});
	});

	it('역방향 새 연결은 열리지 않는다 (태스크 → ALB)', () => {
		retrace(
			'응답 트래픽은 상태 저장(stateful)으로 규칙 없이 통과하지만, ' +
				'이 함수가 판정하는 것은 새 연결이다. 둘을 섞으면 규칙이 실제보다 넓어 보인다.',
			() => {
				expect(canReachSg(chain, 'sg-svc', 'sg-alb', 443)).toBe(false);
			},
		);
	});

	it('사무실 주소에서 태스크로 직접 도달할 수 없다', () => {
		expect(canReachFromIp(chain, '203.0.113.10', 'sg-svc', 8080)).toBe(false);
	});
});

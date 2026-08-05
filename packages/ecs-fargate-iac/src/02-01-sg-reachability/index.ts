/**
 * 과제 2-1 — 보안 그룹 도달성 판정기
 *
 * "A에서 B의 포트 P로 트래픽이 갈 수 있는가"를 판정한다. 규칙 목록을 눈으로
 * 훑어 판단하면 이그레스를 빠뜨리기 쉽다 — 그 실수를 코드로 못박는 과제다.
 *
 * ⚠️ 이 함수들은 **새 연결(요청 방향)**만 판정한다. 보안 그룹은 상태를 기억하므로
 *    응답 트래픽은 규칙 없이도 통과한다 — 응답은 판정 대상이 아니다.
 *
 * 명세:  tests/02-01-sg-reachability/index.test.ts  ← 무엇을 만들지는 여기 있다. 먼저 읽어라
 * 판정:  pnpm test 02-01        (패키지 디렉토리에서)
 * 막히면: docs/02-network-vpc-sg.md § 보안 그룹
 */

/** 인그레스·이그레스 규칙 하나. cidr과 sgId 중 정확히 하나를 갖는다. */
export interface SgRule {
	protocol: 'tcp' | 'udp' | 'all';
	/** 포트 범위의 시작 (출발 포트가 아니다) */
	fromPort: number;
	/** 포트 범위의 끝 */
	toPort: number;
	/** 상대를 IP 범위로 지정 */
	cidr?: string;
	/** 상대를 보안 그룹으로 지정 */
	sgId?: string;
}

export interface SecurityGroup {
	id: string;
	ingress: SgRule[];
	/**
	 * 아웃바운드 규칙.
	 *
	 * ⚠️ `undefined`는 "규칙이 없다"가 아니라 **"SecurityGroupEgress를 쓰지 않았다"**를
	 *    뜻하며, 그 경우 EC2 기본값인 전체 허용(0.0.0.0/0, 모든 포트)이 유지된다.
	 *    빈 배열 `[]`은 "명시했지만 아무것도 허용하지 않는다"로 전체 차단이다.
	 */
	egress?: SgRule[];
}

/**
 * CIDR 범위가 주어진 IPv4 주소를 포함하는가.
 *
 * 예) cidrContains('10.1.0.0/16', '10.1.2.3') === true
 *     cidrContains('1.2.3.4/32', '1.2.3.5')   === false
 *     cidrContains('0.0.0.0/0',  '8.8.8.8')   === true
 *
 * 힌트: 주소를 32비트 정수로 바꿔 접두사 길이만큼 마스킹해 비교한다.
 *       접두사 0에서 JavaScript의 `<< 32`가 `<< 0`과 같아지는 함정에 주의하라.
 */
export function cidrContains(cidr: string, ip: string): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: cidrContains');
}

/**
 * 보안 그룹 `fromSgId`가 붙은 리소스에서 `toSgId`가 붙은 리소스의 `port`로
 * 새 TCP 연결을 열 수 있는가.
 *
 * ⚠️ 출발지의 **이그레스 허용**과 목적지의 **인그레스 허용**이 모두 필요하다.
 *    한쪽만 확인하면 이 과제의 핵심을 놓친다.
 *
 * 이그레스의 목적지 매칭 규칙: 규칙의 `sgId`가 `toSgId`와 같거나, `cidr`가
 * `'0.0.0.0/0'`(전체)일 때만 목적지에 닿는 것으로 본다. SG↔SG 판정에서는
 * 목적지의 실제 IP를 모르므로 그 외 CIDR 규칙은 닿지 않는 것으로 취급한다.
 *
 * @throws 보안 그룹 ID가 목록에 없으면 Error
 */
export function canReachSg(
	groups: SecurityGroup[],
	fromSgId: string,
	toSgId: string,
	port: number,
	protocol: 'tcp' | 'udp' = 'tcp',
): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: canReachSg');
}

/**
 * VPC 밖의 IP(사무실 공인 IP 등)에서 `toSgId`의 `port`로 연결할 수 있는가.
 *
 * 출발지가 보안 그룹이 아니므로 이그레스는 판정에 들어가지 않는다 —
 * 목적지의 인그레스만 본다.
 *
 * @throws 보안 그룹 ID가 목록에 없으면 Error
 */
export function canReachFromIp(
	groups: SecurityGroup[],
	sourceIp: string,
	toSgId: string,
	port: number,
	protocol: 'tcp' | 'udp' = 'tcp',
): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: canReachFromIp');
}

// 직접 실행하면 학습 대상 템플릿의 SG 체인을 판정해 출력한다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const chain: SecurityGroup[] = [
		{
			id: 'sg-alb',
			ingress: [
				{ protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '203.0.113.10/32' },
				{ protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '198.51.100.20/32' },
			],
		},
		{ id: 'sg-svc', ingress: [{ protocol: 'tcp', fromPort: 8080, toPort: 8080, sgId: 'sg-alb' }] },
		{ id: 'sg-db', ingress: [{ protocol: 'tcp', fromPort: 3306, toPort: 3306, sgId: 'sg-svc' }] },
	];
	console.log('사무실 → ALB:443  ', canReachFromIp(chain, '203.0.113.10', 'sg-alb', 443));
	console.log('임의 IP → ALB:443 ', canReachFromIp(chain, '1.2.3.4', 'sg-alb', 443));
	console.log('ALB → 태스크:8080 ', canReachSg(chain, 'sg-alb', 'sg-svc', 8080));
	console.log('ALB → DB:3306     ', canReachSg(chain, 'sg-alb', 'sg-db', 3306), '(한 단계 건너뛰기)');
	console.log('태스크 → DB:3306  ', canReachSg(chain, 'sg-svc', 'sg-db', 3306));
}

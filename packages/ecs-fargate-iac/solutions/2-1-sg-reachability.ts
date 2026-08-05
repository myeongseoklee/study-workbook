/**
 * 과제 2-1의 참고 구현.
 *
 * 판정은 `tests/2-1-sg-reachability.test.ts`가 한다. 여기 있는 코드는
 * "정답 하나"가 아니라 "성립하는 한 예"다.
 *
 * 📍 되짚기: docs/02-network-vpc-sg.md § 보안 그룹 / § 함정 2 — 이그레스 누락
 *            / docs/90-must-memorize.md 카드 5·6·7
 */

export interface SgRule {
	protocol: 'tcp' | 'udp' | 'all';
	fromPort: number;
	toPort: number;
	cidr?: string;
	sgId?: string;
}

export interface SecurityGroup {
	id: string;
	ingress: SgRule[];
	/** undefined = SecurityGroupEgress 미지정 → EC2 기본값(전체 허용). [] = 전체 차단 */
	egress?: SgRule[];
}

/** IPv4 문자열을 32비트 부호 없는 정수로. */
function ipToInt(ip: string): number {
	const octets = ip.split('.').map(Number);
	if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
		throw new Error(`잘못된 IPv4 주소: ${ip}`);
	}
	// >>> 0 으로 부호 없는 값으로 되돌린다. << 24는 최상위 비트를 세워 음수가 된다.
	return ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
}

export function cidrContains(cidr: string, ip: string): boolean {
	const [network, prefixText] = cidr.split('/');
	if (network === undefined || prefixText === undefined) {
		throw new Error(`잘못된 CIDR: ${cidr}`);
	}
	const prefix = Number(prefixText);
	if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
		throw new Error(`잘못된 CIDR 접두사: ${cidr}`);
	}

	// prefix 0에서 (0xFFFFFFFF << 32)는 JS에서 << 0과 같아 마스크가 통째로 남는다.
	// 그러면 0.0.0.0/0이 아무것도 포함하지 않게 되므로 따로 처리한다.
	const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

	// 네트워크 주소가 정렬되지 않아도(10.1.2.7/24) 접두사 밖 비트는 마스킹으로 사라진다.
	return (ipToInt(network) & mask) === (ipToInt(ip) & mask);
}

/** 규칙이 이 프로토콜·포트를 덮는가. */
function coversPort(rule: SgRule, port: number, protocol: 'tcp' | 'udp'): boolean {
	const protocolOk = rule.protocol === 'all' || rule.protocol === protocol;
	return protocolOk && port >= rule.fromPort && port <= rule.toPort;
}

function mustFind(groups: SecurityGroup[], id: string): SecurityGroup {
	const found = groups.find((g) => g.id === id);
	if (!found) throw new Error(`보안 그룹을 찾을 수 없다: ${id}`);
	return found;
}

export function canReachSg(
	groups: SecurityGroup[],
	fromSgId: string,
	toSgId: string,
	port: number,
	protocol: 'tcp' | 'udp' = 'tcp',
): boolean {
	const from = mustFind(groups, fromSgId);
	const to = mustFind(groups, toSgId);

	// ── 출발지 이그레스 ──
	// undefined는 "규칙이 없다"가 아니라 "명시하지 않았다"이고, 그 경우 EC2 기본값인
	// 전체 허용이 유지된다. 여기를 빠뜨리면 실무의 조용한 차단을 재현하지 못한다.
	const egressOk =
		from.egress === undefined
			? true
			: from.egress.some(
					(r) => coversPort(r, port, protocol) && (r.sgId === toSgId || r.cidr === '0.0.0.0/0'),
				);
	if (!egressOk) return false;

	// ── 목적지 인그레스 ──
	return to.ingress.some((r) => coversPort(r, port, protocol) && r.sgId === fromSgId);
}

export function canReachFromIp(
	groups: SecurityGroup[],
	sourceIp: string,
	toSgId: string,
	port: number,
	protocol: 'tcp' | 'udp' = 'tcp',
): boolean {
	const to = mustFind(groups, toSgId);

	// 출발지가 보안 그룹이 아니므로 이그레스는 판정에 들어가지 않는다.
	return to.ingress.some(
		(r) => coversPort(r, port, protocol) && r.cidr !== undefined && cidrContains(r.cidr, sourceIp),
	);
}

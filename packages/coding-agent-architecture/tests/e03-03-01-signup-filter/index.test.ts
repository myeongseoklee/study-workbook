// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e03-03-01-signup-filter/index.ts를 고쳐라.
//
// "온프레미스 안에서 신청했으면 다 직원이겠지"가 틀린 전제라는 것이 이 과제의 출발점이다.
// 사내망은 네트워크 위치일 뿐이고, 가입은 사내 LLM 토큰과 코드 접근을 배분하는 일이다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	decide,
	inCidr,
	type Application,
	type SignupPolicy,
} from '../../src/e03-03-01-signup-filter';

// IP는 전부 RFC 5737 문서용 예약 대역이다 (실제 주소를 예시로 쓰지 않는다).
const OFFICE = '203.0.113.0/24';
const VPN = '198.51.100.0/24';

const manual: SignupPolicy = { mode: 'manual', requiredFields: [] };
const auto: SignupPolicy = { mode: 'auto', requiredFields: [] };

function app(over: Partial<Application> = {}): Application {
	return { email: 'a@example.com', ip: '203.0.113.10', fields: {}, ...over };
}

describe('inCidr — 대역 판정', () => {
	it('대역 안이면 true', () => {
		expect(inCidr('203.0.113.10', OFFICE)).toBe(true);
		expect(inCidr('203.0.113.255', OFFICE)).toBe(true);
	});

	it('대역 밖이면 false', () => {
		// 대역 밖을 보이려고 203.0.114.x 같은 "한 칸 옆" 주소를 쓰면 안 된다 — RFC 5737의
		// 예약 대역은 203.0.113.0/24까지이고 그 밖은 실제 할당된 주소다. 다른 예약 대역을 쓴다.
		expect(inCidr('192.0.2.1', OFFICE)).toBe(false);
		expect(inCidr('198.51.100.1', OFFICE)).toBe(false);
	});

	it('네트워크 주소와 브로드캐스트 주소도 대역에 포함된다', () => {
		expect(inCidr('203.0.113.0', OFFICE)).toBe(true);
	});

	it('/32는 한 주소만 매칭한다', () => {
		expect(inCidr('192.0.2.7', '192.0.2.7/32')).toBe(true);
		expect(inCidr('192.0.2.8', '192.0.2.7/32')).toBe(false);
	});

	it('바이트 경계가 아닌 프리픽스도 맞는다 (/25·/26·/30)', () => {
		retrace(
			'옥텟 문자열 비교로 구현하면 여기서 깨진다. 32비트 정수로 바꿔 마스크를 씌워라.\n' +
				'(테스트 주소를 RFC 5737 예약 대역 안에서만 구성하려고 /24보다 좁은 프리픽스를 쓴다 — ' +
				'검사하려는 성질은 "마스크가 바이트 경계에 걸리지 않는다"이므로 목적은 그대로다.)',
			() => {
				expect(inCidr('192.0.2.130', '192.0.2.128/25')).toBe(true);
				expect(inCidr('192.0.2.127', '192.0.2.128/25')).toBe(false);
				expect(inCidr('198.51.100.70', '198.51.100.64/26')).toBe(true);
				expect(inCidr('198.51.100.63', '198.51.100.64/26')).toBe(false);
				expect(inCidr('203.0.113.9', '203.0.113.8/30')).toBe(true);
				expect(inCidr('203.0.113.12', '203.0.113.8/30')).toBe(false);
			},
		);
	});

	it('/0은 모든 주소를 포함한다 (경계)', () => {
		retrace(
			'`-1 << 32`는 시프트가 32로 모듈로 되어 -1이 된다. 부호 없는 정수로 다루지 않으면 ' +
				'이 케이스에서 결과가 뒤집힌다.',
			() => {
				expect(inCidr('192.0.2.1', '0.0.0.0/0')).toBe(true);
				expect(inCidr('203.0.113.255', '0.0.0.0/0')).toBe(true);
			},
		);
	});

	it('형식이 깨진 입력은 던지지 않고 false다', () => {
		expect(inCidr('nope', OFFICE)).toBe(false);
		expect(inCidr('203.0.113.10', 'nope')).toBe(false);
	});
});

describe('decide — 필수 필드가 정책보다 먼저다', () => {
	const needDept: SignupPolicy = { mode: 'auto', requiredFields: ['department'] };

	it('필수 필드가 없으면 자동 승인 정책이어도 거부된다', () => {
		retrace(
			'"필수 가입 JSON을 받아야 메타 정보를 생성해서 가입시킨다" — 없는 값으로는 어떤 판단도 ' +
				'못 하므로, 필드 검사는 정책 분기보다 앞선다.',
			() => {
				const r = decide(app(), needDept);
				expect(r.status).toBe('rejected');
				expect(r.reason).toBe('missing_fields');
			},
		);
	});

	it('어느 필드가 빠졌는지 알려준다', () => {
		const p: SignupPolicy = { mode: 'auto', requiredFields: ['department', 'employeeId'] };
		const r = decide(app({ fields: { department: 'ops' } }), p);
		expect(r.missing).toEqual(['employeeId']);
	});

	it('빈 문자열은 값이 없는 것으로 본다', () => {
		expect(decide(app({ fields: { department: '  ' } }), needDept).status).toBe('rejected');
	});

	it('필드가 채워져 있으면 정책 분기로 넘어간다', () => {
		expect(decide(app({ fields: { department: 'ops' } }), needDept).status).toBe('approved');
	});
});

describe('decide — 세 가지 정책', () => {
	it('manual은 항상 보류다 (거부가 아니다)', () => {
		retrace('수동 승인은 "사람이 볼 차례"라는 뜻이다. 거부로 만들면 재신청을 요구하게 된다', () => {
			const r = decide(app(), manual);
			expect(r.status).toBe('pending');
			expect(r.reason).toBe('manual_review');
		});
	});

	it('auto는 항상 승인이다', () => {
		expect(decide(app({ ip: '192.0.2.99' }), auto).status).toBe('approved');
	});

	it('filter는 조건을 만족하면 승인한다', () => {
		const p: SignupPolicy = { mode: 'filter', requiredFields: [], allowedCidrs: [OFFICE, VPN] };
		expect(decide(app({ ip: '198.51.100.5' }), p).status).toBe('approved');
	});

	it('filter는 조건을 못 맞추면 보류다 — 거부가 아니다', () => {
		retrace(
			'필터를 통과하지 못한 것은 "자동으로 승인할 근거가 없다"는 뜻이지 "자격이 없다"는 뜻이 ' +
				'아니다. 사람이 보면 승인될 수 있으므로 보류로 떨어뜨린다.',
			() => {
				const p: SignupPolicy = { mode: 'filter', requiredFields: [], allowedCidrs: [OFFICE] };
				const r = decide(app({ ip: '198.51.100.5' }), p);
				expect(r.status).toBe('pending');
				expect(r.reason).toBe('filter_no_match');
			},
		);
	});
});

describe('decide — 필터 조건은 모두 만족해야 한다 (AND)', () => {
	const dir = new Set(['E1001', 'E1002']);
	const p: SignupPolicy = {
		mode: 'filter',
		requiredFields: ['employeeId'],
		allowedCidrs: [OFFICE],
		employeeDirectory: dir,
	};

	it('IP와 사번이 모두 맞으면 승인', () => {
		expect(decide(app({ fields: { employeeId: 'E1001' } }), p).status).toBe('approved');
	});

	it('IP는 맞지만 사번이 인사DB에 없으면 보류', () => {
		retrace(
			'조건을 OR로 두면 사내망 안에 있다는 사실만으로 통과한다 — 협력업체 상주 인원이 그 조건을 ' +
				'만족한다. 보안 정책은 좁히는 방향이어야 하므로 AND다.',
			() => {
				expect(decide(app({ fields: { employeeId: 'E9999' } }), p).status).toBe('pending');
			},
		);
	});

	it('사번은 맞지만 대역 밖이면 보류', () => {
		expect(
			decide(app({ ip: '192.0.2.1', fields: { employeeId: 'E1001' } }), p).status,
		).toBe('pending');
	});

	it('조건이 하나도 지정되지 않은 filter는 승인하지 않는다', () => {
		retrace(
			'조건 없는 필터를 "모두 통과"로 구현하면 filter가 auto와 같아진다. 설정 실수가 ' +
				'전원 자동 승인이 되는 것은 안전한 기본값이 아니다.',
			() => {
				const empty: SignupPolicy = { mode: 'filter', requiredFields: [] };
				expect(decide(app(), empty).status).toBe('pending');
			},
		);
	});
});

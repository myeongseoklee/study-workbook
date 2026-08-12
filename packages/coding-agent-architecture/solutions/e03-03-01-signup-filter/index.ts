/**
 * 참고 구현 — 가입 승인 필터.
 *
 * 판정은 tests/e03-03-01-signup-filter/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep03-admin-implementation/03-signup-policy.md
 */

export interface Application {
	email: string;
	ip: string;
	fields: Record<string, string>;
}

export type SignupMode = 'manual' | 'auto' | 'filter';

export interface SignupPolicy {
	mode: SignupMode;
	requiredFields: string[];
	allowedCidrs?: string[];
	employeeDirectory?: Set<string>;
}

export type Decision = {
	status: 'approved' | 'pending' | 'rejected';
	reason: 'auto_approved' | 'manual_review' | 'filter_matched' | 'filter_no_match' | 'missing_fields';
	missing?: string[];
};

/** 점 표기 주소를 32비트 정수로. 형식이 틀리면 null. */
function toInt(ip: string): number | null {
	const parts = ip.split('.');
	if (parts.length !== 4) return null;
	let n = 0;
	for (const p of parts) {
		if (!/^\d{1,3}$/.test(p)) return null;
		const b = Number(p);
		if (b > 255) return null;
		n = n * 256 + b;
	}
	return n;
}

/**
 * 옥텟 문자열 비교로 구현하면 `/16`·`/25`처럼 바이트 경계가 아닌 프리픽스에서
 * 깨진다. 32비트 정수 + 마스크가 프리픽스 길이와 무관하게 맞는 유일한 방법이다.
 *
 * `>>> 0`이 필요한 이유: `/0`일 때 `-1 << 32`는 시프트가 32로 모듈로 되어 `-1`이
 * 되고, 부호 있는 정수로 비교하면 결과가 뒤집힌다.
 */
export function inCidr(ip: string, cidr: string): boolean {
	const [base, bitsRaw] = cidr.split('/');
	if (base === undefined || bitsRaw === undefined || !/^\d{1,2}$/.test(bitsRaw)) return false;
	const bits = Number(bitsRaw);
	if (bits > 32) return false;
	const a = toInt(ip);
	const b = toInt(base);
	if (a === null || b === null) return false;
	const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
	return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

const filled = (v: string | undefined): boolean => typeof v === 'string' && v.trim() !== '';

/**
 * 판정 순서가 이 함수의 설계다.
 *
 * ① 필수 필드 → ② 정책 분기 → ③ (filter면) 조건 평가
 *
 * ①이 앞에 오는 이유: 필터가 볼 값이 신청서에 없으면 어떤 판단도 성립하지 않는다.
 * 그리고 그 상태는 `pending`이 아니라 `rejected`다 — 사람이 봐도 없는 값을
 * 만들어 줄 수는 없고, 신청자가 다시 제출해야 한다.
 *
 * 반대로 필터 불통과는 `pending`이다. "자동 승인할 근거가 없다"와 "자격이 없다"는
 * 다른 말이고, 후자로 취급하면 정상 직원을 재신청 루프에 빠뜨린다.
 */
export function decide(application: Application, policy: SignupPolicy): Decision {
	const missing = policy.requiredFields.filter((f) => !filled(application.fields[f]));
	if (missing.length > 0) return { status: 'rejected', reason: 'missing_fields', missing };

	if (policy.mode === 'manual') return { status: 'pending', reason: 'manual_review' };
	if (policy.mode === 'auto') return { status: 'approved', reason: 'auto_approved' };

	// filter — 지정된 조건을 모두 만족해야 한다(AND).
	//
	// OR로 두면 "사내망 안에 있다"만으로 통과하고, 협력업체 상주 인원이 그 조건을
	// 만족한다. 조건이 하나도 없으면 통과시키지 않는다 — 설정 실수가 전원 자동
	// 승인이 되는 것은 안전한 기본값이 아니다(→ 기본 거부).
	const checks: boolean[] = [];

	if (policy.allowedCidrs && policy.allowedCidrs.length > 0) {
		checks.push(policy.allowedCidrs.some((c) => inCidr(application.ip, c)));
	}
	if (policy.employeeDirectory) {
		const id = application.fields.employeeId;
		checks.push(filled(id) && policy.employeeDirectory.has(id!));
	}

	const matched = checks.length > 0 && checks.every(Boolean);
	return matched
		? { status: 'approved', reason: 'filter_matched' }
		: { status: 'pending', reason: 'filter_no_match' };
}

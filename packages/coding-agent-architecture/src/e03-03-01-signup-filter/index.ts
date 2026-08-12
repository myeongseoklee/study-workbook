/**
 * 과제 e03-03-01 — 가입 승인 필터
 *
 * "온프레미스 안에서 신청했으면 다 직원이겠지"가 틀린 전제라는 것이 출발점이다.
 * 사내망은 **네트워크 위치**일 뿐이고, 가입은 사내 LLM 토큰과 코드 접근을
 * 배분하는 일이다. 그래서 승인에 정책이 필요하다.
 *
 * 명세:  tests/e03-03-01-signup-filter/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e03-03-01
 * 막히면: docs/ep03-admin-implementation/03-signup-policy.md
 */

export interface Application {
	email: string;
	/** 신청이 들어온 주소 */
	ip: string;
	/** 필수 가입 JSON으로 받은 값들 */
	fields: Record<string, string>;
}

export type SignupMode = 'manual' | 'auto' | 'filter';

export interface SignupPolicy {
	mode: SignupMode;
	/** 이 필드들이 없으면 어떤 정책이든 진행할 수 없다 */
	requiredFields: string[];
	/** filter 모드의 조건 ① — 허용 대역 */
	allowedCidrs?: string[];
	/** filter 모드의 조건 ② — 사번 인사DB (있는 사번인지 조회) */
	employeeDirectory?: Set<string>;
}

export type Decision = {
	status: 'approved' | 'pending' | 'rejected';
	reason: 'auto_approved' | 'manual_review' | 'filter_matched' | 'filter_no_match' | 'missing_fields';
	/** missing_fields일 때 어느 필드가 비었는지 */
	missing?: string[];
};

/**
 * IP가 CIDR 대역에 들어가는가.
 *
 * 힌트: 옥텟 문자열을 비교하면 `/16`·`/25`처럼 바이트 경계가 아닌 프리픽스에서
 *       깨진다. 주소를 **32비트 정수**로 바꿔 마스크를 씌워라. 형식이 깨진
 *       입력은 던지지 않고 false다.
 */
export function inCidr(ip: string, cidr: string): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: inCidr');
}

/**
 * 이 신청을 어떻게 처리할지 판정한다.
 *
 * 힌트 셋:
 *   ① 필수 필드 검사는 **정책 분기보다 먼저**다 — 없는 값으로는 아무 판단도 못 한다
 *   ② 통과하지 못한 것과 자격이 없는 것은 다르다. 무엇이 `pending`이고 무엇이
 *      `rejected`인지 명세가 정해 준다
 *   ③ filter의 조건들은 좁히는 방향으로 결합한다. 그리고 조건이 하나도 없는
 *      filter를 "전부 통과"로 두면 설정 실수가 전원 승인이 된다
 */
export function decide(application: Application, policy: SignupPolicy): Decision {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: decide');
}

/**
 * 과제 e03-02-01 — 세션 생명주기
 *
 * 세션 키의 어려운 쪽은 발급이 아니라 **회수**다. 그리고 회수에는 성격이 다른
 * 세 사건이 있다 — 스스로 만료되는 것(유휴), 관리자가 끊는 것(강제 제거),
 * 그리고 기록을 지우는 것(보관 기간 만료). 이 셋을 하나로 합치면 감사 기록이
 * 사라지거나 죽은 세션이 되살아난다.
 *
 * 명세:  tests/e03-02-01-session-lifecycle/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e03-02-01
 * 막히면: docs/ep03-admin-implementation/02-session-and-audit.md
 */

export interface Session {
	id: string;
	userId: string;
	/** 마지막 요청 시각(초). 유휴 시계의 기준점이다. */
	lastSeenAt: number;
	/** 관리자가 강제 제거한 시각. null이면 제거되지 않았다. */
	revokedAt: number | null;
}

export interface SessionPolicy {
	/** 이 시간 이상 요청이 없으면 만료 (시연값 7200 = 2시간) */
	idleTimeoutSec: number;
	/** 만료된 기록을 이만큼 더 보관한다 (시연값 86400 = 1일) */
	retentionSec: number;
	/** 만료 기록을 남길지. false면 만료 즉시 삭제 대상이다. */
	keepExpired: boolean;
}

export interface SweepResult {
	active: Session[];
	expired: Session[];
	deleted: Session[];
}

/**
 * 이 세션이 만료됐는가.
 *
 * 힌트: 만료 경로가 둘이다. 하나는 시간이고, 다른 하나는 시간과 무관하다.
 */
export function isExpired(session: Session, now: number, policy: SessionPolicy): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: isExpired');
}

/**
 * 요청이 도착했다. 유휴 시계를 되돌린 **새 세션**을 준다.
 *
 * 힌트: 갱신하기 전에 물어야 할 것이 있다. 그 확인을 빼면 늦게 도착한 요청 하나가
 *       죽은 세션을 무한히 살려낸다. 갱신할 수 없으면 `null`을 준다(재발급 대상).
 */
export function touch(session: Session, now: number, policy: SessionPolicy): Session | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: touch');
}

/**
 * 그 사용자의 모든 세션을 끊는다 (퇴사 / 중앙 가드레일 위반).
 *
 * 힌트: "끊는 것"과 "기록을 없애는 것"은 다른 일이다. 이 함수는 앞쪽만 한다.
 *       이미 끊긴 세션의 시각은 처음 끊긴 때가 사실이다.
 */
export function revokeUser(sessions: Session[], userId: string, now: number): Session[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: revokeUser');
}

/**
 * 세션 목록을 세 갈래로 가른다: 살아 있음 / 만료됨(보관 중) / 삭제 대상.
 *
 * 힌트: 보관 기간을 어느 시점부터 재는지가 핵심이다. 마지막 요청 시각부터 재면
 *       보관 기간이 유휴 시간만큼 길어진다. 강제 제거된 세션은 기준점이 또 다르다.
 */
export function sweep(sessions: Session[], now: number, policy: SessionPolicy): SweepResult {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: sweep');
}

/**
 * 참고 구현 — 세션 생명주기.
 *
 * 판정은 tests/e03-02-01-session-lifecycle/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep03-admin-implementation/02-identity-and-session.md
 */

export interface Session {
	id: string;
	userId: string;
	lastSeenAt: number;
	revokedAt: number | null;
}

export interface SessionPolicy {
	idleTimeoutSec: number;
	retentionSec: number;
	keepExpired: boolean;
}

export interface SweepResult {
	active: Session[];
	expired: Session[];
	deleted: Session[];
}

/**
 * 만료 경로가 둘이다. 강제 제거를 먼저 보는 이유는 그것이 **시간을 이기기**
 * 때문이다 — 방금 요청한 세션도 끊겨야 "로그인 취소"가 성립한다.
 */
export function isExpired(session: Session, now: number, policy: SessionPolicy): boolean {
	if (session.revokedAt !== null && now >= session.revokedAt) return true;
	return now - session.lastSeenAt >= policy.idleTimeoutSec;
}

/**
 * 만료된 세션은 갱신 대상이 아니다. 이 확인을 빼면 늦게 도착한 요청 하나가
 * 죽은 세션을 되살리고, 그러면 유휴 만료라는 정책 자체가 없는 것과 같아진다.
 */
export function touch(session: Session, now: number, policy: SessionPolicy): Session | null {
	if (isExpired(session, now, policy)) return null;
	return { ...session, lastSeenAt: now };
}

/**
 * 목록에서 지우지 않는다. "누가 언제 강제 로그아웃됐는지"는 감사 대상 사실이고,
 * 삭제 시점은 보관 기간이 정한다(sweep).
 *
 * 이미 끊긴 세션의 시각을 덮어쓰지 않는 이유도 같다 — 처음 끊긴 때가 사실이다.
 */
export function revokeUser(sessions: Session[], userId: string, now: number): Session[] {
	return sessions.map((s) =>
		s.userId === userId && s.revokedAt === null ? { ...s, revokedAt: now } : s,
	);
}

/** 만료가 시작된 시각. 보관 기간은 여기서부터 잰다. */
function expiredAt(session: Session, policy: SessionPolicy): number {
	if (session.revokedAt !== null) return session.revokedAt;
	return session.lastSeenAt + policy.idleTimeoutSec;
}

/**
 * 세 갈래는 배타적이다. 만료와 삭제를 한 사건으로 합치면 감사 기록이 만료 즉시
 * 사라진다 — 정책의 "만료 기록 유지"가 존재하는 이유가 그것이다.
 *
 * 보관 기간의 기준점이 함정이다. `lastSeenAt + retention`으로 재면 실제 보관이
 * `idleTimeout + retention`이 되어 정책값보다 길어진다.
 */
export function sweep(sessions: Session[], now: number, policy: SessionPolicy): SweepResult {
	const out: SweepResult = { active: [], expired: [], deleted: [] };
	for (const s of sessions) {
		if (!isExpired(s, now, policy)) {
			out.active.push(s);
			continue;
		}
		if (!policy.keepExpired) {
			out.deleted.push(s);
			continue;
		}
		if (now - expiredAt(s, policy) >= policy.retentionSec) out.deleted.push(s);
		else out.expired.push(s);
	}
	return out;
}

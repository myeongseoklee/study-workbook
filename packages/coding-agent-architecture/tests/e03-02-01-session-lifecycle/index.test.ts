// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e03-02-01-session-lifecycle/index.ts를 고쳐라.
//
// 세션 키의 어려운 쪽은 발급이 아니라 **회수**다. 유휴로 스스로 만료되는 경로,
// 관리자가 즉시 끊는 경로, 그리고 만료된 기록을 감사용으로 얼마나 들고 있을지가
// 서로 다른 정책이며 섞으면 하나가 다른 하나를 망가뜨린다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	isExpired,
	revokeUser,
	sweep,
	touch,
	type Session,
	type SessionPolicy,
} from '../../src/e03-02-01-session-lifecycle';

/** 시연값: 유휴 2시간, 만료 기록은 하루 보관. */
const policy: SessionPolicy = { idleTimeoutSec: 7200, retentionSec: 86400, keepExpired: true };

function session(id: string, userId: string, lastSeenAt: number, revokedAt: number | null = null): Session {
	return { id, userId, lastSeenAt, revokedAt };
}

describe('isExpired — 유휴 판정', () => {
	it('마지막 요청 이후 유휴 시간이 안 지났으면 살아 있다', () => {
		expect(isExpired(session('s1', 'u1', 1000), 1000 + 7199, policy)).toBe(false);
	});

	it('정확히 유휴 시간 지점이면 만료다 (경계 포함)', () => {
		retrace('"일정 시간 이상 요청이 없으면 만료"이므로 부등호에 등호를 포함한다', () => {
			expect(isExpired(session('s1', 'u1', 1000), 1000 + 7200, policy)).toBe(true);
		});
	});

	it('관리자가 제거한 세션은 유휴 시간과 무관하게 만료다', () => {
		retrace(
			'강제 제거는 즉시 효력이 있어야 한다 — 방금 요청한 세션도 끊겨야 로그인 취소가 성립한다',
			() => {
				const revoked = session('s1', 'u1', 1000, 1500);
				expect(isExpired(revoked, 1600, policy)).toBe(true);
			},
		);
	});
});

describe('touch — 요청이 오면 유휴 시계를 되돌린다', () => {
	it('살아 있는 세션은 lastSeenAt이 갱신된다', () => {
		const s = session('s1', 'u1', 1000);
		const next = touch(s, 3000, policy);
		expect(next?.lastSeenAt).toBe(3000);
	});

	it('원본을 변형하지 않는다', () => {
		const s = session('s1', 'u1', 1000);
		touch(s, 3000, policy);
		expect(s.lastSeenAt).toBe(1000);
	});

	it('이미 만료된 세션은 touch로 되살아나지 않는다 — null을 준다', () => {
		retrace(
			'만료를 확인하지 않고 lastSeenAt만 갱신하면, 늦게 도착한 요청 하나가 죽은 세션을 ' +
				'무한히 살려낸다. 만료 뒤에는 재발급을 받아야 한다.',
			() => {
				expect(touch(session('s1', 'u1', 1000), 1000 + 7200, policy)).toBeNull();
			},
		);
	});

	it('강제 제거된 세션도 되살아나지 않는다', () => {
		expect(touch(session('s1', 'u1', 5000, 5100), 5200, policy)).toBeNull();
	});
});

describe('revokeUser — 퇴사·가드레일 위반 시 그 사람의 세션을 전부 끊는다', () => {
	it('해당 사용자의 모든 세션에 revokedAt이 찍힌다', () => {
		const list = [session('s1', 'u1', 100), session('s2', 'u1', 200), session('s3', 'u2', 300)];
		const next = revokeUser(list, 'u1', 9000);
		expect(next.filter((s) => s.revokedAt === 9000).map((s) => s.id)).toEqual(['s1', 's2']);
	});

	it('다른 사용자의 세션은 건드리지 않는다', () => {
		const next = revokeUser([session('s3', 'u2', 300)], 'u1', 9000);
		expect(next[0]!.revokedAt).toBeNull();
	});

	it('세션을 목록에서 지우지 않는다 — 끊는 것과 기록을 없애는 것은 다르다', () => {
		retrace(
			'감사가 목적인 시스템에서 "누가 언제 강제 로그아웃됐는지"는 남아야 하는 사실이다. ' +
				'삭제는 sweep의 보관 기간이 결정한다.',
			() => {
				expect(revokeUser([session('s1', 'u1', 100)], 'u1', 9000)).toHaveLength(1);
			},
		);
	});

	it('이미 제거된 세션의 시각을 덮어쓰지 않는다', () => {
		const next = revokeUser([session('s1', 'u1', 100, 500)], 'u1', 9000);
		expect(next[0]!.revokedAt).toBe(500);
	});
});

describe('sweep — 만료와 삭제는 다른 사건이다', () => {
	it('살아 있는 세션은 active로 남는다', () => {
		const out = sweep([session('s1', 'u1', 1000)], 2000, policy);
		expect(out.active.map((s) => s.id)).toEqual(['s1']);
		expect(out.expired).toEqual([]);
		expect(out.deleted).toEqual([]);
	});

	it('만료됐지만 보관 기간 안이면 삭제하지 않고 expired로 옮긴다', () => {
		retrace(
			'만료 즉시 지우면 감사 기록이 사라진다. 정책의 "만료 기록 유지"가 이 단계다.',
			() => {
				// 1000에 마지막 요청 → 8200에 만료. 지금은 만료 후 1시간.
				const out = sweep([session('s1', 'u1', 1000)], 8200 + 3600, policy);
				expect(out.expired.map((s) => s.id)).toEqual(['s1']);
				expect(out.deleted).toEqual([]);
			},
		);
	});

	it('만료 시점부터 보관 기간이 지나면 삭제 대상이다', () => {
		retrace('보관 기간은 만료 시점 기준이다 — 마지막 요청 시점 기준으로 재면 하루가 아니라 하루+2시간이 된다', () => {
			const expiresAt = 1000 + 7200;
			const out = sweep([session('s1', 'u1', 1000)], expiresAt + 86400, policy);
			expect(out.deleted.map((s) => s.id)).toEqual(['s1']);
			expect(out.expired).toEqual([]);
		});
	});

	it('keepExpired가 false면 만료 즉시 삭제 대상이다', () => {
		const drop: SessionPolicy = { ...policy, keepExpired: false };
		const out = sweep([session('s1', 'u1', 1000)], 1000 + 7200, drop);
		expect(out.deleted.map((s) => s.id)).toEqual(['s1']);
		expect(out.expired).toEqual([]);
	});

	it('강제 제거된 세션의 보관 기간은 제거 시각부터 잰다', () => {
		const out = sweep([session('s1', 'u1', 1000, 2000)], 2000 + 86400, policy);
		expect(out.deleted.map((s) => s.id)).toEqual(['s1']);
	});

	it('세 갈래는 서로 배타적이고 합이 입력과 같다', () => {
		const list = [
			session('alive', 'u1', 10_000),
			session('just-expired', 'u2', 1000),
			session('old', 'u3', 0),
			session('revoked', 'u4', 9000, 9500),
		];
		const now = 10_000;
		const out = sweep(list, now, policy);
		const total = out.active.length + out.expired.length + out.deleted.length;
		expect(total).toBe(4);
		expect(out.active.map((s) => s.id)).toEqual(['alive']);
		// 0에 마지막 요청 → 7200 만료 → 7200+86400 이 지나야 삭제. 아직 아니다.
		expect(out.expired.map((s) => s.id).sort()).toEqual(['just-expired', 'old', 'revoked']);
	});

	it('빈 목록도 세 갈래를 모두 준다 — undefined가 아니다', () => {
		expect(sweep([], 0, policy)).toEqual({ active: [], expired: [], deleted: [] });
	});
});

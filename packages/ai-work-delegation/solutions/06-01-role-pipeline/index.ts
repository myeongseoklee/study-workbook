/**
 * 과제 06-01 참고 구현 — 역할 파이프라인의 불변식
 *
 * 📍 되짚기: docs/06-delegation-and-role-separation.md — "역할별로 무엇을 주고 무엇을 감추는가"
 *
 * 이 구현에서 판단이 갈린 곳은 셋이다.
 *
 * **①** 컨텍스트를 **빼기가 아니라 더하기로** 조립했다. `{...draft}`에서
 * 필요 없는 키를 지우는 방식은 `Draft`에 새 필드가 생길 때마다 조용히 새는
 * 구멍이 된다 — 지우는 목록을 갱신하지 않으면 새 필드가 전 역할에 흘러간다.
 * 허용 목록으로 담으면 새 필드는 **명시적으로 추가할 때만** 들어온다. 격리는
 * 기본값이 "안 준다"여야 유지된다.
 *
 * **②** 검사를 실행 앞에 몰아 두었다. 루프 안에서 검사하면 앞쪽 역할이 이미
 * 돌아 버려서, 예외를 잡은 쪽에는 절반쯤 채워진 작업물이 남는다. 그리고 그
 * 작업물에는 "절반"이라는 표시가 없다. **부분 실행의 흔적이 완결된 산출물과
 * 구별되지 않는 것**이 이런 파이프라인에서 가장 위험한 상태다.
 *
 * **③** `evidence`를 복사해서 넘긴다. 격리를 "무엇을 주지 않는가"로만 생각하면
 * 놓치는 자리다 — 준 것이 원본과 같은 배열이면 역할 쪽의 조작이 그대로 원본에
 * 반영된다. 서브에이전트를 다른 프로세스로 띄우면 직렬화가 이 문제를 우연히
 * 가려 주는데, 같은 프로세스 안에서 돌리는 순간 되살아난다.
 */

export type Role = 'researcher' | 'skeptic' | 'auditor' | 'reporter';

export interface Draft {
	question: string;
	evidence: string[];
	conclusion?: string;
	report?: string;
}

export type RoleContext = Partial<Pick<Draft, 'question' | 'evidence' | 'conclusion'>>;
export type RoleCall = (role: Role, context: RoleContext) => Partial<Draft>;

/** 역할별 허용 목록. 여기 없는 필드는 어떤 경우에도 넘어가지 않는다. */
const VISIBLE: Record<Role, readonly (keyof RoleContext)[]> = {
	researcher: ['question'],
	skeptic: ['question', 'evidence'],
	auditor: ['evidence'],
	reporter: ['question', 'evidence', 'conclusion'],
};

export function contextFor(role: Role, draft: Draft): RoleContext {
	const context: RoleContext = {};

	for (const field of VISIBLE[role]) {
		const value = draft[field];
		// 원래 값이 없으면 키를 만들지 않는다. undefined를 담아 두면
		// `'conclusion' in context`가 참이 되어 감춘 것이 있는 것처럼 읽힌다.
		if (value === undefined) continue;
		// 배열은 복사해서 넘긴다 — 원본과 상태를 공유하지 않기 위해서다.
		context[field] = (Array.isArray(value) ? [...value] : value) as never;
	}

	return context;
}

/** 실행 전에 세 불변식을 한 번에 검사한다. */
function assertValidOrder(roles: Role[]): void {
	if (roles.length === 0) {
		throw new RangeError('역할이 하나도 없는 파이프라인은 실행할 수 없다');
	}

	const reporterAt = roles.indexOf('reporter');
	if (reporterAt === -1) return; // 검증만 하고 끝내는 실행은 허용된다

	// 두 번 이상 등장하는 경우도 이 검사에 걸린다 — 첫 등장이 마지막이 아니게 된다.
	if (reporterAt !== roles.length - 1) {
		throw new RangeError(
			`편집자는 마지막에만 올 수 있다 (현재 ${reporterAt + 1}번째 / 전체 ${roles.length}개). ` +
				'글이 먼저 만들어지면 이후 검증이 그 산출물을 지키는 방향으로 기운다.',
		);
	}

	const before = new Set(roles.slice(0, reporterAt));
	const missing = (['skeptic', 'auditor'] as const).filter((role) => !before.has(role));
	if (missing.length > 0) {
		throw new RangeError(
			`편집자 앞에 검증 역할이 빠져 있다: ${missing.join(', ')}. ` +
				'산출물은 모든 검증이 끝난 뒤에만 만든다.',
		);
	}
}

export function runPipeline(roles: Role[], draft: Draft, call: RoleCall): Draft {
	assertValidOrder(roles);

	// 원본을 건드리지 않기 위해 사본에서 시작한다. evidence까지 복사해야
	// 역할이 배열을 밀어 넣었을 때 호출자의 배열이 함께 자라지 않는다.
	let current: Draft = { ...draft, evidence: [...draft.evidence] };

	for (const role of roles) {
		const patch = call(role, contextFor(role, current));
		current = { ...current, ...patch };
	}

	return current;
}

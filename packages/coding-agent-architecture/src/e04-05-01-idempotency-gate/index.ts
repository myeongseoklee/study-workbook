/**
 * 과제 e04-05-01 — 멱등 검문소
 *
 * 4강 슬라이드 「멱등성 실제 구현」의 세 갈래 판정을 인메모리로 구현한다.
 * 실제 구현은 PostgreSQL의 `INSERT ... ON CONFLICT` 한 줄이지만, 판정 규칙
 * 자체는 저장소와 무관하다. 여기서는 규칙만 다룬다.
 *
 * 강의가 직접 정정한 대목이 이 과제의 요점이다 —
 * **"인자 기반 분기이지 멱등은 아님."** 동작을 고치는 게 아니라 동작 앞에
 * 검문소를 세우고, 통과 여부만 키로 결정한다.
 *
 * 명세:  tests/e04-05-01-idempotency-gate/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e04-05-01
 * 막히면: docs/ep04-agent-server/05-idempotency-in-practice.md
 */

/** 봉투에서 검문소가 실제로 보는 것만 뽑았다. */
export interface Request {
	/** 멱등 경계. 재시도해도 같은 값이다. */
	transactionKey: string;
	/** 이 요청 1건의 고유 ID. 재시도하면 **바뀐다.** */
	eventId: string;
	/** 요청 내용. 키가 같아도 이게 다르면 오류다. */
	payload: unknown;
}

/**
 * 실행의 종결 상태. 성공만 종결이 아니다 —
 * 실패·시간초과·취소도 "끝난 것"이고, 각각 다른 재시도 규칙을 붙일 수 있다.
 */
export type TerminalStatus = 'completed' | 'failed' | 'timed_out' | 'cancelled';

export type Claim =
	/** 표에 끼워넣기 성공. 내가 이 요청의 처리 담당이다. */
	| { kind: 'claimed' }
	/** 같은 키·같은 페이로드인데 아직 처리 중. 끝날 때까지 기다린다. */
	| { kind: 'running' }
	/** 같은 키·같은 페이로드이고 이미 끝났다. 저장된 결과를 그대로 돌려준다. */
	| { kind: 'duplicate'; status: TerminalStatus; result: unknown }
	/** 판정 불가. 실행하면 안 된다. */
	| { kind: 'conflict'; reason: ConflictReason };

export type ConflictReason =
	/** 같은 이름표인데 요청 내용이 다르다 — 키를 실수로 재사용했다. */
	| 'payload_mismatch'
	/** 점유 기록이 사라졌다 — 그 사이에 누가 지웠다. */
	| 'claim_disappeared';

/**
 * 페이로드를 비교 가능한 문자열로 줄인다.
 *
 * 힌트: `JSON.stringify`를 그냥 쓰면 **키 순서가 다른 같은 객체**가 서로 다르다고
 *       판정된다. 클라이언트가 재시도하면서 직렬화 순서가 바뀌는 것은 흔하다 —
 *       그때마다 `payload_mismatch` 오류를 내면 정상 재시도가 오류가 된다.
 *       그리고 배열은 순서가 의미이므로 정렬하면 안 된다.
 */
export function payloadHash(payload: unknown): string {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: payloadHash');
}

/**
 * 검문소. 인메모리이지만 실제 구현과 같은 규칙을 따른다.
 *
 * 이름이 `Gate`이지 `IdempotentStore`가 아닌 이유는 4장의 정정 때문이다 —
 * 이 물건은 동작을 멱등하게 만들지 않는다. 통과시킬지만 결정한다.
 */
export class Gate {
	/**
	 * 점유를 시도한다.
	 *
	 * 힌트: 조회해서 없으면 넣는 방식으로 쓰면 안 된다 — 그 사이가 경합 창이다.
	 *       **삽입 자체를 판정으로 써라.** 이 과제는 단일 스레드라 경합이
	 *       재현되지 않지만, 구조를 그렇게 잡아 두는 것이 요점이다.
	 */
	claim(request: Request): Claim {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Gate#claim');
	}

	/**
	 * 처리를 종결한다. 결과를 통째로 보관해야 다음 재시도에 그대로 돌려줄 수 있다.
	 *
	 * 힌트: 점유하지 않은 키를 종결하려 하면 조용히 넘기지 마라. 5장의 규율은
	 *       "모르는 것을 조용히 통과시키지 않는다"다.
	 */
	complete(transactionKey: string, status: TerminalStatus, result: unknown): void {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Gate#complete');
	}

	/**
	 * 점유를 버린다 (6장의 가시성 타임아웃 만료에 해당).
	 *
	 * 워커가 죽으면 표에 `running`이 영원히 남는다. 큐가 메시지를 다시 보이게
	 * 만드는 시점에 이 기록도 정리되어야 다음 워커가 점유할 수 있다.
	 *
	 * 힌트: 이미 종결된 것을 이걸로 지우면 저장된 결과가 사라진다.
	 */
	abandon(transactionKey: string): void {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Gate#abandon');
	}

	/** 검사용. 표에 등록된 트랜잭션 키 수. */
	get size(): number {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: Gate#size');
	}
}

/**
 * 검문소를 앞에 세우고 작업을 한 번만 실행한다.
 *
 * `run`은 **비멱등**이다 — 두 번 부르면 두 번 실행된다. 그것을 감싸서 한 번만
 * 실행되게 만드는 것이 이 함수다. 4장의 표현으로는 "동작 자체는 그대로 둔 채
 * 통과 여부만 키로 결정"하는 자리다.
 *
 * 힌트: `run`이 던지면 어떻게 되는가? 던진 채 `running`으로 남겨 두면 그 키는
 *       영원히 대기 상태가 된다 — 1장에서 지적한 "영원히 멈춤"이 검문소 층에서
 *       재현되는 것이다. 실패도 종결이다.
 */
export async function executeOnce(
	gate: Gate,
	request: Request,
	run: (request: Request) => Promise<unknown>,
): Promise<Claim> {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: executeOnce');
}

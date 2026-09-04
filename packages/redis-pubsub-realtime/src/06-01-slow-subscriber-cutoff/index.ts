/**
 * 과제 06-01: 느린 구독자의 강제 종료 판정
 *
 * Redis는 구독자에게 메시지를 밀어 넣습니다. 구독자가 읽어 가는 속도가 밀어 넣는
 * 속도보다 느리면 읽히지 않은 데이터가 서버 쪽 출력 버퍼에 쌓이고, 그 양이
 * `client-output-buffer-limit`이 정한 한계를 넘으면 Redis가 그 클라이언트의 연결을
 * 닫습니다. 연결이 닫힌 구독자는 구독을 잃으므로 그 뒤에 발행된 메시지를 영원히
 * 받지 못합니다.
 *
 * 출력 버퍼 사용량을 시간 순서대로 관측한 표본을 받아서, Redis가 그 클라이언트를
 * 끊을 시점과 사유를 판정하는 순수 함수를 만드십시오.
 *
 * **무엇을 만들지는 명세에 있습니다**: `tests/06-01-slow-subscriber-cutoff/index.test.ts`
 * 를 먼저 읽으십시오. 경계에서의 부등호 방향, 연속과 누적의 구별, 한계가 0일 때의
 * 처리가 모두 거기에 적혀 있습니다.
 *
 * 원리는 `docs/06-operations-and-failure.md`의 「hard 판정과 soft 판정은 규칙이
 * 다르다」 절에 있습니다.
 *
 * 실행: pnpm test 06-01
 */

/** `client-output-buffer-limit <class> <hard limit> <soft limit> <soft seconds>`에 대응하는 한계 설정입니다. */
export interface BufferLimit {
	/** 도달하는 즉시 끊는 기준(바이트)입니다. 0이면 이 한계는 해제됩니다. */
	hardBytes: number;
	/** 연속 유지 시간을 재기 시작하는 기준(바이트)입니다. 0이면 이 한계는 해제됩니다. */
	softBytes: number;
	/** softBytes 이상인 상태가 이 시간(초) 동안 연속으로 유지되면 끊습니다. */
	softSeconds: number;
}

/** 어느 시점에 관측한 출력 버퍼 사용량입니다. */
export interface Sample {
	/** 관측 시각(초)입니다. 입력 배열은 이 값의 오름차순으로 정렬되어 들어옵니다. */
	atSeconds: number;
	/** 그 시점의 출력 버퍼 메모리 사용량(바이트)이며, `CLIENT LIST`의 `omem`에 해당합니다. */
	omemBytes: number;
}

/** 강제 종료 여부와, 끊겼다면 그 시각과 사유를 담은 판정 결과입니다. */
export interface CutoffVerdict {
	disconnected: boolean;
	/** 끊긴 경우에만 있는, 끊긴 시각(초)입니다. */
	atSeconds?: number;
	/** 끊긴 경우에만 있는 사유입니다. */
	reason?: 'hard' | 'soft';
}

/** Redis가 배포하는 redis.conf의 pubsub 클래스 기본값입니다. hard 32MB, soft 8MB, 60초입니다. */
export const PUBSUB_DEFAULT_LIMIT: BufferLimit = {
	hardBytes: 32 * 1024 * 1024,
	softBytes: 8 * 1024 * 1024,
	softSeconds: 60,
};

/**
 * 출력 버퍼 사용량의 관측 표본을 시간 순서대로 훑어서, Redis가 그 구독자를 끊을
 * 시점과 사유를 판정합니다.
 *
 * 판정은 표본 지점에서만 일어납니다. 표본과 표본 사이에 버퍼가 어떻게 변했는지는
 * 관측되지 않았으므로 보간하거나 추정하지 않습니다.
 *
 * @param samples `atSeconds` 오름차순으로 정렬된 관측 표본입니다.
 * @param limit 적용할 출력 버퍼 한계 설정입니다.
 */
export function evaluateCutoff(samples: Sample[], limit: BufferLimit): CutoffVerdict {
	// 🎯 TODO: 표본을 시간 순서대로 한 번 훑으면서 아래 규칙으로 판정하십시오.
	//
	//   1. hard 판정: 어떤 표본의 omemBytes가 hardBytes 이상이면 그 표본의 시각에
	//      reason 'hard'로 끊습니다. 얼마나 오래 그 상태였는지는 보지 않습니다.
	//   2. soft 판정: omemBytes가 softBytes 이상인 첫 표본에서 연속 구간이 시작됩니다.
	//      이후의 어떤 표본이 여전히 softBytes 이상이고, 그 표본의 시각과 구간 시작
	//      시각의 차이가 softSeconds 이상이면 그 표본의 시각에 reason 'soft'로 끊습니다.
	//   3. 초기화: omemBytes가 softBytes 미만인 표본을 만나면 연속 구간이 사라지고,
	//      그 뒤에 다시 softBytes 이상이 되면 그 시점부터 처음부터 다시 셉니다.
	//      누적이 아니라 연속입니다.
	//   4. 우선순위: 같은 표본에서 두 조건이 모두 성립하면 reason은 'hard'입니다.
	//   5. 순서: 여러 표본에서 조건이 성립하면 가장 이른 시각의 판정을 돌려주고,
	//      그 뒤의 표본은 보지 않습니다.
	//   6. 해제: hardBytes가 0이면 hard 판정을, softBytes가 0이면 soft 판정을 하지
	//      않습니다. 0은 가장 낮은 한계가 아니라 한계가 없다는 뜻입니다.
	//   7. 끝까지 조건이 성립하지 않으면 { disconnected: false }를 돌려줍니다.
	throw new Error('TODO: evaluateCutoff');
}

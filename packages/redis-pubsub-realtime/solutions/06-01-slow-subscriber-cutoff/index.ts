/**
 * 과제 06-01의 참고 구현: 느린 구독자의 강제 종료 판정
 *
 * 📍 되짚기: docs/06-operations-and-failure.md § hard 판정과 soft 판정은 규칙이 다르다
 *
 * 이것은 「정답 하나」가 아니라 명세를 만족하는 한 예입니다. 코드 자체보다 아래의
 * 판단들이 이 과제의 내용입니다.
 *
 * ## 왜 표본을 한 번만, 시간 순서대로 훑는가
 *
 * Redis는 버퍼 상태를 갱신할 때마다 그 자리에서 한계를 확인하고, 넘겼으면 그 클라이언트를
 * 닫도록 예약합니다. 연결이 닫히는 순간 이후의 상태는 존재하지 않습니다. 그러므로 판정도
 * 시간을 앞에서 뒤로 한 번 지나가면서 처음 성립하는 조건에서 멈추는 형태가 됩니다.
 *
 * 흔한 오답은 hard 조건을 전체 표본에서 먼저 훑고, 없으면 soft를 보는 두 번 훑기입니다.
 * 이렇게 하면 soft가 60초에 성립하고 hard가 70초에 성립하는 입력에서 70초의 hard가 답으로
 * 나옵니다. 그러나 연결은 60초에 이미 닫혔으므로 70초의 관측 자체가 성립하지 않습니다.
 * 즉 hard와 soft의 우선순위는 **같은 표본 안에서만** 뜻이 있고, 표본 사이에서는 언제나
 * 이른 시각이 이깁니다. 한 번만 훑는 구조가 이 두 규칙을 자연스럽게 함께 만족시킵니다.
 *
 * ## 왜 두 비교가 모두 「이상」인가
 *
 * 설정 파일의 주석은 hard limit에 「도달하면」 끊고, soft limit에 도달한 상태가 지정된 초
 * 동안 유지되면 끊는다고 규정합니다. 도달은 초과가 아니므로 한계와 정확히 같은 값이 이미
 * 조건을 만족합니다. 경과 시간도 마찬가지여서, 60초를 채운 그 표본에서 성립합니다.
 * 부등호를 `>`로 쓰면 경계에 정확히 붙은 입력에서만 결과가 어긋나는데, 실측 데이터에서는
 * 그런 값이 드물게 나타나므로 오류가 오래 살아남습니다.
 *
 * ## 왜 누적이 아니라 연속인가
 *
 * soft limit의 목적은 「잠깐 튀는 구독자」와 「계속 뒤처지는 구독자」를 가르는 것입니다.
 * soft 이상이었던 시간을 모두 더하는 방식으로 세면 하루에 몇 초씩 튀는 정상 구독자도
 * 언젠가는 60초를 채우게 되므로, 이 구별이 무너지고 멀쩡한 연결을 끊게 됩니다.
 * 그래서 아래 구현은 soft 미만인 표본을 만나면 `runStartSeconds`를 비웁니다. 이 한 줄이
 * 누적과 연속을 가르는 자리이며, 이 과제에서 가장 자주 빠지는 부분이기도 합니다.
 *
 * 구간의 시작을 갱신하는 것도 같은 이유입니다. 시작을 한 번만 정하고 그대로 두면, 내려갔다가
 * 다시 올라온 구독자가 옛 시작 시각을 기준으로 계산되어 실제보다 빨리 끊깁니다.
 *
 * ## 왜 0을 따로 가려내는가
 *
 * 0은 「가장 낮은 한계」가 아니라 「한계 없음」입니다. 값을 그대로 비교에 넣으면
 * `omemBytes >= 0`이 항상 참이어서 첫 표본에서 무조건 끊는 판정이 됩니다. redis.conf의
 * normal 클래스 기본값이 세 값 모두 0인데, 그 뜻은 일반 클라이언트를 즉시 끊는다가 아니라
 * 사실상 한계를 두지 않는다입니다. 그러므로 비교보다 먼저 해제 여부를 가려냅니다.
 *
 * ## 왜 표본 사이를 추정하지 않는가
 *
 * 0초와 100초 두 표본만 있고 둘 다 soft 이상이라면, 실제로는 그 사이에 버퍼가 내려갔다가
 * 다시 올라왔을 수도 있습니다. 관측하지 않은 구간을 「유지되었다」고 채워 넣으면 판정이
 * 관측이 아니라 가정 위에 서게 됩니다. 이 함수는 표본 지점에서만 판정하고, 표본을 더
 * 촘촘히 뜨는 것은 이 함수를 쓰는 쪽의 몫으로 남깁니다.
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
 */
export function evaluateCutoff(samples: Sample[], limit: BufferLimit): CutoffVerdict {
	// 0은 한계가 없다는 뜻이므로, 값을 비교에 넣기 전에 해제 여부를 먼저 가려냅니다.
	const hardEnabled = limit.hardBytes > 0;
	const softEnabled = limit.softBytes > 0;

	// soft 이상인 상태가 연속으로 이어지고 있는 구간의 시작 시각입니다.
	// 구간이 없는 동안에는 null이며, soft 미만인 표본을 만날 때마다 다시 null이 됩니다.
	let runStartSeconds: number | null = null;

	for (const sample of samples) {
		// hard를 먼저 봅니다. 같은 표본에서 두 조건이 겹칠 때 사유를 'hard'로 만드는 자리가 여기입니다.
		if (hardEnabled && sample.omemBytes >= limit.hardBytes) {
			return { disconnected: true, atSeconds: sample.atSeconds, reason: 'hard' };
		}

		if (!softEnabled) {
			continue;
		}

		if (sample.omemBytes >= limit.softBytes) {
			if (runStartSeconds === null) {
				// soft limit에 도달한 첫 표본입니다. 여기서부터 유지 시간을 재기 시작합니다.
				runStartSeconds = sample.atSeconds;
			} else if (sample.atSeconds - runStartSeconds >= limit.softSeconds) {
				return { disconnected: true, atSeconds: sample.atSeconds, reason: 'soft' };
			}
		} else {
			// soft 미만으로 내려왔으므로 경과 시간이 사라집니다. 누적이 아니라 연속이라는 규칙이 이 한 줄입니다.
			runStartSeconds = null;
		}
	}

	// 끝까지 성립하는 조건이 없었으므로 연결은 유지됩니다. 시각과 사유는 채우지 않습니다.
	return { disconnected: false };
}

/**
 * 과제 02-01의 참고 구현.
 *
 * 판정은 `tests/02-01-signal-extractor/index.test.ts`가 한다. 같은 테스트를 이 파일에 대고
 * 돌린 것이 `pnpm test:solutions`다 — 여기 있는 코드는 "정답 하나"가 아니라
 * "성립하는 한 예"다.
 *
 * 📍 되짚기: docs/02-golden-signals.md § Errors, § Latency / docs/90-must-memorize.md 카드 5·6·7
 */

export interface RequestEvent {
	durationMs: number;
	status: number;
	contentValid?: boolean;
}

export interface SignalOptions {
	windowMs: number;
	latencySloMs: number;
}

export interface GoldenSignals {
	traffic: number;
	errorCounts: { explicit: number; implicit: number; policy: number };
	errorRate: number;
	successLatencyMs: number[];
	failureLatencyMs: number[];
}

/**
 * 명시적 실패 — 프로토콜 레벨에서 서비스가 실패를 선언한 것.
 *
 * 4xx를 제외하는 이유: 4xx는 "클라이언트가 잘못 보냈다"는 뜻이라 서비스의 실패가
 * 아니다. 이것을 5xx와 함께 세면 스캐너·봇·잘못 구현된 클라이언트가 우리 에러
 * 예산을 태운다 — 그리고 그때 할 수 있는 조치가 우리 쪽에 없다.
 */
function isExplicitFailure(e: RequestEvent): boolean {
	return e.status >= 500;
}

/**
 * 묵시적 실패 — 성공으로 보이는데 내용이 틀린 것.
 *
 * 두 조건이 **모두** 필요하다. 상태 코드가 성공 대역(< 400)이어야 하고, 검증이
 * 실제로 수행되어 false가 나왔어야 한다. `contentValid === false`만 보면 500 응답의
 * 내용 검증 실패까지 묵시적으로 세게 되고, 그러면 "성공으로 보이는데 틀린 것"이라는
 * 이 범주의 정의가 무너진다 — 이미 명시적으로 잡힌 것을 한 번 더 세는 것이다.
 *
 * `contentValid === false`로 비교하는 것도 의도적이다. `!e.contentValid`로 쓰면
 * undefined(검증 안 함)가 false(검증 실패)와 같아져, 검증을 붙이지 않은 엔드포인트가
 * 전부 실패로 보고된다.
 */
function isImplicitFailure(e: RequestEvent): boolean {
	return e.status < 400 && e.contentValid === false;
}

/**
 * 정책적 실패 — 응답은 왔지만 우리가 정한 선을 넘은 것.
 *
 * 경계는 `>`다. "1초 안에 응답"이라는 약속은 정확히 1000ms를 지킨 것으로 본다.
 */
function isPolicyFailure(e: RequestEvent, sloMs: number): boolean {
	return e.durationMs > sloMs;
}

export function extractSignals(events: RequestEvent[], opts: SignalOptions): GoldenSignals {
	const errorCounts = { explicit: 0, implicit: 0, policy: 0 };
	const successLatencyMs: number[] = [];
	const failureLatencyMs: number[] = [];
	let failedRequests = 0;

	for (const e of events) {
		const explicit = isExplicitFailure(e);
		const implicit = isImplicitFailure(e);
		const policy = isPolicyFailure(e, opts.latencySloMs);

		if (explicit) errorCounts.explicit += 1;
		if (implicit) errorCounts.implicit += 1;
		if (policy) errorCounts.policy += 1;

		// 에러율의 분자는 "실패한 요청 수"다. 범주 카운트를 더하면 한 요청이 두 번
		// 세어지고, 극단적으로는 에러율이 1을 넘는다 — 비율이라 불릴 수 없는 값이 된다.
		if (explicit || implicit || policy) failedRequests += 1;

		// 레이턴시 분리 기준은 **전달 실패**(명시적·묵시적)뿐이다.
		//
		// 정책적 실패를 여기서 빼면 안 되는 이유: 정책적 실패는 정의상 "느린 요청"이므로,
		// 그것만 골라 제외하면 성공 레이턴시의 분포에서 오른쪽 꼬리가 잘려 나간다.
		// 그러면 p99가 언제나 SLO 이하로 보이고, SLO 위반을 SLO 지표로 감지할 수 없게 된다.
		//
		// 분리의 목적은 "빠른 실패가 레이턴시를 좋게 보이게 하는 왜곡"을 막는 것이고,
		// 느린 요청을 숨기는 것이 아니다.
		if (explicit || implicit) failureLatencyMs.push(e.durationMs);
		else successLatencyMs.push(e.durationMs);
	}

	// 정렬해서 내보내는 이유: 소비자(05 히스토그램, 분위수 계산)가 정렬을 전제한다.
	// 여기서 한 번 하면 소비자마다 다시 정렬하지 않는다.
	successLatencyMs.sort((a, b) => a - b);
	failureLatencyMs.sort((a, b) => a - b);

	// 창 길이는 ms로 받고 초당 요청 수로 낸다. 빈 창은 0/0이 아니라 정상 상태(0 RPS)다.
	const windowSec = opts.windowMs / 1_000;
	const traffic = windowSec > 0 ? events.length / windowSec : 0;
	const errorRate = events.length > 0 ? failedRequests / events.length : 0;

	return { traffic, errorCounts, errorRate, successLatencyMs, failureLatencyMs };
}

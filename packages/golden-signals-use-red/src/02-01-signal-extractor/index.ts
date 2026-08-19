/**
 * 과제 02-01 — 네 신호 추출기
 *
 * 요청 이벤트 스트림에서 Golden Signals를 뽑는다. 이 파일이 뒤 과제들의 입력을
 * 만드는 첫 단계다 — 05(히스토그램)·08(트리아지)이 여기 나온 값을 쓴다.
 *
 * 명세:  tests/02-01-signal-extractor/index.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test 02-01
 * 막히면: docs/02-golden-signals.md
 */

/** 완료된 요청 하나. */
export interface RequestEvent {
	/** 요청 처리에 걸린 시간(ms). */
	durationMs: number;
	/** HTTP 상태 코드. */
	status: number;
	/**
	 * 응답 내용이 올바른지 검증한 결과.
	 * `undefined`면 검증하지 않았다는 뜻 — "틀렸다"가 아니다.
	 */
	contentValid?: boolean;
}

export interface SignalOptions {
	/** 트래픽을 계산할 창의 길이(ms). */
	windowMs: number;
	/** 정책적 실패를 판정할 지연 SLO(ms). */
	latencySloMs: number;
}

export interface GoldenSignals {
	/** 초당 요청 수. */
	traffic: number;
	/** 범주별 실패 건수. 한 요청이 여러 범주에 걸치면 각각에 센다. */
	errorCounts: { explicit: number; implicit: number; policy: number };
	/** 실패한 요청 수 ÷ 전체 요청 수. 범주 중복은 제거한다. */
	errorRate: number;
	/** 전달에 성공한 요청의 처리 시간, 오름차순. */
	successLatencyMs: number[];
	/** 전달에 실패한 요청의 처리 시간, 오름차순. */
	failureLatencyMs: number[];
}

/**
 * 요청 이벤트에서 네 신호를 뽑는다.
 *
 * 힌트 1: 실패의 세 범주는 서로 배타적이지 않다. "범주별 카운트"와 "실패한 요청 수"는
 *         다른 값이므로 따로 세야 한다.
 * 힌트 2: 레이턴시를 성공/실패로 가르는 기준은 세 범주 전부가 아니다. 어느 둘인지,
 *         그리고 나머지 하나를 빼면 무엇이 망가지는지 명세의 힌트를 읽어라.
 * 힌트 3: 4xx의 취급을 에러 카운트와 레이턴시 분리에서 **일관되게** 해야 한다.
 */
export function extractSignals(events: RequestEvent[], opts: SignalOptions): GoldenSignals {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: extractSignals');
}

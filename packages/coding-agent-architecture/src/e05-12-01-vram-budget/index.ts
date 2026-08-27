/**
 * 과제 e05-12-01 — 온프레미스 용량 견적기
 *
 * 12장의 판단 순서를 코드로 옮긴 것이다 —
 *   "'메모리를 얼마 살까'가 아니라 '어떤 모델을 올릴 건데 그게 몇 GB인가'에서
 *    시작한다. 그리고 KV 캐시 자리를 빼고 계산하면 항상 틀린다."
 *
 * 이 과제가 잡아내려는 실수 셋:
 *   1. KV 캐시를 빼고 모델 크기만으로 견적을 낸다
 *   2. Q4 이하를 후보에 남긴다 ("돌아가긴 하니까")
 *   3. 메모리를 늘렸는데 올릴 수 있는 모델이 안 는다는 것을 모른다 (용량 공백)
 *
 * 모든 계산은 **GB 단위 실수**로 하고, 비교는 이 파일의 `EPSILON`으로 한다.
 * 부동소수 비교를 직접 `===`로 하면 통과하지 못한다.
 *
 * 명세:  tests/e05-12-01-vram-budget/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e05-12-01
 * 막히면: docs/ep05-broker-infra/12-capacity-planning.md
 */

/** GB 비교 허용 오차. */
export const EPSILON = 1e-6;

/** 코딩 에이전트로 쓸 수 있는 양자화 하한. 12장: "Q4는 다 갖다 버려." */
export const MIN_QUANT_FOR_CODING = 5;

/** 카탈로그의 모델 한 줄. */
export interface ModelEntry {
	name: string;
	/** 양자화 비트. Q5면 5. */
	quant: number;
	/** 가중치 파일 크기(GB). */
	weightsGb: number;
	/** 이미지·오디오 인코더가 살아 있는가. 없으면 스크린샷을 못 던진다. */
	multimodal: boolean;
	/** MTP 웨이트가 동봉되면 그 크기(GB). 없으면 0. */
	mtpGb: number;
}

/** 이 견적이 감당해야 하는 워크로드. */
export interface Workload {
	/** 동시에 살아 있어야 하는 세션 수. */
	concurrentSessions: number;
	/** 세션 하나가 최대로 쓰는 컨텍스트 길이(토큰). */
	maxContextTokens: number;
	/** 토큰 하나당 KV 캐시 크기(바이트). 모델 구조가 정한다. */
	kvBytesPerToken: number;
	/** 코딩 에이전트 용도인가. true면 Q5 하한과 멀티모달 요구가 걸린다. */
	forCoding: boolean;
	/** MTP를 붙일 것인가. 붙이면 그만큼 자리를 더 쓴다. */
	useMtp: boolean;
}

/**
 * KV 캐시가 차지하는 자리(GB).
 *
 * `동시 세션 수 × 최대 컨텍스트 × 토큰당 바이트` 를 GB로 환산한다.
 *
 * 힌트: 1GB = 1024³ 바이트로 계산한다. 10⁹으로 하면 약 7% 적게 나오고,
 *       그 7%가 빠듯한 견적에서 로딩 실패를 만든다.
 */
export function kvCacheGb(workload: Workload): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: kvCacheGb');
}

/**
 * 이 모델을 이 워크로드로 돌리는 데 필요한 총 메모리(GB).
 *
 * 가중치 + (MTP를 쓰면 MTP) + KV 캐시.
 */
export function requiredGb(model: ModelEntry, workload: Workload): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: requiredGb');
}

/** 후보에서 탈락한 이유. */
export type RejectReason = 'quant-too-low' | 'no-multimodal' | 'out-of-memory';

export interface Candidate {
	model: ModelEntry;
	requiredGb: number;
	/** 통과했으면 null. */
	rejected: RejectReason | null;
}

/**
 * 카탈로그를 걸러 후보를 판정한다. 입력 순서를 유지한다.
 *
 * 판정 순서가 정해져 있다 — **먼저 걸리는 것을 이유로 삼는다.**
 *   1. `forCoding`인데 `quant < MIN_QUANT_FOR_CODING`  → `'quant-too-low'`
 *   2. `forCoding`인데 멀티모달이 아니다              → `'no-multimodal'`
 *   3. 필요 메모리가 가용을 넘는다                     → `'out-of-memory'`
 *
 * 힌트: 순서를 바꾸면 "Q4이고 텍스트 전용인 모델"의 이유가 달라진다.
 *       12장이 Q5 하한을 1차 필터로 둔 것은 그것이 **가장 싸게 판정되는 조건**이기 때문이다.
 */
export function screen(
	catalog: ModelEntry[],
	workload: Workload,
	availableGb: number,
): Candidate[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: screen');
}

/**
 * 통과한 후보 중 **가장 큰 가중치**를 가진 것을 고른다. 없으면 null.
 *
 * 힌트: "가장 큰 것"의 기준은 총 필요량이 아니라 **가중치**다 —
 *       같은 메모리를 쓴다면 모델이 큰 쪽이 낫기 때문이다.
 *       동률이면 카탈로그에서 먼저 나온 것.
 */
export function bestFit(
	catalog: ModelEntry[],
	workload: Workload,
	availableGb: number,
): ModelEntry | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: bestFit');
}

/** 메모리를 늘렸을 때 실익이 있는지의 판정. */
export interface UpgradeVerdict {
	/** 올릴 수 있는 모델이 늘어나면 true. */
	worthIt: boolean;
	/** 늘리기 전에 통과하던 모델 수. */
	before: number;
	/** 늘린 뒤 통과하는 모델 수. */
	after: number;
	/** 새로 올라가게 된 모델 이름들. 카탈로그 순서 유지. */
	unlocked: string[];
}

/**
 * 용량 공백 판정 — 12장의 "128GB는 64GB와 실익 차이가 작다".
 *
 * 메모리를 `fromGb`에서 `toGb`로 늘렸을 때 후보가 늘어나는지를 본다.
 */
export function upgradeVerdict(
	catalog: ModelEntry[],
	workload: Workload,
	fromGb: number,
	toGb: number,
): UpgradeVerdict {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: upgradeVerdict');
}

/**
 * 참고 구현 e05-12-01 — 온프레미스 용량 견적기
 *
 * 판정은 tests/e05-12-01-vram-budget/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep05-broker-infra/12-capacity-planning.md
 *
 * 읽을 때 눌러 볼 곳 넷:
 *  1. `1024 ** 3` — 10⁹으로 나누면 약 7% 적게 나온다. 빠듯한 견적에서 그 7%가 로딩 실패다
 *  2. `screen`의 판정 순서 — 싼 조건(정수 비교)부터. 메모리 계산은 마지막이다
 *  3. `bestFit`이 총량이 아니라 **가중치**로 고르는 것 — 같은 자리면 모델이 큰 쪽이 낫다
 *  4. `upgradeVerdict` — "메모리를 늘렸는데 아무것도 안 늘어난다"를 숫자로 보여 주는 것이 목적이다
 */

export const EPSILON = 1e-6;
export const MIN_QUANT_FOR_CODING = 5;

export interface ModelEntry {
	name: string;
	quant: number;
	weightsGb: number;
	multimodal: boolean;
	mtpGb: number;
}

export interface Workload {
	concurrentSessions: number;
	maxContextTokens: number;
	kvBytesPerToken: number;
	forCoding: boolean;
	useMtp: boolean;
}

const GB = 1024 ** 3;

export function kvCacheGb(workload: Workload): number {
	const bytes =
		workload.concurrentSessions * workload.maxContextTokens * workload.kvBytesPerToken;
	return bytes / GB;
}

export function requiredGb(model: ModelEntry, workload: Workload): number {
	const mtp = workload.useMtp ? model.mtpGb : 0;
	// KV 캐시를 빼고 계산하면 항상 틀린다 — 12장.
	return model.weightsGb + mtp + kvCacheGb(workload);
}

export type RejectReason = 'quant-too-low' | 'no-multimodal' | 'out-of-memory';

export interface Candidate {
	model: ModelEntry;
	requiredGb: number;
	rejected: RejectReason | null;
}

export function screen(
	catalog: ModelEntry[],
	workload: Workload,
	availableGb: number,
): Candidate[] {
	return catalog.map((model) => {
		const need = requiredGb(model, workload);

		// 순서가 규정이다. 싼 판정(정수 비교)부터 하고 메모리 계산을 마지막에 둔다.
		let rejected: RejectReason | null = null;
		if (workload.forCoding && model.quant < MIN_QUANT_FOR_CODING) {
			rejected = 'quant-too-low';
		} else if (workload.forCoding && !model.multimodal) {
			rejected = 'no-multimodal';
		} else if (need > availableGb + EPSILON) {
			rejected = 'out-of-memory';
		}

		return { model, requiredGb: need, rejected };
	});
}

export function bestFit(
	catalog: ModelEntry[],
	workload: Workload,
	availableGb: number,
): ModelEntry | null {
	let best: ModelEntry | null = null;
	for (const c of screen(catalog, workload, availableGb)) {
		if (c.rejected !== null) continue;
		// 가중치 기준. 같은 자리를 쓴다면 모델이 큰 쪽이 낫다.
		// 동률이면 먼저 나온 것을 유지한다(> 이므로 갱신되지 않는다).
		if (best === null || c.model.weightsGb > best.weightsGb + EPSILON) best = c.model;
	}
	return best;
}

export interface UpgradeVerdict {
	worthIt: boolean;
	before: number;
	after: number;
	unlocked: string[];
}

export function upgradeVerdict(
	catalog: ModelEntry[],
	workload: Workload,
	fromGb: number,
	toGb: number,
): UpgradeVerdict {
	const passed = (gb: number) =>
		screen(catalog, workload, gb)
			.filter((c) => c.rejected === null)
			.map((c) => c.model.name);

	const beforeNames = passed(fromGb);
	const afterNames = passed(toGb);
	const beforeSet = new Set(beforeNames);

	// 카탈로그 순서를 유지한 채 새로 열린 것만 추린다.
	const unlocked = afterNames.filter((n) => !beforeSet.has(n));

	return {
		worthIt: unlocked.length > 0,
		before: beforeNames.length,
		after: afterNames.length,
		unlocked,
	};
}

/**
 * 참고 구현 — 모델 프리셋 레지스트리.
 *
 * 판정은 tests/e03-05-01-model-presets/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep03-admin-implementation/05-model-registry.md
 */

export type Modality = 'text' | 'image' | 'audio' | 'video';

export interface SamplingParams {
	temperature: number;
	topP: number;
	topK: number;
	repeatPenalty?: number;
	minP?: number;
}

export interface Preset {
	name: string;
	modelId: string;
	contextSize: number;
	params: SamplingParams;
	modalities: Modality[];
}

export interface Registry {
	endpointName: string;
	presets: Preset[];
}

export interface RegisterResult {
	ok: boolean;
	registry: Registry;
	errors: string[];
}

/**
 * top_k가 50인 이유: 20은 후보를 너무 좁혀 같은 표현만 나오고, 권장 구간이 50~60이다.
 * repeatPenalty를 여기 넣지 않는 것이 의도다 — 기본으로 주는 값이 아니라 **증상
 * (작은 모델의 리즈닝 루프)에 대응하는 처방**이기 때문이다.
 */
export const DEFAULT_CODING_PARAMS: SamplingParams = {
	temperature: 0.4,
	topP: 0.95,
	topK: 50,
};

/**
 * 위반을 모아서 돌려준다. 첫 위반에서 return하면 사용자가 저장을 여러 번 반복하며
 * 하나씩 발견하게 된다.
 *
 * topK의 0을 허용하는 이유: 추론 서버들이 0을 "제한 없음"으로 쓴다. 음수만 오류다.
 */
export function validatePreset(preset: Preset): string[] {
	const bad: string[] = [];
	if (preset.name.trim() === '') bad.push('name');
	if (preset.modelId.trim() === '') bad.push('modelId');
	if (!(preset.contextSize > 0)) bad.push('contextSize');
	if (preset.modalities.length === 0) bad.push('modalities');

	const p = preset.params;
	if (!(p.temperature >= 0 && p.temperature <= 2)) bad.push('temperature');
	if (!(p.topP >= 0 && p.topP <= 1)) bad.push('topP');
	if (!(p.topK >= 0)) bad.push('topK');
	if (p.minP !== undefined && !(p.minP >= 0 && p.minP <= 1)) bad.push('minP');
	if (p.repeatPenalty !== undefined && !(p.repeatPenalty >= 0)) bad.push('repeatPenalty');
	return bad;
}

/**
 * 중복 판정의 기준이 **이름**이라는 것이 이 함수의 전부다.
 *
 * `modelId`를 기준으로 삼으면 "같은 모델을 온도만 달리해 등록"이 막히는데, 그게
 * 정확히 프리셋이 존재하는 이유다. 그래서 이름이 실질적 키이고, 사람이 구분되게
 * 지어야 한다("이름을 좀 다르게 해서 여러 개 추가해 프리셋을 만든다").
 */
export function registerPreset(registry: Registry, preset: Preset): RegisterResult {
	const errors = validatePreset(preset);
	if (registry.presets.some((p) => p.name === preset.name)) errors.push('duplicate_name');
	if (errors.length > 0) return { ok: false, registry, errors };
	return {
		ok: true,
		registry: { ...registry, presets: [...registry.presets, preset] },
		errors: [],
	};
}

/**
 * 클라이언트가 보낸 파라미터를 **병합하지 않는다.**
 *
 * 병합하면 조직별 모델 통제가 무너진다. 관리자가 온도 0.4로 묶어 둔 프리셋에
 * 클라이언트가 1.9를 실어 보내면 그만이기 때문이다. 서버는 등록된 값만 내려주고,
 * 다른 파라미터가 필요하면 **관리자가 프리셋을 하나 더 만드는 것**이 정상 경로다.
 *
 * 그래서 인자를 받기만 하고 쓰지 않는다 — 호출 규약(요청이 값을 실어 보낼 수 있다)은
 * 유지하면서 그 값을 신뢰하지 않는다는 뜻이다.
 */
export function resolveParams(
	registry: Registry,
	presetName: string,
	_requested?: Partial<SamplingParams>,
): { modelId: string; contextSize: number; params: SamplingParams } | null {
	const found = registry.presets.find((p) => p.name === presetName);
	if (!found) return null;
	return { modelId: found.modelId, contextSize: found.contextSize, params: { ...found.params } };
}

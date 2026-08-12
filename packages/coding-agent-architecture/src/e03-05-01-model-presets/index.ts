/**
 * 과제 e03-05-01 — 모델 프리셋 레지스트리
 *
 * 등록 단위가 "모델"이 아니라 **"모델 + 파라미터 조합"**이라는 것이 핵심이다.
 * 같은 `gemma4 31b`를 코딩용(temperature 0.4)과 문서용(1.0)으로 동시에 쓰려면
 * 두 개를 따로 등록해야 하고, 그래서 **이름이 실질적인 키**가 된다.
 *
 * 명세:  tests/e03-05-01-model-presets/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e03-05-01
 * 막히면: docs/ep03-admin-implementation/05-model-registry.md
 */

export type Modality = 'text' | 'image' | 'audio' | 'video';

export interface SamplingParams {
	temperature: number;
	topP: number;
	topK: number;
	/** 기본값에 없다. 작은 모델이 리즈닝 루프에 빠질 때 주는 처방이다. */
	repeatPenalty?: number;
	minP?: number;
}

export interface Preset {
	/** 사람이 읽는 이름. 이것이 키다. */
	name: string;
	/** 추론 서버가 아는 모델 이름. 여러 프리셋이 같은 값을 가질 수 있다. */
	modelId: string;
	contextSize: number;
	params: SamplingParams;
	/** 적재된 배포본에서 제거됐을 수 있으므로 사람이 지정한다. */
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

/** 강의가 준 코딩용 실무 기본값. */
export const DEFAULT_CODING_PARAMS: SamplingParams = {
	// 🎯 TODO: 값을 채우라 (문서 05장의 표)
	temperature: 0,
	topP: 0,
	topK: 0,
};

/**
 * 프리셋의 문제를 **필드 이름 목록**으로 돌려준다. 문제가 없으면 빈 배열.
 *
 * 힌트: 첫 위반에서 멈추지 말고 전부 모아라. 한 번 저장할 때 고칠 것을 다
 *       알려주는 편이 왕복을 줄인다.
 */
export function validatePreset(preset: Preset): string[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: validatePreset');
}

/**
 * 프리셋을 등록한 **새 레지스트리**를 준다. 실패하면 원래 레지스트리를 그대로.
 *
 * 힌트: 무엇이 중복 판정의 기준인지가 이 과제의 요점이다. 잘못 고르면 "같은
 *       모델을 온도만 달리해 등록"이 막힌다.
 */
export function registerPreset(registry: Registry, preset: Preset): RegisterResult {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: registerPreset');
}

/**
 * 프리셋 이름으로 실제 호출에 쓸 값을 해석한다. 없으면 null.
 *
 * 힌트: 두 번째 인자는 클라이언트가 함께 보낸 파라미터다. 이것을 어떻게 다뤄야
 *       조직별 모델 통제가 유지되는지 생각하라 (명세가 답을 정해 준다).
 */
export function resolveParams(
	registry: Registry,
	presetName: string,
	requested?: Partial<SamplingParams>,
): { modelId: string; contextSize: number; params: SamplingParams } | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: resolveParams');
}

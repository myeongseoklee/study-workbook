// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e03-05-01-model-presets/index.ts를 고쳐라.
//
// 등록 단위가 "모델"이 아니라 "모델 + 파라미터 조합(프리셋)"이라는 것이 이 과제의 핵심이다.
// 같은 gemma를 코딩용(0.4)과 문서용(1.0)으로 동시에 쓰려면 두 개를 따로 등록해야 한다.
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	DEFAULT_CODING_PARAMS,
	registerPreset,
	resolveParams,
	validatePreset,
	type Preset,
	type Registry,
} from '../../src/e03-05-01-model-presets';

function preset(over: Partial<Preset> = {}): Preset {
	return {
		name: 'gemma-coding',
		modelId: 'gemma4 31b',
		contextSize: 262_000,
		params: { temperature: 0.4, topP: 0.95, topK: 50 },
		modalities: ['text'],
		...over,
	};
}

const empty: Registry = { endpointName: 'lmstudio', presets: [] };

describe('DEFAULT_CODING_PARAMS — 강의가 준 실무 기본값', () => {
	it('temperature 0.4 · top_p 0.95 · top_k 50 **뿐**이다', () => {
		retrace(
			'코딩은 빡빡하게(0.4). top_k는 20이 너무 좁고 권장이 50~60이다. 그리고 repeat_penalty를 ' +
				'여기 넣으면 안 된다 — 기본으로 주는 값이 아니라 작은 모델이 리즈닝 루프에 빠질 때 ' +
				'꺼내는 처방이다. (toEqual은 정확히 일치를 요구하므로 여분의 키도 걸린다)',
			() => {
				expect(DEFAULT_CODING_PARAMS).toEqual({ temperature: 0.4, topP: 0.95, topK: 50 });
			},
		);
	});
});

describe('validatePreset — 범위를 벗어난 값을 잡는다', () => {
	it('정상 프리셋은 문제가 없다', () => {
		expect(validatePreset(preset())).toEqual([]);
	});

	it('temperature는 0~2다', () => {
		expect(validatePreset(preset({ params: { temperature: 2.5, topP: 1, topK: 50 } }))).toContain(
			'temperature',
		);
		expect(validatePreset(preset({ params: { temperature: -0.1, topP: 1, topK: 50 } }))).toContain(
			'temperature',
		);
	});

	it('top_p는 0~1이다', () => {
		expect(validatePreset(preset({ params: { temperature: 1, topP: 1.5, topK: 50 } }))).toContain('topP');
	});

	it('top_k는 음수가 될 수 없다 (0은 "제한 없음"이라 허용)', () => {
		expect(validatePreset(preset({ params: { temperature: 1, topP: 1, topK: -1 } }))).toContain('topK');
		expect(validatePreset(preset({ params: { temperature: 1, topP: 1, topK: 0 } }))).toEqual([]);
	});

	it('컨텍스트 크기는 양수여야 한다', () => {
		expect(validatePreset(preset({ contextSize: 0 }))).toContain('contextSize');
	});

	it('모달리티가 비면 안 된다 — 무엇도 받지 못하는 프리셋이 된다', () => {
		expect(validatePreset(preset({ modalities: [] }))).toContain('modalities');
	});

	it('이름이 비면 안 된다 — 이름이 키이기 때문이다', () => {
		expect(validatePreset(preset({ name: '  ' }))).toContain('name');
	});

	it('위반이 여럿이면 모두 보고한다 — 첫 번째에서 멈추지 않는다', () => {
		retrace('한 번 저장할 때 고칠 것을 다 알려주는 편이 왕복을 줄인다', () => {
			const bad = preset({ name: '', contextSize: -1, modalities: [] });
			expect(validatePreset(bad).sort()).toEqual(['contextSize', 'modalities', 'name']);
		});
	});
});

describe('registerPreset — 이름이 키다', () => {
	it('등록하면 목록에 들어간다', () => {
		const r = registerPreset(empty, preset());
		expect(r.ok).toBe(true);
		expect(r.registry.presets.map((p) => p.name)).toEqual(['gemma-coding']);
	});

	it('같은 모델을 파라미터만 달리해 여러 개 등록할 수 있다', () => {
		retrace(
			'modelId를 키로 쓰면 여기서 막힌다. 같은 모델을 코딩용·문서용으로 동시에 쓰는 것이 ' +
				'프리셋이 존재하는 이유다.',
			() => {
				const a = registerPreset(empty, preset({ name: 'gemma-coding' }));
				const b = registerPreset(a.registry, {
					...preset(),
					name: 'gemma-writing',
					params: { temperature: 1.0, topP: 0.95, topK: 50 },
				});
				expect(b.ok).toBe(true);
				expect(b.registry.presets).toHaveLength(2);
				expect(b.registry.presets.map((p) => p.modelId)).toEqual(['gemma4 31b', 'gemma4 31b']);
			},
		);
	});

	it('이름이 중복되면 거부한다', () => {
		const a = registerPreset(empty, preset());
		const b = registerPreset(a.registry, preset({ contextSize: 8192 }));
		expect(b.ok).toBe(false);
		expect(b.errors).toContain('duplicate_name');
		expect(b.registry.presets).toHaveLength(1);
	});

	it('검증에 실패하면 등록하지 않는다', () => {
		const r = registerPreset(empty, preset({ contextSize: -5 }));
		expect(r.ok).toBe(false);
		expect(r.errors).toContain('contextSize');
		expect(r.registry.presets).toEqual([]);
	});

	it('원본 레지스트리를 변형하지 않는다', () => {
		registerPreset(empty, preset());
		expect(empty.presets).toEqual([]);
	});
});

describe('resolveParams — 서버가 내려주고 클라이언트는 고르지 못한다', () => {
	const registry: Registry = {
		endpointName: 'lmstudio',
		presets: [preset({ name: 'gemma-coding' }), preset({ name: 'gemma-writing', params: { temperature: 1, topP: 0.9, topK: 60 } })],
	};

	it('프리셋 이름으로 파라미터를 찾는다', () => {
		expect(resolveParams(registry, 'gemma-writing')?.params.temperature).toBe(1);
	});

	it('없는 이름이면 null이다', () => {
		expect(resolveParams(registry, 'nope')).toBeNull();
	});

	it('요청이 파라미터를 함께 보내도 무시한다', () => {
		retrace(
			'클라이언트가 보낸 값을 병합하면 조직별 모델 통제가 무너진다 — 온도 0.4로 묶어 둔 ' +
				'프리셋에 1.9를 실어 보내면 그만이기 때문이다. 서버가 등록된 값만 내려줘야 한다.',
			() => {
				const got = resolveParams(registry, 'gemma-coding', { temperature: 1.9, topK: 200 });
				expect(got?.params).toEqual({ temperature: 0.4, topP: 0.95, topK: 50 });
			},
		);
	});

	it('모델 식별자와 컨텍스트 크기도 함께 준다', () => {
		const got = resolveParams(registry, 'gemma-coding');
		expect(got?.modelId).toBe('gemma4 31b');
		expect(got?.contextSize).toBe(262_000);
	});
});

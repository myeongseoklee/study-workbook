/**
 * 과제 3-1의 명세 — KV 캐시 계산기
 *
 * 이 파일이 과제의 정의다. `src/3-1-kv-calc.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다 — docs/03-kv-cache.md § 필수 지식 2를 다시 읽어라.
 *
 * 실행: pnpm test 3-1
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { bytesPerToken, feasibleCombos } from '../src/3-1-kv-calc';

const GB = 1024 ** 3;

describe('bytesPerToken — 토큰 1개가 차지하는 KV 캐시 바이트', () => {
	it('Llama 3.1 70B(layers 80, nKv 8, headDim 128, fp16)는 327,680바이트다', () => {
		retrace(
			"'× 2 (K와 V)'나 '× layers'를 빠뜨리면 값이 정확히 배수만큼 어긋난다. " +
				'절반(163,840)이면 K·V 중 하나, 4,096이면 layers가 빠진 것이다.',
			() => {
				expect(bytesPerToken(80, 8, 128, 2)).toBe(327_680);
			},
		);
	});

	it('320 KB라는 암기값과 일치한다', () => {
		expect(bytesPerToken(80, 8, 128, 2) / 1024).toBe(320);
	});

	it('dtype 항이 실제로 작동한다 — fp8이면 정확히 절반', () => {
		retrace('dtypeBytes를 곱하지 않고 상수 2로 박아두면 이 검사에서 걸린다', () => {
			expect(bytesPerToken(80, 8, 128, 1)).toBe(bytesPerToken(80, 8, 128, 2) / 2);
		});
	});

	it('dtypeBytes 기본값은 fp16(2바이트)다', () => {
		expect(bytesPerToken(80, 8, 128)).toBe(bytesPerToken(80, 8, 128, 2));
	});

	it('MHA 가정(nKv = Query 헤드 64개)은 GQA(nKv 8)의 정확히 8배다', () => {
		retrace(
			'GQA가 절약하는 양이 여기서 드러난다. 8배가 아니면 nKv가 공식에서 선형이 아니다.',
			() => {
				expect(bytesPerToken(80, 64, 128, 2)).toBe(bytesPerToken(80, 8, 128, 2) * 8);
			},
		);
	});
});

describe('feasibleCombos — 가용 메모리에서 성립하는 (시퀀스 길이, 배치)', () => {
	const bpt = 327_680;
	const candidates = [8192, 32768, 131072];

	it('40GB / Llama 3.1 70B에서 세 후보가 모두 성립한다', () => {
		expect(feasibleCombos(40 * GB, bpt, candidates)).toHaveLength(3);
	});

	it('8K 컨텍스트는 배치 16, 128K 컨텍스트는 배치 1이다', () => {
		retrace(
			'배치 = floor(가용 / (토큰당 × 길이)). 길이가 16배가 되면 배치가 16분의 1이 된다 — ' +
				'컨텍스트와 배치가 같은 메모리를 두고 경쟁한다는 뜻이다.',
			() => {
				expect(feasibleCombos(40 * GB, bpt, candidates)).toEqual([
					[8192, 16],
					[32768, 4],
					[131072, 1],
				]);
			},
		);
	});

	it('배치가 1에 못 미치는 길이는 결과에서 뺀다', () => {
		retrace(
			'floor의 결과가 0인 조합을 [길이, 0]으로 넣으면 "가능한 조합"이라는 이름이 거짓이 된다',
			() => {
				expect(feasibleCombos(1 * GB, bpt, [131072])).toEqual([]);
			},
		);
	});

	it('메모리가 정확히 딱 맞으면 성립으로 친다 (경계 포함)', () => {
		const exact = bpt * 8192;
		expect(feasibleCombos(exact, bpt, [8192])).toEqual([[8192, 1]]);
	});
});

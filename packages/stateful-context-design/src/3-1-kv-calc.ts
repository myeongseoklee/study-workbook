/**
 * 과제 3-1 — KV 캐시 계산기
 *
 * 모델 구성값을 받아 KV 캐시 크기를 계산하고, 주어진 GPU 메모리에서
 * 가능한 (컨텍스트 길이 × 배치) 조합을 산출한다.
 *
 * 판정:  npm run test:3-1
 * 막히면: docs/03-kv-cache.md § 필수 지식 2
 *
 * 성공 기준 (테스트가 검사하는 항목)
 *  - layers·nKv·headDim·dtype으로 토큰당 바이트를 계산한다
 *  - Llama 3.1 70B(80/8/128/fp16) = 327,680바이트(320 KB)
 *  - dtype 항이 실제로 작동한다 (fp8이면 절반)
 *  - 가용 메모리로 (seqLen, batch) 조합을 최소 3개 산출한다
 *  - 40GB에서 8K→배치 16, 128K→배치 1
 *  - MHA 가정(nKv = Query 헤드 수)이 GQA의 정확히 8배
 */

/**
 * 토큰 1개가 차지하는 KV 캐시 바이트 수.
 *
 * 공식의 각 항이 왜 필요한지는 docs/03-kv-cache.md § 필수 지식 2에 있다.
 * 힌트: 항이 7개인데 여기 인자는 4개다. 나머지 3개(s, b, 그리고 하나 더)는
 *       어디로 갔는지 생각해 보라.
 */
export function bytesPerToken(
	layers: number,
	nKv: number,
	headDim: number,
	dtypeBytes = 2,
): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: bytesPerToken');
}

/**
 * 가용 메모리 안에서 성립하는 (시퀀스 길이, 배치) 조합.
 *
 * 각 후보 길이에 대해 배치를 몇 개까지 올릴 수 있는지 계산한다.
 * 배치가 1 미만이면 그 길이는 애초에 불가능하므로 결과에 넣지 않는다.
 */
export function feasibleCombos(
	availableBytes: number,
	bpt: number,
	candidates: number[],
): Array<[number, number]> {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: feasibleCombos');
}

// 직접 실행하면 Llama 3.1 70B 기준 요약을 출력한다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const bpt = bytesPerToken(80, 8, 128, 2);
	console.log(`토큰당: ${(bpt / 1024).toFixed(0)} KB`);
	for (const [s, b] of feasibleCombos(40 * 1024 ** 3, bpt, [8192, 32768, 131072])) {
		console.log(`  ${s / 1024}K 컨텍스트 → 배치 ${b}`);
	}
}

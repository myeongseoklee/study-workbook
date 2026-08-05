/**
 * 과제 3-1의 참고 구현.
 *
 * 판정은 `tests/03-01-kv-calc/index.test.ts`가 한다. 같은 테스트를 이 파일에 대고
 * 돌린 것이 `pnpm test:solutions`다 — 명세가 실제로 통과 가능한지를 증명하는
 * 쪽이라, 여기 있는 코드는 "정답 하나"가 아니라 "성립하는 한 예"다.
 *
 * 📍 되짚기: docs/03-kv-cache.md § 필수 지식 2 / docs/90-must-memorize.md 카드 1·2
 */

/**
 * 토큰 1개가 차지하는 KV 캐시 바이트 수.
 *
 *   2 × layers × nKv × headDim × dtypeBytes
 *   ↑ K와 V 두 텐서
 *
 * 전체 공식의 나머지 두 항(시퀀스 길이 s, 배치 b)이 여기 없는 이유는
 * "토큰당"이라는 말이 이미 s = 1, b = 1을 고정하기 때문이다. 그래서 이 값에
 * s와 b를 곱하면 곧바로 실제 점유량이 되고, feasibleCombos가 그 곱을 뒤집어 푼다.
 */
export function bytesPerToken(
	layers: number,
	nKv: number,
	headDim: number,
	dtypeBytes = 2,
): number {
	return 2 * layers * nKv * headDim * dtypeBytes;
}

/**
 * 가용 메모리 안에서 성립하는 (시퀀스 길이, 배치) 조합.
 *
 * 길이 하나를 고정하면 배치의 상한이 나눗셈 한 번으로 정해진다. 후보 길이를
 * 훑으며 그 상한을 모으는 게 전부다 — 길이를 16배 늘리면 배치가 16분의 1이
 * 되는 반비례가 표로 드러나는 것이 이 함수의 목적이다.
 */
export function feasibleCombos(
	availableBytes: number,
	bpt: number,
	candidates: number[],
): Array<[number, number]> {
	const combos: Array<[number, number]> = [];
	for (const seqLen of candidates) {
		const batch = Math.floor(availableBytes / (bpt * seqLen));
		if (batch >= 1) combos.push([seqLen, batch]);
	}
	return combos;
}

// 직접 실행하면 Llama 3.1 70B 기준 요약을 출력한다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const bpt = bytesPerToken(80, 8, 128, 2);
	console.log(`토큰당: ${(bpt / 1024).toFixed(0)} KB`);
	for (const [s, b] of feasibleCombos(40 * 1024 ** 3, bpt, [8192, 32768, 131072])) {
		console.log(`  ${s / 1024}K 컨텍스트 → 배치 ${b}`);
	}
}

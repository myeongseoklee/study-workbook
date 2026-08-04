/**
 * 과제 3-1의 정답 — 테스트 코드
 *
 * 참고 구현(완성 골격)은 주지 않는다. 읽으면 베끼게 되고 그 순간 과제가
 * 독해로 바뀐다. 대신 당신의 구현을 돌려 판정한다.
 *
 * 실행: npm run test:3-1
 *
 * 각 check는 src/3-1-kv-calc.ts 상단의 성공 기준과 1:1로 대응한다.
 */
import { bytesPerToken, feasibleCombos } from '../src/3-1-kv-calc.js';

let pass = 0;
let total = 0;

function check(label: string, cond: boolean, detail = ''): void {
	total++;
	if (cond) pass++;
	console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? `\n    ${detail}` : ''}`);
}

// 기준 1 — layers·nKv·headDim·dtype으로 토큰당 바이트를 계산한다
const bpt = bytesPerToken(80, 8, 128, 2);
check('토큰당 바이트를 4개 인자로 계산', Number.isInteger(bpt) && bpt > 0, `반환값: ${bpt}`);

// 기준 2 — Llama 3.1 70B에서 320 KB
check(
	'Llama 3.1 70B = 320 KB',
	bpt === 327_680,
	`기대 327680, 실제 ${bpt} — '× 2 (K와 V)'나 '× layers'를 빼먹었는지 확인`,
);

// 기준 3 — dtype 항이 실제로 작동한다 (fp8이면 절반)
const fp8 = bytesPerToken(80, 8, 128, 1);
check('dtype 항이 반영됨', fp8 === 163_840, `fp8에서 기대 163840, 실제 ${fp8}`);

// 기준 4 — 가용 메모리로 (s, b) 조합을 최소 3개 산출
const combos = feasibleCombos(40 * 1024 ** 3, bpt, [8192, 32768, 131072]);
check(
	'조합 3개 이상 산출',
	combos.length >= 3,
	`실제 ${combos.length}개: ${JSON.stringify(combos)}`,
);

// 기준 5 — 40GB에서 8K는 배치 16, 128K는 배치 1 (s와 b의 곱이 보존되는지)
const byLen = new Map(combos);
check('40GB / 8K → 배치 16', byLen.get(8192) === 16, `실제 ${byLen.get(8192)}`);
check('40GB / 128K → 배치 1', byLen.get(131072) === 1, `실제 ${byLen.get(131072)}`);

// 기준 6 — MHA 가정은 GQA의 정확히 8배
const mha = bytesPerToken(80, 64, 128, 2);
check('MHA(nKv=64)는 GQA의 8배', mha === bpt * 8, `기대 ${bpt * 8}, 실제 ${mha}`);

console.log(`\n${pass}/${total} 통과`);

// 📍 되짚기: docs/03-kv-cache.md § 필수 지식 2 / docs/90-must-memorize.md 카드 1·2
process.exit(pass === total ? 0 : 1);

/**
 * 과제 3-2의 정답 — 테스트 코드
 *
 * 참고 구현은 주지 않는다. 당신의 구현을 돌려 판정한다.
 *
 * 실행: npm run test:3-2
 *
 * 각 check는 src/3-2-kv-session-budget.ts 상단의 성공 기준과 1:1로 대응한다.
 */
import {
	QUANT_FLOOR_BITS,
	PARAM_FLOOR_B,
	modelFootprintGb,
	concurrentSessions,
	developerCapacity,
	meetsFloors,
} from '../src/3-2-kv-session-budget.js';

let pass = 0;
let total = 0;

function check(label: string, cond: boolean, detail = ''): void {
	total++;
	if (cond) pass++;
	console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? `\n    ${detail}` : ''}`);
}

// 기준 1 — 파라미터 수와 비트폭으로 적재 용량을 계산한다.
//   1B 파라미터를 8비트로 적재하면 약 1GB다.
const q5 = modelFootprintGb(460, 5);
check(
	'460B Q5 ≈ 287.5GB',
	Math.abs(q5 - 287.5) < 0.6,
	`실제 ${q5} — 파라미터당 바이트 = bits/8 입니다`,
);
const fp16 = modelFootprintGb(70, 16);
check(
	'70B fp16 = 140GB (비트폭 항이 작동)',
	Math.abs(fp16 - 140) < 0.6,
	`실제 ${fp16} — 비트폭을 상수로 굳혔는지 확인하세요`,
);

// 기준 2 — (노드 − 모델) / 세션당 캐시, 내림
const sessions = concurrentSessions(500, 287.5, 10);
check(
	'500GB 노드에 287.5GB 모델 → 세션 21개',
	sessions === 21,
	`실제 ${sessions} — (500−287.5)/10 = 21.25 → 내림 21. Math.floor를 빠뜨렸는지 확인`,
);

// 기준 3 — 모델이 노드보다 크면 0 (음수 금지)
const impossible = concurrentSessions(100, 200, 10);
check(
	'모델이 노드보다 크면 0',
	impossible === 0,
	`실제 ${impossible} — 음수 세션은 존재하지 않습니다`,
);

// 기준 4 — 1인당 동시 세션 수로 나눈다, 내림
const devs = developerCapacity(21, 7);
check(
	'세션 21개, 1인 7세션 → 개발자 3명',
	devs === 3,
	`실제 ${devs} — 21/7 = 3`,
);
check(
	'나머지는 버린다 (20/7 = 2명)',
	developerCapacity(20, 7) === 2,
	`실제 ${developerCapacity(20, 7)} — 2.86명을 3명으로 올리면 안 됩니다`,
);

// 기준 5 — 두 하한이 상수로 명시돼 있다
check(
	'QUANT_FLOOR_BITS = 5 (Q5 하한)',
	QUANT_FLOOR_BITS === 5,
	`실제 ${QUANT_FLOOR_BITS} — Q4는 원본 분포에서 벗어나 사실상 다른 모델입니다`,
);
check(
	'PARAM_FLOOR_B = 200 (약 200B 하한)',
	PARAM_FLOOR_B === 200,
	`실제 ${PARAM_FLOOR_B} — 30B·120B로는 제품 수준 코딩이 안 됩니다`,
);

// 기준 6 — 두 하한을 모두 만족해야 true
check(
	'460B Q5 → 통과',
	meetsFloors(460, 5) === true,
	'두 하한을 모두 넘는데 false가 나왔습니다',
);
check(
	'120B Q5 → 실패 (크기 하한 미달)',
	meetsFloors(120, 5) === false,
	'모델 크기 하한을 검사하지 않았습니다',
);
check(
	'460B Q4 → 실패 (양자화 하한 미달)',
	meetsFloors(460, 4) === false,
	'양자화 하한을 검사하지 않았습니다 — 크기만 보면 Q4도 통과합니다',
);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);

// 📍 되짚기: docs/ep01-concepts/06-local-llm.md § KV 캐시 산수 / § 두 개의 마지노선

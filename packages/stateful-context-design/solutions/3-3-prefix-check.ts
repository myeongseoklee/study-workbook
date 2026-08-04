/**
 * 과제 3-3의 정답 — 테스트 코드
 *
 * 실행: npm run test:3-3
 *
 * 마지막 두 항목이 이 과제의 핵심이다. 검사기 안에서 키나 배열을 정렬해
 * "정규화"하면 편하지만, 그러면 실제로 캐시를 깨뜨리는 차이를 놓친다.
 * 검사기와 실제 요청 코드가 **같은 직렬화 경로**를 써야 한다는 것이 교훈이다.
 */
import { renderPrefix, compare, type Request } from '../src/3-3-prefix-check.js';

let pass = 0;
let total = 0;

function check(label: string, cond: boolean, detail = ''): void {
	total++;
	if (cond) pass++;
	console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? `\n    ${detail}` : ''}`);
}

const TOOLS = [{ name: 'search' }, { name: 'fetch' }];
const SYSTEM = '당신은 도우미입니다.';
const MSGS = [{ role: 'user', content: '안녕' }];
const base: Request = { tools: TOOLS, system: SYSTEM, messages: MSGS };

// 기준 1 — tools → system → messages 순서로 직렬화한다
const p = renderPrefix(TOOLS, SYSTEM, MSGS);
const iTools = p.indexOf('search');
const iSys = p.indexOf('도우미');
const iMsgs = p.indexOf('안녕');
check(
	'렌더 순서가 tools → system → messages',
	iTools >= 0 && iTools < iSys && iSys < iMsgs,
	`위치: tools=${iTools} system=${iSys} messages=${iMsgs} — tools가 위치 0이어야 합니다`,
);

// 기준 2 — 같은 요청이면 same=true
{
	const r = compare(base, { tools: TOOLS, system: SYSTEM, messages: MSGS });
	check('동일 입력 → same=true', r.same === true, `반환: ${JSON.stringify(r)}`);
}

// 기준 3 — 다르면 처음 갈라지는 오프셋을 보고한다
{
	const r = compare(base, { tools: TOOLS, system: `${SYSTEM} 간결하게.`, messages: MSGS });
	check('차이 감지', r.same === false, `반환: ${JSON.stringify(r)}`);
	check(
		'갈라지는 오프셋 보고',
		Number.isInteger(r.offset) && (r.offset as number) > 0,
		`offset이 정수여야 합니다: ${r.offset}`,
	);
	// 기준 4 — 그 오프셋이 실제로 바뀐 구간을 가리킨다
	if (Number.isInteger(r.offset)) {
		check(
			'오프셋이 system 구간을 가리킴',
			(r.offset as number) >= iSys,
			`system을 고쳤으므로 오프셋(${r.offset})이 system 시작(${iSys}) 이후여야 합니다`,
		);
	}
}

// 기준 5 — 시스템 프롬프트의 매 요청 변하는 값(시각)을 잡아낸다
{
	const withNow = (): Request => ({
		tools: TOOLS,
		system: `현재 시각: ${new Date().toISOString()}\n${SYSTEM}`,
		messages: MSGS,
	});
	const r = compare(withNow(), withNow());
	check(
		'시스템 프롬프트의 now()를 불안정으로 판정',
		r.same === false,
		'두 번 만든 프롬프트가 같다고 나왔습니다 — 시각이 프리픽스에 들어가면 캐시가 깨집니다',
	);
}

// 기준 6 — 도구 순서만 바꿔도 잡아낸다
{
	const r = compare(base, { tools: [...TOOLS].reverse(), system: SYSTEM, messages: MSGS });
	check(
		'도구 순서 변경을 불안정으로 판정',
		r.same === false,
		'도구는 위치 0이므로 순서가 바뀌면 전체 캐시가 무효입니다 — 검사기가 배열을 정렬하지 않았는지 확인',
	);
}

console.log(`\n${pass}/${total} 통과`);

// 📍 되짚기: docs/06-prompt-caching.md § 필수 지식 1~2 / docs/90-must-memorize.md 카드 13·14
process.exit(pass === total ? 0 : 1);

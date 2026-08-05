#!/usr/bin/env node
/**
 * study 레포 규약 준수 감사 — 결정적으로 판정 가능한 항목만.
 *
 * 규약의 단일 진실 원천은 README.md다. 이 스크립트는 그 규약 중
 * **기계가 셀 수 있는 것**만 검사한다. 문항 품질·서술의 적절성 같은
 * 판단은 convention-auditor 에이전트의 몫이다.
 *
 * 사용: node audit-conventions.js [패키지명]   (생략하면 전체)
 * 종료 코드: 0 = 위반 없음, 1 = 위반 있음
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ESM에는 __dirname이 없다 — import.meta.url에서 유도한다.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../..');
const findings = [];

/**
 * 주제 패키지가 아닌 것들. 규약 1·2는 "학습 자료"에 대한 규약이라
 * 도구 패키지에 적용하면 거짓 위반만 쌓인다.
 */
const TOOL_PACKAGES = new Set(['testkit']);

/**
 * 규약 제정 이전에 만들어져 구조가 다른 패키지. README에 사유가 적혀 있고,
 * 감사는 그 예외를 알고 있어야 한다 — 모르면 매번 같은 위반을 보고하고,
 * 그러면 사람이 감사 전체를 무시하기 시작한다.
 */
const LEGACY_PACKAGES = new Map([
	[
		'multi-agent-systems',
		'실습이 살아 있는 LLM API를 호출해 단위 테스트로 판정할 수 없다 (README 참조)',
	],
]);

function add(severity, pkg, rule, detail) {
	findings.push({ severity, pkg, rule, detail });
}

function readIf(p) {
	try {
		return fs.readFileSync(p, 'utf8');
	} catch {
		return null;
	}
}

/**
 * docs/ 아래의 마크다운을 모은다. 회차가 늘어나는 시리즈는 `ep01-`, `ep02-`
 * 같은 하위 폴더로 나뉘므로 한 단계는 내려간다. 규약 1이 정하는 것은 파일의
 * **역할**(00 개요 / 90 암기 / 99 참고)이지 평평한 배치가 아니다.
 */
function listMd(dir) {
	const out = [];
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	for (const e of entries) {
		if (e.isFile() && e.name.endsWith('.md')) out.push(e.name);
		else if (e.isDirectory()) {
			for (const f of fs.readdirSync(path.join(dir, e.name))) {
				if (f.endsWith('.md')) out.push(path.join(e.name, f));
			}
		}
	}
	return out.sort();
}

function listTs(dir, filter) {
	try {
		return fs.readdirSync(dir).filter(filter).sort();
	} catch {
		return [];
	}
}

/** `export function foo` / `export const foo` / `export interface Foo` 등에서 이름만 뽑는다. */
function exportedNames(body) {
	const names = new Set();
	const re = /^export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
	for (const m of body.matchAll(re)) names.add(m[1]);
	return names;
}

// ── 규약 1: 문서화 ──────────────────────────────────────────────────────────
function auditDocs(pkg, root) {
	const docs = path.join(root, 'docs');
	const files = listMd(docs);

	if (files.length === 0) {
		add('error', pkg, '규약1', 'docs/에 마크다운이 없다');
		return;
	}
	const hasRole = (name) => files.some((f) => path.basename(f) === name);
	if (!hasRole('00-overview.md')) {
		add('error', pkg, '규약1', 'docs/00-overview.md가 없다 — 로드맵 진입점이 필요하다');
	}
	if (!hasRole('99-references.md')) {
		add('warn', pkg, '규약1', 'docs/99-references.md가 없다 — 확인한 출처를 모을 곳이 없다');
	}

	for (const f of files) {
		const body = readIf(path.join(docs, f)) ?? '';

		// 파일명은 영문 slug
		if (/[^\x20-\x7E]/.test(f)) {
			add('error', pkg, '규약1', `파일명에 비ASCII: ${f} — 파일명은 영문 slug를 유지한다`);
		}

		// H1 존재 + 한글 우선
		const h1 = body.match(/^#\s+(.+)$/m);
		if (!h1) {
			add('error', pkg, '규약1', `${f}: H1이 없다 — 노션 등에서 페이지 제목이 파일명으로 떨어진다`);
		} else if (!/[가-힣]/.test(h1[1])) {
			add('warn', pkg, '규약1', `${f}: H1에 한글이 없다 ("${h1[1].slice(0, 40)}") — H1은 한글 우선`);
		}

		// 자기완결성 — 핵심을 외부로 넘기는 패턴
		const punt = body.match(/자세한 (내용|건|것)은 (공식 )?문서 참고/g);
		if (punt) {
			add('warn', pkg, '규약1', `${f}: 핵심을 외부로 넘기는 문구 ${punt.length}건 — 자기완결성 위반 후보`);
		}
	}

	// 90에 암기 항목이 실제로 들어 있는지.
	//
	// 형식은 규약이 정하지 않는다 — 규약 1은 "검색 없이 즉답할 항목만"이라고만
	// 말한다. 카드(###)로 쓰든 표로 쓰든 목록으로 쓰든 자료 성격에 맞으면 된다.
	// 그래서 특정 마크업을 요구하지 않고 "항목이 하나라도 있는가"만 본다.
	// (초기 버전은 ###을 강제했는데, 그건 한 자료의 형식을 전체 규약으로
	//  착각한 오버피팅이었다. 스크립트가 규약보다 엄격하면 감사가 신뢰를 잃는다.)
	const memo = readIf(path.join(docs, '90-must-memorize.md'));
	if (memo) {
		const items =
			(memo.match(/^###\s/gm) || []).length + // 카드형
			(memo.match(/^\|[^|]+\|/gm) || []).length + // 표 행 (헤더·구분선 포함)
			(memo.match(/^\s*[-*]\s+\S/gm) || []).length; // 목록형
		if (items === 0) {
			add(
				'warn',
				pkg,
				'규약1',
				'90-must-memorize.md에 암기 항목이 없다 (카드·표·목록 어느 형식이든 없음)',
			);
		}
	}
}

// ── 규약 2: 서술형 워크북 ──────────────────────────────────────────────────
function auditWorkbook(pkg, root) {
	const wb = path.join(root, 'workbook');
	if (!fs.existsSync(wb)) return; // 워크북은 선택

	const q = readIf(path.join(wb, '92-workbook.md'));
	const a = readIf(path.join(wb, '93-solutions.md'));

	if (q && !a) add('error', pkg, '규약2', '92는 있고 93이 없다 — 문제에 정답이 없다');
	if (a && !q) add('error', pkg, '규약2', '93은 있고 92가 없다 — 정답에 대응 문항이 없다');
	if (!q || !a) return;

	// 92에 정답이 새지 않았는지
	const toggles = (q.match(/<details/g) || []).length;
	if (toggles > 0) {
		add('error', pkg, '규약2', `92에 <details> ${toggles}개 — 접기는 분리가 아니다. 정답은 93으로`);
	}
	for (const marker of ['📍 되짚기', '**즉답 예시**']) {
		if (q.includes(marker)) {
			add('error', pkg, '규약2', `92에 "${marker}"가 있다 — 정답 흔적이 문제 파일에 남았다`);
		}
	}

	// 번호 1:1 대응.
	//
	// 번호 체계와 헤딩 깊이는 규약이 정하지 않는다 — `3-1`도 `1-A-2`도 쓰이고,
	// 정답 헤딩은 파트가 있으면 H3, 없으면 H2가 된다. 대응이 맞는지만 본다.
	// (초기 버전은 `## \d+-\d+`만 인정해서, H3로 쓴 자료를 "정답 없음"으로
	//  잘못 보고했다. 감사가 규약보다 좁으면 진짜 위반이 소음에 묻힌다.)
	// 헤딩은 `## 2-1`일 수도 `## 2-1 — 해설`일 수도 있다. 번호 뒤에 무엇이 오든
	// 받되, 번호로 시작하지 않는 헤딩(`## 파트 1. 회수 연습`)은 걸러진다.
	const ANSWER_HEADING = /^#{2,4}\s+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)(?=[\s.:—-]|$)/gm;
	// 문항은 `**1-1.** 본문` 또는 `**3-6. 제목**` 둘 다 쓰인다. 굵게 표시가 번호에서
	// 끝나는지 제목까지 감싸는지는 규약이 정하지 않으므로 번호까지만 본다.
	const qNums = [...q.matchAll(/^\*\*([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)\./gm)].map((m) => m[1]);
	const aNums = [...a.matchAll(ANSWER_HEADING)].map((m) => m[1]);
	// 코딩 과제는 93에 정답을 두지 않는다. 답은 tests/(명세)와 solutions/(참고 구현)이
	// 담당하고, 92는 그 과제를 안내만 한다. 그러니 src/에 같은 번호의 파일이 있으면
	// 93에 없는 것이 정상이다.
	const codingNums = new Set(
		listTs(path.join(root, 'src'), (f) => /^\d+-\d+-.+\.ts$/.test(f)).map(
			(f) => f.match(/^(\d+-\d+)/)[1],
		),
	);
	const missing = qNums.filter((n) => !aNums.includes(n) && !codingNums.has(n));
	const extra = aNums.filter((n) => !qNums.includes(n));
	if (missing.length) {
		add('error', pkg, '규약2', `93에 정답 없는 문항: ${missing.join(', ')}`);
	}
	if (extra.length) {
		add('error', pkg, '규약2', `92에 문항 없는 정답: ${extra.join(', ')}`);
	}

	// 93의 각 항목에 되짚기. 파트 구분용 헤딩(`## 파트 1. …`)은 항목이 아니므로 뺀다.
	const noPointer = a
		.split(/^(?=#{2,4}\s)/m)
		.filter((s) => new RegExp(ANSWER_HEADING.source, 'm').test(s))
		.filter((s) => !/📍 되짚기/.test(s))
		.map((s) => s.match(new RegExp(ANSWER_HEADING.source, 'm'))[1]);
	if (noPointer.length) {
		add('warn', pkg, '규약2', `93에 되짚기 없는 항목: ${noPointer.join(', ')}`);
	}

	// 상호 링크
	if (!/93-solutions\.md/.test(q)) add('warn', pkg, '규약2', '92가 93을 링크하지 않는다');
	if (!/92-workbook\.md/.test(a)) add('warn', pkg, '규약2', '93이 92를 링크하지 않는다');
}

// ── 규약 2: 코딩 과제 — tests(명세) / src(문제) / solutions(참고 구현) ────────
function auditCoding(pkg, root) {
	const srcDir = path.join(root, 'src');
	const solDir = path.join(root, 'solutions');
	const testDir = path.join(root, 'tests');
	if (!fs.existsSync(srcDir)) return;

	const isAssignment = (f) => /^\d+-\d+-.+\.ts$/.test(f) && !f.endsWith('.test.ts');
	const isSpec = (f) => /^\d+-\d+-.+\.test\.ts$/.test(f);

	const src = listTs(srcDir, isAssignment);
	const sol = listTs(solDir, isAssignment);
	const specs = listTs(testDir, isSpec);

	if (src.length === 0) return; // 코딩 과제 없는 패키지

	const base = (f) => f.replace(/\.test\.ts$|\.ts$/, '');
	const specBases = new Set(specs.map(base));
	const solBases = new Set(sol.map(base));

	// ── 세 파일이 한 벌인가
	for (const f of src) {
		const b = base(f);
		if (!specBases.has(b)) {
			add('error', pkg, '규약2', `tests/${b}.test.ts 가 없다 — 명세 없이는 무엇을 만들지 알 수 없다`);
		}
		if (!solBases.has(b)) {
			add('error', pkg, '규약2', `solutions/${b}.ts 가 없다 — 참고 구현이 없으면 양방향 검증을 못 한다`);
		}
	}
	const srcBases = new Set(src.map(base));
	for (const f of sol) {
		if (!srcBases.has(base(f))) {
			add('error', pkg, '규약2', `src/${base(f)}.ts 가 없다 — 참고 구현만 있고 문제가 없다`);
		}
	}
	for (const f of specs) {
		if (!srcBases.has(base(f))) {
			add('error', pkg, '규약2', `src/${base(f)}.ts 가 없다 — 명세만 있고 문제가 없다`);
		}
	}

	// ── 문제 파일 (src): 한 파일 한 문제 + TODO 스켈레톤 + 명세 포인터
	for (const f of src) {
		const body = readIf(path.join(srcDir, f)) ?? '';
		const b = base(f);
		const nums = new Set([...body.matchAll(/과제\s+(\d+-\d+)/g)].map((m) => m[1]));
		if (nums.size > 1) {
			add('error', pkg, '규약2', `src/${f}에 과제 ${[...nums].join(', ')} — 한 파일에 한 문제만`);
		}
		if (!/🎯 TODO/.test(body)) {
			add('warn', pkg, '규약2', `src/${f}에 🎯 TODO가 없다 — 채울 지점이 표시되지 않았다`);
		}
		if (!/throw new Error\(['"]TODO/.test(body)) {
			add('warn', pkg, '규약2', `src/${f}가 throw로 시작하지 않는다 — 채우기 전에 테스트가 통과할 수 있다`);
		}
		if (!body.includes(`tests/${b}.test.ts`)) {
			add('warn', pkg, '규약2', `src/${f}가 명세 파일(tests/${b}.test.ts)을 가리키지 않는다`);
		}
		// 이전 규격의 잔재. 성공 기준은 이제 테스트의 it() 설명이 담는다.
		if (/^\s*\*\s*성공 기준/m.test(body)) {
			add(
				'warn',
				pkg,
				'규약2',
				`src/${f}에 "성공 기준" 목록이 남아 있다 — 명세가 tests/로 옮겨졌으니 이중 관리가 된다`,
			);
		}
	}

	// ── 명세 파일 (tests): 실제로 판정하는가
	for (const f of specs) {
		const body = readIf(path.join(testDir, f)) ?? '';
		const b = base(f);

		if (!/from ['"]vitest['"]/.test(body)) {
			add('error', pkg, '규약3', `tests/${f}가 vitest를 import하지 않는다`);
		}
		if (!new RegExp(`from ['"]\\.\\./src/${b}(?:\\.js)?['"]`).test(body)) {
			add(
				'error',
				pkg,
				'규약2',
				`tests/${f}가 ../src/${b} 를 import하지 않는다 — 이 상대 경로가 있어야 STUDY_TARGET 치환이 걸린다`,
			);
		}
		const assertions = (body.match(/\bexpect\(/g) || []).length;
		if (assertions === 0) {
			add('error', pkg, '규약2', `tests/${f}에 expect()가 없다 — 아무것도 검사하지 않는다`);
		} else if (assertions < 3) {
			add('warn', pkg, '규약2', `tests/${f}의 expect()가 ${assertions}개뿐 — 경계 조건이 빠졌을 수 있다`);
		}
		if (!/고치지 않는다/.test(body)) {
			add('warn', pkg, '규약2', `tests/${f}에 "이 파일은 고치지 않는다"가 없다 — 명세를 고쳐 통과시키는 걸 막지 못한다`);
		}
		if (!/\bit\(/.test(body)) {
			add('warn', pkg, '규약2', `tests/${f}에 it()이 없다 — 성질 단위로 나뉘지 않았다`);
		}
	}

	// ── 참고 구현 (solutions): 테스트가 아니어야 하고, 인터페이스가 src와 같아야 한다
	for (const f of sol) {
		const body = readIf(path.join(solDir, f)) ?? '';
		const b = base(f);

		// 규격이 뒤집혔다. 예전에는 solutions가 테스트였고, 지금은 구현이다.
		if (/from ['"]vitest['"]/.test(body) || /^\s*function check\(/m.test(body)) {
			add(
				'error',
				pkg,
				'규약2',
				`solutions/${f}가 아직 테스트다 — 판정은 tests/가 하고 solutions/는 참고 구현을 담는다`,
			);
		}
		if (/from ['"]\.\.\/src\//.test(body)) {
			add(
				'error',
				pkg,
				'규약2',
				`solutions/${f}가 ../src/를 import한다 — 참고 구현은 독립적이어야 STUDY_TARGET 치환의 대상이 된다`,
			);
		}
		if (!/📍 되짚기/.test(body)) {
			add('warn', pkg, '규약2', `solutions/${f}에 되짚기 주석이 없다`);
		}

		// 인터페이스 일치 — 여기가 어긋나면 STUDY_TARGET 치환이 조용히 깨진다.
		const srcBody = readIf(path.join(srcDir, `${b}.ts`));
		if (srcBody) {
			const want = exportedNames(srcBody);
			const have = exportedNames(body);
			const missing = [...want].filter((n) => !have.has(n));
			if (missing.length) {
				add(
					'error',
					pkg,
					'규약2',
					`solutions/${f}에 없는 export: ${missing.join(', ')} — src와 인터페이스가 달라 치환 시 깨진다`,
				);
			}
		}
	}
}

// ── 규약 3·5: 패키지 설정 ──────────────────────────────────────────────────
function auditPackageSetup(pkg, root, { isTool, isLegacy }) {
	const pj = readIf(path.join(root, 'package.json'));
	if (!pj) {
		add('error', pkg, '규약5', 'package.json이 없다 — 워크스페이스가 인식하지 못한다');
		return;
	}
	const j = JSON.parse(pj);
	const expectedName = isTool ? `@study/${pkg}` : pkg;
	if (j.name !== expectedName && j.name !== pkg) {
		add('warn', pkg, '규약5', `package.json name("${j.name}")이 디렉토리명과 다르다`);
	}
	if (j.type !== 'module') {
		add('warn', pkg, '규약5', 'type: "module"이 아니다 — ESM import가 깨진다');
	}

	const scripts = j.scripts ?? {};
	if (!scripts.typecheck) add('warn', pkg, '규약5', 'package.json에 typecheck 스크립트가 없다');

	const ts = readIf(path.join(root, 'tsconfig.json'));
	if (!ts) {
		add('error', pkg, '규약5', 'tsconfig.json이 없다');
	} else if (!/tsconfig\.base\.json/.test(ts)) {
		add('warn', pkg, '규약5', 'tsconfig.json이 ../../tsconfig.base.json을 상속하지 않는다');
	}

	if (isTool) return;

	// README 현재 패키지 표에 등재
	const readme = readIf(path.join(REPO, 'README.md')) ?? '';
	if (!new RegExp('`' + pkg + '`').test(readme)) {
		add('warn', pkg, '규약5', 'README.md "현재 패키지" 표에 없다');
	}

	if (isLegacy) return;

	// 코딩 과제가 있는 패키지는 Vitest 배선이 되어 있어야 한다.
	const hasAssignments = listTs(path.join(root, 'src'), (f) => /^\d+-\d+-.+\.ts$/.test(f)).length > 0;
	if (!hasAssignments) return;

	if (scripts.test !== 'vitest run') {
		add('error', pkg, '규약5', `test 스크립트가 "vitest run"이 아니다 (현재: ${scripts.test ?? '없음'})`);
	}
	for (const stale of Object.keys(scripts).filter((s) => /^test:\d+-\d+$/.test(s))) {
		add('warn', pkg, '규약5', `옛 규격의 스크립트가 남아 있다: ${stale} — 이제 vitest가 파일명으로 필터한다`);
	}
	if (!(j.devDependencies?.['@study/testkit'])) {
		add('error', pkg, '규약3', 'devDependencies에 @study/testkit이 없다 — vitest.config.ts가 해석되지 않는다');
	}

	const vc = readIf(path.join(root, 'vitest.config.ts'));
	if (!vc) {
		add('error', pkg, '규약5', 'vitest.config.ts가 없다 — 양방향 검증(STUDY_TARGET) 치환이 걸리지 않는다');
	} else if (!/defineStudyConfig/.test(vc)) {
		add('error', pkg, '규약5', 'vitest.config.ts가 defineStudyConfig를 쓰지 않는다 — 치환 규칙이 패키지마다 갈린다');
	}

	if (ts && !/"tests"/.test(ts)) {
		add('warn', pkg, '규약5', 'tsconfig.json의 include에 "tests"가 없다 — 명세가 타입 검사를 받지 않는다');
	}
}

// ── 규약 4: 풀이 브랜치 ────────────────────────────────────────────────────
function auditBranches(packages) {
	let branches = [];
	try {
		branches = execSync('git branch --format="%(refname:short)"', { cwd: REPO, encoding: 'utf8' })
			.split('\n')
			.map((b) => b.trim())
			.filter(Boolean);
	} catch {
		add('warn', '(repo)', '규약4', 'git 브랜치를 읽을 수 없다');
		return;
	}

	// 규약 4가 정하는 것은 **풀이 브랜치**의 명명이지, 레포의 모든 브랜치가
	// sol/이어야 한다는 뜻이 아니다. 백업·실험·기능 브랜치는 규약 밖이므로
	// 건드리지 않는다. sol/로 시작하는 것만 형식과 패키지 존재를 검증한다.
	//
	// 진짜 규약 위반은 "풀이가 main에 머지됐는가"이고, 그건 아래에서 파일
	// 상태로 확인한다 — 브랜치 이름보다 그쪽이 실질이다.
	for (const b of branches) {
		if (!b.startsWith('sol/')) continue;
		const parts = b.split('/');
		if (parts.length !== 3 || !parts[1] || !parts[2]) {
			add('warn', '(repo)', '규약4', `브랜치 "${b}"가 sol/{패키지}/{과제} 3단 형식이 아니다`);
			continue;
		}
		if (!packages.includes(parts[1])) {
			add('warn', '(repo)', '규약4', `브랜치 "${b}"의 패키지 "${parts[1]}"가 존재하지 않는다`);
		}
	}

	// 풀이가 main에 머지됐는지 — main에 TODO가 사라진 과제가 있으면 의심
	for (const pkg of packages) {
		if (LEGACY_PACKAGES.has(pkg) || TOOL_PACKAGES.has(pkg)) continue;
		const srcDir = path.join(REPO, 'packages', pkg, 'src');
		if (!fs.existsSync(srcDir)) continue;
		const filled = listTs(srcDir, (f) => /^\d+-\d+-.+\.ts$/.test(f)).filter((f) => {
			const b = readIf(path.join(srcDir, f)) ?? '';
			return /🎯 TODO/.test(b) === false;
		});
		if (filled.length) {
			add(
				'error',
				pkg,
				'규약4',
				`main의 문제 파일이 채워져 있다: ${filled.join(', ')} — 풀이가 main에 머지된 것으로 보인다. main은 문제 상태를 유지한다`,
			);
		}
	}
}

// ── 실행 ───────────────────────────────────────────────────────────────────
const target = process.argv[2];
const pkgRoot = path.join(REPO, 'packages');
const packages = fs.existsSync(pkgRoot)
	? fs.readdirSync(pkgRoot).filter((d) => fs.statSync(path.join(pkgRoot, d)).isDirectory())
	: [];

if (packages.length === 0) {
	console.error('packages/ 아래에 패키지가 없다. 레포 루트에서 실행했는지 확인하라.');
	process.exit(1);
}

const targets = target ? packages.filter((p) => p === target) : packages;
if (target && targets.length === 0) {
	console.error(`패키지 "${target}"를 찾을 수 없다. 있는 것: ${packages.join(', ')}`);
	process.exit(1);
}

const exempted = [];
for (const pkg of targets) {
	const root = path.join(pkgRoot, pkg);
	const isTool = TOOL_PACKAGES.has(pkg);
	const isLegacy = LEGACY_PACKAGES.has(pkg);

	if (isTool) {
		exempted.push(`${pkg} (도구 패키지 — 규약 1·2 미적용)`);
	} else {
		auditDocs(pkg, root);
		auditWorkbook(pkg, root);
		if (isLegacy) {
			exempted.push(`${pkg} (${LEGACY_PACKAGES.get(pkg)})`);
		} else {
			auditCoding(pkg, root);
		}
	}
	auditPackageSetup(pkg, root, { isTool, isLegacy });
}
if (!target) auditBranches(packages);

// ── 보고 ───────────────────────────────────────────────────────────────────
const errors = findings.filter((f) => f.severity === 'error');
const warns = findings.filter((f) => f.severity === 'warn');

if (exempted.length) {
	console.log('예외 적용');
	for (const e of exempted) console.log(`  · ${e}`);
	console.log();
}

if (findings.length === 0) {
	console.log(`✓ 규약 위반 없음 (검사: ${targets.join(', ')})`);
	process.exit(0);
}

for (const [severity, label, list] of [
	['error', '위반', errors],
	['warn', '주의', warns],
]) {
	if (list.length === 0) continue;
	console.log(`${label} ${list.length}건`);
	for (const f of list) {
		console.log(`  ${severity === 'error' ? '✗' : '△'} [${f.pkg}/${f.rule}] ${f.detail}`);
	}
	console.log();
}

console.log(`위반 ${errors.length} · 주의 ${warns.length}`);
console.log('규약 원문: README.md');
process.exit(errors.length > 0 ? 1 : 0);

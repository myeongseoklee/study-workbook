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
 *
 * multi-agent-systems는 한때 여기 있었다("살아 있는 LLM API를 호출해 단위 테스트로
 * 판정할 수 없다"는 사유로) — 실제로는 대부분의 실습이 client/ask를 파라미터로 받는
 * 순수 orchestration 함수였고, 모킹이 아니라 스텁 주입으로 얼마든지 판정 가능했다.
 * 전면 tests/src/solutions 전환 후 이 항목은 제거했다.
 */
const LEGACY_PACKAGES = new Map([]);

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

/**
 * 과제 폴더 목록. 폴더명은 `{문서번호}-{순번}-{slug}`이고 회차 시리즈는
 * `e{회차}-` 접두가 붙는다 (README § 규약 2).
 */
function listAssignmentDirs(dir) {
	try {
		return fs
			.readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isDirectory() && /^(?:e\d+-)?\d+-\d+-.+$/.test(e.name))
			.map((e) => e.name)
			.sort();
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
	// 담당하고, 92는 그 과제를 안내만 한다.
	//
	// 문항 번호만으로는 코딩 과제인지 알 수 없다 — 워크북 파트 3의 문항 번호(`3-1`)와
	// 과제 번호(`03-01`)는 서로 다른 좌표계다(README § 규약 2). 그래서 문항이 과제를
	// 가리키는지(`(과제 `03-01`)` 병기 또는 `src/`·`tests/` 경로)로 판정한다.
	const codingNums = new Set(
		[...q.matchAll(/^\*\*([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)\.[^\n]*$/gm)]
			.filter((m) => /과제 `|src\/|tests\//.test(m[0]))
			.map((m) => m[1]),
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
//
// 과제 하나가 **폴더 하나**다. 폴더 안에서 `index`는 필수 문제이고 `extra-*`는
// 선택 문제다(README § 규약 2). 그래서 검사는 두 층으로 나뉜다: 세 곳(tests·src·
// solutions)에 같은 **폴더**가 있는가, 그리고 그 폴더 안의 각 **파일**이 세 벌로
// 짝을 맞추는가.
function auditCoding(pkg, root) {
	const dirs = { src: path.join(root, 'src'), sol: path.join(root, 'solutions'), test: path.join(root, 'tests') };
	if (!fs.existsSync(dirs.src)) return;

	const assignments = listAssignmentDirs(dirs.test);
	if (assignments.length === 0) {
		// 평평한 옛 배치가 남아 있으면 알린다 — 조용히 0건 통과로 넘어가면
		// 마이그레이션이 끝난 것처럼 보인다.
		if (listTs(dirs.src, (f) => /^(?:e\d+-)?\d+-\d+-.+\.ts$/.test(f)).length > 0) {
			add('error', pkg, '규약2', 'src/에 평평한 과제 파일이 있다 — 과제는 폴더 하나여야 한다(폴더+index)');
		}
		return;
	}

	for (const a of assignments) {
		// ── 세 폴더가 한 벌인가
		for (const [key, label] of [['src', 'src'], ['sol', 'solutions']]) {
			if (!fs.existsSync(path.join(dirs[key], a))) {
				add('error', pkg, '규약2', `${label}/${a}/ 가 없다 — 과제는 세 폴더가 한 벌이다`);
			}
		}

		// ── 필수 문제(index)가 세 곳에 있는가
		const trio = [
			['test', `tests/${a}/index.test.ts`],
			['src', `src/${a}/index.ts`],
			['sol', `solutions/${a}/index.ts`],
		];
		for (const [key, rel] of trio) {
			const f = path.join(root, rel);
			if (!fs.existsSync(f)) add('error', pkg, '규약2', `${rel} 가 없다 — 필수 문제는 index다`);
		}

		// ── 선택 문제(extra-*)도 세 벌이어야 한다
		const extras = {
			test: listTs(path.join(dirs.test, a), (f) => /^extra-.+\.test\.ts$/.test(f)).map((f) =>
				f.replace(/\.test\.ts$/, ''),
			),
			src: listTs(path.join(dirs.src, a), (f) => /^extra-.+\.ts$/.test(f) && !f.endsWith('.test.ts')).map((f) =>
				f.replace(/\.ts$/, ''),
			),
			sol: listTs(path.join(dirs.sol, a), (f) => /^extra-.+\.ts$/.test(f) && !f.endsWith('.test.ts')).map((f) =>
				f.replace(/\.ts$/, ''),
			),
		};
		const allExtras = new Set([...extras.test, ...extras.src, ...extras.sol]);
		for (const e of allExtras) {
			if (!extras.test.includes(e)) add('error', pkg, '규약2', `tests/${a}/${e}.test.ts 가 없다 — 선택 문제도 명세가 있어야 푼다`);
			if (!extras.src.includes(e)) add('error', pkg, '규약2', `src/${a}/${e}.ts 가 없다 — 명세만 있고 문제가 없다`);
			if (!extras.sol.includes(e)) add('error', pkg, '규약2', `solutions/${a}/${e}.ts 가 없다 — 양방향 검증을 못 한다`);
		}

		// ── 문제 파일 (src): TODO 스켈레톤 + 명세 포인터
		for (const name of ['index', ...extras.src]) {
			const rel = `src/${a}/${name}.ts`;
			const body = readIf(path.join(root, rel));
			if (body === null) continue;
			if (!/🎯 TODO/.test(body)) {
				add('warn', pkg, '규약2', `${rel}에 🎯 TODO가 없다 — 채울 지점이 표시되지 않았다`);
			}
			if (!/throw new Error\(['"]TODO/.test(body)) {
				add('warn', pkg, '규약2', `${rel}가 throw로 시작하지 않는다 — 채우기 전에 테스트가 통과할 수 있다`);
			}
			const spec = name === 'index' ? `tests/${a}/index.test.ts` : `tests/${a}/${name}.test.ts`;
			if (!body.includes(spec)) {
				add('warn', pkg, '규약2', `${rel}가 명세 파일(${spec})을 가리키지 않는다`);
			}
			if (/^\s*\*\s*성공 기준/m.test(body)) {
				add('warn', pkg, '규약2', `${rel}에 "성공 기준" 목록이 남아 있다 — 명세가 tests/로 옮겨졌으니 이중 관리가 된다`);
			}
		}

		// ── 명세 파일 (tests): 실제로 판정하는가
		for (const name of ['index', ...extras.test]) {
			const rel = `tests/${a}/${name}.test.ts`;
			const body = readIf(path.join(root, rel));
			if (body === null) continue;

			if (!/from ['"]vitest['"]/.test(body)) {
				add('error', pkg, '규약3', `${rel}가 vitest를 import하지 않는다`);
			}
			// 폴더가 한 단계 깊어져 경로는 `../../src/…`다. 이 상대 경로가 있어야
			// STUDY_TARGET 치환이 걸린다 — 깊이가 어긋나면 치환이 조용히 빗나가고
			// 늘 src/를 보게 되므로 양방향 검증이 무력화된다.
			const want = name === 'index' ? `../../src/${a}` : `../../src/${a}/${name}`;
			if (!new RegExp(`from ['"]${want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.js)?['"]`).test(body)) {
				add('error', pkg, '규약2', `${rel}가 ${want} 를 import하지 않는다 — 이 상대 경로가 있어야 STUDY_TARGET 치환이 걸린다`);
			}
			const assertions = (body.match(/\bexpect\(/g) || []).length;
			if (assertions === 0) {
				add('error', pkg, '규약2', `${rel}에 expect()가 없다 — 아무것도 검사하지 않는다`);
			} else if (assertions < 3) {
				add('warn', pkg, '규약2', `${rel}의 expect()가 ${assertions}개뿐 — 경계 조건이 빠졌을 수 있다`);
			}
			if (name === 'index' && !/고치지 않는다/.test(body)) {
				add('warn', pkg, '규약2', `${rel}에 "이 파일은 고치지 않는다"가 없다 — 명세를 고쳐 통과시키는 걸 막지 못한다`);
			}
			if (!/\bit\(/.test(body)) {
				add('warn', pkg, '규약2', `${rel}에 it()이 없다 — 성질 단위로 나뉘지 않았다`);
			}
		}

		// ── 참고 구현 (solutions): 테스트가 아니어야 하고, 인터페이스가 src와 같아야 한다
		for (const name of ['index', ...extras.sol]) {
			const rel = `solutions/${a}/${name}.ts`;
			const body = readIf(path.join(root, rel));
			if (body === null) continue;

			if (/from ['"]vitest['"]/.test(body) || /^\s*function check\(/m.test(body)) {
				add('error', pkg, '규약2', `${rel}가 아직 테스트다 — 판정은 tests/가 하고 solutions/는 참고 구현을 담는다`);
			}
			if (/from ['"](?:\.\.\/)+src\//.test(body)) {
				add('error', pkg, '규약2', `${rel}가 src/를 import한다 — 참고 구현은 독립적이어야 STUDY_TARGET 치환의 대상이 된다`);
			}
			if (name === 'index' && !/📍 되짚기/.test(body)) {
				add('warn', pkg, '규약2', `${rel}에 되짚기 주석이 없다`);
			}

			// 인터페이스 일치 — 여기가 어긋나면 STUDY_TARGET 치환이 조용히 깨진다.
			const srcBody = readIf(path.join(dirs.src, a, `${name}.ts`));
			if (srcBody) {
				const want = exportedNames(srcBody);
				const have = exportedNames(body);
				const missing = [...want].filter((n) => !have.has(n));
				if (missing.length) {
					add('error', pkg, '규약2', `${rel}에 없는 export: ${missing.join(', ')} — src와 인터페이스가 달라 치환 시 깨진다`);
				}
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

// ── 반출 안전: 실제 식별자가 산출물에 남았는가 ──────────────────────────────
//
// 학습 자료는 공유되기 쉽다 — 노션에 올리고, 팀에 링크를 주고, 공개 레포로 옮긴다.
// 계정 ID·공인 IP·리소스 ID가 한 문서에 모이면 그것만으로 정찰 정보가 되고,
// 한 번 새어 나가면 git 이력·캐시·포크에 남는다. 그래서 **생성 시점에** 막는다.
//
// 판정은 "문서용으로 허용된 값인가"로 한다. 실제 값과 예시값을 자동으로 가르는
// 완벽한 규칙은 없으므로, 허용 목록을 명시하고 그 밖은 사람이 보게 한다.
//
// study-material-generator SKILL.md의 치환 대상 8종 중 이 함수가 다루는 것은
// 계정 ID·공인 IP·리소스 ID·이메일·DB 엔드포인트·OIDC sub·SSID 7종이다.
// **"내부 자격·공용 리소스 이름"(DB 유저명, 공용 보안그룹 이름 등)은 기계 검출 대상에서
// 뺐다** — 회사마다 고유한 어휘라 허용 목록을 만들 수 없고, 일반 단어와 구분할 정규식이
// 없다. 이 항목은 여전히 사람이 검토해야 한다. 이 함수가 "위반 없음"을 보고해도
// 이 항목은 검사되지 않았다는 뜻이다.

/** AWS 문서·이 레포가 예시로 쓰는 계정 ID. */
const ALLOWED_ACCOUNT_IDS = new Set([
	'111122223333', // AWS 문서 표준 예시
	'123456789012',
	'444455556666',
	'555555555555',
	'000000000000',
]);

/** 문서·테스트에 써도 되는 IP. RFC 5737 예약 대역 + 사설/특수 대역 + 명백한 장난값. */
const SAFE_IP = [
	/^192\.0\.2\./, // RFC 5737 TEST-NET-1
	/^198\.51\.100\./, // RFC 5737 TEST-NET-2
	/^203\.0\.113\./, // RFC 5737 TEST-NET-3
	/^10\./, // RFC 1918
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
	/^127\./,
	/^169\.254\./, // 링크 로컬 (ECS 메타데이터 엔드포인트가 여기다)
	/^0\.0\.0\.0/,
	/^255\./,
	/^8\.8\.8\.8/, // 공개 DNS — 관용적 예시
	/^1\.2\.3\.\d+$/, // 장난값
];

/**
 * 이 레포가 예시로 쓰는 리소스 ID. 새 예시를 만들면 여기 추가한다.
 *
 * 검사는 **16진수 8자 이상**만 대상으로 하므로 `sg-alb`·`igw-xxxx`·`subnet-public`
 * 같은 설명용 표기는 애초에 걸리지 않는다(실제 AWS ID는 hex만 쓴다).
 * 문서에서 `subnet-0aaa1111…`처럼 줄여 쓰면 앞부분만 검출되므로, 접두사 일치도 허용한다.
 */
const ALLOWED_RESOURCE_IDS = [
	'subnet-0aaa1111bbbb2222a',
	'subnet-0ccc3333dddd4444b',
	'subnet-0eee5555ffff6666c',
	'subnet-0999777788889999d',
	'sg-0db1111222233334',
	'sg-0int111122223333',
	'vpc-0abc1234def5678a',
];

/** 검출값이 허용 예시와 같거나 그 앞부분(줄임 표기)이면 통과. */
function isAllowedResourceId(id) {
	return ALLOWED_RESOURCE_IDS.some((allowed) => allowed === id || allowed.startsWith(id));
}

/** 문서에 써도 되는 이메일 도메인. */
const SAFE_EMAIL = /@(example\.(com|org|net)|invalid|localhost|anthropic\.com)$/;

/** 값이 전부 0인 UUID — 자리표시자로 관용적으로 쓰인다. */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** 관리형 DB·캐시가 쓰는 엔드포인트 접미사. 벤더가 늘면 이 표에 추가한다. */
const MANAGED_DB_SUFFIXES = [
	/\.rds\.amazonaws\.com$/,
	/\.cache\.amazonaws\.com$/,
	/\.database\.windows\.net$/, // Azure SQL
	/\.documents\.azure\.com$/, // Azure Cosmos DB
	/\.redis\.cache\.windows\.net$/, // Azure Cache for Redis
];

/**
 * 조직명·리소스명이 자리표시자처럼 보이는지 — 특정 값을 허용 목록에 등록하는 대신
 * "관용적으로 자리표시자에 쓰이는 표기 패턴"으로 판별한다. 안전 목록 방식은 문서마다
 * 다른 관례(`OWNER/REPO`, `<org>`, `my-org`, `{{ORG}}`...)를 전부 등록해야 하고, 등록 안 된
 * 새 관례가 나올 때마다 오탐을 낸다 — 실제로 GitHub 공식 문서의 `OWNER/REPO`가 그렇게 걸렸다.
 */
function looksLikePlaceholder(token) {
	return (
		/^[A-Z_][A-Z0-9_]*$/.test(token) || // ALL_CAPS 관례: OWNER, MY_ORG, ORG_NAME
		/^[<{].*[>}]$/.test(token) || // <org>, {org}, {{org}}
		/^(my|your|example|foo|bar|acme|test|sample|placeholder|org|company|x+)[-_]?/i.test(token)
	);
}

function auditExportSafety(pkg, root) {
	const files = [];
	for (const sub of ['docs', 'workbook', 'src', 'solutions', 'tests']) {
		const dir = path.join(root, sub);
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
		} catch {
			continue;
		}
		for (const e of entries) {
			if (!e.isFile()) continue;
			if (!/\.(md|ts|js|ya?ml|json)$/.test(e.name)) continue;
			const parent = e.parentPath ?? e.path ?? dir;
			files.push(path.join(parent, e.name));
		}
	}

	for (const file of files) {
		const body = readIf(file);
		if (!body) continue;
		const rel = path.relative(root, file);

		// ① 12자리 계정 ID — ARN·ECR URI 문맥이면 확신도가 높아 error, 맨숫자로만
		//    나오면 오탐(전화번호·금액 등) 가능성이 있어 warn으로 낮춰서라도 사람 눈에 띄게 한다.
		//    (문맥 없이도 잡지 않으면 산문에 그대로 적힌 계정 ID를 놓친다 — 실제로 있었던 사고 형태다.)
		const armMatchedIds = new Set();
		for (const m of body.matchAll(/(?:arn:aws[a-z-]*:[a-z0-9-]*:[a-z0-9-]*:|(?<![\w.])(?=\d{12}\.dkr\.ecr))(\d{12})/g)) {
			armMatchedIds.add(m[1]);
			if (!ALLOWED_ACCOUNT_IDS.has(m[1])) {
				add('error', pkg, '반출안전', `${rel}: 실제 계정 ID로 보이는 값 ${m[1]} — 예시 계정(111122223333)으로 치환한다`);
			}
		}
		// 앞뒤에 문자·숫자가 더 붙어 있으면(도서 ID·상품 코드 등) 계정 ID가 아니라
		// 더 긴 식별자의 일부다 — 경계를 `\d`가 아니라 `\w`로 넓게 잡아 그런 값은 뺀다.
		for (const m of body.matchAll(/(?<!\w)(\d{12})(?!\w)/g)) {
			if (armMatchedIds.has(m[1]) || ALLOWED_ACCOUNT_IDS.has(m[1])) continue;
			add('warn', pkg, '반출안전', `${rel}: 문맥 없는 12자리 숫자 ${m[1]} — 계정 ID일 수 있다. 확인 후 치환하거나 허용 목록에 추가한다`);
		}

		// ② 공인 IP — 사설·문서용 대역 밖이면 실제 주소일 수 있다
		const seenIp = new Set();
		for (const m of body.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g)) {
			const ip = m[1];
			if (seenIp.has(ip)) continue;
			seenIp.add(ip);
			const octets = ip.split('.').map(Number);
			if (octets.some((o) => o > 255)) continue; // 버전 번호 등
			if (SAFE_IP.some((re) => re.test(ip))) continue;
			add('error', pkg, '반출안전', `${rel}: 공인 IP로 보이는 값 ${ip} — RFC 5737 대역(203.0.113.x 등)으로 치환한다`);
		}

		// ③ 리소스 ID — AWS만이 아니라 "짧은 소문자 접두사 + 긴 16진수" 관례를 쓰는
		//    벤더 전반(AWS·일부 Azure·k8s)을 겨냥한다. AWS 리소스 타입을 하나씩 나열하면
		//    새 리소스 타입이 나올 때마다 목록을 갱신해야 하므로, 접두사를 열어 둔다.
		//    hex 8자 이상만 대상으로 해 `igw-xxxx`·`subnet-public` 같은 설명용 표기는 빠진다.
		const seenId = new Set();
		for (const m of body.matchAll(/\b([a-z]{1,6}-[0-9a-f]{8,})\b/g)) {
			const id = m[1];
			if (seenId.has(id) || isAllowedResourceId(id)) continue;
			seenId.add(id);
			add('warn', pkg, '반출안전', `${rel}: 리소스 ID ${id} — 실제 값이면 치환하고, 예시면 스크립트의 ALLOWED_RESOURCE_IDS에 추가한다`);
		}

		// ③-b UUID/GUID — Azure 구독 ID·GCP 요청 ID·k8s 오브젝트 UID 등 벤더 불문으로
		//    쓰인다. 접두사가 없어 ③의 정규식으로는 못 잡으므로 별도로 본다.
		const seenUuid = new Set();
		for (const m of body.matchAll(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi)) {
			const id = m[1].toLowerCase();
			if (seenUuid.has(id) || id === NIL_UUID) continue;
			seenUuid.add(id);
			add('warn', pkg, '반출안전', `${rel}: UUID/GUID ${id} — 실제 구독·리소스 ID면 치환한다 (예: ${NIL_UUID})`);
		}

		// ④ 이메일 — 조직 도메인이 붙은 주소
		const seenMail = new Set();
		for (const m of body.matchAll(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g)) {
			const mail = m[0];
			if (seenMail.has(mail) || SAFE_EMAIL.test(mail)) continue;
			seenMail.add(mail);
			add('error', pkg, '반출안전', `${rel}: 실제 이메일로 보이는 값 ${mail} — example.com 도메인으로 치환한다`);
		}

		// ⑤ DB·캐시 엔드포인트 — 완전 일반화(모든 3단 이상 호스트명)는 시도하지 않는다.
		//    그러면 문서가 정당하게 인용하는 공개 API 호스트명(예: api.github.com)까지
		//    걸려 오탐이 신호를 덮는다. 대신 관리형 DB 서비스가 쓰는 접미사 표(MANAGED_DB_SUFFIXES)를
		//    벤더별로 넓혀 둔다 — AWS 하나만 보던 이전보다는 일반화됐지만, 여전히 알려진
		//    벤더 접미사 기반이라 완전히 새로운 벤더는 표에 추가해야 잡힌다.
		for (const m of body.matchAll(/\b([\w-]+(?:\.[\w-]+)+)\b/g)) {
			const host = m[1];
			if (!MANAGED_DB_SUFFIXES.some((re) => re.test(host))) continue;
			if (!/^example/i.test(host)) {
				add('error', pkg, '반출안전', `${rel}: 실제 DB·캐시 엔드포인트로 보이는 값 ${host} — example로 시작하는 값으로 치환한다`);
			}
		}

		// ⑥ OIDC sub — GitHub Actions의 `repo:{org}/{repo}:environment:*` 클레임.
		//    조직명이 실제 GitHub org면 그 자체로 어느 회사인지 특정된다. 판별은 특정
		//    조직명을 허용 목록에 등록하는 게 아니라 looksLikePlaceholder()로 한다 (위 주석 참조).
		for (const m of body.matchAll(/\brepo:([\w.-]+)\/([\w.-]+):/g)) {
			if (!looksLikePlaceholder(m[1])) {
				add(
					'error',
					pkg,
					'반출안전',
					`${rel}: OIDC sub의 조직명으로 보이는 값 "${m[1]}" — repo:my-org/my-service:environment:* 형태의 예시로 치환한다`,
				);
			}
		}

		// ⑦ SSID·와이파이 언급 — 실제 값인지는 기계로 판별 불가하지만, 이 단어가 나오면
		//    사람이 값을 봐야 한다는 신호는 낼 수 있다.
		if (/\bSSID\b/i.test(body) || /와이파이|Wi-?Fi\s*(이름|명)/.test(body)) {
			add('warn', pkg, '반출안전', `${rel}: SSID/와이파이 언급 — 실제 네트워크 이름이 아닌지 확인한다`);
		}
	}

	// ⑥ 치환했다면 그 사실을 개요에 밝혀야 한다 (독자가 예시값을 실제 값으로 오해하지 않도록)
	const overview = readIf(path.join(root, 'docs', '00-overview.md'));
	if (overview) {
		const hasPlaceholders = /111122223333|203\.0\.113\.|198\.51\.100\.|192\.0\.2\./.test(overview);
		const disclosed = /예시값|치환|익명|가짜/.test(overview);
		if (hasPlaceholders && !disclosed) {
			add('warn', pkg, '반출안전', 'docs/00-overview.md에 예시 식별자가 있는데 치환 사실을 밝히지 않았다 — 독자가 실제 값으로 오해한다');
		}
	}
}

// ── 테스트 더블 중복 ─────────────────────────────────────────────────────────
//
// README 규약: "새 헬퍼는 두 패키지 이상에서 필요해진 뒤에 testkit에 넣는다."
// 문제는 이 판단이 "다른 패키지에 이미 비슷한 게 있는지 검색했는가"에 달려 있는데,
// 그 검색을 강제하는 장치가 지금까지 없었다 — 사람이 매번 기억해서 grep해야 했다.
//
// 완전한 해결은 아니다. 이름이 다르면(예: `fakeModel` vs `stubModel`) 잡지 못한다.
// 그건 여전히 사람의 판단이 필요하다. 이 검사가 하는 일은 둘뿐이다:
//   ① testkit 밖에 있는 테스트 더블 후보를 전부 한 번에 나열한다 (매번 손으로 grep할 필요를 없앤다)
//   ② 정확히 같은 이름이 두 패키지에 나타나면 — 이건 사람이 못 보고 지나쳤을 확률이 높다 — 위반으로 잡는다
//
// 선언에 `export`를 요구하지 않는다. 테스트 더블은 대개 그 파일 안에서만 쓰이므로
// export 없이 모듈 최상단 상수로 선언되는 게 실제로 더 흔하다(예:
// multi-agent-systems/src/week3-multiagent/index.ts의 `stubPerformanceData`).
// export만 봤다면 이런 경우를 전부 놓쳐 "0건"이 "중복 없음"이 아니라 "사각지대"가 된다.
function auditTestDoubleDuplication(packages) {
	const DOUBLE_NAME = /\b(?:fake|stub|scripted|mock)[A-Z]\w*|\bFake\w*|\bStub\w*|\bScripted\w*|\bMock\w*/g;
	const found = new Map(); // 정규화된 이름 → [{pkg, file}]

	for (const pkg of packages) {
		if (TOOL_PACKAGES.has(pkg)) continue; // testkit 자신은 제외 — 거기 있는 게 정상 위치다
		const root = path.join(pkgRoot, pkg);
		for (const sub of ['src', 'solutions', 'tests']) {
			const dir = path.join(root, sub);
			let entries;
			try {
				entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
			} catch {
				continue;
			}
			for (const e of entries) {
				if (!e.isFile() || !e.name.endsWith('.ts')) continue;
				const file = path.join(e.parentPath ?? e.path ?? dir, e.name);
				const body = readIf(file);
				if (!body) continue;
				for (const m of body.matchAll(/\b(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) {
					const name = m[1];
					if (!DOUBLE_NAME.test(name)) continue;
					DOUBLE_NAME.lastIndex = 0;
					const key = name.toLowerCase();
					if (!found.has(key)) found.set(key, []);
					found.get(key).push({ pkg, file: path.relative(REPO, file) });
				}
			}
		}
	}

	if (found.size === 0) return;

	const all = [...found.entries()].flatMap(([, sites]) => sites);
	console.log(`테스트 더블 후보 ${all.length}건 (testkit 밖) — 새로 추가하기 전에 이 목록에서 비슷한 게 있는지 눈으로 확인하라`);
	for (const [name, sites] of found) {
		const pkgs = new Set(sites.map((s) => s.pkg));
		for (const s of sites) console.log(`  · ${name}  [${s.pkg}] ${s.file}`);
		if (pkgs.size > 1) {
			add('error', '(전역)', '테스트더블중복', `"${name}"이 ${[...pkgs].join(', ')}에 각각 있다 — 같은 이름이 두 패키지에 나타나면 testkit으로 올릴 후보다`);
		}
	}
	console.log();
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

// 중복 탐지는 전체 패키지를 봐야 의미가 있다 — 특정 패키지만 감사 대상이어도 비교군은 전부다.
auditTestDoubleDuplication(packages);

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
	// 반출 안전은 예외 없이 모든 패키지에 적용한다 — 도구 패키지에도 실제 식별자가 들어갈 이유가 없다.
	auditExportSafety(pkg, root);
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

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

function listMd(dir) {
	try {
		return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
	} catch {
		return [];
	}
}

// ── 규약 1: 문서화 ──────────────────────────────────────────────────────────
function auditDocs(pkg, root) {
	const docs = path.join(root, 'docs');
	const files = listMd(docs);

	if (files.length === 0) {
		add('error', pkg, '규약1', 'docs/에 마크다운이 없다');
		return;
	}
	if (!files.includes('00-overview.md')) {
		add('error', pkg, '규약1', 'docs/00-overview.md가 없다 — 로드맵 진입점이 필요하다');
	}
	if (!files.includes('99-references.md')) {
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

// ── 규약 2: 문제와 정답 ────────────────────────────────────────────────────
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

	// 번호 1:1 대응
	const qNums = [...q.matchAll(/^\*\*(\d+-\d+)\.\*\*/gm)].map((m) => m[1]);
	const aNums = [...a.matchAll(/^##\s+(\d+-\d+)/gm)].map((m) => m[1]);
	const missing = qNums.filter((n) => !aNums.includes(n));
	const extra = aNums.filter((n) => !qNums.includes(n));
	if (missing.length) {
		add('error', pkg, '규약2', `93에 정답 없는 문항: ${missing.join(', ')}`);
	}
	if (extra.length) {
		add('error', pkg, '규약2', `92에 문항 없는 정답: ${extra.join(', ')}`);
	}

	// 93의 각 항목에 되짚기
	const sections = a.split(/^##\s+/m).slice(1);
	const noPointer = sections
		.filter((s) => !/📍 되짚기/.test(s))
		.map((s) => s.split(/\s/)[0]);
	if (noPointer.length) {
		add('warn', pkg, '규약2', `93에 되짚기 없는 항목: ${noPointer.join(', ')}`);
	}

	// 상호 링크
	if (!/93-solutions\.md/.test(q)) add('warn', pkg, '규약2', '92가 93을 링크하지 않는다');
	if (!/92-workbook\.md/.test(a)) add('warn', pkg, '규약2', '93이 92를 링크하지 않는다');
}

// ── 규약 2: 코딩 문제 — 한 파일 한 문제 + solutions 미러 ───────────────────
function auditCoding(pkg, root) {
	const srcDir = path.join(root, 'src');
	const solDir = path.join(root, 'solutions');
	if (!fs.existsSync(srcDir)) return;

	const isAssignment = (f) => /^\d+-\d+-.+\.ts$/.test(f);
	const src = fs.existsSync(srcDir) ? fs.readdirSync(srcDir).filter(isAssignment).sort() : [];
	const sol = fs.existsSync(solDir) ? fs.readdirSync(solDir).filter(isAssignment).sort() : [];

	if (src.length === 0) return; // 코딩 과제 없는 패키지

	// 미러 대응
	for (const f of src) {
		if (!sol.includes(f)) {
			add('error', pkg, '규약2', `solutions/${f}가 없다 — 문제와 같은 파일명으로 테스트를 둔다`);
		}
	}
	for (const f of sol) {
		if (!src.includes(f)) {
			add('error', pkg, '규약2', `src/${f}가 없다 — 정답만 있고 문제가 없다`);
		}
	}

	// 문제 파일: 한 파일 한 문제 + TODO 스켈레톤
	for (const f of src) {
		const body = readIf(path.join(srcDir, f)) ?? '';
		const nums = new Set([...body.matchAll(/과제\s+(\d+-\d+)/g)].map((m) => m[1]));
		if (nums.size > 1) {
			add('error', pkg, '규약2', `src/${f}에 과제 ${[...nums].join(', ')} — 한 파일에 한 문제만`);
		}
		if (!/🎯 TODO/.test(body)) {
			add('warn', pkg, '규약2', `src/${f}에 🎯 TODO가 없다 — 채울 지점이 표시되지 않았다`);
		}
		if (!/throw new Error\('TODO/.test(body)) {
			add('warn', pkg, '규약2', `src/${f}가 throw로 시작하지 않는다 — 채우기 전에 테스트가 통과할 수 있다`);
		}
		if (!/성공 기준/.test(body)) {
			add('warn', pkg, '규약2', `src/${f}에 성공 기준이 없다 — 테스트와 1:1 대응을 확인할 수 없다`);
		}
	}

	// 정답 파일: 테스트여야 한다
	for (const f of sol) {
		const body = readIf(path.join(solDir, f)) ?? '';
		if (!/check\(/.test(body)) {
			add('error', pkg, '규약2', `solutions/${f}가 테스트가 아니다 — 정답은 참고 구현이 아니라 테스트`);
		}
		if (!/📍 되짚기/.test(body)) {
			add('warn', pkg, '규약2', `solutions/${f}에 되짚기 주석이 없다`);
		}
		if (/from ['"]\.\.\/src\//.test(body) === false) {
			add('warn', pkg, '규약2', `solutions/${f}가 src/를 import하지 않는다 — 학습자 구현을 판정하지 못한다`);
		}
		// 테스트 프레임워크 의존 금지
		for (const dep of ['vitest', 'jest', '@jest/globals', 'mocha']) {
			if (new RegExp(`from ['"]${dep}`).test(body)) {
				add('error', pkg, '규약3', `solutions/${f}가 ${dep}에 의존한다 — tsx 외 의존성을 두지 않는다`);
			}
		}
	}

	// package.json 스크립트 대응
	const pj = readIf(path.join(root, 'package.json'));
	if (pj) {
		const scripts = JSON.parse(pj).scripts ?? {};
		for (const f of src) {
			const num = f.match(/^(\d+-\d+)/)[1];
			if (!scripts[`test:${num}`]) {
				add('error', pkg, '규약5', `package.json에 test:${num} 스크립트가 없다`);
			}
		}
		if (!scripts.test) add('warn', pkg, '규약5', 'package.json에 test 스크립트가 없다');
		if (!scripts.typecheck) add('warn', pkg, '규약5', 'package.json에 typecheck 스크립트가 없다');
	}
}

// ── 규약 5: 패키지 설정 ────────────────────────────────────────────────────
function auditPackageSetup(pkg, root) {
	const pj = readIf(path.join(root, 'package.json'));
	if (!pj) {
		add('error', pkg, '규약5', 'package.json이 없다 — 워크스페이스가 인식하지 못한다');
		return;
	}
	const j = JSON.parse(pj);
	if (j.name !== pkg) {
		add('warn', pkg, '규약5', `package.json name("${j.name}")이 디렉토리명과 다르다`);
	}
	if (j.type !== 'module') {
		add('warn', pkg, '규약5', 'type: "module"이 아니다 — ESM import가 깨진다');
	}

	const ts = readIf(path.join(root, 'tsconfig.json'));
	if (!ts) {
		add('error', pkg, '규약5', 'tsconfig.json이 없다');
	} else if (!/tsconfig\.base\.json/.test(ts)) {
		add('warn', pkg, '규약5', 'tsconfig.json이 ../../tsconfig.base.json을 상속하지 않는다');
	}

	// README 현재 패키지 표에 등재
	const readme = readIf(path.join(REPO, 'README.md')) ?? '';
	if (!new RegExp('`' + pkg + '`').test(readme)) {
		add('warn', pkg, '규약5', 'README.md "현재 패키지" 표에 없다');
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
			add(
				'warn',
				'(repo)',
				'규약4',
				`브랜치 "${b}"가 sol/{패키지}/{과제} 3단 형식이 아니다`,
			);
			continue;
		}
		const pkg = parts[1];
		if (!packages.includes(pkg)) {
			add('warn', '(repo)', '규약4', `브랜치 "${b}"의 패키지 "${pkg}"가 존재하지 않는다`);
		}
	}

	// 풀이가 main에 머지됐는지 — main에 TODO가 사라진 과제가 있으면 의심
	for (const pkg of packages) {
		const srcDir = path.join(REPO, 'packages', pkg, 'src');
		if (!fs.existsSync(srcDir)) continue;
		const filled = fs
			.readdirSync(srcDir)
			.filter((f) => /^\d+-\d+-.+\.ts$/.test(f))
			.filter((f) => {
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

for (const pkg of targets) {
	const root = path.join(pkgRoot, pkg);
	auditDocs(pkg, root);
	auditWorkbook(pkg, root);
	auditCoding(pkg, root);
	auditPackageSetup(pkg, root);
}
if (!target) auditBranches(packages);

// ── 보고 ───────────────────────────────────────────────────────────────────
const errors = findings.filter((f) => f.severity === 'error');
const warns = findings.filter((f) => f.severity === 'warn');

if (findings.length === 0) {
	console.log(`✓ 규약 위반 없음 (검사: ${targets.join(', ')})`);
	process.exit(0);
}

for (const group of [
	['error', '위반', errors],
	['warn', '주의', warns],
]) {
	const [, label, list] = group;
	if (list.length === 0) continue;
	console.log(`\n${label} ${list.length}건`);
	for (const f of list) {
		console.log(`  ${f.severity === 'error' ? '✗' : '△'} [${f.pkg}/${f.rule}] ${f.detail}`);
	}
}

console.log(`\n위반 ${errors.length} · 주의 ${warns.length}`);
console.log('규약 원문: README.md');
process.exit(errors.length > 0 ? 1 : 0);

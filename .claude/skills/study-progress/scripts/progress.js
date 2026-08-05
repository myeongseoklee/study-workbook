#!/usr/bin/env node
/**
 * 학습 기록 — 진도를 `study-log` 브랜치에 남기고, 코딩 과제는 실제로 판정한다.
 *
 * ## 왜 별도 브랜치인가
 *
 * main은 **문제 상태**(스켈레톤·교재)를 보존한다(README 규약 4). 진도를 교재의
 * 체크박스에 적으면 교재가 개인 기록을 겸하게 되고, 재도전·초기화가 어려워지고,
 * 패키지를 떼어 공개할 때 남의 진도가 따라간다. 그래서 기록은 orphan 브랜치
 * `study-log`에 두고, main 이력과 섞지 않는다.
 *
 * 브랜치를 오갈 필요는 없다. `.study-log/`에 worktree로 상주시키므로 `sol/`
 * 브랜치에서 과제를 풀는 중에도 기록을 읽고 쓸 수 있다. 매번 stash·switch가
 * 필요하면 아무도 쓰지 않을 기능이 된다.
 *
 * ## 왜 "통과했다"는 말을 믿지 않는가
 *
 * `sol/` 브랜치가 있고 TODO가 사라졌다는 것은 통과의 증거가 아니다 — TODO만
 * 지우고 아무 값이나 반환해도 그렇게 보인다. 유일하게 믿을 만한 신호는 실제
 * 테스트 통과다. 그래서 상태에 `미확인`이 있고, `check`가 그것을 `통과`나
 * `막힘`으로 확정한다.
 *
 * 판정은 체크아웃 없이 한다. testkit의 `defineStudyConfig`가 `STUDY_TARGET`으로
 * 임의 디렉토리를 받고 `packages/*​/_probe/`가 이미 gitignore돼 있으므로,
 * `git show`로 풀이 파일만 뽑아 그 자리에 놓고 돌리면 된다. worktree를 새로
 * 만들거나 node_modules를 다시 설치할 필요가 없다.
 *
 * 사용:
 *   progress.js init                      기록 브랜치·worktree·기록 파일 준비 (멱등)
 *   progress.js status [패키지]            진도 요약 (읽기 전용, 테스트 안 돌림)
 *   progress.js mark <패키지> docs 00-03    문서 읽음 표시 (범위·부분일치·목록)
 *   progress.js mark <패키지> workbook 1    워크북 파트 표시
 *   progress.js check <패키지> [번호]       코딩 과제를 실제로 돌려 확정
 *   progress.js save ["메시지"]             기록 커밋 + push (--no-push로 생략)
 *   progress.js path [패키지]               기록 파일 경로 (에이전트가 직접 편집할 때)
 *
 * 공통 플래그: --undo (mark 해제) · --force (check가 기존 _probe를 덮음)
 *            --prune (init이 목록에 없는 옛 항목을 제거) · --no-push (save)
 *
 * 종료 코드는 **판정을 수행할 수 있었는지**다: 0 = 판정 완료(과제가 `막힘`이어도
 * 0이다 — 못 푼 것은 정상적인 학습 상태다), 1 = 판정 불가(파일·설정 문제).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../..');
const BRANCH = 'study-log';
const WT = path.join(REPO, '.study-log');
const TOOL_PACKAGES = new Set(['testkit']);
const TODAY = new Date().toISOString().slice(0, 10);

// 자동 관리하는 섹션의 제목. 이 셋만 스크립트가 건드리고, 나머지(오답 노트·메모)는
// 사람과 에이전트의 영역이다 — 서술형을 인자로 넘기려 하면 규격이 무너진다.
const SEC_DOCS = '## 문서 (읽음)';
const SEC_WORKBOOK = '## 워크북';
const SEC_ASSIGN = '## 코딩 과제';

// ── git 얇은 래퍼 ──────────────────────────────────────────────────────────
function git(args, cwd = REPO) {
	return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function gitOk(args, cwd = REPO) {
	try {
		git(args, cwd);
		return true;
	} catch {
		return false;
	}
}
function gitOut(args, cwd = REPO) {
	try {
		return git(args, cwd);
	} catch {
		return null;
	}
}
const branchExists = (name) => gitOk(`rev-parse --verify --quiet refs/heads/${name}`);

function die(msg) {
	console.error(`✗ ${msg}`);
	process.exit(1);
}

// ── 레포 스캔 ──────────────────────────────────────────────────────────────
function topicPackages() {
	const dir = path.join(REPO, 'packages');
	if (!fs.existsSync(dir)) die('packages/ 가 없다 — 레포 루트가 맞는지 확인하라');
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.isDirectory() && !TOOL_PACKAGES.has(e.name))
		.map((e) => e.name)
		.sort();
}

/**
 * docs/ 아래 마크다운을 상대 경로로 모은다. 회차가 늘어나는 시리즈는 `ep01-`
 * 같은 하위 폴더로 나뉘므로 한 단계는 내려간다(감사 스크립트와 같은 규칙).
 */
function listDocs(pkg) {
	const base = path.join(REPO, 'packages', pkg, 'docs');
	const out = [];
	const walk = (dir, prefix, depth) => {
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
			if (e.isFile() && e.name.endsWith('.md')) out.push(prefix + e.name);
			else if (e.isDirectory() && depth > 0) walk(path.join(dir, e.name), `${prefix}${e.name}/`, depth - 1);
		}
	};
	walk(base, '', 1);
	return out;
}

/**
 * 워크북 문제 파일의 `파트 N` 제목을 뽑아 항목으로 쓴다.
 *
 * 제목 수준이 패키지마다 다르다(`# 파트 1.` / `## 파트 1.`) — 규격이 아니라
 * 저작 시점의 차이다. 그래서 H1~H3를 모두 받는다. 파트 구조가 아예 없는
 * 구형 워크북은 파일 하나를 항목 하나로 잡는다: 0/0으로 두면 "워크북이 없다"와
 * "워크북이 있는데 진도가 0"이 화면에서 구별되지 않는다.
 */
function listWorkbookParts(pkg) {
	const dir = path.join(REPO, 'packages', pkg, 'workbook');
	let file;
	try {
		file = fs.readdirSync(dir).find((f) => f.startsWith('92'));
	} catch {
		return [];
	}
	if (!file) return [];
	const text = fs.readFileSync(path.join(dir, file), 'utf8');
	const parts = [];
	for (const line of text.split('\n')) {
		const m = line.match(/^#{1,3}\s*파트\s*(\d+)\.?\s*(.*)$/);
		if (m) parts.push({ key: `파트${m[1]}`, label: (m[2] || '').replace(/\s*\(.*$/, '').trim() });
	}
	return parts.length ? parts : [{ key: '워크북', label: '전체' }];
}

/**
 * 과제 목록. 과제 하나가 `tests/` 아래 폴더 하나다 (README § 규약 2).
 *
 * 폴더명은 `{문서번호}-{순번}-{slug}`이고, 회차 시리즈는 `e{회차}-` 접두가
 * 붙는다. 번호는 폴더명에서 뽑되 slug는 버린다 — 사용자가 `check … 03-01`처럼
 * 번호만으로 부르기 때문이다.
 */
const ASSIGN_DIR = /^((?:e\d+-)?\d+-\d+)-.+$/;

function listAssignments(pkg) {
	const dir = path.join(REPO, 'packages', pkg, 'tests');
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const nums = entries
		.filter((e) => e.isDirectory())
		.map((e) => e.name.match(ASSIGN_DIR))
		.filter(Boolean)
		.map((m) => m[1]);
	return [...new Set(nums)].sort(cmpNum);
}

/** 번호로 과제 폴더명을 찾는다 (slug를 몰라도 되게). */
function assignmentDir(pkg, num, kind = 'tests') {
	const dir = path.join(REPO, 'packages', pkg, kind);
	try {
		return (
			fs
				.readdirSync(dir, { withFileTypes: true })
				.find((e) => e.isDirectory() && e.name.startsWith(`${num}-`))?.name ?? null
		);
	} catch {
		return null;
	}
}

/** 그 과제의 선택 문제(extra-*) 개수. 진도의 필수 판정에는 쓰지 않는다. */
function countExtras(pkg, num) {
	const folder = assignmentDir(pkg, num, 'src');
	if (!folder) return 0;
	try {
		return fs
			.readdirSync(path.join(REPO, 'packages', pkg, 'src', folder))
			.filter((f) => /^extra-.+\.ts$/.test(f)).length;
	} catch {
		return 0;
	}
}

/** `e01-02-01` / `03-01` 모두 받는다. 회차가 있으면 그것이 최상위 정렬 키다. */
function cmpNum(a, b) {
	const parse = (s) => {
		const m = s.match(/^(?:e(\d+)-)?(\d+)-(\d+)$/);
		return m ? [Number(m[1] ?? 0), Number(m[2]), Number(m[3])] : [0, 0, 0];
	};
	const [ae, ad, ai] = parse(a);
	const [be, bd, bi] = parse(b);
	return ae - be || ad - bd || ai - bi;
}

// ── 기록 파일 (섹션 단위 읽기·쓰기) ─────────────────────────────────────────
const recordPath = (pkg) => path.join(WT, `${pkg}.md`);

/** `- [x] key  꼬리표` 한 줄에서 체크 상태와 키를 뽑는다. 키는 항상 단일 토큰이다. */
function parseItem(line) {
	const m = line.match(/^- \[([ xX])\]\s+(\S+)(.*)$/);
	if (!m) return null;
	return { done: m[1].toLowerCase() === 'x', key: m[2], tail: m[3] ?? '' };
}

/** 본문을 `## ` 기준으로 자른다. 첫 조각은 제목·머리말이다. */
function splitSections(text) {
	const lines = text.split('\n');
	const sections = [{ heading: null, lines: [] }];
	for (const line of lines) {
		if (line.startsWith('## ')) sections.push({ heading: line.trim(), lines: [] });
		else sections.at(-1).lines.push(line);
	}
	return sections;
}
const joinSections = (sections) =>
	sections.map((s) => (s.heading ? `${s.heading}\n${s.lines.join('\n')}` : s.lines.join('\n'))).join('\n');

function readRecord(pkg) {
	const p = recordPath(pkg);
	if (!fs.existsSync(p)) return null;
	return splitSections(fs.readFileSync(p, 'utf8'));
}
function writeRecord(pkg, sections) {
	fs.writeFileSync(recordPath(pkg), joinSections(sections));
}
const findSection = (sections, heading) => sections.find((s) => s.heading === heading);

/** 섹션 안의 체크 항목을 순서대로 준다. */
function sectionItems(sections, heading) {
	const sec = findSection(sections, heading);
	if (!sec) return [];
	return sec.lines.map(parseItem).filter(Boolean);
}

// ── init ───────────────────────────────────────────────────────────────────
function cmdInit(prune = false) {
	// ① orphan 브랜치. 체크아웃 곡예 대신 plumbing으로 빈 커밋을 만든다 —
	//    작업 트리를 건드리지 않으므로 지금 어느 브랜치에 있어도 안전하다.
	if (!branchExists(BRANCH)) {
		const emptyTree = git('hash-object -t tree /dev/null');
		const sha = git(`commit-tree ${emptyTree} -m "chore(study-log): 학습 기록 브랜치 시작"`);
		git(`update-ref refs/heads/${BRANCH} ${sha}`);
		console.log(`✓ ${BRANCH} 브랜치 생성 (orphan — main 이력과 무관)`);
	}

	// ② worktree 상주
	if (!fs.existsSync(path.join(WT, '.git'))) {
		if (fs.existsSync(WT) && fs.readdirSync(WT).length > 0) {
			die(`${WT} 가 이미 있고 worktree가 아니다 — 옮기거나 지운 뒤 다시 실행하라`);
		}
		git(`worktree add ${JSON.stringify(WT)} ${BRANCH}`);
		console.log(`✓ worktree 연결: .study-log/  (브랜치 전환 없이 기록 가능)`);
	}

	// ③ main의 .gitignore 확인. 여기서 고치지 않는다 — 추적 파일을 스크립트가
	//    조용히 바꾸면 커밋에 의도 없는 변경이 섞인다. 알리고 사람이 정한다.
	const gi = path.join(REPO, '.gitignore');
	const giText = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
	if (!/^\.study-log\/?$/m.test(giText)) {
		console.log('△ .gitignore에 `.study-log/` 가 없다 — 추가해야 worktree가 main에 잡히지 않는다');
	}

	// ④ 기록 파일 스캐폴딩 + 동기화(새 문서·과제가 생기면 항목만 덧붙인다)
	if (!fs.existsSync(path.join(WT, 'README.md'))) {
		fs.writeFileSync(path.join(WT, 'README.md'), worktreeReadme());
	}
	let created = 0;
	let added = 0;
	const orphans = [];
	for (const pkg of topicPackages()) {
		const existed = fs.existsSync(recordPath(pkg));
		if (!existed) {
			fs.writeFileSync(recordPath(pkg), scaffoldRecord(pkg));
			created++;
		} else {
			added += syncRecord(pkg);
			orphans.push(...pruneOrphans(pkg, prune).map((k) => `${pkg}/${k}`));
		}
	}
	console.log(`✓ 기록 파일 ${created}개 생성 · 항목 ${added}개 추가`);
	if (orphans.length) {
		// 과제·문서가 이름을 바꾸거나 사라지면 옛 항목이 남는다. 조용히 지우면
		// 통과 기록이 함께 날아가므로 기본은 알리기만 하고, --prune일 때만 지운다.
		console.log(
			prune
				? `✓ 목록에 없는 항목 ${orphans.length}개 제거: ${orphans.join(', ')}`
				: `△ 목록에 없는 항목 ${orphans.length}개: ${orphans.join(', ')}\n` +
						'  이름이 바뀐 과제라면 기록을 새 항목으로 옮긴 뒤 --prune으로 지운다',
		);
	}
	console.log(`\n기록 위치: ${WT}`);
	console.log('다음: progress.js status');
}

function worktreeReadme() {
	return `# 학습 기록 (study-log 브랜치)

이 브랜치는 **진도와 학습 결과만** 담는다. 교재와 문제(스켈레톤)는 \`main\`에 있고,
풀이는 \`sol/{패키지}/{과제번호}\` 브랜치에 있다. 셋을 섞지 않는 이유:

- main은 **문제 상태**를 보존해야 재도전이 가능하고, 패키지를 떼어 공개할 때 깨끗하다
- 진도는 개인적이고 자주 바뀐다 — 교재 이력에 섞이면 교재의 변경 이력이 안 보인다
- 그래서 이 브랜치는 orphan이다. \`git log study-log\`가 학습 이력만 보여준다

## 파일

- \`{패키지}.md\` — 패키지 하나의 학습 기록

각 파일의 네 섹션 중 앞의 셋(문서·워크북·코딩 과제)은 **\`progress.js\`가 관리**한다.
직접 고쳐도 되지만 서식이 흔들리면 집계가 어긋난다. 뒤의 둘(오답 노트·메모)은
**사람과 에이전트의 영역**이다 — 자유롭게 쓴다.

## 조작

\`\`\`bash
S=.claude/skills/study-progress/scripts/progress.js
node $S status                        # 진도 요약
node $S mark mcp-protocol docs 00-03  # 문서 읽음
node $S check mcp-protocol 3-1        # 과제를 실제로 돌려 확정
node $S save "오늘 한 것"              # 커밋 + push
\`\`\`

자연어로 하려면 \`study-progress\` 스킬을 쓴다 — "MCP 3장까지 읽었어" 같은 말을
위 명령으로 옮겨준다.
`;
}

function scaffoldRecord(pkg) {
	const docs = listDocs(pkg);
	const parts = listWorkbookParts(pkg);
	const nums = listAssignments(pkg);

	const docLines = docs.length ? docs.map((d) => `- [ ] ${d}`).join('\n') : '(문서 없음)';
	const partLines = parts.length
		? parts.map((p) => `- [ ] ${p.key}${p.label ? ` — ${p.label}` : ''}`).join('\n')
		: '(워크북 없음)';
	const numLines = nums.length ? nums.map((n) => `- [ ] ${n}  미확정`).join('\n') : '(과제 없음)';

	return `# ${pkg} 학습 기록

> 앞의 세 섹션은 \`progress.js\`가 관리한다. 오답 노트와 메모는 자유롭게 쓴다.
> 코딩 과제의 \`통과\`는 \`check\`가 실제 테스트를 돌려서만 붙인다.

${SEC_DOCS}

${docLines}

${SEC_WORKBOOK}

${partLines}

${SEC_ASSIGN}

${numLines}

## 오답 노트

| 문항 | 내가 쓴 답 | 정답 | 왜 틀렸나 (지식 부족 / 오해 / 부주의) | 재확인 |
|---|---|---|---|---|
|  |  |  |  |  |

## 메모

`;
}

/**
 * 지금 목록에 없는 항목(이름이 바뀌거나 삭제된 문서·과제)을 찾는다.
 * `prune`이면 실제로 지우고, 아니면 키만 돌려준다.
 */
function pruneOrphans(pkg, prune) {
	const sections = readRecord(pkg);
	if (!sections) return [];
	const wanted = {
		[SEC_DOCS]: new Set(listDocs(pkg)),
		[SEC_WORKBOOK]: new Set(listWorkbookParts(pkg).map((p) => p.key)),
		[SEC_ASSIGN]: new Set(listAssignments(pkg)),
	};
	const found = [];
	let changed = false;
	for (const [heading, keys] of Object.entries(wanted)) {
		const sec = findSection(sections, heading);
		if (!sec || keys.size === 0) continue; // 목록을 못 읽었으면 손대지 않는다
		const keep = [];
		for (const line of sec.lines) {
			const item = parseItem(line);
			if (item && !keys.has(item.key)) {
				found.push(item.key);
				if (prune) {
					changed = true;
					continue;
				}
			}
			keep.push(line);
		}
		sec.lines = keep;
	}
	if (changed) writeRecord(pkg, sections);
	return found;
}

/** 새로 생긴 문서·파트·과제를 기존 기록에 덧붙인다. 기존 체크 상태는 보존한다. */
function syncRecord(pkg) {
	const sections = readRecord(pkg);
	if (!sections) return 0;
	let added = 0;

	const ensure = (heading, wanted) => {
		const sec = findSection(sections, heading);
		if (!sec) return;
		const have = new Set(sectionItems(sections, heading).map((i) => i.key));
		const missing = wanted.filter((w) => !have.has(w.key));
		if (!missing.length) return;
		// 플레이스홀더("(문서 없음)")가 있으면 치운다
		const placeholder = sec.lines.findIndex((l) => /^\(.*없음\)$/.test(l.trim()));
		if (placeholder !== -1) sec.lines.splice(placeholder, 1);
		// 섹션 끝의 빈 줄 앞에 삽입
		let at = sec.lines.length;
		while (at > 0 && sec.lines[at - 1].trim() === '') at--;
		sec.lines.splice(at, 0, ...missing.map((m) => m.line));
		added += missing.length;
	};

	ensure(
		SEC_DOCS,
		listDocs(pkg).map((d) => ({ key: d, line: `- [ ] ${d}` })),
	);
	ensure(
		SEC_WORKBOOK,
		listWorkbookParts(pkg).map((p) => ({
			key: p.key,
			line: `- [ ] ${p.key}${p.label ? ` — ${p.label}` : ''}`,
		})),
	);
	ensure(
		SEC_ASSIGN,
		listAssignments(pkg).map((n) => ({ key: n, line: `- [ ] ${n}  미확정` })),
	);

	if (added) writeRecord(pkg, sections);
	return added;
}

// ── mark ───────────────────────────────────────────────────────────────────
/**
 * 패턴 매칭에는 두 모드가 있다.
 *   범위  `00-03` → 키의 앞 숫자가 0..3인 것 (문서 여러 장을 한 번에)
 *   부분  `mrtr`  → 키에 그 문자열이 있는 것
 * 범위 문법이 있는 이유는 "3장까지 읽었어"가 가장 흔한 기록 단위라서다.
 */
function matchKey(key, pattern) {
	const range = pattern.match(/^(\d+)-(\d+)$/);
	if (range) {
		const [lo, hi] = [Number(range[1]), Number(range[2])];
		if (lo <= hi) {
			const n = key.match(/(\d+)/);
			return n ? Number(n[1]) >= lo && Number(n[1]) <= hi : false;
		}
	}
	return key.toLowerCase().includes(pattern.toLowerCase());
}

function cmdMark(pkg, kind, patterns, undo) {
	if (!pkg || !kind || !patterns.length) die('사용: mark <패키지> <docs|workbook> <패턴...> [--undo]');
	const heading = kind === 'docs' ? SEC_DOCS : kind === 'workbook' ? SEC_WORKBOOK : null;
	if (!heading) die(`mark의 대상은 docs 또는 workbook이다 (받은 값: ${kind})`);
	const sections = readRecord(pkg);
	if (!sections) die(`${pkg} 기록 파일이 없다 — 먼저 init을 실행하라`);

	const sec = findSection(sections, heading);
	if (!sec) die(`${pkg} 기록에 "${heading}" 섹션이 없다`);

	const changed = [];
	sec.lines = sec.lines.map((line) => {
		const item = parseItem(line);
		if (!item) return line;
		if (!patterns.some((p) => matchKey(item.key, p))) return line;
		const want = !undo;
		if (item.done === want) return line;
		changed.push(item.key);
		return `- [${want ? 'x' : ' '}] ${item.key}${item.tail}`;
	});

	if (!changed.length) {
		console.log(`변경 없음 — 매칭된 항목이 없거나 이미 ${undo ? '해제' : '표시'}됨`);
		return;
	}
	writeRecord(pkg, sections);
	const items = sectionItems(sections, heading);
	const done = items.filter((i) => i.done).length;
	console.log(`✓ ${pkg} / ${kind} ${undo ? '해제' : '표시'} ${changed.length}개: ${changed.join(', ')}`);
	console.log(`  현재 ${done}/${items.length}`);
}

// ── check (실제 판정) ───────────────────────────────────────────────────────
function cmdCheck(pkg, num, force) {
	if (!pkg) die('사용: check <패키지> [과제번호]');
	const nums = num ? [num] : listAssignments(pkg);
	if (!nums.length) die(`${pkg}에 과제가 없다`);
	let failed = 0;
	for (const n of nums) failed += checkOne(pkg, n, force) ? 0 : 1;
	process.exit(failed > 0 ? 1 : 0);
}

function checkOne(pkg, num, force) {
	const pkgDir = path.join(REPO, 'packages', pkg);
	const folder = assignmentDir(pkg, num, 'src');
	if (!folder) {
		console.log(`${pkg} ${num}  ✗ src/${num}-*/ 를 찾을 수 없다`);
		return false;
	}

	const branch = `sol/${pkg}/${num}`;
	if (!branchExists(branch)) {
		console.log(`${pkg} ${num}  · 미시작 (${branch} 브랜치가 없다)`);
		return true; // 아직 안 푼 것은 실패가 아니다
	}

	const probeDir = path.join(pkgDir, '_probe');
	if (fs.existsSync(probeDir) && !force) {
		die(`${pkg}/_probe/ 가 이미 있다 — 다른 검증이 쓰는 중일 수 있다. 확인 후 --force`);
	}

	let result;
	try {
		// 체크아웃 없이 그 브랜치의 풀이 폴더를 통째로 뽑아 놓는다. index만
		// 필요하지만 extra까지 함께 꺼내는 이유는, 선택 문제를 푼 사람의 index가
		// 같은 폴더의 extra를 import할 수 있어서다.
		fs.mkdirSync(path.join(probeDir, folder), { recursive: true });
		const listing = gitOut(`ls-tree --name-only ${branch}:packages/${pkg}/src/${folder}`);
		if (listing === null) {
			// main의 배치가 바뀌었는데 풀이 브랜치가 옛 구조로 남아 있는 경우다.
			// 판정을 못 하는 것이지 풀이가 틀린 게 아니므로, 무엇을 해야 하는지 알린다.
			console.log(
				`${pkg} ${num}  △ ${branch}에 src/${folder}/ 가 없다 — 그 브랜치가 옛 배치를 담고 있다.\n` +
					`             풀이를 새 구조(src/${folder}/index.ts)로 옮긴 뒤 다시 check하라.`,
			);
			return true;
		}
		const files = listing.split('\n').filter((f) => f.endsWith('.ts'));
		if (files.length === 0) die(`${branch}의 src/${folder}/ 에 .ts 파일이 없다`);
		for (const f of files) {
			const body = git(`show ${branch}:packages/${pkg}/src/${folder}/${f}`);
			fs.writeFileSync(path.join(probeDir, folder, f), `${body}\n`);
		}
		// 필터는 vitest의 경로 부분 일치다. 번호(`02-01`)만 주면 그 폴더의 extra까지
		// 함께 걸리고, `${num}/index`는 실제 경로(`02-01-agent-loop/index.test.ts`)와
		// 어긋난다. 폴더명을 그대로 써야 필수 문제 하나만 판정한다.
		result = runVitest(pkgDir, `${folder}/index`);
	} finally {
		fs.rmSync(probeDir, { recursive: true, force: true });
	}

	const total = result.passed + result.failed;
	if (total === 0) {
		console.log(`${pkg} ${num}  ✗ 실행된 테스트가 0개 — 번호·파일명을 확인하라`);
		return false;
	}
	const ok = result.failed === 0;
	const label = ok ? `통과 (${result.passed}/${total})` : `막힘 (${result.failed}/${total} 실패)`;
	console.log(`${pkg} ${num}  ${ok ? '✓' : '✗'} ${label}`);
	recordAssignment(pkg, num, ok, label);
	return true;
}

function runVitest(pkgDir, num) {
	let raw = '';
	try {
		raw = execSync(`pnpm exec vitest run ${num} --reporter=json`, {
			cwd: pkgDir,
			encoding: 'utf8',
			env: { ...process.env, STUDY_TARGET: '_probe' },
			stdio: ['ignore', 'pipe', 'ignore'],
		});
	} catch (e) {
		// 테스트 실패는 종료 코드가 0이 아니다 — 그래도 stdout에 JSON이 있다.
		raw = e.stdout?.toString() ?? '';
	}
	const start = raw.indexOf('{');
	if (start === -1) return { passed: 0, failed: 0 };
	try {
		const r = JSON.parse(raw.slice(start));
		return { passed: r.numPassedTests ?? 0, failed: r.numFailedTests ?? 0 };
	} catch {
		return { passed: 0, failed: 0 };
	}
}

/** 과제 줄을 확정 결과로 갱신한다. 이 줄만이 "통과"의 근거다. */
function recordAssignment(pkg, num, ok, label) {
	const sections = readRecord(pkg);
	if (!sections) return;
	const sec = findSection(sections, SEC_ASSIGN);
	if (!sec) return;
	let hit = false;
	sec.lines = sec.lines.map((line) => {
		const item = parseItem(line);
		if (!item || item.key !== num) return line;
		hit = true;
		return `- [${ok ? 'x' : ' '}] ${num}  ${label} · ${TODAY}`;
	});
	if (!hit) {
		let at = sec.lines.length;
		while (at > 0 && sec.lines[at - 1].trim() === '') at--;
		sec.lines.splice(at, 0, `- [${ok ? 'x' : ' '}] ${num}  ${label} · ${TODAY}`);
	}
	writeRecord(pkg, sections);
}

// ── status ─────────────────────────────────────────────────────────────────
/**
 * 무료 신호(브랜치 유무·TODO 잔존)로 아직 확정 안 된 과제의 상태를 추정한다.
 * 필수 문제(`index.ts`)만 본다 — 진도의 완료 판정은 index가 기준이다.
 */
function inferAssignment(pkg, num) {
	const branch = `sol/${pkg}/${num}`;
	if (!branchExists(branch)) return '미시작';
	const folder = assignmentDir(pkg, num, 'src');
	if (!folder) return '진행중';
	const body = gitOut(`show ${branch}:packages/${pkg}/src/${folder}/index.ts`);
	if (body === null) return '진행중';
	return /🎯 TODO|TODO:/.test(body) ? '진행중' : '미확인';
}

function cmdStatus(filter) {
	if (!fs.existsSync(path.join(WT, '.git'))) {
		console.log('기록 브랜치가 아직 없다 — progress.js init 을 먼저 실행하라');
		return;
	}
	const pkgs = topicPackages().filter((p) => !filter || p.includes(filter));
	if (!pkgs.length) die(`패키지를 찾을 수 없다: ${filter}`);

	console.log(`학습 기록 · ${BRANCH} 브랜치 (.study-log/)\n`);
	for (const pkg of pkgs) {
		const sections = readRecord(pkg);
		if (!sections) {
			console.log(`${pkg.padEnd(26)} 기록 없음 — init 재실행`);
			continue;
		}
		const docs = sectionItems(sections, SEC_DOCS);
		const parts = sectionItems(sections, SEC_WORKBOOK);
		const recorded = new Map(
			sectionItems(sections, SEC_ASSIGN).map((i) => [i.key, i.tail.trim()]),
		);

		const tally = { 통과: 0, 막힘: 0, 미확인: 0, 진행중: 0, 미시작: 0 };
		let extras = 0;
		for (const num of listAssignments(pkg)) {
			extras += countExtras(pkg, num);
			const tail = recorded.get(num) ?? '';
			if (tail.startsWith('통과')) tally.통과++;
			else if (tail.startsWith('막힘')) tally.막힘++;
			else tally[inferAssignment(pkg, num)]++;
		}
		const total = Object.values(tally).reduce((a, b) => a + b, 0);
		const detail = Object.entries(tally)
			.filter(([, v]) => v > 0)
			.map(([k, v]) => `${k} ${v}`)
			.join(' · ');

		console.log(
			`${pkg.padEnd(26)} 문서 ${String(docs.filter((d) => d.done).length).padStart(2)}/${String(docs.length).padEnd(2)}` +
				` · 워크북 ${parts.filter((p) => p.done).length}/${parts.length}` +
				` · 과제 ${tally.통과}/${total}${extras ? ` (+선택 ${extras})` : ''}` +
				`${detail ? `  (${detail})` : ''}`,
		);
	}
	const dirty = gitOut('status --porcelain', WT);
	console.log(dirty ? '\n△ 저장하지 않은 기록이 있다 — progress.js save' : '');
}

// ── save ───────────────────────────────────────────────────────────────────
function cmdSave(message, push) {
	if (!fs.existsSync(path.join(WT, '.git'))) die('기록 브랜치가 없다 — init을 먼저 실행하라');
	if (!gitOut('status --porcelain', WT)) {
		console.log('변경된 기록이 없다');
		return;
	}
	git('add -A', WT);
	const msg = message || `study(log): 진도 갱신 ${TODAY}`;
	execSync(`git commit -q -F -`, { cwd: WT, input: `${msg}\n`, encoding: 'utf8' });
	console.log(`✓ 커밋: ${git('log --oneline -1', WT)}`);

	if (!push) {
		console.log('  (push 생략 — --no-push)');
		return;
	}
	const hasUpstream = gitOk(`rev-parse --abbrev-ref ${BRANCH}@{upstream}`, WT);
	try {
		git(hasUpstream ? 'push' : `push -u origin ${BRANCH}`, WT);
		console.log(`✓ push: origin/${BRANCH}`);
	} catch (e) {
		console.log(`△ push 실패 — 커밋은 남아 있다. 네트워크·권한 확인 후 다시 save`);
		console.log(`  ${String(e.stderr ?? e.message).trim().split('\n').slice(-1)[0]}`);
	}
}

// ── path ───────────────────────────────────────────────────────────────────
function cmdPath(pkg) {
	if (!pkg) {
		console.log(WT);
		return;
	}
	const p = recordPath(pkg);
	if (!fs.existsSync(p)) die(`${pkg} 기록 파일이 없다 — init을 먼저 실행하라`);
	console.log(p);
}

// ── 진입점 ─────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const args = argv.filter((a) => !a.startsWith('--'));
const [cmd, ...rest] = args;

if (flags.has('--help') || cmd === 'help') {
	// 파일 머리의 주석 블록이 곧 사용법이다 — 두 곳에 적으면 어긋난다.
	const head = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0];
	console.log(
		head
			.replace(/^#!.*\n/, '')
			.replace(/^\/\*\*\n/, '')
			.replace(/^ \* ?/gm, '')
			.trim(),
	);
	process.exit(0);
}

switch (cmd) {
	case 'init':
		cmdInit(flags.has('--prune'));
		break;
	case undefined:
	case 'status':
		cmdStatus(rest[0]);
		break;
	case 'mark':
		cmdMark(rest[0], rest[1], rest.slice(2), flags.has('--undo'));
		break;
	case 'check':
		cmdCheck(rest[0], rest[1], flags.has('--force'));
		break;
	case 'save':
		cmdSave(rest.join(' '), !flags.has('--no-push'));
		break;
	case 'path':
		cmdPath(rest[0]);
		break;
	default:
		die(`모르는 명령: ${cmd}  (init / status / mark / check / save / path)`);
}

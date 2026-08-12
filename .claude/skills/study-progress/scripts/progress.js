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
 * ## 왜 풀이도 worktree에서 하는가
 *
 * 같은 이유가 풀이에도 적용된다. `git switch sol/…`로 푸는 구조에서는 워킹트리가
 * 하나뿐이라 셋이 서로를 밀어낸다 — main에서 교재를 보거나 자료를 고치는 작업,
 * 과제 풀이, 그리고 에이전트가 무언가 확인하려고 브랜치를 바꾸는 일. 어느 하나가
 * 브랜치를 점유하면 나머지는 stash를 거쳐야 하고, 과제 두 개를 동시에 열어 둘 수도
 * 없다.
 *
 * 그래서 `start`가 `.sol/{패키지}/{번호}/`에 worktree를 연다. main은 항상 교재
 * 상태로 남고, 풀이는 자기 디렉토리에서 평범하게 커밋된다 — 중간 저장이 그대로
 * 되므로 "다 풀기 전에는 git에 아무것도 없는" 상태가 생기지 않는다.
 *
 * 대가는 worktree마다 `pnpm install`이 필요하다는 것이다(pnpm은 store 하드링크라
 * 디스크는 거의 안 먹는다). 다 풀면 `done`으로 worktree만 걷어낸다 — 브랜치와
 * 커밋은 남으므로 나중에 다시 열 수 있다.
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
 * ## 왜 기록에 지문을 박는가
 *
 * `[x] 통과`는 **어떤 명세와 어떤 풀이로** 통과했는지까지 말해야 뜻이 있다. main의
 * 명세가 나중에 바뀌면 그 체크는 과거의 사실일 뿐인데, 화면에서는 현재의 사실처럼
 * 보인다. 실제로 그런 일이 있었다 — 명세에서 검사 두 개가 빠졌는데 기록은 옛
 * 개수(6/6)를 그대로 달고 있었다. 그때는 우연히 여전히 통과했지만, 명세가
 * 강화되는 방향이었다면 거짓 통과가 조용히 남았을 것이다.
 *
 * 그래서 판정에 들어간 두 입력의 지문을 함께 적는다: `spec:`(main의 테스트 파일
 * 내용)과 `sol:`(풀이 브랜치의 커밋). 문서·워크북은 읽은 시점의 본문 지문이다.
 * `status`가 매번 대조해 어긋난 것을 `⚠`로 세운다. **표시만 하고 체크를 지우지는
 * 않는다** — 판정 없이 통과를 취소하는 것도 똑같이 근거 없는 기록이기 때문이다.
 * 지우는 것은 `check`(과제)와 사람(문서)의 몫이다.
 *
 * 지문은 커밋 이력이 아니라 **내용**을 해싱한다. rebase·amend로 SHA가 바뀌어도
 * 내용이 같으면 유효하고, 커밋하지 않은 수정도 잡힌다.
 *
 * 사용:
 *   progress.js init                      기록 브랜치·worktree·기록 파일 준비 (멱등)
 *   progress.js status [패키지]            진도 요약 + 지문 대조 (테스트는 안 돌림)
 *   progress.js mark <패키지> docs 00-03    문서 읽음 표시 (범위·부분일치·목록)
 *   progress.js mark <패키지> workbook 1    워크북 파트 표시
 *   progress.js start <패키지> <번호>       풀이 worktree 열기 (.sol/ · 브랜치 전환 없음)
 *   progress.js check <패키지> [번호]       코딩 과제를 실제로 돌려 확정
 *   progress.js check <패키지> 03-01/extra-1-graph-router   선택 문제 하나
 *   progress.js check --stale [패키지]      지문이 어긋난 과제만 재검증
 *   progress.js done <패키지> <번호>        풀이 worktree 정리 (브랜치·커밋은 남는다)
 *   progress.js sync-sol [패키지] [번호]    풀이 브랜치에 main 반영 (체크아웃 없음)
 *   progress.js save ["메시지"]             기록 커밋 + push (--no-push로 생략)
 *   progress.js path [패키지]               기록 파일 경로 (에이전트가 직접 편집할 때)
 *
 * 공통 플래그: --undo (mark 해제) · --force (check가 기존 _probe를 덮음,
 *            done이 저장 안 한 변경을 버림) · --extras (check가 선택 문제까지 판정)
 *            --stale (어긋난 것만) · --prune (init이 목록에 없는 옛 항목을 제거)
 *            --no-push (save) · --no-install (start가 의존성 설치를 건너뜀)
 *
 * 종료 코드는 **판정을 수행할 수 있었는지**다: 0 = 판정 완료(과제가 `막힘`이어도
 * 0이다 — 못 푼 것은 정상적인 학습 상태다), 1 = 판정 불가(파일·설정 문제).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../..');
const BRANCH = 'study-log';
const WT = path.join(REPO, '.study-log');
const SOL_ROOT = path.join(REPO, '.sol'); // 풀이 worktree들이 사는 곳
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
 * 워크북 **문제** 파일들. 정답 파일은 진도 항목이 아니다.
 *
 * 파일명 규약이 둘을 가른다 — `92-workbook.md` / `93-solutions.md`. 회차별로
 * 성격이 다른 워크북이 생기면 파일이 늘어난다(`94-workbook-ep03.md`).
 * 번호로 92만 집으면 나중 회차의 워크북이 진도에서 통째로 빠진다.
 */
function workbookFiles(pkg) {
	try {
		return fs
			.readdirSync(path.join(REPO, 'packages', pkg, 'workbook'))
			.filter((f) => f.endsWith('.md') && /workbook/i.test(f) && !/solutions?/i.test(f))
			.sort();
	} catch {
		return [];
	}
}

/**
 * 워크북 문제 파일의 `파트 N` 제목을 뽑아 항목으로 쓴다.
 *
 * 제목 수준이 패키지마다 다르다(`# 파트 1.` / `## 파트 1.`) — 규격이 아니라
 * 저작 시점의 차이다. 그래서 H1~H3를 모두 받는다. 파트 구조가 아예 없는
 * 구형 워크북은 파일 하나를 항목 하나로 잡는다: 0/0으로 두면 "워크북이 없다"와
 * "워크북이 있는데 진도가 0"이 화면에서 구별되지 않는다.
 *
 * 워크북이 **여럿이면 파일 번호를 키 앞에 붙인다**(`94:파트1`). 회차마다 파트 1이
 * 있어 키가 충돌하기 때문이다. 하나뿐인 패키지는 접두 없이 두어 기존 기록이
 * 그대로 살아 있게 한다 — 키가 바뀌면 그 항목의 진도가 orphan이 된다.
 */
function listWorkbookParts(pkg) {
	const dir = path.join(REPO, 'packages', pkg, 'workbook');
	const files = workbookFiles(pkg);
	if (!files.length) return [];
	const prefixed = files.length > 1;

	const out = [];
	for (const file of files) {
		const num = file.match(/^(\d+)/)?.[1] ?? file.replace(/\.md$/, '');
		const text = fs.readFileSync(path.join(dir, file), 'utf8');
		const found = [];
		for (const line of text.split('\n')) {
			const m = line.match(/^#{1,3}\s*파트\s*(\d+)\.?\s*(.*)$/);
			if (m) found.push({ base: `파트${m[1]}`, label: (m[2] || '').replace(/\s*\(.*$/, '').trim() });
		}
		if (!found.length) found.push({ base: '워크북', label: '전체' });
		for (const f of found) out.push({ key: prefixed ? `${num}:${f.base}` : f.base, label: f.label });
	}
	return out;
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

/**
 * 선택 문제 목록. 키는 `{과제번호}/{파일명}`이고, 필수 문제의 키(`03-01`)와
 * 한 섹션에 섞여도 충돌하지 않는다.
 *
 * `tests/`를 기준으로 센다 — 명세가 있는 것만 판정할 수 있고, 판정할 수 없는
 * 항목을 체크박스로 세우면 그 체크는 자기 신고가 된다.
 */
function listExtras(pkg, num) {
	const nums = num ? [num] : listAssignments(pkg);
	const out = [];
	for (const n of nums) {
		const folder = assignmentDir(pkg, n, 'tests');
		if (!folder) continue;
		let files;
		try {
			files = fs.readdirSync(path.join(REPO, 'packages', pkg, 'tests', folder));
		} catch {
			continue;
		}
		for (const f of files.filter((f) => /^extra-.+\.test\.ts$/.test(f)).sort()) {
			const file = f.replace(/\.test\.ts$/, '');
			out.push({ num: n, file, key: `${n}/${file}` });
		}
	}
	return out;
}

/** 과제 섹션의 키를 (번호, 파일)로 가른다. 슬래시가 없으면 필수 문제다. */
function splitKey(key) {
	const i = key.indexOf('/');
	return i === -1
		? { num: key, file: 'index', extra: false }
		: { num: key.slice(0, i), file: key.slice(i + 1), extra: true };
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

// ── 지문 (기록이 무엇을 근거로 삼았는지) ────────────────────────────────────
/**
 * 파일 내용의 짧은 해시. 파일명도 함께 넣어 이름이 바뀐 것을 내용이 같다고
 * 보지 않는다. 하나도 못 읽으면 null — "지문이 없다"와 "빈 파일의 지문"은
 * 구별돼야 한다.
 */
function hashFiles(paths) {
	const h = crypto.createHash('sha1');
	let any = false;
	for (const p of [...paths].sort()) {
		let body;
		try {
			body = fs.readFileSync(p);
		} catch {
			continue;
		}
		h.update(path.basename(p)).update('\0').update(body).update('\0');
		any = true;
	}
	return any ? h.digest('hex').slice(0, 7) : null;
}

/**
 * 과제 판정의 두 입력을 지문으로 남긴다.
 *
 *   spec — main의 테스트 파일. 판정 기준 그 자체다
 *   sol  — 풀이 브랜치의 커밋. 풀이를 고치면 이전 판정은 그 풀이의 것이 아니다
 *
 * 둘 중 하나만 바뀌어도 "지금도 통과한다"는 보장이 사라진다. 그래서 하나로
 * 합치지 않고 따로 둔다 — 무엇이 바뀌었는지가 다음 행동을 가른다(명세가
 * 바뀌었으면 다시 읽어야 하고, 풀이가 바뀌었으면 그냥 다시 돌리면 된다).
 */
function assignmentStamp(pkg, key) {
	const { num, file } = splitKey(key);
	const folder = assignmentDir(pkg, num, 'tests');
	return {
		spec: folder ? hashFiles([path.join(REPO, 'packages', pkg, 'tests', folder, `${file}.test.ts`)]) : null,
		sol: gitOut(`rev-parse --short=7 refs/heads/sol/${pkg}/${num}`),
	};
}

/** 읽은 문서의 본문 지문. 교재가 개정되면 "읽음"은 옛 판을 읽은 것이다. */
function docStamp(pkg, doc) {
	return { doc: hashFiles([path.join(REPO, 'packages', pkg, 'docs', doc)]) };
}

/**
 * 워크북 지문. 파트별로 가르지 않고 **그 파트가 속한 문제 파일** 전체를 해싱한다 —
 * 파트 경계는 제목 수준이 패키지마다 달라 신뢰할 수 없고, 워크북은 대개 통째로
 * 개정된다.
 *
 * 워크북이 여럿인 패키지는 키에 파일 번호가 붙어 있으므로(`94:파트1`) 그것으로
 * 파일을 고른다. 전부 한 파일로 해싱하면 3강 워크북만 고쳤는데 1·2강 진도까지
 * 재확인 대상이 된다.
 */
function workbookStamp(pkg, key = '') {
	const dir = path.join(REPO, 'packages', pkg, 'workbook');
	const files = workbookFiles(pkg);
	if (!files.length) return { wb: null };
	const num = String(key).includes(':') ? String(key).split(':')[0] : null;
	const file = (num && files.find((f) => f.startsWith(num))) || files[0];
	return { wb: hashFiles([path.join(dir, file)]) };
}

const STAMP_RE = /\b(spec|sol|doc|wb):([0-9a-f]{7})\b/g;
const STAMP_LABEL = { spec: '명세', sol: '풀이', doc: '문서', wb: '워크북' };

/** 받침 있는 낱말 뒤에는 `이`, 없으면 `가`. 라벨이 늘어도 문장이 깨지지 않게. */
function 조사(word, withJong = '이', withoutJong = '가') {
	const last = word.codePointAt(word.length - 1);
	const isHangul = last >= 0xac00 && last <= 0xd7a3;
	return isHangul && (last - 0xac00) % 28 !== 0 ? withJong : withoutJong;
}

/** 기록 줄 꼬리표에서 지문을 뽑는다. 지문 도입 전의 기록은 빈 객체가 된다. */
function parseStamp(tail) {
	const out = {};
	for (const m of tail.matchAll(STAMP_RE)) out[m[1]] = m[2];
	return out;
}
const fmtStamp = (st) =>
	Object.entries(st)
		.filter(([, v]) => v)
		.map(([k, v]) => `${k}:${v}`)
		.join(' ');

/** 꼬리표의 지문 부분만 갈아 끼운다 (라벨·날짜 같은 나머지는 보존). */
function withStamp(tail, st) {
	const base = tail.replace(/\s*·?\s*\b(?:spec|sol|doc|wb):[0-9a-f]{7}\b/g, '').trimEnd();
	const s = fmtStamp(st);
	return s ? `${base}  · ${s}` : base;
}

/**
 * 기록된 지문과 현재 지문을 대조한다.
 *
 *   ok    같다 — 그 기록은 지금도 유효하다
 *   stale 다르다 — 근거가 바뀌었다. `drift`가 무엇이 바뀌었는지 말한다
 *   none  기록에 지문이 없다 (지문 도입 전) — 소급해서 채우지 않는다.
 *         그때 무엇을 근거로 삼았는지 우리가 모르는데 아는 척하는 셈이 된다
 */
function stampState(recorded, current) {
	const keys = Object.keys(current).filter((k) => current[k]);
	if (!keys.length) return { state: 'ok', drift: [] };
	if (!keys.some((k) => recorded[k])) return { state: 'none', drift: [] };
	const drift = keys.filter((k) => recorded[k] && recorded[k] !== current[k]);
	return { state: drift.length ? 'stale' : 'ok', drift };
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
	const giText = readIgnore();
	for (const entry of ['.study-log', '.sol']) {
		if (!new RegExp(`^${entry.replace('.', '\\.')}\\/?$`, 'm').test(giText)) {
			console.log(`△ .gitignore에 \`${entry}/\` 가 없다 — 추가해야 worktree가 main에 잡히지 않는다`);
		}
	}

	// ④ 기록 파일 스캐폴딩 + 동기화(새 문서·과제가 생기면 항목만 덧붙인다)
	if (!fs.existsSync(path.join(WT, 'README.md'))) {
		fs.writeFileSync(path.join(WT, 'README.md'), worktreeReadme());
	}
	let created = 0;
	let added = 0;
	let stamped = 0;
	const orphans = [];
	for (const pkg of topicPackages()) {
		const existed = fs.existsSync(recordPath(pkg));
		if (!existed) {
			fs.writeFileSync(recordPath(pkg), scaffoldRecord(pkg));
			created++;
		} else {
			added += syncRecord(pkg);
			stamped += backfillReadStamps(pkg);
			orphans.push(...pruneOrphans(pkg, prune).map((k) => `${pkg}/${k}`));
		}
	}
	console.log(`✓ 기록 파일 ${created}개 생성 · 항목 ${added}개 추가`);
	if (stamped) {
		console.log(
			`✓ 읽음 항목 ${stamped}개에 지문 소급\n` +
				'  한계: 지문을 붙이기 전에 개정된 문서는 이 소급으로 영영 잡히지 않는다',
		);
	}
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
풀이는 \`sol/{패키지}/{과제번호}\` 브랜치(\`.sol/\` 아래 worktree)에 있다. 셋을 섞지
않는 이유:

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
node $S status                        # 진도 요약 + 열린 풀이 worktree
node $S mark mcp-protocol docs 00-03  # 문서 읽음
node $S start mcp-protocol 03-01      # 풀이 worktree 열기
node $S check mcp-protocol 03-01      # 과제를 실제로 돌려 확정
node $S done mcp-protocol 03-01       # 풀이 worktree 정리
node $S save "오늘 한 것"              # 커밋 + push
\`\`\`

자연어로 하려면 \`study-progress\` 스킬을 쓴다 — "MCP 3장까지 읽었어" 같은 말을
위 명령으로 옮겨준다.
`;
}

/**
 * 과제 섹션에 세울 줄들 — 필수와 선택이 한 섹션에 번호 순으로 섞인다.
 *
 * 선택을 따로 떼어 놓지 않는 이유는, 학습자가 보는 단위가 "03-01을 한다"이지
 * "선택 문제들을 한다"가 아니어서다. 완료 집계에서만 갈린다(README 규약 2).
 */
function assignmentLines(pkg) {
	const extras = listExtras(pkg);
	const rows = [];
	for (const num of listAssignments(pkg)) {
		rows.push({ key: num, line: `- [ ] ${num}  미확정` });
		for (const e of extras.filter((x) => x.num === num)) {
			rows.push({ key: e.key, line: `- [ ] ${e.key}  (선택) 미확정` });
		}
	}
	return rows;
}

function scaffoldRecord(pkg) {
	const docs = listDocs(pkg);
	const parts = listWorkbookParts(pkg);
	const rows = assignmentLines(pkg);

	const docLines = docs.length ? docs.map((d) => `- [ ] ${d}`).join('\n') : '(문서 없음)';
	const partLines = parts.length
		? parts.map((p) => `- [ ] ${p.key}${p.label ? ` — ${p.label}` : ''}`).join('\n')
		: '(워크북 없음)';
	const numLines = rows.length ? rows.map((r) => r.line).join('\n') : '(과제 없음)';

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
		[SEC_ASSIGN]: new Set(assignmentLines(pkg).map((r) => r.key)),
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

/**
 * 읽음 표시는 있는데 지문이 없는 문서·워크북에 현재 지문을 붙인다.
 *
 * **과제에는 이 짓을 하지 않는다.** 과제에는 `check`라는 진짜 판정 수단이 있으니,
 * 모르는 것을 소급하느니 재검증을 요구하는 편이 옳다. 문서 "읽음"은 애초에 자기
 * 신고여서 되돌릴 판정이 없고, 지문을 영원히 비워 두면 앞으로의 개정도 못 잡는다.
 * 그래서 지금 지문을 심되 그 한계를 호출부에서 알린다.
 */
function backfillReadStamps(pkg) {
	const sections = readRecord(pkg);
	if (!sections) return 0;
	let n = 0;
	for (const [heading, stamper] of [
		[SEC_DOCS, (k) => docStamp(pkg, k)],
		[SEC_WORKBOOK, (k) => workbookStamp(pkg, k)],
	]) {
		const sec = findSection(sections, heading);
		if (!sec) continue;
		sec.lines = sec.lines.map((line) => {
			const item = parseItem(line);
			if (!item || !item.done) return line;
			const st = stamper(item.key);
			if (stampState(parseStamp(item.tail), st).state !== 'none') return line;
			n++;
			return `- [x] ${item.key}${withStamp(item.tail, st)}`;
		});
	}
	if (n) writeRecord(pkg, sections);
	return n;
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
	ensure(SEC_ASSIGN, assignmentLines(pkg));
	if (added) reorderAssignments(sections, pkg);

	if (added) writeRecord(pkg, sections);
	return added;
}

/**
 * 과제 줄을 목록 순서로 다시 세운다. `ensure`는 새 항목을 섹션 끝에 붙이므로,
 * 나중에 생긴 선택 문제가 자기 필수 문제에서 멀리 떨어진다 — 읽는 사람에게
 * 03-01의 선택 문제는 03-01 바로 아래 있어야 한다.
 *
 * 각 줄의 내용(체크·판정·지문)은 그대로 옮긴다. 순서만 바꾼다.
 */
function reorderAssignments(sections, pkg) {
	const sec = findSection(sections, SEC_ASSIGN);
	if (!sec) return;
	const order = assignmentLines(pkg).map((r) => r.key);
	if (!order.length) return;

	const known = new Map();
	for (const line of sec.lines) {
		const item = parseItem(line);
		if (item && order.includes(item.key)) known.set(item.key, line);
	}
	// 목록에 없는 항목(이름이 바뀐 옛 과제)이 섞여 있으면 건드리지 않는다.
	// 그건 pruneOrphans가 사람에게 물어볼 일이다.
	if (known.size !== order.length) return;

	const firstIdx = sec.lines.findIndex((l) => known.has(parseItem(l)?.key));
	const rest = sec.lines.filter((l) => !known.has(parseItem(l)?.key));
	rest.splice(firstIdx, 0, ...order.map((k) => known.get(k)));
	sec.lines = rest;
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
		// 읽은 시점의 본문 지문을 함께 박는다. 해제할 때는 지운다 — 안 읽은 것에
		// 지문이 남아 있으면 "그 판을 안 읽었다"는 무의미한 사실이 기록된다.
		const st = want ? (kind === 'docs' ? docStamp(pkg, item.key) : workbookStamp(pkg, item.key)) : {};
		return `- [${want ? 'x' : ' '}] ${item.key}${withStamp(item.tail, st)}`;
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

// ── start / done (풀이 worktree) ────────────────────────────────────────────
const solPath = (pkg, num) => path.join(SOL_ROOT, pkg, num);
const rel = (p) => path.relative(REPO, p) || '.';

/**
 * 지금 열려 있는 풀이 worktree들. `git worktree list`가 원천이다 — 디렉토리만
 * 훑으면 사람이 손으로 지운 껍데기까지 세게 된다.
 */
function solWorktrees() {
	const raw = gitOut('worktree list --porcelain') ?? '';
	const out = [];
	let cur = null;
	for (const line of raw.split('\n')) {
		if (line.startsWith('worktree ')) cur = line.slice(9).trim();
		else if (line.startsWith('branch ') && cur) {
			const branch = line.slice(7).trim().replace(/^refs\/heads\//, '');
			const m = branch.match(/^sol\/(.+)\/((?:e\d+-)?\d+-\d+)$/);
			if (m) out.push({ path: cur, branch, pkg: m[1], num: m[2] });
			cur = null;
		}
	}
	return out;
}

/** 그 과제의 worktree가 열려 있는가. 열려 있으면 ref를 함부로 옮기면 안 된다. */
const worktreeFor = (pkg, num) => solWorktrees().find((w) => w.pkg === pkg && w.num === num) ?? null;

/**
 * pnpm을 부르는 방법. PATH에 없으면 corepack으로 우회한다.
 *
 * `packageManager` 필드가 버전을 고정하고 있으므로 `corepack pnpm`은 같은 버전을
 * 쓴다. nvm으로 노드 버전을 갈아탄 뒤 `corepack enable`을 다시 안 했거나, 에이전트가
 * 로그인 셸이 아닌 환경에서 스크립트를 돌릴 때 PATH에서 pnpm이 사라진다 — 그때
 * "command not found"로 끝나면 원인이 의존성 설치인지 환경인지 구별되지 않는다.
 */
let PNPM = null;
function pnpmCmd() {
	if (PNPM !== null) return PNPM;
	const has = (c) => {
		try {
			execSync(`command -v ${c}`, { stdio: 'ignore', shell: '/bin/sh' });
			return true;
		} catch {
			return false;
		}
	};
	PNPM = has('pnpm') ? 'pnpm' : has('corepack') ? 'corepack pnpm' : '';
	return PNPM;
}

/**
 * worktree에 의존성을 깐다. 새 worktree에는 node_modules가 없어서 테스트가 아예
 * 돌지 않는다 — `.study-log/`가 문서만 담아 이 문제를 겪지 않았을 뿐이다.
 *
 * testkit은 빌드 산출물(`dist/`)로 소비된다. Vite가 설정 파일의 워크스페이스
 * 의존성을 externalize하므로 `vitest.config.ts`의 `defineStudyConfig`는 Node가
 * 직접 읽을 수 있어야 한다 — install만 하고 build를 빠뜨리면 설정 로딩에서 죽는다.
 *
 * 실패해도 worktree는 그대로 둔다. 만들어진 것을 되돌리는 것보다 무엇을 손으로
 * 실행하면 되는지 알려주는 편이 낫다.
 */
function installWorktree(wt) {
	const pnpm = pnpmCmd();
	if (!pnpm) {
		console.log('△ pnpm도 corepack도 없다 — worktree는 만들어졌다. 노드 환경을 갖춘 뒤 직접 실행하라:');
		console.log(`    cd ${rel(wt)} && corepack enable pnpm && pnpm install && pnpm --filter @study/testkit build`);
		return false;
	}
	console.log(`· 의존성 설치 중 (${pnpm} — store 하드링크라 디스크는 거의 안 먹는다)`);
	const run = (cmd) => execSync(cmd, { cwd: wt, encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
	try {
		run(`${pnpm} install`);
		run(`${pnpm} --filter @study/testkit build`);
		console.log('✓ 의존성 준비 완료');
		return true;
	} catch (e) {
		console.log('△ 설치 실패 — worktree는 만들어졌다. 직접 실행하라:');
		console.log(`    cd ${rel(wt)} && ${pnpm} install && ${pnpm} --filter @study/testkit build`);
		const err = String(e.stderr ?? e.message).trim().split('\n').slice(-1)[0];
		if (err) console.log(`  ${err}`);
		return false;
	}
}

/**
 * gitignore된 로컬 설정(`.env`)을 worktree에서도 보이게 한다.
 *
 * 새 worktree에는 추적되는 파일만 들어온다. API 키가 필요한 과제는 그것 없이는
 * 테스트 수집 단계에서 `process.exit(1)`로 죽는데, 화면에는 "키가 없다"가 아니라
 * 스위트 실패로 보여서 원인이 풀이인 줄 알게 된다.
 *
 * 복사가 아니라 심볼릭 링크다 — 키를 갱신하면 열려 있는 모든 worktree가 따라간다.
 * 복사본은 만든 시점의 키를 붙들고 있어서, 키가 만료됐을 때 어느 사본이 낡았는지
 * 추적해야 한다.
 */
function linkLocalEnv(wt) {
	const linked = [];
	for (const pkg of topicPackages()) {
		const src = path.join(REPO, 'packages', pkg, '.env');
		if (!fs.existsSync(src)) continue;
		const dest = path.join(wt, 'packages', pkg, '.env');
		if (fs.existsSync(dest)) continue;
		try {
			fs.symlinkSync(src, dest);
			linked.push(pkg);
		} catch {
			/* 패키지가 그 브랜치에 없거나 권한이 없으면 넘어간다 */
		}
	}
	if (linked.length) console.log(`✓ .env 연결: ${linked.join(', ')}  (원본을 가리키므로 키 갱신이 따라온다)`);
}

/** 풀고 나서 무엇을 할지. 명세를 먼저 읽으라는 순서가 규약이다(README 규약 4). */
function printNext(pkg, num, wt) {
	const tests = assignmentDir(pkg, num, 'tests');
	const src = assignmentDir(pkg, num, 'src');
	console.log('');
	if (tests) console.log(`  ① 명세를 먼저 읽는다  ${rel(wt)}/packages/${pkg}/tests/${tests}/index.test.ts`);
	if (src) console.log(`  ② 🎯 TODO를 채운다     ${rel(wt)}/packages/${pkg}/src/${src}/index.ts`);
	console.log(`  ③ 판정                 cd ${rel(wt)}/packages/${pkg} && pnpm test ${num}`);
	console.log(`  ④ 커밋 후 기록         node $S check ${pkg} ${num}`);
}

function cmdStart(pkg, num, opts = {}) {
	if (!pkg || !num) die('사용: start <패키지> <과제번호>');
	if (!topicPackages().includes(pkg)) die(`패키지를 찾을 수 없다: ${pkg}`);
	if (!assignmentDir(pkg, num, 'src')) {
		const known = listAssignments(pkg).join(', ');
		die(`packages/${pkg}/src/${num}-*/ 를 찾을 수 없다 — 있는 과제: ${known || '(없음)'}`);
	}

	const branch = `sol/${pkg}/${num}`;
	const wt = solPath(pkg, num);

	// 이미 열려 있으면 경로만 알린다 — 멱등이라 "이미 하고 있었나" 확인용으로 부를 수 있다.
	// 다만 의존성은 다시 본다: 첫 설치가 실패했을 때 재시도할 손잡이가 없으면
	// 사용자는 실패한 worktree를 지웠다 다시 만드는 수밖에 없다.
	const open = worktreeFor(pkg, num);
	if (open) {
		console.log(`이미 열려 있다: ${rel(open.path)}  (${branch})`);
		if (opts.install !== false && !fs.existsSync(path.join(open.path, 'node_modules'))) {
			console.log('· 의존성이 없다 — 다시 설치한다');
			installWorktree(open.path);
		}
		linkLocalEnv(open.path);
		printNext(pkg, num, open.path);
		return;
	}
	if (fs.existsSync(wt) && fs.readdirSync(wt).length > 0) {
		die(`${rel(wt)} 가 이미 있고 worktree가 아니다 — 옮기거나 지운 뒤 다시 실행하라`);
	}

	// 브랜치가 있으면 재개(재도전·이어풀기), 없으면 main에서 새로 분기한다.
	// 분기 기준을 main으로 못박는 이유는 README 규약 4에 있다 — study-log는
	// orphan이라 packages/ 자체가 없고, 다른 sol 브랜치에서 뻗으면 남의 풀이가 딸려온다.
	const fresh = !branchExists(branch);
	if (fresh) {
		if (!gitOut('rev-parse --verify --quiet refs/heads/main')) die('main 브랜치를 찾을 수 없다');
		git(`worktree add -b ${branch} ${JSON.stringify(wt)} main`);
		console.log(`✓ ${branch} 생성 (main에서 분기)`);
	} else {
		// 그 브랜치를 다른 worktree가 쓰고 있으면 git이 거부한다 — 그 메시지가 정확하다
		git(`worktree add ${JSON.stringify(wt)} ${branch}`);
		console.log(`✓ ${branch} 재개 (기존 풀이가 그대로 있다)`);
	}
	console.log(`✓ worktree: ${rel(wt)}  (main은 교재 상태 그대로다)`);

	if (!/^\.sol\/?$/m.test(readIgnore())) {
		console.log('△ .gitignore에 `.sol/` 가 없다 — 추가해야 worktree가 main에 잡히지 않는다');
	}

	if (opts.install === false) console.log('· 의존성 설치 생략 (--no-install)');
	else installWorktree(wt);
	linkLocalEnv(wt);

	printNext(pkg, num, wt);
}

function cmdDone(pkg, num, force) {
	if (!pkg || !num) die('사용: done <패키지> <과제번호> [--force]');
	const open = worktreeFor(pkg, num);
	if (!open) {
		console.log(`열린 worktree가 없다: ${rel(solPath(pkg, num))}`);
		return;
	}

	// 커밋하지 않은 풀이를 조용히 날리지 않는다. worktree를 쓰는 이유의 절반이
	// "중간 저장이 그냥 된다"인데, 정리 명령이 그것을 버리면 앞뒤가 안 맞는다.
	const dirty = gitOut('status --porcelain', open.path);
	if (dirty && !force) {
		console.log(`△ ${open.branch} 에 커밋하지 않은 변경이 있다 — 지우면 사라진다`);
		for (const l of dirty.split('\n').slice(0, 10)) console.log(`    ${l}`);
		if (dirty.split('\n').length > 10) console.log('    …');
		console.log(`\n  남기려면: cd ${rel(open.path)} && git add -A && git commit -m "sol(${pkg}): ${num} …"`);
		console.log(`  버리려면: done ${pkg} ${num} --force`);
		process.exit(1);
	}

	git(`worktree remove ${force ? '--force ' : ''}${JSON.stringify(open.path)}`);
	// 패키지 디렉토리가 비면 같이 치운다 — .sol/ 아래 빈 껍데기가 쌓이면
	// "뭐가 열려 있지"를 디렉토리로 판단할 수 없게 된다
	for (const dir of [path.dirname(open.path), SOL_ROOT]) {
		try {
			if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
		} catch {
			/* 없거나 비어 있지 않으면 그대로 둔다 */
		}
	}
	console.log(`✓ worktree 제거: ${rel(open.path)}`);
	console.log(`  브랜치 ${open.branch} 와 커밋은 남는다 — 다시 열려면 start ${pkg} ${num}`);
}

const readIgnore = () => {
	try {
		return fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8');
	} catch {
		return '';
	}
};

// ── check (실제 판정) ───────────────────────────────────────────────────────
function cmdCheck(pkg, key, force, opts = {}) {
	// --stale은 패키지를 생략할 수 있다: 어긋난 것을 통째로 정리하는 손잡이다
	if (!pkg && !opts.stale) die('사용: check <패키지> [과제번호]  |  check --stale [패키지]');
	// 여기서 막지 않으면 "실행된 테스트가 0개"로 끝나서 원인이 번호 오타처럼 보인다
	if (!pnpmCmd()) die('pnpm도 corepack도 없다 — 판정을 돌릴 수 없다. 노드 환경을 확인하라');

	const pkgs = pkg ? [pkg] : topicPackages();
	if (pkg && !topicPackages().includes(pkg)) die(`패키지를 찾을 수 없다: ${pkg}`);

	let failed = 0;
	let ran = 0;
	for (const p of pkgs) {
		let keys;
		if (key) keys = [key];
		else if (opts.stale) keys = staleAssignments(p).map((s) => s.key);
		else keys = opts.extras ? assignmentLines(p).map((r) => r.key) : listAssignments(p);
		for (const k of keys) {
			ran++;
			failed += checkOne(p, k, force) ? 0 : 1;
		}
	}
	if (ran === 0) {
		console.log(opts.stale ? '지문이 어긋난 과제가 없다 — 모든 판정이 현재 명세·풀이 기준이다' : '판정할 과제가 없다');
	}
	process.exit(failed > 0 ? 1 : 0);
}

/** 통과·막힘으로 확정된 기록 중 지문이 어긋난 것. `--stale`과 status가 함께 쓴다. */
function staleAssignments(pkg) {
	const sections = readRecord(pkg);
	if (!sections) return [];
	const out = [];
	for (const item of sectionItems(sections, SEC_ASSIGN)) {
		const tail = item.tail.trim();
		if (!/^(통과|\(선택\)\s*통과|막힘|\(선택\)\s*막힘)/.test(tail)) continue;
		const { state, drift } = stampState(parseStamp(item.tail), assignmentStamp(pkg, item.key));
		if (state === 'stale') out.push({ key: item.key, drift, state });
		else if (state === 'none') out.push({ key: item.key, drift: [], state });
	}
	return out;
}

function checkOne(pkg, key, force) {
	const { num, file, extra } = splitKey(key);
	const pkgDir = path.join(REPO, 'packages', pkg);
	const folder = assignmentDir(pkg, num, 'src');
	if (!folder) {
		console.log(`${pkg} ${key}  ✗ src/${num}-*/ 를 찾을 수 없다`);
		return false;
	}
	if (extra && !fs.existsSync(path.join(REPO, 'packages', pkg, 'tests', folder, `${file}.test.ts`))) {
		console.log(`${pkg} ${key}  ✗ tests/${folder}/${file}.test.ts 가 없다`);
		return false;
	}

	const branch = `sol/${pkg}/${num}`;
	if (!branchExists(branch)) {
		console.log(`${pkg} ${key}  · 미시작 (${branch} 브랜치가 없다)`);
		return true; // 아직 안 푼 것은 실패가 아니다
	}

	// 판정은 **커밋된** 풀이로 한다. worktree에서 고치고 커밋하지 않았다면 화면의
	// 코드와 판정 대상이 다르다 — 이걸 모르면 "고쳤는데 왜 그대로 막힘이지"에서 막힌다.
	const openWt = worktreeFor(pkg, num);
	if (openWt && gitOut('status --porcelain', openWt.path)) {
		console.log(`${pkg} ${key}  △ ${rel(openWt.path)} 에 커밋하지 않은 변경이 있다 — 아래 판정에는 들어가지 않는다`);
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
				`${pkg} ${key}  △ ${branch}에 src/${folder}/ 가 없다 — 그 브랜치가 옛 배치를 담고 있다.\n` +
					`             풀이를 새 구조(src/${folder}/index.ts)로 옮긴 뒤 다시 check하라.`,
			);
			return true;
		}
		const files = listing.split('\n').filter((f) => f.endsWith('.ts'));
		if (files.length === 0) die(`${branch}의 src/${folder}/ 에 .ts 파일이 없다`);
		if (extra) {
			// 선택 문제는 안 풀어도 되는 것이다. 손대지 않은 것을 `막힘`으로 세면
			// "선택"이 아니게 되고, 학습 판단("막힘이 최우선")까지 왜곡된다.
			//
			// 파일 **유무**로는 판별할 수 없다. `sync-sol`이 main을 반영하면 안 푼
			// 선택 문제의 스켈레톤도 함께 브랜치에 들어오기 때문이다. TODO 잔존이
			// 유일한 신호다 — 필수 문제의 `진행중` 판정이 쓰는 것과 같다.
			const body = files.includes(`${file}.ts`)
				? gitOut(`show ${branch}:packages/${pkg}/src/${folder}/${file}.ts`)
				: null;
			if (body === null || /🎯 TODO|TODO:/.test(body)) {
				console.log(`${pkg} ${key}  · 미시작 (아직 스켈레톤이다)`);
				return true;
			}
		}
		for (const f of files) {
			const body = git(`show ${branch}:packages/${pkg}/src/${folder}/${f}`);
			fs.writeFileSync(path.join(probeDir, folder, f), `${body}\n`);
		}
		// 필터는 vitest의 경로 부분 일치다. 번호(`02-01`)만 주면 그 폴더의 extra까지
		// 함께 걸리고, `${num}/index`는 실제 경로(`02-01-agent-loop/index.test.ts`)와
		// 어긋난다. 폴더명 + 파일명을 써야 부른 문제 하나만 판정한다.
		result = runVitest(pkgDir, `${folder}/${file}`);
	} finally {
		fs.rmSync(probeDir, { recursive: true, force: true });
	}

	const total = result.passed + result.failed;
	if (total === 0) {
		console.log(`${pkg} ${key}  ✗ 실행된 테스트가 0개 — 번호·파일명을 확인하라`);
		return false;
	}
	const ok = result.failed === 0;
	const label =
		(extra ? '(선택) ' : '') +
		(ok ? `통과 (${result.passed}/${total})` : `막힘 (${result.failed}/${total} 실패)`);
	console.log(`${pkg} ${key}  ${ok ? '✓' : '✗'} ${label}`);
	recordAssignment(pkg, key, ok, label);

	// 판정은 **main의 명세**로 했다. 풀이 브랜치가 옛 명세를 담고 있으면, 사용자가
	// 그 브랜치에서 직접 `pnpm test`를 돌렸을 때 여기 결과와 어긋난다. 어느 쪽이
	// 고장 났는지 찾느라 시간을 버리기 전에 알린다.
	const specPath = `packages/${pkg}/tests/${folder}/${file}.test.ts`;
	const onBranch = gitOut(`show ${branch}:${specPath}`);
	const onMain = (() => {
		try {
			return fs.readFileSync(path.join(REPO, specPath), 'utf8').trim();
		} catch {
			return null;
		}
	})();
	if (onBranch !== null && onMain !== null && onBranch !== onMain) {
		console.log(
			`${' '.repeat(pkg.length + key.length + 3)}△ ${branch}의 명세가 main과 다르다 — 위 판정은 main 기준이다.\n` +
				`${' '.repeat(pkg.length + key.length + 5)}그 브랜치에서 직접 테스트하려면 main을 rebase하라.`,
		);
	}
	return true;
}

function runVitest(pkgDir, num) {
	let raw = '';
	try {
		raw = execSync(`${pnpmCmd()} exec vitest run ${num} --reporter=json`, {
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

/**
 * 과제 줄을 확정 결과로 갱신한다. 이 줄만이 "통과"의 근거다.
 *
 * 판정 **직후** 지문을 찍는다 — 방금 돌린 명세와 풀이가 곧 그 판정의 근거다.
 */
function recordAssignment(pkg, key, ok, label) {
	const sections = readRecord(pkg);
	if (!sections) return;
	const sec = findSection(sections, SEC_ASSIGN);
	if (!sec) return;
	const line = `- [${ok ? 'x' : ' '}] ${key}  ${label} · ${TODAY}  · ${fmtStamp(assignmentStamp(pkg, key))}`;
	let hit = false;
	sec.lines = sec.lines.map((l) => {
		const item = parseItem(l);
		if (!item || item.key !== key) return l;
		hit = true;
		return line;
	});
	if (!hit) {
		let at = sec.lines.length;
		while (at > 0 && sec.lines[at - 1].trim() === '') at--;
		sec.lines.splice(at, 0, line);
		reorderAssignments(sections, pkg);
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
		const items = new Map(sectionItems(sections, SEC_ASSIGN).map((i) => [i.key, i]));
		const warn = [];

		// ① 읽음 표시한 문서·워크북의 본문이 그 뒤 바뀌었는가
		for (const [list, stamper] of [
			[docs, (k) => docStamp(pkg, k)],
			[parts, (k) => workbookStamp(pkg, k)],
		]) {
			for (const it of list.filter((i) => i.done)) {
				const { state } = stampState(parseStamp(it.tail), stamper(it.key));
				if (state === 'stale') warn.push(`${it.key}  본문이 개정됐다 — 다시 볼 것`);
			}
		}

		const tally = { 통과: 0, 막힘: 0, 미확인: 0, 진행중: 0, 미시작: 0 };
		const extras = listExtras(pkg);
		let extrasDone = 0;

		for (const num of listAssignments(pkg)) {
			const tail = (items.get(num)?.tail ?? '').trim();
			if (tail.startsWith('통과')) tally.통과++;
			else if (tail.startsWith('막힘')) tally.막힘++;
			else tally[inferAssignment(pkg, num)]++;
		}
		for (const e of extras) {
			if (/통과/.test(items.get(e.key)?.tail ?? '')) extrasDone++;
		}
		const total = Object.values(tally).reduce((a, b) => a + b, 0);
		const detail = Object.entries(tally)
			.filter(([, v]) => v > 0)
			.map(([k, v]) => `${k} ${v}`)
			.join(' · ');

		// ② 확정된 판정의 근거(명세·풀이)가 그 뒤 바뀌었는가
		for (const s of staleAssignments(pkg)) {
			const what = s.drift.map((d) => STAMP_LABEL[d]).join('·');
			warn.push(
				s.state === 'none'
					? `${s.key}  지문 없음 — 무엇으로 통과했는지 알 수 없다. check 재실행`
					: `${s.key}  ${what}${조사(what)} 바뀌었다 — check 재실행`,
			);
		}

		// ③ 목록 자체가 어긋났는가 (과제·문서가 늘거나 사라짐)
		const missing =
			[...listDocs(pkg)].filter((d) => !docs.some((i) => i.key === d)).length +
			[...assignmentLines(pkg)].filter((r) => !items.has(r.key)).length;
		if (missing) warn.push(`기록에 없는 항목 ${missing}개 — progress.js init`);
		const orphan =
			docs.filter((i) => !listDocs(pkg).includes(i.key)).length +
			[...items.keys()].filter((k) => !assignmentLines(pkg).some((r) => r.key === k)).length;
		if (orphan) warn.push(`목록에 없는 기록 ${orphan}개 — progress.js init --prune`);

		console.log(
			`${pkg.padEnd(26)} 문서 ${String(docs.filter((d) => d.done).length).padStart(2)}/${String(docs.length).padEnd(2)}` +
				` · 워크북 ${parts.filter((p) => p.done).length}/${parts.length}` +
				` · 과제 ${tally.통과}/${total}${extras.length ? ` (+선택 ${extrasDone}/${extras.length})` : ''}` +
				`${detail ? `  (${detail})` : ''}`,
		);
		for (const w of warn) console.log(`${' '.repeat(28)}⚠ ${w}`);
	}
	// 열려 있는 풀이 worktree. 진도표에는 안 보이는 정보다 — 브랜치가 있다는 것과
	// 지금 작업 중이라는 것은 다르고, 후자가 "어디까지 했더라"의 답인 경우가 많다.
	const open = solWorktrees().filter((w) => pkgs.includes(w.pkg));
	if (open.length) {
		console.log('\n열린 풀이 worktree');
		for (const w of open) {
			const wtDirty = gitOut('status --porcelain', w.path);
			console.log(`  ${rel(w.path).padEnd(40)} ${wtDirty ? '작업 중 (저장 안 한 변경)' : '커밋됨'}`);
		}
	}

	const dirty = gitOut('status --porcelain', WT);
	console.log(dirty ? '\n△ 저장하지 않은 기록이 있다 — progress.js save' : '');
}

// ── sync-sol (풀이 브랜치를 main에 맞춘다) ──────────────────────────────────
/**
 * main의 최신 내용을 풀이 브랜치에 반영한다. 판정(`check`)은 어차피 main의
 * 명세로 하므로 이것이 없어도 진도는 정확하다 — 문제는 **사용자가 그 브랜치에서
 * 직접 `pnpm test`를 돌릴 때**다. 브랜치에 옛 명세가 남아 있으면 화면의 결과와
 * 기록의 판정이 어긋나고, 어느 쪽이 고장 났는지 찾느라 시간을 버린다.
 *
 * rebase가 아니라 **머지**다. 이력을 다시 쓰면 이미 push된 브랜치에 force가
 * 필요해지는데, 학습 이력을 지우면서까지 얻을 것이 없다. 트리는 main을 바닥에
 * 깔고 풀이 폴더만 브랜치 것으로 덮으므로 충돌이라는 개념이 없다.
 *
 * 체크아웃하지 않는다 — 사용자가 무엇을 하고 있든 안전해야 한다.
 */
function cmdSyncSol(pkg, num) {
	const mainSha = gitOut('rev-parse refs/heads/main');
	if (!mainSha) die('main 브랜치를 찾을 수 없다');

	const targets = [];
	for (const p of pkg ? [pkg] : topicPackages()) {
		for (const n of num ? [num] : listAssignments(p)) {
			if (branchExists(`sol/${p}/${n}`)) targets.push({ pkg: p, num: n });
		}
	}
	if (!targets.length) {
		console.log('풀이 브랜치가 없다');
		return;
	}

	let synced = 0;
	for (const t of targets) {
		const branch = `sol/${t.pkg}/${t.num}`;
		const head = git(`rev-parse refs/heads/${branch}`);

		// 이미 main을 품고 있으면 할 일이 없다
		if (gitOk(`merge-base --is-ancestor ${mainSha} ${head}`)) continue;

		// 그 브랜치를 열어 둔 worktree가 있으면 ref만 옮길 수 없다. worktree의
		// HEAD·인덱스는 옛 커밋을 가리킨 채 남아서 `git status`가 "전부 삭제됨"처럼
		// 보이고, 사용자는 자기 풀이가 날아간 줄 안다. 깨끗하면 반영 후 맞춰 주고,
		// 작업 중이면 아예 손대지 않는다.
		const wt = worktreeFor(t.pkg, t.num);
		if (wt && gitOut('status --porcelain', wt.path)) {
			console.log(`${branch}  △ ${rel(wt.path)} 에서 작업 중 — 건너뜀 (커밋하거나 done 후 다시 실행)`);
			continue;
		}

		const folder = assignmentDir(t.pkg, t.num, 'src');
		if (!folder) {
			console.log(`${branch}  △ src/${t.num}-*/ 를 찾을 수 없다 — 건너뜀`);
			continue;
		}
		const scope = `packages/${t.pkg}/src/${folder}/`;

		// 풀이 폴더 밖을 건드린 브랜치는 손대지 않는다. 규약상 있어서는 안 되지만,
		// 있다면 그 변경을 조용히 버리는 것이 이 명령이 할 일은 아니다.
		const touched = (gitOut(`diff --name-only ${mainSha}...${head}`) ?? '')
			.split('\n')
			.filter((f) => f && !f.startsWith(scope));
		if (touched.length) {
			console.log(
				`${branch}  △ 풀이 폴더 밖 변경 ${touched.length}개 — 건너뜀 (${touched.slice(0, 2).join(', ')}${touched.length > 2 ? ' …' : ''})`,
			);
			continue;
		}

		const listing = gitOut(`ls-tree --name-only ${head}:${scope.replace(/\/$/, '')}`);
		if (listing === null) {
			console.log(`${branch}  △ ${scope} 가 없다 — 건너뜀`);
			continue;
		}

		// main 트리를 임시 인덱스에 깔고 풀이 파일만 덮어쓴다
		const idx = path.join(REPO, '.git', `sync-sol-index-${process.pid}`);
		const env = { ...process.env, GIT_INDEX_FILE: idx };
		const g = (a) => execSync(`git ${a}`, { cwd: REPO, encoding: 'utf8', env }).trim();
		try {
			g(`read-tree ${mainSha}`);
			for (const f of listing.split('\n').filter(Boolean)) {
				const blob = g(`rev-parse ${head}:${scope}${f}`);
				g(`update-index --add --cacheinfo 100644,${blob},${scope}${f}`);
			}
			const tree = g('write-tree');
			const msg = `chore(sol): main 반영 (${t.pkg} ${t.num})`;
			const sha = execSync(`git commit-tree ${tree} -p ${head} -p ${mainSha} -F -`, {
				cwd: REPO,
				encoding: 'utf8',
				env,
				input: `${msg}\n`,
			}).trim();
			git(`update-ref refs/heads/${branch} ${sha}`);
			// 위에서 깨끗한 것을 확인했으므로 버릴 작업이 없다
			if (wt) git(`reset --hard --quiet ${sha}`, wt.path);
			console.log(`✓ ${branch}  main 반영 (${git(`rev-parse --short ${sha}`)})${wt ? ` · ${rel(wt.path)} 갱신` : ''}`);
			synced++;
		} finally {
			fs.rmSync(idx, { force: true });
		}
	}
	console.log(synced ? `\n${synced}개 브랜치를 main에 맞췄다` : '모든 풀이 브랜치가 이미 main을 품고 있다');
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
	case 'start':
		cmdStart(rest[0], rest[1], { install: !flags.has('--no-install') });
		break;
	case 'check':
		cmdCheck(rest[0], rest[1], flags.has('--force'), {
			stale: flags.has('--stale'),
			extras: flags.has('--extras'),
		});
		break;
	case 'done':
		cmdDone(rest[0], rest[1], flags.has('--force'));
		break;
	case 'sync-sol':
		cmdSyncSol(rest[0], rest[1]);
		break;
	case 'save':
		cmdSave(rest.join(' '), !flags.has('--no-push'));
		break;
	case 'path':
		cmdPath(rest[0]);
		break;
	default:
		die(`모르는 명령: ${cmd}  (init / status / mark / start / check / done / sync-sol / save / path)`);
}

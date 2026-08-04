#!/usr/bin/env bash
# 패키지·과제 스캐폴딩. 규약이 요구하는 파일과 설정을 한 번에 만든다.
#
# 손으로 만들면 package.json 스크립트나 tsconfig 상속을 빠뜨리기 쉽고,
# 그 누락은 감사에서 잡히기 전까지 조용히 남는다. 그래서 스크립트로 고정한다.
#
# 사용:
#   scaffold.sh package <주제-slug> "<한 줄 설명>"
#   scaffold.sh assignment <패키지> <과제번호> <slug> "<한 줄 설명>"
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
MODE="${1:?package 또는 assignment}"

# ── 패키지 ─────────────────────────────────────────────────────────────────
if [ "$MODE" = "package" ]; then
  SLUG="${2:?주제 slug이 필요하다 (영문 kebab-case)}"
  DESC="${3:-학습 워크북}"
  DIR="$REPO/packages/$SLUG"

  [ -e "$DIR" ] && { echo "✗ 이미 있다: packages/$SLUG"; exit 1; }
  case "$SLUG" in
    *[^a-z0-9-]*) echo "✗ slug은 영문 소문자·숫자·하이픈만 (규약 1: 파일명은 영문)"; exit 1 ;;
  esac

  mkdir -p "$DIR"/{docs,workbook,src,solutions}

  cat > "$DIR/package.json" <<JSON
{
  "name": "$SLUG",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "$DESC",
  "scripts": {
    "test": "echo '과제가 추가되면 test:{번호}를 여기에 연결한다' && exit 0",
    "typecheck": "tsc"
  }
}
JSON

  cat > "$DIR/tsconfig.json" <<'JSON'
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "solutions"]
}
JSON

  # docs·solutions가 빈 디렉토리면 git이 추적하지 않는다.
  cat > "$DIR/docs/.gitkeep" <<'EOF'
EOF
  cat > "$DIR/solutions/.gitkeep" <<'EOF'
EOF

  echo "✓ packages/$SLUG 생성"
  echo
  echo "다음 할 일"
  echo "  1. docs/00-overview.md 부터 지식 문서 작성 (H1 한글, 파일명 영문)"
  echo "  2. README.md '현재 패키지' 표에 한 줄 추가"
  echo "  3. 과제 추가:  scaffold.sh assignment $SLUG 3-1 <slug> \"설명\""
  echo "  4. 감사:       node .claude/skills/study-repo/scripts/audit-conventions.js $SLUG"
  exit 0
fi

# ── 과제 ───────────────────────────────────────────────────────────────────
if [ "$MODE" = "assignment" ]; then
  PKG="${2:?패키지명이 필요하다}"
  NUM="${3:?과제번호가 필요하다 (예: 3-1)}"
  SLUG="${4:?과제 slug이 필요하다 (예: kv-calc)}"
  DESC="${5:-과제}"
  DIR="$REPO/packages/$PKG"

  [ -d "$DIR" ] || { echo "✗ 패키지가 없다: $PKG"; exit 1; }
  case "$NUM" in
    [0-9]*-[0-9]*) ;;
    *) echo "✗ 과제번호는 {파트}-{순번} 형식 (예: 3-1)"; exit 1 ;;
  esac

  FILE="$NUM-$SLUG.ts"
  [ -e "$DIR/src/$FILE" ] && { echo "✗ 이미 있다: src/$FILE"; exit 1; }

  # 문제 — 한 파일 한 문제, 🎯 TODO + throw로 시작
  cat > "$DIR/src/$FILE" <<TS
/**
 * 과제 $NUM — $DESC
 *
 * 판정:  npm run test:$NUM --workspace $PKG
 * 막히면: docs/{해당 문서}.md § {해당 절}
 *
 * 성공 기준 (테스트가 검사하는 항목과 1:1 대응한다)
 *  - TODO: 기준을 적으라. 각 기준이 solutions/$FILE 의 check() 하나가 된다
 */

export function example(input: unknown): unknown {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: example');
}
TS

  # 정답 = 테스트
  cat > "$DIR/solutions/$FILE" <<TS
/**
 * 과제 $NUM 의 정답 — 테스트 코드
 *
 * 참고 구현(완성 골격)은 주지 않는다. 읽으면 베끼게 되고 그 순간 과제가
 * 독해로 바뀐다. 대신 학습자의 구현을 돌려 판정한다.
 *
 * 실행: npm run test:$NUM --workspace $PKG
 */
import { example } from '../src/$FILE';

let pass = 0;
let total = 0;

function check(label: string, cond: boolean, detail = ''): void {
	total++;
	if (cond) pass++;
	console.log(\`\${cond ? '✓' : '✗'} \${label}\${!cond && detail ? \`\n    \${detail}\` : ''}\`);
}

// TODO: src/$FILE 상단의 성공 기준마다 check() 하나를 쓴다.
//       실패 detail은 "무엇이 틀렸는지"를 말해야 한다 — 'test 1 failed'는 정보가 없다.
check('TODO: 첫 기준', false, '테스트를 아직 쓰지 않았다');

console.log(\`\n\${pass}/\${total} 통과\`);

// 📍 되짚기: docs/{해당 문서}.md § {해당 절}
process.exit(pass === total ? 0 : 1);
TS

  # package.json에 test:{번호} 연결
  node - "$DIR" "$NUM" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const [dir, num] = process.argv.slice(2);
const p = path.join(dir, 'package.json');
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
j.scripts ??= {};
const files = fs.readdirSync(path.join(dir, 'src')).filter((f) => /^\d+-\d+-.+\.ts$/.test(f)).sort();
const solFile = files.find((f) => f.startsWith(num + '-'));
j.scripts[`test:${num}`] = `tsx solutions/${solFile}`;
// 전체 test는 존재하는 과제들을 순서대로 잇는다
const nums = files.map((f) => f.match(/^(\d+-\d+)/)[1]);
j.scripts.test = nums.map((n) => `npm run test:${n}`).join(' && ');
j.scripts.typecheck ??= 'tsc';
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
console.log(`✓ package.json: test:${num} 연결, test 갱신 (${nums.length}개 과제)`);
NODE

  echo "✓ src/$FILE          (문제 — 🎯 TODO)"
  echo "✓ solutions/$FILE    (정답 — 테스트)"
  echo
  echo "다음 할 일"
  echo "  1. src/$FILE 에 성공 기준과 인터페이스를 적는다"
  echo "  2. solutions/$FILE 에 기준마다 check() 하나를 쓴다"
  echo "  3. 양방향 검증: verify-assignment.sh $PKG $NUM <정답구현.ts>"
  exit 0
fi

echo "✗ 알 수 없는 모드: $MODE (package | assignment)"
exit 1

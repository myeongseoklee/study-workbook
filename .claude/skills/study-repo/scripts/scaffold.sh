#!/usr/bin/env bash
# 패키지·과제 스캐폴딩. 규약이 요구하는 파일과 설정을 한 번에 만든다.
#
# 손으로 만들면 vitest.config.ts나 testkit 의존성, tsconfig의 tests 포함을
# 빠뜨리기 쉽고, 그 누락은 감사에서 잡히기 전까지 조용히 남는다.
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

  mkdir -p "$DIR"/{docs,workbook,tests,src,solutions}

  cat > "$DIR/package.json" <<JSON
{
  "name": "$SLUG",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "$DESC",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc"
  },
  "devDependencies": {
    "@study/testkit": "workspace:*"
  }
}
JSON

  cat > "$DIR/tsconfig.json" <<'JSON'
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "tests", "solutions", "vitest.config.ts"]
}
JSON

  cat > "$DIR/vitest.config.ts" <<'TS'
import { defineStudyConfig } from '@study/testkit/config';

export default defineStudyConfig(import.meta.url);
TS

  # docs·solutions가 빈 디렉토리면 git이 추적하지 않는다.
  : > "$DIR/docs/.gitkeep"
  : > "$DIR/solutions/.gitkeep"

  echo "✓ packages/$SLUG 생성"
  echo
  echo "다음 할 일"
  echo "  1. pnpm install                (워크스페이스 링크)"
  echo "  2. docs/00-overview.md 부터 지식 문서 작성 (H1 한글, 파일명 영문)"
  echo "  3. README.md '현재 패키지' 표에 한 줄 추가"
  echo "  4. 과제 추가:  scaffold.sh assignment $SLUG 3-1 <slug> \"설명\""
  echo "  5. 감사:       node .claude/skills/study-repo/scripts/audit-conventions.js $SLUG"
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

  BASE="$NUM-$SLUG"
  [ -e "$DIR/src/$BASE.ts" ] && { echo "✗ 이미 있다: src/$BASE.ts"; exit 1; }

  mkdir -p "$DIR/tests"

  # ── 문제 (스켈레톤) — 학습자가 채운다
  cat > "$DIR/src/$BASE.ts" <<TS
/**
 * 과제 $NUM — $DESC
 *
 * 명세:  tests/$BASE.test.ts ← **먼저 읽어라.** 무엇을 만들지는 거기 있다
 * 판정:  pnpm test $NUM
 * 막히면: docs/{해당 문서}.md § {해당 절}
 */

export function example(input: unknown): unknown {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: example');
}
TS

  # ── 명세 (테스트) — 문제와 함께 주어진다
  cat > "$DIR/tests/$BASE.test.ts" <<TS
/**
 * 과제 $NUM 의 명세 — $DESC
 *
 * 이 파일이 과제의 정의다. \`src/$BASE.ts\`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다.
 *
 * 실행: pnpm test $NUM
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { example } from '../src/$BASE';

describe('example — TODO: 무엇을 검사하는 묶음인가', () => {
	// TODO: it() 설명에는 검사 번호가 아니라 **성질**을 쓴다.
	//       나쁨: 'example 테스트 1'
	//       좋음: 'dtype 항이 실제로 작동한다 — fp8이면 정확히 절반'
	it('TODO: 첫 성질', () => {
		expect(example(null)).toBe(null);
	});

	// TODO: 틀리기 쉬운 지점에는 retrace로 도메인 힌트를 붙인다.
	//       Vitest는 기대/실제 값만 알려주지, 왜 그 값이 나왔는지는 모른다.
	it('TODO: 경계 조건 — 부등호·내림·off-by-one 중 하나는 반드시 검사한다', () => {
		retrace('TODO: 이 검사가 실패했을 때 어디를 의심해야 하는가', () => {
			expect(example(null)).toBe(null);
		});
	});
});
TS

  # ── 참고 구현 — 판정에 쓰지 않는다
  cat > "$DIR/solutions/$BASE.ts" <<TS
/**
 * 과제 $NUM 의 참고 구현.
 *
 * 판정은 \`tests/$BASE.test.ts\`가 한다. 여기 있는 코드는 "정답 하나"가 아니라
 * "성립하는 한 예"다.
 *
 * 📍 되짚기: docs/{해당 문서}.md § {해당 절}
 */

/**
 * TODO: 코드보다 **왜 이 형태인지**를 설명한다.
 *       규칙의 적용 순서, 경계를 그렇게 잡은 이유, 흔한 오답이 왜 오답인지.
 */
export function example(input: unknown): unknown {
	return input;
}
TS

  echo "✓ tests/$BASE.test.ts    (📋 명세 — 학습자에게 주어진다)"
  echo "✓ src/$BASE.ts           (🎯 스켈레톤 — 학습자가 채운다)"
  echo "✓ solutions/$BASE.ts     (✅ 참고 구현)"
  echo
  echo "다음 할 일"
  echo "  1. tests/$BASE.test.ts 를 먼저 쓴다 — 명세가 과제를 정의한다"
  echo "  2. src/$BASE.ts 에 인터페이스만 남기고 본문은 🎯 TODO + throw"
  echo "  3. solutions/$BASE.ts 에 참고 구현과 그 이유를 쓴다"
  echo "  4. 양방향 검증: verify-assignment.sh $PKG $NUM"
  exit 0
fi

echo "✗ 알 수 없는 모드: $MODE (package | assignment)"
exit 1

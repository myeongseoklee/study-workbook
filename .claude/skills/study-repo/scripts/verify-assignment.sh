#!/usr/bin/env bash
# 과제의 명세가 실제로 판정 기능을 하는지 양방향 확인.
#
# "정답에서 통과한다"만 보면 절반이다. 아무것도 검사하지 않는 테스트도 통과한다.
# 그래서 같은 테스트를 두 방향으로 돌린다:
#   ① src/ (🎯 TODO 스켈레톤)  → 전부 실패해야 한다
#   ② solutions/ (참고 구현)   → 전부 통과해야 한다
#
# ①에서 통과하는 항목이 있으면 그 테스트는 비어 있는 것이고,
# ②에서 실패하는 항목이 있으면 명세가 성립 불가능한 것이다.
#
# 치환은 파일을 옮기지 않고 STUDY_TARGET 환경변수로 한다 (@study/testkit의
# defineStudyConfig). 예전처럼 문제 파일을 덮었다 되돌리지 않으므로, 중간에
# 죽어도 작업 트리가 오염되지 않는다.
#
# 사용: verify-assignment.sh <패키지> [과제번호]
#   과제번호를 생략하면 패키지 전체를 검증한다.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
PKG="${1:?패키지명이 필요하다 (예: stateful-context-design)}"
NUM="${2:-}"

PKG_DIR="$REPO/packages/$PKG"
[ -d "$PKG_DIR" ] || { echo "✗ 패키지가 없다: $PKG"; exit 1; }
[ -f "$PKG_DIR/vitest.config.ts" ] || {
  echo "✗ $PKG/vitest.config.ts 가 없다 — defineStudyConfig가 없으면 양방향 치환이 안 된다"
  exit 1
}

# 과제번호가 주어졌으면 세 폴더와 그 안의 index가 모두 있는지 먼저 본다.
# (과제 하나가 폴더 하나다 — README § 규약 2)
if [ -n "$NUM" ]; then
  SRC=$(find "$PKG_DIR/src" -maxdepth 1 -type d -name "${NUM}-*" | head -1)
  [ -n "$SRC" ] || { echo "✗ src/${NUM}-*/ 를 찾을 수 없다"; exit 1; }
  BASE=$(basename "$SRC")
  for d in "tests/$BASE" "solutions/$BASE"; do
    [ -d "$PKG_DIR/$d" ] || { echo "✗ $d/ 이 없다 — 과제는 세 폴더가 한 벌이다"; exit 1; }
  done
  for f in "tests/$BASE/index.test.ts" "src/$BASE/index.ts" "solutions/$BASE/index.ts"; do
    [ -f "$PKG_DIR/$f" ] || { echo "✗ $f 이 없다 — 필수 문제는 index다"; exit 1; }
  done
  EXTRA=$(find "$PKG_DIR/src/$BASE" -maxdepth 1 -name 'extra-*.ts' | wc -l | tr -d ' ')
  if [ "$EXTRA" -gt 0 ]; then
    echo "과제 $PKG / $NUM  ($BASE)  · 선택 문제 ${EXTRA}개"
  else
    echo "과제 $PKG / $NUM  ($BASE)"
  fi
else
  echo "패키지 전체 $PKG"
fi
echo

# vitest는 위치 인자를 테스트 파일명 부분 일치 필터로 쓴다.
run() {
  local target="$1"
  ( cd "$PKG_DIR" && STUDY_TARGET="$target" pnpm exec vitest run ${NUM:+"$NUM"} --reporter=json 2>/dev/null )
}

# JSON 리포터에서 통과/실패 수를 뽑는다. 텍스트 파싱보다 안정적이다.
counts() {
  node -e '
    let raw = "";
    process.stdin.on("data", (c) => (raw += c));
    process.stdin.on("end", () => {
      const start = raw.indexOf("{");
      if (start === -1) { console.log("0 0"); return; }
      try {
        const r = JSON.parse(raw.slice(start));
        console.log(`${r.numPassedTests ?? 0} ${r.numFailedTests ?? 0}`);
      } catch { console.log("0 0"); }
    });
  '
}

# 리포터 출력이 두 정수가 아니면(=vitest/node가 죽었으면) 개수를 믿을 수 없다.
# 빈 값을 그대로 [ -gt ]에 넣으면 셸이 에러를 내면서 **거짓**으로 평가되어,
# 아무것도 검사하지 못한 실행이 성공 분기로 떨어진다 — 감사 도구의 거짓 통과다.
is_num() { case "$1" in ""|*[!0-9]*) return 1 ;; *) return 0 ;; esac; }

FAILED=0

# ── ① 스켈레톤: 전부 실패해야 한다 ─────────────────────────────────────────
echo "① src/ (스켈레톤) — 전부 실패해야 정상"
read -r SKEL_PASS SKEL_FAIL <<<"$(run src | counts)"
if ! is_num "$SKEL_PASS" || ! is_num "$SKEL_FAIL"; then
  echo "  ✗ 테스트가 비정상 종료했다 — 실행 결과를 읽지 못했다"
  echo "     vitest/node가 죽었을 수 있다 (NODE_OPTIONS 등 환경을 확인하라)"
  FAILED=1
elif [ "$SKEL_PASS" -gt 0 ]; then
  echo "  ✗ ${SKEL_PASS}개가 통과했다 — 그 테스트들은 아무것도 검사하지 않는다"
  echo "     스켈레톤은 throw만 하므로, 통과했다면 assertion이 비었거나 상수만 보고 있다"
  FAILED=1
elif [ "$SKEL_FAIL" -eq 0 ]; then
  echo "  ✗ 실행된 테스트가 0개다 — 파일명·경로를 확인하라"
  FAILED=1
else
  echo "  ✓ ${SKEL_FAIL}개 전부 실패"
fi
echo

# ── ② 참고 구현: 전부 통과해야 한다 ────────────────────────────────────────
echo "② solutions/ (참고 구현) — 전부 통과해야 정상"
read -r SOL_PASS SOL_FAIL <<<"$(run solutions | counts)"
if ! is_num "$SOL_PASS" || ! is_num "$SOL_FAIL"; then
  echo "  ✗ 테스트가 비정상 종료했다 — 실행 결과를 읽지 못했다"
  echo "     vitest/node가 죽었을 수 있다 (NODE_OPTIONS 등 환경을 확인하라)"
  FAILED=1
elif [ "$SOL_FAIL" -gt 0 ]; then
  echo "  ✗ ${SOL_FAIL}개가 실패했다 — 명세가 성립 불가능하거나 참고 구현이 어긋났다"
  echo "     상세:"
  ( cd "$PKG_DIR" && STUDY_TARGET=solutions pnpm exec vitest run ${NUM:+"$NUM"} 2>&1 | grep -E "^\s+(×|→)" | head -20 ) || true
  FAILED=1
elif [ "$SOL_PASS" -eq 0 ]; then
  echo "  ✗ 실행된 테스트가 0개다"
  FAILED=1
else
  echo "  ✓ ${SOL_PASS}개 전부 통과"
fi
echo

# ── ③ 두 방향의 개수가 맞는가 ──────────────────────────────────────────────
if [ "$FAILED" -eq 0 ] && [ "$SKEL_FAIL" -ne "$SOL_PASS" ]; then
  echo "③ ✗ 실패 ${SKEL_FAIL}개 ≠ 통과 ${SOL_PASS}개 — 두 방향에서 실행된 테스트 수가 다르다"
  echo "     테스트가 STUDY_TARGET에 따라 분기하고 있는지 확인하라 (그래선 안 된다)"
  FAILED=1
fi

if [ "$FAILED" -eq 0 ]; then
  echo "✓ 양방향 검증 통과 (${SKEL_FAIL} 실패 / ${SOL_PASS} 통과)"
else
  exit 1
fi

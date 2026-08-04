#!/usr/bin/env bash
# 과제의 테스트가 실제로 판정 기능을 하는지 양방향 확인.
#
# 테스트가 "정답에서 통과"하는 것만 보면 절반이다. 아무것도 검사하지 않는
# 테스트도 통과한다. 그래서 두 방향을 본다:
#   ① 스켈레톤(🎯 TODO) 상태 → 실패해야 한다
#   ② 정답 구현 주입 → 통과해야 한다
# ②를 위한 정답 구현은 호출자가 파일로 준다(하네스의 author 에이전트가 작성).
#
# 사용: verify-assignment.sh <패키지> <과제번호> [정답구현.ts]
#   정답구현을 생략하면 ①만 확인한다.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
PKG="${1:?패키지명이 필요하다 (예: stateful-context-design)}"
NUM="${2:?과제번호가 필요하다 (예: 3-1)}"
IMPL="${3:-}"

PKG_DIR="$REPO/packages/$PKG"
[ -d "$PKG_DIR" ] || { echo "✗ 패키지가 없다: $PKG"; exit 1; }

SRC=$(find "$PKG_DIR/src" -maxdepth 1 -name "${NUM}-*.ts" | head -1)
[ -n "$SRC" ] || { echo "✗ src/${NUM}-*.ts 를 찾을 수 없다"; exit 1; }
BASENAME=$(basename "$SRC")
SOL="$PKG_DIR/solutions/$BASENAME"
[ -f "$SOL" ] || { echo "✗ solutions/$BASENAME 이 없다 — 정답 테스트가 필요하다"; exit 1; }

echo "과제 $PKG / $NUM  ($BASENAME)"
echo

# ── ① 스켈레톤 상태: 실패해야 한다 ─────────────────────────────────────────
echo "① 스켈레톤 상태 — 실패해야 정상"
if grep -q '🎯 TODO' "$SRC"; then
  if (cd "$REPO" && npm run --silent "test:$NUM" --workspace "$PKG" >/tmp/skel.log 2>&1); then
    echo "  ✗ 스켈레톤인데 테스트가 통과했다 — 테스트가 아무것도 검사하지 않는다"
    echo "     (성공 기준을 실제로 검사하는 check()가 있는지 확인하라)"
    exit 1
  fi
  echo "  ✓ 예상대로 실패 ($(grep -m1 'TODO' /tmp/skel.log | tr -d '\t' || echo '실패'))"
else
  echo "  △ src에 🎯 TODO가 없다 — 이미 채워진 상태이므로 ①을 건너뛴다"
  echo "     (main 브랜치라면 규약 위반: 풀이는 sol/ 브랜치에서 한다)"
fi
echo

# ── ② 정답 구현 주입: 통과해야 한다 ────────────────────────────────────────
if [ -z "$IMPL" ]; then
  echo "② 정답 구현이 주어지지 않아 건너뜀"
  echo "   테스트가 통과 가능한지 확인하려면 구현 파일을 3번째 인자로 주라"
  exit 0
fi
[ -f "$IMPL" ] || { echo "✗ 정답 구현 파일이 없다: $IMPL"; exit 1; }

echo "② 정답 구현 주입 — 통과해야 정상"
BACKUP=$(mktemp)
cp "$SRC" "$BACKUP"
# 어떤 경로로 끝나도 원본을 되돌린다. 문제 파일이 채워진 채 남으면 규약 위반이 된다.
trap 'cp "$BACKUP" "$SRC"; rm -f "$BACKUP"; echo; echo "  (문제 파일 원상 복구)"' EXIT

cp "$IMPL" "$SRC"
if (cd "$REPO" && npm run --silent "test:$NUM" --workspace "$PKG" 2>&1 | tail -20); then
  echo "  ✓ 정답 구현으로 전항 통과"
else
  echo "  ✗ 정답 구현인데 실패했다 — 테스트나 인터페이스가 어긋났다"
  exit 1
fi

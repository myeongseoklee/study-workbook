# 학습 기록 (study-log 브랜치)

이 브랜치는 **진도와 학습 결과만** 담는다. 교재와 문제(스켈레톤)는 `main`에 있고,
풀이는 `sol/{패키지}/{과제번호}` 브랜치에 있다. 셋을 섞지 않는 이유:

- main은 **문제 상태**를 보존해야 재도전이 가능하고, 패키지를 떼어 공개할 때 깨끗하다
- 진도는 개인적이고 자주 바뀐다 — 교재 이력에 섞이면 교재의 변경 이력이 안 보인다
- 그래서 이 브랜치는 orphan이다. `git log study-log`가 학습 이력만 보여준다

## 파일

- `{패키지}.md` — 패키지 하나의 학습 기록

각 파일의 네 섹션 중 앞의 셋(문서·워크북·코딩 과제)은 **`progress.js`가 관리**한다.
직접 고쳐도 되지만 서식이 흔들리면 집계가 어긋난다. 뒤의 둘(오답 노트·메모)은
**사람과 에이전트의 영역**이다 — 자유롭게 쓴다.

## 조작

```bash
S=.claude/skills/study-progress/scripts/progress.js
node $S status                        # 진도 요약
node $S mark mcp-protocol docs 00-03  # 문서 읽음
node $S check mcp-protocol 3-1        # 과제를 실제로 돌려 확정
node $S save "오늘 한 것"              # 커밋 + push
```

자연어로 하려면 `study-progress` 스킬을 쓴다 — "MCP 3장까지 읽었어" 같은 말을
위 명령으로 옮겨준다.

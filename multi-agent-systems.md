# multi-agent-systems 학습 기록

> 앞의 세 섹션은 `progress.js`가 관리한다. 오답 노트와 메모는 자유롭게 쓴다.
> 코딩 과제의 `통과`는 `check`가 실제 테스트를 돌려서만 붙인다.

## 문서 (읽음)

- [x] 00-overview.md  · doc:0388cea
- [x] 01-prerequisites.md  · doc:c6e272f
- [x] 02-what-is-an-agent.md  · doc:578c497
- [x] 03-langgraph-basics.md  · doc:81a25b5
- [x] 04-multi-agent-patterns.md  · doc:961b92b
- [x] 05-eval-and-observability.md  · doc:fca8394
- [ ] 06-rag-when-needed.md
- [ ] 07-should-you-build-multi-agent.md
- [ ] 08-agent-platform-infra.md
- [ ] 90-must-memorize.md
- [ ] 91-glossary.md
- [ ] 99-references.md

## 워크북

(워크북 없음)

## 코딩 과제

- [x] 02-01  통과 (4/4) · 2026-08-14  · spec:ec1c3f8 sol:7df3406
- [x] 03-01  통과 (3/3) · 2026-08-14  · spec:f129cee sol:25dd803
- [x] 03-01/extra-1-graph-router  (선택) 통과 (9/9) · 2026-08-14  · spec:eef6305 sol:25dd803
- [x] 04-01  통과 (5/5) · 2026-08-14  · spec:9a2e5a7 sol:ed2f2eb
- [x] 04-01/extra-1-agent-router  (선택) 통과 (9/9) · 2026-08-14  · spec:db94d42 sol:ed2f2eb
- [x] 05-01  통과 (4/4) · 2026-08-14  · spec:c6417a2 sol:131cc7b
- [ ] 05-01/extra-1-failure-triage  (선택) 막힘 (4/17 실패) · 2026-08-14  · spec:3287c9d sol:131cc7b
- [ ] 06-01  미확정
- [ ] 06-01/extra-1-hybrid-rank  (선택) 미확정
- [ ] 08-01  미확정
- [ ] 08-01/extra-1-tool-format  (선택) 미확정
- [ ] 08-02  미확정
- [ ] 08-03  미확정
- [ ] 08-04  미확정

## 오답 노트

| 문항 | 내가 쓴 답 | 정답 | 왜 틀렸나 (지식 부족 / 오해 / 부주의) | 재확인 |
|---|---|---|---|---|
| 05-01/extra-1 `classifyFailure` | `!step?.tool?.ok` 로 툴 실패 판정 | `step.tool && !step.tool.ok` — `tool`은 옵셔널이라 미사용 스텝이 `undefined` → `!undefined` → 실패로 뒤집힌다 | 오해 — 옵셔널 체이닝을 "없으면 안전하게 빠짐"으로 읽었으나, 부정과 결합하면 부재가 곧 실패가 된다 | 2026-08-21 |
| 05-01/extra-1 `classifyFailure` | 빈 스텝 가드를 주석 처리하고 뺌 | `steps.length === 0` 가드가 상한 검사보다 **앞**. 없으면 `maxSteps: 0`에서 `0 >= 0`이 참이라 무한 루프로 읽힌다 | 부주의 — 가드를 떠올렸다가 뒤 조건들이 알아서 걸러줄 것으로 보고 지웠다 | 2026-08-21 |

## 메모


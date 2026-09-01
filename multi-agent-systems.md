# multi-agent-systems 학습 기록

> 앞의 세 섹션은 `progress.js`가 관리한다. 오답 노트와 메모는 자유롭게 쓴다.
> 코딩 과제의 `통과`는 `check`가 실제 테스트를 돌려서만 붙인다.

## 문서 (읽음)

- [x] 00-overview.md  · doc:0388cea
- [x] 01-prerequisites.md  · doc:c6e272f
- [x] 02-what-is-an-agent.md  · doc:578c497
- [x] 03-langgraph-basics.md  · doc:81a25b5
- [x] 04-multi-agent-patterns.md  · doc:6340394
- [x] 05-eval-and-observability.md  · doc:fca8394
- [x] 06-rag-when-needed.md  · doc:1041a98
- [x] 07-should-you-build-multi-agent.md  · doc:dbac033
- [x] 08-agent-platform-infra.md  · doc:c771f54
- [ ] 90-must-memorize.md
- [ ] 91-glossary.md
- [ ] 99-references.md

## 워크북

(워크북 없음)

## 코딩 과제

- [x] 02-01  통과 (4/4) · 2026-08-27  · spec:ec1c3f8 sol:cfcb762
- [x] 03-01  통과 (3/3) · 2026-08-27  · spec:f129cee sol:1a12c09
- [x] 03-01/extra-1-graph-router  (선택) 통과 (9/9) · 2026-08-27  · spec:eef6305 sol:1a12c09
- [x] 04-01  통과 (5/5) · 2026-08-27  · spec:9a2e5a7 sol:7d51978
- [x] 04-01/extra-1-agent-router  (선택) 통과 (9/9) · 2026-08-27  · spec:db94d42 sol:7d51978
- [x] 05-01  통과 (4/4) · 2026-08-27  · spec:c6417a2 sol:944d5ce
- [x] 05-01/extra-1-failure-triage  (선택) 통과 (21/21) · 2026-08-27  · spec:4a09fc0 sol:944d5ce
- [x] 06-01  통과 (5/5) · 2026-08-27  · spec:ca68ec9 sol:dddfd5b
- [ ] 06-01/extra-1-hybrid-rank  (선택) 미확정
- [ ] 06-01/extra-2-memory-vector-store  (선택) 미확정
- [x] 06-01/extra-3-chunking  (선택) 통과 (16/16) · 2026-08-27  · spec:a4a7625 sol:dddfd5b
- [x] 06-01/extra-4-rerank  (선택) 통과 (13/13) · 2026-08-27  · spec:8a50585 sol:dddfd5b
- [x] 06-01/extra-5-score-fusion  (선택) 통과 (17/17) · 2026-08-27  · spec:b8510bc sol:dddfd5b
- [x] 06-01/extra-6-retrieval-eval  (선택) 통과 (16/16) · 2026-08-27  · spec:56417d3 sol:dddfd5b
- [x] 08-01  통과 (5/5) · 2026-08-28  · spec:a026500 sol:f915295
- [x] 08-01/extra-1-tool-format  (선택) 통과 (15/15) · 2026-08-28  · spec:e19c31b sol:f915295
- [x] 08-02  통과 (3/3) · 2026-09-01  · spec:db067f3 sol:c1129e4
- [x] 08-03  통과 (3/3) · 2026-09-01  · spec:debe1af sol:3d270f7
- [x] 08-04  통과 (4/4) · 2026-09-01  · spec:a959d84 sol:a9d7b9a

## 오답 노트

| 문항 | 내가 쓴 답 | 정답 | 왜 틀렸나 (지식 부족 / 오해 / 부주의) | 재확인 |
|---|---|---|---|---|
| 05-01/extra-1 `classifyFailure` | `!step?.tool?.ok` 로 툴 실패 판정 | `step.tool && !step.tool.ok` — `tool`은 옵셔널이라 미사용 스텝이 `undefined` → `!undefined` → 실패로 뒤집힌다 | 오해 — 옵셔널 체이닝으로 방어는 넣었는데 `!`와 결합하면 부재가 곧 실패가 된다는 것을 안 따졌다. 테스트엔 없었지만 **타입 `tool?`가 이미 알려준 정보**였다 | 2026-08-21 |

## 메모

### 2026-08-14 · 명세 공백은 오답이 아니다 (05-01 선택)

`maxSteps: 0`에서 `steps.length >= maxSteps`가 참이 되어 빈 트레이스를 `infinite-loop`로 읽던 건,
명세도 타입도(`maxSteps: number`) 알려주지 않은 케이스였다 — 오답이 아니라 **명세 공백**이다.
명세를 보강하는 쪽이 맞는 처방이었고, 실제로 그렇게 했다 (main `e3cab2a`, 선택 테스트 13 → 17개).

가르는 기준: **타입이 말해줬는가.** 말해줬으면 내 오답(`tool?`가 그 경우),
안 말해줬으면 명세를 고친다. 테스트에 없다는 것만으로 면제되지는 않는다.


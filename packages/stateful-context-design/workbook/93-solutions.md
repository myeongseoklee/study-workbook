# 93. 정답과 해설 — 축적된 상태 설계

> 먼저 [92-workbook.md](92-workbook.md)를 풀고 나서 열어보세요.
> 문항 번호가 그대로 대응합니다 (`1-1` → `### 1-1`).

각 항목의 **📍 되짚기**는 그 지식이 어느 파일 어느 절에서 나왔는지 가리킵니다. 틀린 항목은 정답을 외우는 대신 그 절로 돌아가세요 — 파트 1은 암기 카드, 파트 2·3은 원리를 다시 읽는 것이 회복 경로입니다.

---

# 파트 1. 회수 연습

## 1-1

`2 × L × n_kv × head_dim × s × b × bytes`
(K와 V / 레이어 수 / KV 헤드 수 / 헤드 차원 / 시퀀스 길이 / 배치 / 값당 바이트)

가장 자주 빠뜨리는 항은 **`× L` (레이어 수)** 입니다. 어텐션은 레이어마다 독립적으로 일어나고 각 레이어가 자기만의 K·V projection 가중치를 가지므로, 레이어 1의 K와 레이어 2의 K는 완전히 다른 값이며 둘 다 저장해야 합니다. 이 항을 빼면 80레이어 모델의 캐시를 80배 작게 추정합니다.

📍 되짚기: `90-must-memorize.md` 카드 1 / `03-kv-cache.md` § 필수 지식 2

## 1-2

토큰당: `2 × 80 × 8 × 128 × 2 bytes = 327,680 bytes = 320 KB`
128K 배치 1: `320KB × 131,072 ≈ 40 GB`
같은 총량: **8K 컨텍스트 배치 16** (`2.5GB × 16 = 40GB`) — `s`와 `b`가 모두 1차항이므로 곱이 같으면 캐시도 같습니다.

함의: 긴 컨텍스트 지원과 높은 동시 처리량은 **같은 메모리 예산을 나눠 쓰는 경쟁 관계**입니다.

📍 되짚기: 카드 2 / `03-kv-cache.md` § 실제 계산

## 1-3

읽기 0.1× / 쓰기 1.25×(5분), 2×(1시간).
- 5분 TTL: `1.25 + 0.1 = 1.35×` vs 미사용 `2×` → **2회**면 이득
- 1시간 TTL: `2 + 0.1 + 0.1 = 2.2×` vs 미사용 `3×` → **3회 이상** 필요

1시간 TTL은 쓰기 비용이 2배이므로 공짜가 아닙니다. 요청 간격이 5분 이내라면 5분 TTL이 낫습니다.

📍 되짚기: 카드 3 / `06-prompt-caching.md` § 필수 지식 4

## 1-4

세대가 올라갈수록 작아지지 않는다는 뜻입니다 — 최신 Opus 5는 512인데 Opus 4.6·4.5와 Haiku 4.5는 4,096으로 8배 큽니다.

3,000토큰이 캐시되지 않는 모델: **Opus 4.6, Opus 4.5, Haiku 4.5** (모두 4,096). Opus 4.7(2,048)에서는 캐시됩니다.

미달 시 **에러가 없고** `cache_creation_input_tokens: 0`으로 조용히 넘어갑니다. 특히 Haiku 4.5는 저비용 모델인데 최소값이 가장 커서, "싼 모델로 내렸는데 캐시가 꺼져 오히려 비싸지는" 상황이 발생합니다.

📍 되짚기: 카드 4 / `06-prompt-caching.md` § 필수 지식 3

## 1-5

**약 5배**입니다 (Opus 5: $5→$25, Sonnet 5: $3→$15, Haiku 4.5: $1→$5).

원인: 입력은 prefill로 **병렬 일괄 처리**되어 compute-bound이고, 출력은 decode로 **토큰 1개씩 순차 처리**되며 매 토큰마다 모델 가중치와 KV 캐시 전체를 읽어야 해 memory-bound입니다. 연산 강도의 차이가 가격에 반영된 것입니다.

📍 되짚기: 카드 5 / `05-prefill-and-decode.md` § 필수 지식 3

## 1-6

```
① 축적 → ② 접기 → ③ 스냅샷 → ④ 축출 → (①로)
```
- ①→②: 쌓기만 하면 상태를 얻을 방법이 필요하다
- ②→③: 로그가 길어지면 접는 비용이 선형으로 커진다
- ③→④: 스냅샷을 떠도 로그 자체는 계속 커진다
- ④→①: 남은 로그에 계속 쌓는다

함께 기억: **상태는 파생물이고 로그가 진실 원천이다.** 그리고 세 지층 공통 배치 규율은 **안정적인 것을 앞에, 변동하는 것을 뒤에**입니다.

📍 되짚기: 카드 6 / `02-core-principles.md`

## 1-7

| | 스텝당 | 전체 (N개 생성) |
|---|---|---|
| 없음 | `O(n²·d)` | `O(N³·d)` |
| 있음 | `O(n·d)` | `O(N²·d)` |

캐시가 없애는 것은 과거 K·V의 **재계산**뿐입니다. "새 Q가 n개의 K와 점수를 낸다"는 **필연적 계산**은 남으므로 `O(N²·d)`가 잔존합니다. 이를 줄이려면 볼 대상 자체를 줄여야 합니다(슬라이딩 윈도우 → 스텝당 `O(W·d)` 상수).

📍 되짚기: 카드 7 / `03-kv-cache.md` § 필수 지식 1

## 1-8

- prefill: **연산**(compute-bound). 프롬프트 전체를 병렬 처리 → 행렬×행렬(GEMM) → 연산 강도 높음
- decode: **메모리 대역폭**(memory-bound). 토큰 1개씩 → 행렬×벡터(GEMV) → 연산 강도 낮음

decode가 매 토큰 읽는 것: **① 모델 가중치 전체**(70B fp16 = 140GB), **② 해당 시퀀스의 KV 캐시 전체**.

②가 컨텍스트 길이에 비례하므로 컨텍스트가 길어지면 토큰 생성이 느려집니다.

📍 되짚기: 카드 8 / `05-prefill-and-decode.md` § 필수 지식 1

## 1-9

이득: 모델 가중치는 모든 요청이 **공유**하므로 한 번 읽어서 배치 전체에 적용할 수 있습니다. 놀고 있던 연산기를 채웁니다.

한계: **KV 캐시는 요청마다 별개**이므로 배칭으로 읽기 비용이 분산되지 않습니다 — 배치가 커지면 읽어야 할 KV 총량이 비례해 늘어납니다. 게다가 KV 메모리도 `b`에 선형으로 늘어 HBM이 먼저 고갈됩니다.

📍 되짚기: 카드 9 / `05-prefill-and-decode.md` § 필수 지식 2

## 1-10

`유효 시야 ≈ W × L`. Mistral 7B: `4096 × 32 ≈ 131,072` (약 131K 토큰).

손실의 두 이유:
1. **압축 누적** — 하위 레이어의 표현이 이미 여러 토큰을 하나의 벡터로 접은 것이므로, 개별 토큰의 내용을 다시 분리할 수 없습니다.
2. **지목 불가** — full attention은 t7이 t1의 K와 직접 점수를 매겨 지목할 수 있지만, SWA는 중간 토큰을 통해 흘러온 흐릿한 정보만 받습니다.

결과: 대화 지속·요약은 견디고, 정확한 인용·needle-in-haystack은 취약합니다.

📍 되짚기: 카드 10 / `07-sliding-window.md` § 필수 지식 2

## 1-11

- **학습 시점**: GQA / MQA / MLA, 크로스레이어 공유, 슬라이딩 윈도우 → **모델 선택의 기준**
- **런타임**: 접두사 공유, KV 양자화, PagedAttention, 오프로드 → **운영의 조정 손잡이**

서빙 중 시도할 수 없는 것: GQA/MQA/MLA로 바꾸기, 크로스레이어 공유 도입, 슬라이딩 윈도우 추가. 필요하면 **다른 모델로 교체**하는 것이 유일한 방법입니다.

함께: GQA는 `n_kv`를 줄인 비율만큼 캐시를 줄입니다 (Llama 3.1 70B: 64/8 = 8배).

📍 되짚기: 카드 11 / `04-kv-cache-reduction.md` § 종합 비교

## 1-12

TTFT = **prefill** 지표(첫 토큰까지). TPOT = **decode** 지표(토큰당 생성 시간).

프롬프트 캐싱은 prefill을 건너뛰는 기법이므로 **TPOT는 개선되지 않습니다.** decode는 캐시된 KV를 읽어야 하는 작업이므로 캐싱으로 사라지지 않으며, 오히려 프리픽스가 길면 읽을 KV가 많아 TPOT에 불리합니다.

TPOT 문제의 처방: KV 양자화, 컨텍스트 단축, 배치 조정.

📍 되짚기: 카드 12 / `05-prefill-and-decode.md` § 필수 지식 4

## 1-13

원인 후보: 시스템 프롬프트의 `datetime.now()` / `uuid4()` 등 요청별 고유값 / sort_keys 없는 `json.dumps()` / `set` 순회 / 세션·유저 ID 보간 / 조건부 system 섹션 / 유저별 도구 목록 구성.

```
전체 프롬프트 = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
```

`input_tokens`는 **캐시되지 않은 나머지**일 뿐이므로 단일 필드가 아니라 합을 봐야 합니다.

📍 되짚기: 카드 13 / `06-prompt-caching.md` § 필수 지식 2

## 1-14

렌더 순서: `tools → system → messages` (tools가 위치 0).

전면 무효화: **① 도구 정의 변경**(추가/삭제/재정렬), **② 모델 교체**.

우회로:
- 시스템 프롬프트 변경 → `messages[]`에 `{"role": "system", ...}` **append** (Opus 5/4.8/Fable 5/Mythos 5, 베타 헤더 불필요)
- 도구 추가/삭제 → `tool_addition`/`tool_removal` 블록 (Opus 5 이상, 베타)
- **모델 교체 → 우회로 없음.** 캐시는 모델 범위이므로 메인 루프는 한 모델로 두고 저렴한 하위 작업은 서브에이전트로 분리합니다.

📍 되짚기: 카드 14 / `06-prompt-caching.md` § 필수 지식 5

## 1-15

- 요청당 **최대 4개**
- 마커는 **"공유되는 구간의 끝"** 에 둡니다 (전체 프롬프트의 끝이 아님). 끝에 두면 매 요청이 새 항목을 쓰고 아무것도 읽지 않습니다.
- 원인: **20블록 되돌아보기 창.** 각 브레이크포인트는 최대 20개 콘텐츠 블록까지만 뒤로 걸어가며 기존 캐시를 찾습니다. 한 턴에 `tool_use`/`tool_result` 쌍이 쌓여 20블록을 넘으면 조용히 미적중합니다. 처방: 15블록마다 중간 브레이크포인트.
- 추가: 동시 요청은 서로의 캐시를 읽을 수 없으므로, 1개를 보내고 **첫 토큰 스트리밍 후** 나머지를 발사합니다.

📍 되짚기: 카드 15 / `06-prompt-caching.md` § 필수 지식 6

## 1-16

현상: **perplexity가 10~100배 급등**합니다.

원인: **softmax의 "합이 1" 제약.** 모델은 볼 만한 것이 없을 때도 어딘가에 비중을 배출해야 하므로, 학습 과정에서 맨 앞 토큰을 배출구로 삼는 습관(**attention sink**)을 만듭니다. 싱크를 버리면 그 비중이 남은 토큰들에 강제 재분배되며 분포가 왜곡됩니다.

처방: **앞 4개 토큰의 KV를 영구 고정** + 최근 W개 슬라이딩. 이 방식으로 최대 400만 토큰까지 안정 동작이 보고됐습니다.

핵심: **의미가 없다는 것과 구조적으로 필요하다는 것은 다릅니다.**

📍 되짚기: 카드 16 / `07-sliding-window.md` § attention sink

## 1-17

- Gemma 2: local : global = **1 : 1**(교대), local 창 **4,096**, global 범위 8,192
- Gemma 3: local : global = **5 : 1**, local 창 **1,024**

방향: **local 비중을 늘리고 창을 좁혔습니다** — 캐시를 더 공격적으로 절감.

효과: 32K 토큰 기준 KV 오버헤드가 global-only 방식 **60%** → Gemma 3 하이브리드 **15% 미만**. ablation에서 품질 영향은 미미하다고 보고됩니다.

선택 기준: 무한 스트림 → 순수 SWA+sink / 짧고 정확 → full attention / **긴 컨텍스트 + 회수 정확도 → 하이브리드(사실상 기본)**

📍 되짚기: 카드 17 / `07-sliding-window.md` § 필수 지식 3

## 1-18

기준: **원본을 보관하는가.** 보관하면 스냅샷(되돌릴 수 있음), 버리면 축출(되돌릴 수 없음).

철칙: **스냅샷을 전부 지워도 시스템은 느려질 뿐 틀리지 않습니다.** 로그에서 다시 만들 수 있으니까요. 이 성질을 잃으면 스냅샷이 아닙니다.

규율: 스냅샷은 항상 **로그에서** 만들고 **이전 스냅샷에서 만들지 않습니다** — 그러면 오차가 곱해집니다. 연쇄가 불가피하면 카운터를 세고 상한에서 로그 기반 재구축으로 끊습니다.

📍 되짚기: 카드 18 / `02-core-principles.md` 원리 ③ / `09-agent-context-design.md` § 2

## 1-19

| 앵커 | 버리면 |
|---|---|
| 시스템 프롬프트 / 행동 규약 | 페르소나 붕괴, 지시 위반 |
| 도구 정의 | 도구 오사용, 존재하지 않는 도구 호출 |
| 원래 과업 목표 | 목표 표류(다른 일을 시작) |
| 확정된 제약·결정 | 이미 배제한 방향을 재시도 |

구조: `[고정: 앵커] [축출 대상: 오래된 원시 도구 출력] [고정: 최근 N턴]`

이 배치가 캐시 배치 규율(안정→변동)과 **일치**합니다 — 두 요구가 같은 방향을 가리킵니다.

📍 되짚기: 카드 19 / `09-agent-context-design.md` § 3

## 1-20

1. **비멱등 도구**(메일·결제·PR)는 재생 시 **캐시된 결과**를 쓴다. 근본 해법은 도구 입력에 **멱등 키**를 넣는 것.
2. **비결정적 값**(`now()`, `random()`)은 실행 중 생성하지 말고 **주입**한다.
3. **실패는 지우지 말고 append**한다 (`is_error: true`). 지우면 캐시가 깨지고 모델이 같은 실패를 반복한다.
4. **버리기 전에 파일로 쓸 수 있는지 확인**한다 (오프로드 > 축출).

몰라야 하는 것: **실행 컨텍스트 — 지금이 실제 처리인지 재생인지.** 로직 안에 `if (isReplay)`가 들어가면 두 경로가 갈라지고 재생 결정론성이 무너집니다. 판단은 게이트웨이가 투명하게 처리합니다.

📍 되짚기: 카드 20 / `08-event-sourcing.md` § 필수 지식 3 / `09-agent-context-design.md` § 4

---

# 파트 2. 판단 문제

## 2-1 — 해설

**브레이크포인트**: 용어집(공유 구간)의 **끝**에 하나. 사용자 질문 뒤에 두면 매 요청이 새 항목을 쓰고 아무것도 읽지 않습니다.

**TTL**: 업무시간 트래픽이 분당 5~10건이므로 요청 간격이 5분보다 훨씬 짧습니다 → **5분 TTL**이 정답입니다. 실제 요청이 캐시를 계속 살려두므로 1시간 TTL의 2× 쓰기 비용을 낼 이유가 없습니다.

**반대 선택(1시간 TTL)이 나은 조건**: 요청 간격이 5분~1시간으로 드문드문할 때. 예를 들어 이 서비스가 "하루 20건, 산발적"이라면 5분 TTL은 매번 재작성하게 되므로 1시간 TTL이 유리합니다.

**모델 제약**: 3,500토큰은 **Opus 4.6 / Opus 4.5 / Haiku 4.5(모두 최소 4,096)에서 캐시되지 않습니다.** 에러 없이 조용히 꺼지므로, 비용 최적화로 Haiku 4.5를 선택하면 오히려 비싸질 수 있습니다. Opus 4.7 이상 또는 Sonnet 계열(1,024~2,048)을 쓰거나, 용어집을 4,096토큰 이상으로 보강하는 것도 방법입니다.

**야간 처리**: 야간 트래픽이 거의 없다면 캐시를 유지할 이유가 없습니다. 업무 시작 시점에 `max_tokens: 0` 사전 워밍 1회가 첫 요청 TTFT를 개선합니다.

📍 되짚기: `06-prompt-caching.md` § 필수 지식 3·4 / 카드 3·4

## 2-2 — 해설

**(b)가 요구사항에 있으므로 A(full attention) 쪽으로 기울어집니다.** 정확한 문구 인용은 특정 토큰을 **지목**해야 하는 작업이고, SWA local 레이어는 지목이 불가능합니다 — 간접 전파로 흘러온 흐릿한 정보만 받으므로 문구가 변형될 위험이 있습니다. (a) 요약은 B로도 충분합니다.

**단, 성급히 결론 내리지 말 것**: B가 5:1이라도 global 레이어가 존재하므로 장거리 지목이 아예 불가능한 것은 아닙니다. 판단은 스펙이 아니라 **자신의 데이터로 needle-in-haystack 유형 평가**를 돌려서 해야 합니다.

**반대 선택(B)이 나은 조건**:
- 요약·위험 판단이 주 업무이고 인용은 부수적일 때
- 문서가 매우 길어(수십만 토큰) full attention의 KV 메모리가 감당 불가할 때 — B는 32K 기준 오버헤드가 60%→15% 미만입니다
- 인용을 모델의 회수 능력에 맡기지 않고 **검색·오프셋 기반으로 코드가 보장**하는 설계를 택할 때. 이 경우 모델의 지목 능력이 불필요해지므로 B의 메모리 이득만 취할 수 있습니다

마지막 항목이 실무에서 가장 좋은 답인 경우가 많습니다 — **정확성을 모델 능력에 의존하는 대신 아키텍처로 옮기는 것**입니다.

📍 되짚기: `07-sliding-window.md` § 필수 지식 2·3 / 카드 10·17

## 2-3 — 해설

**(가) = 축출(원리 ④), (나) = 스냅샷 또는 축출(원본 보관 여부에 따라).**

**(가)를 먼저** 시도해야 합니다. 이유:

1. **신호 대비 부피**가 큰 것부터 버리는 것이 정석입니다. 성공한 도구 호출의 원시 출력(긴 파일 내용, 검색 결과 전문)은 대체로 결론만 남기면 되는 것들입니다.
2. **(가)는 국소적**이고 (나)는 전면적입니다. (나)는 이력 전체를 요약으로 대체하므로 정보 손실 범위가 훨씬 큽니다.
3. **(나)는 캐시를 전부 재구축**합니다 — 새 컨텍스트는 프리픽스가 완전히 다릅니다.

**(가)를 개선하는 방법**: 제거 대신 **파일로 오프로드**하고 경로만 남기면 되돌릴 수 있습니다(축출 → 계층화). 파일 시스템이 있는 에이전트에게 순수 축출은 거의 항상 차선입니다.

**(나)가 필요해질 때의 필수 조건**: 원본 이력을 보관해야 합니다. 그렇지 않으면 스냅샷이 아니라 되돌릴 수 없는 축출이고, 요약이 중요한 정보를 빠뜨렸을 때 복구 경로가 없습니다. 또 요약의 요약을 반복하지 않도록 연쇄 카운터를 두어야 합니다.

📍 되짚기: `09-agent-context-design.md` § 2·3 / 카드 18

## 2-4 — 해설

**상태가 불확정입니다.** `tool_use`만 있고 `tool_result`가 없으므로 세 가지 가능성이 있습니다 — (1) 호출 전에 죽었다, (2) 호출은 갔지만 응답 전에 죽었다, (3) PR은 생성됐고 결과 기록 전에 죽었다.

**즉시 필요한 정보**: 외부 시스템(GitHub)의 실제 상태를 **조회**해야 합니다. 로그만으로는 알 수 없습니다. 이것이 이벤트 소싱의 "재생에 필요한 모든 것을 이벤트 안에 기록"이 실패한 지점입니다.

**재시작 전략**:
1. 외부 상태 조회로 PR 존재 여부 확인
2. 존재하면 그 결과를 `tool_result`로 append하고 진행 (보정 이벤트 규율 — 로그를 고치지 않고 추가)
3. 없으면 재호출
4. `tool_use`를 로그에서 **지우지 않습니다** — 캐시가 깨지고 이력 추적이 끊깁니다

**프로토콜 수정 (근본 해법)**: `create_pull_request` 입력에 **멱등 키**를 넣습니다. 예를 들어 브랜치명 + 커밋 SHA로 유도한 키를 포함시켜 GitHub 측(또는 그 앞의 게이트웨이)이 중복을 거르게 하면, 재호출이 안전해집니다. 그러면 위 1~3단계의 판단 자체가 불필요해집니다.

**원리로 정리하면**: 재생 안전성을 하네스의 판단 로직에 두는 대신 **프로토콜 수준의 멱등성**으로 옮기는 것입니다. 판단 로직은 버그가 생기지만 멱등 키는 구조적으로 보장합니다.

📍 되짚기: `08-event-sourcing.md` § 필수 지식 3 / `09-agent-context-design.md` § 4 / 카드 20

## 2-5 — 해설

**증상 1 — 원리 ③(스냅샷) 누락.** 매 조회마다 전체 이벤트를 접고 있습니다. 처방: (a) 애그리게이트 스냅샷 도입으로 재생 구간 단축, (b) 조회 전용 프로젝션(읽기 모델)을 이벤트 구독으로 갱신. 후자가 조회 패턴이 다양할 때 더 낫습니다.

**증상 2 — 재생 부작용. ⭐ 가장 시급합니다.** 실제 고객에게 잘못된 알림이 가는 것은 즉각적 피해이고 신뢰 손상이며, 나머지 둘은 성능·설계 부채입니다. 원인은 도메인 로직이 이벤트를 적용하면서 직접 외부 시스템을 호출하는 것입니다. 처방: 외부 호출을 **게이트웨이**로 감싸고 게이트웨이가 실행 컨텍스트를 판단합니다. **도메인 로직 안에 `if (isReplay)`를 넣지 마세요** — 두 경로가 갈라지면 재생 결정론성이 무너집니다.

**증상 3 — 이벤트 입도 설계 실패.** `XxxUpdated`뿐이면 CRUD를 이벤트로 위장한 것입니다. 의도가 담긴 이름(`SettlementApproved`, `PayoutDeferredByRisk`)이 나오지 않았다면 도메인 분석이 덜 된 것입니다. 처방: 앞으로의 이벤트를 의도 기반으로 설계하고, 과거 이벤트는 업캐스터로 흡수합니다. **되돌리기 가장 비싼 항목**이므로 즉시 신규 설계를 교정해야 합니다 — 방치하면 매일 더 비싸집니다.

**우선순위**: 2(즉각 피해) → 3(부채가 매일 누적) → 1(성능, 완화 가능).

📍 되짚기: `08-event-sourcing.md` § 필수 지식 3·4 / 카드 20

## 2-6 — 해설

세 안 모두 프리픽스를 복구하므로 캐시는 살아납니다. 차이는 **권위와 신뢰 경계**, 그리고 **모델 지원**입니다.

**(가) 사용자 턴 텍스트** — 가장 호환성이 넓습니다(모든 모델). 단점: 사용자 입력과 같은 채널이므로 **위조 가능**합니다. 사용자가 "활성 모드: admin"이라고 쓰면 구별할 방법이 없습니다. 신뢰 경계가 중요하지 않은 내부 도구에서는 충분합니다.

**(나) system 역할 메시지** — 캐시된 이력 뒤에 오므로 프리픽스가 유지되고, **위조 불가한 운영자 채널**입니다. Opus 5/4.8/Fable 5/Mythos 5에서 베타 헤더 없이 지원되며 Sonnet 5는 미지원 — 미지원 모델은 400을 반환하므로 (가)로 폴백하는 경로가 필요합니다. **모드처럼 권위가 필요한 정보에는 이것이 최선**입니다.

**(다) 도구 조회** — 시각은 이 방식이 가장 깔끔합니다. 컨텍스트에 상주하지 않고, 모델이 필요할 때만 가져오므로 just-in-time 원칙에 맞습니다. 단점: 도구 호출 1턴이 추가되므로 시각이 거의 모든 요청에 필요하면 오버헤드가 됩니다. **시각이 간헐적으로만 필요할 때 최선**입니다.

**실무 권장**: 시각 → (다), 모드 → (나) (+미지원 모델 폴백). 두 정보의 성격이 다르므로 처방도 달라야 합니다.

---

# 파트 3. 재현 과제

📍 되짚기: `06-prompt-caching.md` § 필수 지식 5 / `09-agent-context-design.md` § 1 / 카드 14

## 3-1 — 테스트

**참고 구현은 주지 않습니다.** 대신 당신의 구현을 판정하는 테스트를 씁니다 — 골격을 읽으면 과제가 독해로 바뀝니다.

아래를 `test-3-1.ts`로 저장하고, 당신의 구현을 `kv-calc.ts`에 두고 `npx tsx test-3-1.ts`로 실행하세요.

**구현해야 할 인터페이스** (내부 구조는 자유):
```typescript
export function bytesPerToken(
  layers: number, nKv: number, headDim: number, dtypeBytes?: number,
): number;

export function feasibleCombos(
  availableBytes: number, bpt: number, candidates: number[],
): Array<[number, number]>;   // [seqLen, batch] 쌍
```

```typescript
import { bytesPerToken, feasibleCombos } from './kv-calc';

let pass = 0;
let total = 0;
function check(label: string, cond: boolean, detail = ''): void {
  total++;
  if (cond) pass++;
  console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? `\n    ${detail}` : ''}`);
}

// 기준 1 — layers·nKv·headDim·dtype으로 토큰당 바이트를 계산한다
const bpt = bytesPerToken(80, 8, 128, 2);
check('토큰당 바이트를 4개 인자로 계산', Number.isInteger(bpt) && bpt > 0,
      `반환값: ${bpt}`);

// 기준 2 — Llama 3.1 70B에서 320 KB
check('Llama 3.1 70B = 320 KB', bpt === 327_680,
      `기대 327680, 실제 ${bpt} — '× 2 (K와 V)'나 '× layers'를 빼먹었는지 확인`);

// 기준 3 — dtype 항이 실제로 작동한다 (fp8이면 절반)
const fp8 = bytesPerToken(80, 8, 128, 1);
check('dtype 항이 반영됨', fp8 === 163_840, `fp8에서 기대 163840, 실제 ${fp8}`);

// 기준 4 — 가용 메모리로 (s, b) 조합을 최소 3개 산출
const combos = feasibleCombos(40 * 1024 ** 3, bpt, [8192, 32768, 131072]);
check('조합 3개 이상 산출', combos.length >= 3,
      `실제 ${combos.length}개: ${JSON.stringify(combos)}`);

// 기준 5 — 40GB에서 8K는 배치 16, 128K는 배치 1 (s와 b의 곱이 보존되는지)
const byLen = new Map(combos);
check('40GB / 8K → 배치 16', byLen.get(8192) === 16, `실제 ${byLen.get(8192)}`);
check('40GB / 128K → 배치 1', byLen.get(131072) === 1, `실제 ${byLen.get(131072)}`);

// 기준 6 — MHA 가정은 GQA의 정확히 8배
const mha = bytesPerToken(80, 64, 128, 2);
check('MHA(nKv=64)는 GQA의 8배', mha === bpt * 8, `기대 ${bpt * 8}, 실제 ${mha}`);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);
```

**테스트가 잡아주는 전형적 실수**: `× 2`(K와 V) 누락 → 기준 2에서 절반이 나옵니다. `× L` 누락 → 80분의 1이 나옵니다. 두 경우 실패 메시지가 어느 항을 의심할지 알려줍니다.

📍 되짚기: `03-kv-cache.md` § 필수 지식 2 / 카드 1·2

## 3-2 — 테스트

`test-3-2.ts`로 저장하고 구현을 `swa-mask.ts`에 두세요. `npx tsx test-3-2.ts`로 실행합니다.

**구현해야 할 인터페이스**:
```typescript
export function visible(i: number, j: number, W: number, nSink?: number): boolean;
export function render(n: number, W: number, nSink?: number): void;  // 표준출력에 그림
```

```typescript
import { visible, render } from './swa-mask';

let pass = 0;
let total = 0;
function check(label: string, cond: boolean, detail = ''): void {
  total++;
  if (cond) pass++;
  console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? `\n    ${detail}` : ''}`);
}

// 기준 1 — (i, j, W, nSink)로 가시성을 반환한다
check('boolean을 반환', typeof visible(3, 2, 4, 0) === 'boolean',
      `반환 타입: ${typeof visible(3, 2, 4, 0)}`);

// 기준 2 — causal: 미래는 못 본다
check('미래 차단 (j > i)', visible(2, 5, 4) === false, 'j > i인데 true를 반환했습니다');
check('자기 자신은 봄 (j === i)', visible(5, 5, 4) === true);

// 기준 3 — 창 조건이 경계까지 정확한가 (i − W < j)
check('창 안은 보임', visible(9, 6, 4) === true, 'W=4, i=9 → j=6은 창 안(6 > 5)');
check('창 밖은 차단', visible(9, 5, 4) === false, 'W=4, i=9 → j=5는 창 밖(5 ≤ 5)');
check('창 경계 정확', visible(9, 4, 4) === false && visible(9, 6, 4) === true,
      '경계가 i-W < j 인지 i-W <= j 인지 확인 — 하나 차이로 창 크기가 달라집니다');

// 기준 4 — sink 예외: 창을 벗어나도 보인다
check('sink는 창 밖에서도 보임', visible(50, 0, 4, 2) === true,
      'i=50이면 j=0은 창을 한참 벗어나지만 sink이므로 보여야 합니다');
check('sink 범위 밖은 여전히 차단', visible(50, 2, 4, 2) === false,
      'nSink=2면 j=0,1만 sink입니다');

// 기준 5 — sink가 causal을 뚫지 않는다
check('sink가 causal을 뚫지 않음',
      visible(1, 0, 4, 2) === true && visible(0, 1, 4, 2) === false,
      '미래 토큰이 sink라도 볼 수 없어야 합니다');

// 기준 6 — W=4, nSink=2, n=10 렌더링에서 sink 열이 모든 행에 채워진다
const captured: string[] = [];
const originalLog = console.log;
console.log = (...args: unknown[]) => { captured.push(args.join(' ')); };
render(10, 4, 2);
console.log = originalLog;

const rows = captured.filter((r) => r.trim().length > 0);
check('10행 출력', rows.length === 10, `실제 ${rows.length}행`);
if (rows.length === 10) {
  const blank = (ch: string) => ch === '.' || ch === '·' || ch === ' ';
  const col0 = rows.every((r) => !blank(r[0]));
  const col1 = rows.slice(1).every((r) => !blank(r[1]));  // 0행의 j=1은 미래라 제외
  check('sink 열이 세로로 채워짐', col0 && col1,
        "왼쪽 2열이 모든 행에서 보여야 합니다 — 이것이 '영구 고정'의 시각적 의미");
}

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);
```

**경계 조건이 이 과제의 핵심입니다.** `i - W < j`를 `i - W <= j`로 쓰면 창이 W+1이 되고, 테스트의 "창 경계 정확" 항목이 잡아냅니다.

📍 되짚기: `07-sliding-window.md` § 필수 지식 1 / 카드 16

## 3-3 — 테스트

`test-3-3.ts`로 저장하고 구현을 `prefix-check.ts`에 두세요. `npx tsx test-3-3.ts`로 실행합니다.

**구현해야 할 인터페이스**:
```typescript
export interface Request {
  tools: unknown;
  system: unknown;
  messages: unknown;
}
export interface CompareResult {
  same: boolean;
  offset?: number;   // 다를 때 처음 갈라지는 위치
}

export function renderPrefix(tools: unknown, system: unknown, messages: unknown): string;
export function compare(a: Request, b: Request): CompareResult;
```

```typescript
import { renderPrefix, compare, type Request } from './prefix-check';

let pass = 0;
let total = 0;
function check(label: string, cond: boolean, detail = ''): void {
  total++;
  if (cond) pass++;
  console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? `\n    ${detail}` : ''}`);
}

const TOOLS = [{ name: 'search' }, { name: 'fetch' }];
const SYSTEM = '당신은 도우미입니다.';
const MSGS = [{ role: 'user', content: '안녕' }];
const base: Request = { tools: TOOLS, system: SYSTEM, messages: MSGS };

// 기준 1 — tools → system → messages 순서로 직렬화한다
const p = renderPrefix(TOOLS, SYSTEM, MSGS);
const iTools = p.indexOf('search');
const iSys = p.indexOf('도우미');
const iMsgs = p.indexOf('안녕');
check('렌더 순서가 tools → system → messages',
      iTools >= 0 && iTools < iSys && iSys < iMsgs,
      `위치: tools=${iTools} system=${iSys} messages=${iMsgs} — tools가 위치 0이어야 합니다`);

// 기준 2 — 같은 요청이면 same=true
{
  const r = compare(base, { tools: TOOLS, system: SYSTEM, messages: MSGS });
  check('동일 입력 → same=true', r.same === true, `반환: ${JSON.stringify(r)}`);
}

// 기준 3 — 다르면 처음 갈라지는 오프셋을 보고한다
{
  const r = compare(base, { tools: TOOLS, system: `${SYSTEM} 간결하게.`, messages: MSGS });
  check('차이 감지', r.same === false, `반환: ${JSON.stringify(r)}`);
  check('갈라지는 오프셋 보고', Number.isInteger(r.offset) && (r.offset as number) > 0,
        `offset이 정수여야 합니다: ${r.offset}`);
  if (Number.isInteger(r.offset)) {
    check('오프셋이 system 구간을 가리킴', (r.offset as number) >= iSys,
          `system을 고쳤으므로 오프셋(${r.offset})이 system 시작(${iSys}) 이후여야 합니다`);
  }
}

// 기준 4 — 시스템 프롬프트의 매 요청 변하는 값(시각)을 잡아낸다
{
  const withNow = (): Request => ({
    tools: TOOLS,
    system: `현재 시각: ${new Date().toISOString()}\n${SYSTEM}`,
    messages: MSGS,
  });
  const r = compare(withNow(), withNow());
  check('시스템 프롬프트의 now()를 불안정으로 판정', r.same === false,
        '두 번 만든 프롬프트가 같다고 나왔습니다 — 시각이 프리픽스에 들어가면 캐시가 깨집니다');
}

// 기준 5 — 도구 순서만 바꿔도 잡아낸다
{
  const r = compare(base, { tools: [...TOOLS].reverse(), system: SYSTEM, messages: MSGS });
  check('도구 순서 변경을 불안정으로 판정', r.same === false,
        '도구는 위치 0이므로 순서가 바뀌면 전체 캐시가 무효입니다');
}

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);
```

**마지막 두 항목에 함정이 있습니다.** 검사기 안에서 `json.dumps(..., sort_keys=True)`로 키를 정렬하면 편하지만, 그렇게 하면 **도구 순서 변경을 놓칩니다**(리스트 순서는 `sort_keys`가 건드리지 않으므로 이 케이스는 통과하지만, 딕셔너리 키 순서 문제는 가려집니다). 더 중요한 것은 **검사기와 실제 요청 코드가 같은 직렬화 경로를 써야 한다**는 점입니다 — 검사기만 정규화하면 검사는 통과하는데 실제 캐시는 미적중합니다. 이것이 이 과제의 핵심 교훈입니다.

📍 되짚기: `06-prompt-caching.md` § 필수 지식 1~2 / 카드 13·14

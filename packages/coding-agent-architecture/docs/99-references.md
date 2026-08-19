# 99. 외부 공식 문서 색인

본문은 그 자체로 완결적이다. 아래 링크는 **더 깊이 탐색하고 싶을 때** 가는 곳이며, 본문 이해에 필수는 아니다.

## 학습 원본

- **뉴런데브 — 코딩에이전트 만들기 재생목록**: <https://www.youtube.com/playlist?list=PLGjmLnACrYZI>
  - #1 (본편, 약 1시간 54분) · #1-사고로 꺼짐(도입부, 약 23분). 채널: 뉴런데브. 업로드 2026-07-29.
  - **#2 비지니스용 에이전트** (라이브, 약 1시간 23분). 2026-08-04 스트리밍. 멤버십(코친멤버) 전용.
  - **#3** (라이브, 약 58분): <https://www.youtube.com/live/xBbmtCHgnBA> — 2강 계획표의 **참조 구현**. 2026-08-11 스트리밍, 공개.
    3강 자료는 화면에 열린 `.codex/skills/*/SKILL.md` 원문을 1차 자료로 쓴다 — 이 회차의 최고 산출물이 화면이 아니라 **지시문**이기 때문이다.
  - **#4 에이전트 서버** (라이브, 약 1시간 42분): <https://www.youtube.com/live/5DsZaAzAYc0> — 이벤트 기반 서버 골격(CPS·멱등·큐·워커). 2026-08-18 스트리밍. 라이브 종료 후 **멤버십 전용**으로 전환됐다.
    4강 자료는 슬라이드 11장을 1차 자료로 쓴다 — 이 회차는 슬라이드가 곧 설계 문서다. 강의자의 메모장 도출(CPS 유도·큐 재정렬 시뮬레이션·워커 사망 시나리오)과 실제 코드 캡처(`claimExecution`·DDL·워커 풀·`VibeEvent` 유니온)를 함께 썼다.
  - #1·#3은 자동 자막, **#2·#4는 자막이 없어 로컬 STT(whisper large-v3-turbo)로 전사**한 뒤 슬라이드 캡처와 교차 확인해 재구성했다.
  - **자동 자막의 한계**: 고유명사가 흔들린다(`SQ라이트`→SQLite, `도코`→Docker, `민피/탑피/탑케`→min_p/top_p/top_k, `잼마`→gemma). 3강의 식별자·수치는 **캡처로 교차 확인**한 값이다. 본문의 `[00:00:00]` 타임스탬프는 원본 영상에서 직접 확인할 수 있는 좌표다.
  - **로컬 STT의 한계 (#4에서 실제로 나타난 것)**: 약어와 영문 용어가 흔들린다 — `CPS`→`GPS`/`CTS`, `멱등`→`몇 등`/`역등`, `UUIDv7`→`UID7`, `선입선출`→`선임 선출`, `엔벨로프`→`엠벨롭`, `어보트`→`어벌트`/`어볼트`. **#4의 모든 식별자·필드명·타입명은 슬라이드·코드 캡처로 교차 확인한 값**이고, 캡처로 확인되지 않은 것(노드 버전, 즉흥 나열된 라이브러리 이름)은 본문에서 근거로 쓰지 않았다.

## 하드웨어 — 검증된 수치

- **NVIDIA H200 (141GB HBM3e, ~4.8 TB/s)**: <https://www.nvidia.com/en-us/data-center/h200/>
  - 90번 카드의 "H200 = 141GB" 근거. H100(80GB HBM3) 대비 VRAM 76%·대역폭 43% 증가.

## 벤치마크

- **Terminal-Bench 2.0**: <https://www.tbench.ai/>
  - 3장에서 언급한 터미널 에이전트 벤치마크. Snorkel AI·스탠퍼드·Laude Institute 공동 제작, 89개 다단계 터미널 태스크를 격리 컨테이너에서 검증. (강의는 "오픈AI 벤치"라 표현했지만 제작 주체는 제3자이며 오픈AI가 쉘 통합 전략상 이를 중시하는 것.)
  - 리더보드(제3자 집계): <https://artificialanalysis.ai/evaluations/terminalbench-v2-1>

## 모델 컨텍스트 창 — 현재 수치 (5장·90 카드)

- **Anthropic 모델 개요 / 컨텍스트·가격**: <https://platform.claude.com/docs/en/about-claude/models/overview>
  - Opus 4.8 / Opus 4.7 / Sonnet 5 / Fable 5 = 1M, Haiku 4.5 = 200K. (컨텍스트 크기는 정책에 따라 바뀌므로, 정확한 최신값은 이 문서나 Models API로 확인.)

## #2 관련 — 직접 확인할 수 있는 것

- **Turborepo (모노레포 빌드)**: <https://turborepo.com/docs>
  - 10장의 `apps`/`packages` 구조와 `turbo.json`. 하부에 비-JS 프로젝트를 함께 두는 구성은 태스크 정의 문서를 참고.
- **pgvector**: <https://github.com/pgvector/pgvector>
  - 10장 베이스. PostgreSQL 벡터 확장. (강의가 얹는다고 한 "카프카 대체 이벤트 스트림 플러그인"은 특정 제품명이 명시되지 않았으므로 여기서 링크하지 않는다.)
- **PowerShell 7 기본 인코딩 UTF-8**: <https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding>
  - 8장의 CP949 문제 근거. Windows PowerShell 5.1은 시스템 로케일(한국어 환경에서 CP949)을 따르고, PowerShell 6+는 UTF-8이 기본.
- **Red Hat Enterprise Linux 컨테이너 도구**: <https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/building_running_and_managing_containers/index>
  - 8장의 "RHEL 환경에서 도커 차단" 맥락. RHEL 8+는 Docker 대신 Podman·Buildah를 기본 제공하며, 사내 보안 정책으로 컨테이너 런타임을 제한하는 경우가 이와 겹친다. **개별 기업의 차단 정책은 공개 문서로 검증할 수 없으므로 강의의 현장 관찰로만 취급하라.**

## #4 관련 — 직접 확인할 수 있는 것

- **PGMQ**: <https://github.com/pgmq/pgmq>
  - 1·6장 베이스. PostgreSQL 메시지 큐 확장. 본문이 말하는 "세 동작"에 대응하는 실제 함수: `pgmq.send` / `pgmq.read(queue, vt, qty)` / `pgmq.set_vt` / `pgmq.delete` / `pgmq.archive`.
  - **`vt`(가시성 타임아웃)와 `archive` vs `delete`의 차이**를 문서에서 직접 확인하라 — 6장의 "삭제 시점" 판단이 이 둘의 구분 위에 있다. 이 모노레포의 [`event-sourcing-msa/docs/11-postgres-as-broker.md`](../../event-sourcing-msa/docs/11-postgres-as-broker.md)에 정리돼 있다.
- **Amazon SQS 가시성 타임아웃**: <https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html>
  - 강의가 PGMQ를 "SQS와 똑같은 일을 한다"고 설명한 근거를 대조할 곳. **`ChangeMessageVisibility`가 본문의 하트비트(`set_vt`)에 해당**하고, AWS 문서도 at-least-once와 중복 수신을 전제로 설계하라고 명시한다.
- **UUIDv7 (RFC 9562)**: <https://www.rfc-editor.org/rfc/rfc9562.html#name-uuid-version-7>
  - 3장의 `eventKey` 발급. 앞부분이 밀리초 타임스탬프라 문자열 정렬이 **대체로** 생성 순서와 일치한다. RFC가 같은 밀리초 안의 순서를 보장하지 않는다는 점을 확인하라 — 그래서 본문은 정렬 근거로 `sequence`를 따로 둔다.
- **Node.js `worker_threads`**: <https://nodejs.org/api/worker_threads.html>
  - 8장의 워커 풀 기반. `postMessage`가 **구조화 복제(structured clone)**를 쓴다는 점이 1장의 "직렬화 대가"가 워커 층에서도 발생하는 이유다. 강의 중 노드 버전 언급이 흔들리지만 이 모듈은 Node.js 12부터 안정 단계이므로 **버전 숫자는 본문에서 근거로 쓰지 않았다.**
- **`AbortController` / `AbortSignal`**: <https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal>
  - 8장. `signal.aborted`를 리스너 등록 전에 검사해야 하는 이유(등록 전에 abort가 오면 리스너가 안 불린다)를 명세에서 확인할 수 있다.
- **트랜잭션 아웃박스 패턴**: <https://microservices.io/patterns/data/transactional-outbox.html>
  - 5장에서 강의자가 *"키워드나 던지고 가자"*로 넘긴 항목. 큐와 DB가 갈라져 있을 때 필요하고, PGMQ처럼 같은 DB 안이면 어긋남이 애초에 작다는 본문 설명의 근거.
- **PostgreSQL `INSERT ... ON CONFLICT`**: <https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT>
  - 5장의 검문소. **"조회 후 삽입"이 아니라 삽입 자체를 판정으로 쓰는** 이유가 여기 있다 — 유일 제약이 원자적으로 승자를 결정한다.
- **TypeScript 판별 유니온(discriminated union)**: <https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions>
  - 7장의 `VibeEvent`. 태그 필드가 없으면 좁혀지지 않아 결국 타입 단정을 쓰게 되고, 그러면 `any`로 때운 것과 안전성이 같아진다.

> ⚠️ #4 검증 안내: 4강 본문의 **테이블 스키마·타입 정의·워커 API는 라이브 화면 캡처에서 읽은 것**이고, 강의 시점에 아직 움직이는 중이었다(DDL의 `CHECK (status IN ('running','completed'))`와 코드가 다루는 종결 상태 넷이 어긋나며, `payload_hash`는 런타임 마이그레이션으로 추가된다 — 11장에 기록). **원리(세 갈래 판정, 삭제 시점, 봉투 4축)는 취하되 필드 목록을 확정 스펙으로 옮기지 말라.** 그리고 이 회차에서 강의자가 언급한 뉴스 사례(개발자 노트북 세션 기록 회수)는 **원문 출처를 확인하지 않았다** — 10장에 그 주의를 명시했다.

## 개념 심화 (본문 원리를 더 파고들 때)

- **RLVR / 강화학습 기반 추론 모델** — 1장 참고 배경. "reinforcement learning with verifiable rewards" 키워드로 각 모델 제공사 기술 블로그 검색.
- **LLM 양자화 / KL divergence 품질 저하** — 6장 근거. "llama.cpp quantization", "GGUF quantization KL divergence" 키워드로 llama.cpp 프로젝트 문서 및 커뮤니티 벤치 확인.
- **KV cache 와 VRAM** — 5·6장 근거. "KV cache memory", "vLLM PagedAttention" 키워드.

> ⚠️ #2 검증 안내: #2 본문의 수치 중 **기반 컨텍스트 5%(코덱스 약 4%), 컴팩션 80% 트리거, 유휴 캐시 약 20분, AGENTS.md 200K 축소, 262K 컨텍스트 예시**는 강의자가 라이브에서 제시한 관찰·경험값이며 공식 문서로 확정된 수치가 아니다. **원리(기반은 작게, 잘림 전에 컴팩트, 캐시는 내려간다)는 취하되 구체 수치는 자기 환경에서 측정하라.** 제품명·모델명 표기는 로컬 STT 전사라 오차가 있을 수 있어 슬라이드 캡처로 확인된 것만 본문에 남겼다.

> ⚠️ 검증 안내: 6장의 구체 모델명(MiniMax M2/M3, Nemotron, GLM, gpt-oss-120B)과 GB 수치, 5장의 특정 모델 컨텍스트 수치(258K 등)는 강의 시점(2026-07-29)의 라이브 관찰·자동 자막 기반이라 오차가 있을 수 있다. **원리("200B·Q5 두 하한", "컨텍스트=비용")는 취하되, 구체 수치는 위 공식 소스로 직접 검증**하라.

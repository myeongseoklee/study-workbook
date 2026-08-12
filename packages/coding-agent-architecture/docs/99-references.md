# 99. 외부 공식 문서 색인

본문은 그 자체로 완결적이다. 아래 링크는 **더 깊이 탐색하고 싶을 때** 가는 곳이며, 본문 이해에 필수는 아니다.

## 학습 원본

- **뉴런데브 — 코딩에이전트 만들기 재생목록**: <https://www.youtube.com/playlist?list=PLGjmLnACrYZI>
  - #1 (본편, 약 1시간 54분) · #1-사고로 꺼짐(도입부, 약 23분). 채널: 뉴런데브. 업로드 2026-07-29.
  - **#2 비지니스용 에이전트** (라이브, 약 1시간 23분). 2026-08-04 스트리밍. 멤버십(코친멤버) 전용.
  - **#3** (라이브, 약 58분): <https://www.youtube.com/live/xBbmtCHgnBA> — 2강 계획표의 **참조 구현**. 2026-08-11 스트리밍, 공개.
    3강 자료는 화면에 열린 `.codex/skills/*/SKILL.md` 원문을 1차 자료로 쓴다 — 이 회차의 최고 산출물이 화면이 아니라 **지시문**이기 때문이다.
  - #1·#3은 자동 자막, #2는 **자막이 없어 로컬 STT(whisper large-v3-turbo)로 전사**한 뒤 슬라이드 캡처와 교차 확인해 재구성했다.
  - **자동 자막의 한계**: 고유명사가 흔들린다(`SQ라이트`→SQLite, `도코`→Docker, `민피/탑피/탑케`→min_p/top_p/top_k, `잼마`→gemma). 3강의 식별자·수치는 **캡처로 교차 확인**한 값이다. 본문의 `[00:00:00]` 타임스탬프는 원본 영상에서 직접 확인할 수 있는 좌표다.

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

## 개념 심화 (본문 원리를 더 파고들 때)

- **RLVR / 강화학습 기반 추론 모델** — 1장 참고 배경. "reinforcement learning with verifiable rewards" 키워드로 각 모델 제공사 기술 블로그 검색.
- **LLM 양자화 / KL divergence 품질 저하** — 6장 근거. "llama.cpp quantization", "GGUF quantization KL divergence" 키워드로 llama.cpp 프로젝트 문서 및 커뮤니티 벤치 확인.
- **KV cache 와 VRAM** — 5·6장 근거. "KV cache memory", "vLLM PagedAttention" 키워드.

> ⚠️ #2 검증 안내: #2 본문의 수치 중 **기반 컨텍스트 5%(코덱스 약 4%), 컴팩션 80% 트리거, 유휴 캐시 약 20분, AGENTS.md 200K 축소, 262K 컨텍스트 예시**는 강의자가 라이브에서 제시한 관찰·경험값이며 공식 문서로 확정된 수치가 아니다. **원리(기반은 작게, 잘림 전에 컴팩트, 캐시는 내려간다)는 취하되 구체 수치는 자기 환경에서 측정하라.** 제품명·모델명 표기는 로컬 STT 전사라 오차가 있을 수 있어 슬라이드 캡처로 확인된 것만 본문에 남겼다.

> ⚠️ 검증 안내: 6장의 구체 모델명(MiniMax M2/M3, Nemotron, GLM, gpt-oss-120B)과 GB 수치, 5장의 특정 모델 컨텍스트 수치(258K 등)는 강의 시점(2026-07-29)의 라이브 관찰·자동 자막 기반이라 오차가 있을 수 있다. **원리("200B·Q5 두 하한", "컨텍스트=비용")는 취하되, 구체 수치는 위 공식 소스로 직접 검증**하라.

# 99. 공식 문서 색인

본문에서 인용한 수치·규격의 근거입니다. **모두 실제로 확인한 URL이며**, 각 항목에 "이 문서에서 무엇을 확인할 수 있는지"를 적었습니다.

---

## 어텐션 기초

| 문서 | 확인할 내용 |
|---|---|
| [Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) | 어텐션 3단계 계산(§3.2), 멀티헤드 구조, `√d` 스케일링의 근거 |
| [Attention Is All You Need — PDF](https://arxiv.org/pdf/1706.03762) | 그림 2의 Scaled Dot-Product Attention 도식 |

---

## KV 캐시 절감 기법

| 문서 | 확인할 내용 |
|---|---|
| [GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints (arXiv:2305.13245)](https://arxiv.org/abs/2305.13245) | GQA 정의, MHA↔MQA 스펙트럼, **uptraining이 원래 사전학습 연산의 약 5%** 로 가능하다는 결과, EMNLP 2023 |
| [GQA — PDF](https://arxiv.org/pdf/2305.13245) | 그룹 분할 도식과 품질·속도 비교 표 |
| [DeepSeek-V2: A Strong, Economical, and Efficient MoE Language Model (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) | MLA(Multi-head Latent Attention). **KV 캐시 93.3% 감소**, 최대 생성 처리량 **5.76배**, 학습 비용 42.5% 절감 |
| [Efficient Memory Management for LLM Serving with PagedAttention (arXiv:2309.06180)](https://arxiv.org/pdf/2309.06180) | PagedAttention. 기존 시스템의 메모리 낭비 **60~80%** → vLLM **4% 미만**, 동일 지연에서 처리량 **2~4배**. §2는 prefill/decode 단계 구분과 memory-bound 성격 |

---

## 슬라이딩 윈도우와 축출

| 문서 | 확인할 내용 |
|---|---|
| [Mistral 7B (arXiv:2310.06825)](https://arxiv.org/pdf/2310.06825) | SWA 정의와 마스크, **rolling buffer cache**, `W=4096 × 32레이어 ≈ 131K` 이론적 attention span, 32k 시퀀스에서 캐시 메모리 **8배** 절감, FlashAttention/xFormers 수정으로 16K·W=4096에서 **2배** 속도 |
| [Efficient Streaming Language Models with Attention Sinks (StreamingLLM, ICLR 2024 — arXiv:2309.17453)](https://arxiv.org/pdf/2309.17453) | **attention sink** 발견, 초기 토큰 축출 시 **perplexity 10~100배 급등**, **앞 4개 토큰** 고정으로 충분, Llama-2/MPT/Falcon/Pythia에서 최대 **400만 토큰** 안정 동작 |
| [Gemma 3 Technical Report (arXiv:2503.19786)](https://arxiv.org/pdf/2503.19786) | local:global = **5:1**, local 창 **1,024**, 32K 기준 KV 오버헤드 global-only **60%** → 하이브리드 **15% 미만**, 품질 영향이 미미하다는 ablation |
| [Gemma 2: Improving Open Language Models at a Practical Size (arXiv:2408.00118)](https://arxiv.org/pdf/2408.00118) | local:global = **1:1**(교대), local 창 **4,096**, global 범위 **8,192** |

---

## 모델 구성값

| 문서 | 확인할 내용 |
|---|---|
| [The Llama 3 Herd of Models (arXiv:2407.21783)](https://arxiv.org/pdf/2407.21783) | Llama 3.1 계열 구성. **70B: 80레이어 / Query 헤드 64 / KV 헤드 8 / head_dim 128 / hidden 8192**, GQA 채택 근거 |

---

## 프롬프트 캐싱과 컨텍스트 관리 (Claude API)

| 문서 | 확인할 내용 |
|---|---|
| [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) | `cache_control` 문법, TTL 옵션(5분/1시간), 브레이크포인트 최대 4개, 최소 캐시 토큰 모델별 표, 무효화 계층, `usage` 필드 |
| [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) | 입력/출력 단가(출력 ≈ 입력 5배), 캐시 읽기 0.1× / 쓰기 1.25×·2× 배수 |
| [Context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing) | `clear_tool_uses_20250919` / `clear_thinking_20251015` 전략 — 축출(요약 아님) |
| [Compaction](https://platform.claude.com/docs/en/build-with-claude/compaction) | 서버 측 자동 요약, compaction 블록을 다음 요청에 되돌려줘야 하는 규칙 |
| [Effective context engineering for AI agents — Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | compaction, 구조화된 노트 작성, **just-in-time 컨텍스트**, "목표 결과 확률을 최대화하는 최소한의 고신호 토큰 집합" 원칙 |
| [Context engineering: memory, compaction, and tool clearing — Claude Cookbook](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools) | 메모리·compaction·도구 결과 정리의 실행 예제 |

> ⚠️ 위 Claude API 수치는 **2026-06-24 기준 캐시된 값**입니다. 모델 가격과 최소 캐시 토큰은 변경될 수 있으므로, 비용 계산에 쓰기 전 위 두 문서를 다시 확인하세요.

---

## 이벤트 소싱

| 문서 | 확인할 내용 |
|---|---|
| [Event Sourcing — Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html) | 원전. "capture all changes as a sequence of events", **complete rebuild**, **temporal query**, 스냅샷의 역할, 그리고 **외부 시스템 재생 부작용과 게이트웨이 패턴** — "도메인 로직은 실행 컨텍스트를 알아서는 안 된다" |
| [Event Sourcing pattern — Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) | 적용 조건, 고려사항, 최종 일관성 문제 |
| [Pattern: Event sourcing — microservices.io](https://microservices.io/patterns/data/event-sourcing.html) | 마이크로서비스 문맥의 트레이드오프, CQRS와의 관계 |

---

## 같은 레포의 관련 학습 자료

이 자료와 인접한 주제를 다루는 기존 자료입니다.

| 자료 | 관계 |
|---|---|
| `docs/study/agentreport/` — 특히 `01-turn-loop-skeleton.md`, `02-memory-and-steering.md` | **가장 인접한 자료.** 턴 루프와 메모리·스티어링을 구현 관점에서 다룹니다. 이 자료의 09는 같은 대상을 **네 원리 관점**에서 재해석한 것이므로 함께 읽으면 구현과 원리가 맞물립니다 |
| `docs/study/coding-agent-architecture/` | 코딩 에이전트 제작 전반(회차별 구조). 이 자료의 09가 그 컨텍스트·캐시 층의 판단 근거를 제공 |
| `docs/study/multi-agent-systems/` | 멀티에이전트 구성. 이 자료의 "모델 교체는 캐시 우회로가 없다 → 서브에이전트로 분리"(카드 14)가 여기 연결 |
| `docs/study/rag-basics/` | RAG 기초·심화. 이 자료의 07(SWA의 회수 취약성)과 09(프로젝션·just-in-time 참조)가 직접 관련 |
| `docs/study/ai-service-design/` | AI 서비스 설계 관점 — 비용·모델 선택 판단이 이 자료의 05(가격 비대칭)와 맞물림 |

---

## 이 자료를 다시 확인해야 할 시점

| 트리거 | 확인할 항목 |
|---|---|
| 새 Claude 모델 출시 | 최소 캐시 토큰 표(카드 4), 가격 배수(카드 3·5) |
| 사용 모델 교체 | 최소 캐시 토큰, 어텐션 구조(하이브리드 비율), 컨텍스트 상한 |
| 새 추론 서버 도입 | PagedAttention 지원 여부, KV 양자화 옵션, chunked prefill 설정 |
| 하네스에 도구 추가·변경 | 캐시 무효화 계층(카드 14), 도구 스키마 진화 규율(`09` §4) |
| 에이전트가 장시간 실행되기 시작 | 앵커 목록(카드 19), 재생 규율(카드 20), 요약 연쇄 상한(`09` §2) |

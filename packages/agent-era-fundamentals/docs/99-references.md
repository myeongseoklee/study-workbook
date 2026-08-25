# 99. 참고 자료 — 원본 좌표와 교정 기록

## 원본 영상

| 항목 | 내용 |
|---|---|
| 제목 | [한영자막] AI 시대에 소프트웨어 기본기가 중요한 이유를 엉클 밥에게 물었습니다 |
| 채널 | Tech Bridge |
| URL | https://youtu.be/IyJNc5vpN1Q |
| 길이 | 56분 39초 |
| 게시 | 2026-08-21 |
| 형식 | 라이브 스트림 인터뷰. 영상 말미에 동시 시청자 1,500명이 언급된다 |

본문의 `[MM:SS]`는 이 영상의 시각이다. 자동 자막 기준이라 몇 초의 오차가 있을 수 있다.

## 구간 좌표 인덱스

| 구간 | 내용 | 이 자료의 문서 |
|---|---|---|
| `00:00~04:15` | 소개, 목욕가운의 유래, 밥의 이력 | (다루지 않음) |
| `04:15~05:43` | 에이전트를 쓰기 시작한 경위와 첫 인상 | 01 |
| `05:43~08:32` | CRAP과 뮤테이션 테스팅의 좌절과 부활 | 03 |
| `08:32~10:28` | 코드를 보지 않는 것을 목표로 삼는 이유 | 01 |
| `10:28~12:22` | 지저분한 코드가 에이전트에 하는 일 | 01 |
| `12:22~15:12` | 규칙 문서의 실패와 lost in the middle | 02 |
| `15:12~17:32` | 똑똑한 구간과 멍청한 구간, 검사를 쌓는 한계, 루프 | 02 · 03 |
| `17:32~22:32` | 다중 에이전트 파이프라인 다섯 단계 | 04 |
| `22:32~25:23` | 생산성 계산, 궤적 개념, 커피와 드라마 | 03 · 04 |
| `25:23~28:11` | 모듈 구조, 아키텍처 뷰어, 의존 규칙 체커 | 05 |
| `28:11~31:06` | 좋은 구조가 주는 것, 깊은 모듈 | 05 |
| `31:06~35:23` | 책에서 바꿀 것, 임계값, 규율과 가치 | 06 |
| `35:23~41:36` | 사전 계획의 실패, 집 짓기 비유 | 07 |
| `41:36~45:24` | spec-driven 논쟁, 명세의 휘발성, 읽기 비대칭 | 07 |
| `45:24~53:06` | 전술과 전략, 신입 학습 경로, 권하는 책 | 08 |
| `53:06~56:39` | 기본기가 중요한 이유, 추상화 계층, 마무리 | 08 |

## 자막 교정 대조표

원본은 **자동 생성 영어 자막**이라 고유명사와 전문 용어가 다수 틀어져 있다. 이 자료는 교정된 표기를 쓴다. 원본 자막과 대조할 때 참고한다.

| 자막 표기 | 교정 | 무엇인가 |
|---|---|---|
| John Aster / John Asterhout / John Osarov | **John Ousterhout** | 『A Philosophy of Software Design』 저자. 깊은 모듈·전술과 전략 개념의 출처 |
| Girkin | **Gherkin** | `given / when / then` 형식의 인수 테스트 기술 언어 |
| cyclatic complexity | **cyclomatic complexity** | 순환 복잡도 |
| Dystra | **Dijkstra** | 밥이 인용 출처로 지목하되 스스로 확신하지 못한다고 밝힌 이름 |
| Ed Yordan | **Ed Yourdon** | 구조적 분석·설계 분야의 저자 |
| claw.md / agents.mmd | **CLAUDE.md / AGENTS.md** | 에이전트 지시 파일 |
| specri development / spectrum development | **spec-driven development** | 명세 주도 개발 |
| Grock | **Grok** | 밥이 처음 쓴 에이전트 |
| Chachi PT | **ChatGPT** | |
| Forran / Cobalt / PL1 | **Fortran / COBOL / PL/I** | 밥이 소년기에 읽은 언어 책들 |
| crap | **CRAP** | 약어다. 아래 항목 참고 |

### 확실하지 않은 것

- **Dex**: 진행자가 "똑똑한 구간·멍청한 구간"을 이 사람의 용어라고 밝히지만 `[15:12]`, 성이 언급되지 않아 특정할 수 없다. 이 자료는 "Dex의 용어"라고만 적는다
- **인터뷰 진행자**: 영상에서 이름이 밝혀지지 않는다
- **"소프트웨어는 인간이 시도한 가장 복잡한 것"의 출처**: 밥이 Dijkstra로 지목하면서 **"내가 이걸 틀리게 말할 것"**이라고 먼저 단서를 달았다 `[53:36]`. 이 자료는 그 불확실성을 그대로 남긴다

## CRAP 점수의 정의

밥은 인터뷰에서 공식을 밝히지 않고 "복잡한 공식"이라고만 말한다 `[06:11]`. 03장에 실은 공식은 영상 밖에서 확인한 것이다.

- **CRAP** = Change Risk Anti-Patterns
- 2007년 Alberto Savoia와 Bob Evans가 Google Testing Blog에 제안했다
- `CRAP(m) = CC² × (1 − cov)³ + CC`
- 원 저자들은 **30을 넘는 함수**를 나쁜 함수로 규정했다. 밥이 쓰는 4·6·8과 다른 이유는 03장에서 다룬다

확인한 자료:

- [Crap4j FAQ](http://www.crap4j.org/faq.html) — 원 저자들이 만든 자바용 도구의 설명
- [The CRAP Metric: Quantifying Code Risk with Cyclomatic Complexity and Test Coverage](https://betterstack.com/community/guides/ai/crap-metric/) — 공식과 지수 설계의 의도에 대한 해설
- [CRAP Metric Is a Thing And It Tells You About Risk in Your Code](https://blog.ndepend.com/crap-metric-thing-tells-risk-code/)

## 영상에서 언급된 책과 사람

| 이름 | 맥락 |
|---|---|
| **Robert C. Martin**, 『Clean Code』 | 화자 본인의 책. 영상에서 진행자가 2판을 들어 보이고 `[03:19]`, 밥은 **부록에 자신과 John Ousterhout의 긴 논쟁이 실렸다**고 말한다 `[31:06]` |
| **John Ousterhout**, 『A Philosophy of Software Design』 | 깊은 모듈 `[30:09]`, 전술과 전략의 구별 `[45:51]`, 함수를 쓰고 그 테스트를 쓰는 방식 `[34:28]` |
| **Tom DeMarco** | 전략적 판단을 배울 자료로 밥이 권한다 `[51:40]` |
| **Ed Yourdon** | 같은 맥락 `[51:40]` |
| **『The Pragmatic Programmer』** | 진행자가 거들고 밥이 동의한다 `[51:40]` |

밥이 권하는 방식에는 단서가 붙어 있다. 상당수가 1970~80년대에 쓰였으므로 **낡은 부분은 걸러 내야 하지만, 그때가 이 교훈들이 학습된 시기**라는 것이다 `[52:08]`.

## 1차 자료의 위치

전사문과 원본 자막은 이 레포에 두지 않았다. 자료를 만든 작업 환경의 캐시에 있다.

```
{작업 레포}/.cc-system/cache/video/uncle-bob-fundamentals-in-ai-era/
├── manifest.json        수집 정보와 충실도 등급 (full-subtitle)
├── transcript.md        25초 단위로 묶은 타임스탬프 전사문
└── subtitles.en.srv1    원본 자동 자막
```

**이 레포에 넣지 않은 이유**는 두 가지다. 자막 전문은 원본 저작물의 사본이고, 이 레포는 공개를 전제하기 때문이다. 그리고 전사문은 학습 자료의 입력이지 학습 자료가 아니다.

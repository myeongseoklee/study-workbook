# 정답과 해설 (3강)

> 먼저 [94-workbook-ep03.md](94-workbook-ep03.md)를 풀고 나서 열어보라. 문항 번호가 그대로 대응한다.
>
> 코딩 과제(3-1~3-3)의 정답은 이 파일에 없다. 판정은 `tests/`의 명세가 하고 참고 구현은 `solutions/`에 있다. 파트 2는 정답이 하나가 아니므로 **기준 답안**(강의자의 실제 스킬 문장)과 채점 포인트를 준다.

## 파트 1. 대조표 복원

### 1-1

| 항목 | 2강의 판정 |
|---|---|
| 1. 인증인가 — 온프레미스 환경을 고려한 자체 인증 | **구현** |
| 2. 공유드라이브 설정기능 | **미구현** |
| 3. 모델라우터 — 에이전트가 사용할 모델의 개인별 할당정책 | **간략하게 구현** |
| 4. 정보검색센터 | **미구현** |

📍 되짚기: `../docs/ep03-admin-implementation/00-overview.md` / 2강 영상 [1:20:51]

### 1-2

| 하위 항목 | 3강 실제 | 판정 |
|---|---|---|
| 토큰기반 세션키 발급 | 세션 키 발급 + 유휴 만료(7200초) | 구현 |
| 중앙에서 세션키 모니터링 및 **변경가능** | 세션 목록 화면, 강제 제거, 만료 기록 보관(86400초) | 구현 |
| 보안을 위해 로그인 시 **다양한 정보수집 커스터마이즈** | 세션 헤더·쿠키 **이름** 설정 + 필수 가입 JSON | **부분** |
| 인가권한 **중간 관리자 위임기능** | 조직 트리 + 책임자 범위 2종 + 재귀 위임 | 구현 |

(하위 항목은 슬라이드상 세 줄이지만 첫 줄이 발급과 중앙 관리를 함께 담고 있어 넷으로 갈라 봤다.)

📍 되짚기: `../docs/ep03-admin-implementation/01-plan-vs-built.md` § 1

### 1-3

**부분으로 남은 것: 로그인 시 정보수집 커스터마이즈.**

빠진 것은 **수집 항목을 정의하는 화면**이다. 계획의 "다양한 정보수집"은 사내 IP·부서·사번·지급 노트북의 보안 프로그램 헤더처럼 **회사마다 다른 풋프린트**를 뜻하는데, 3강이 만든 것은 그 값이 실릴 **통로**(헤더·쿠키 이름)와 가입 시 받을 필드까지다. "이 회사는 이 항목을 남긴다"를 관리자가 정하는 UI는 없다.

자기 구현에서 열어 두는 방법: 감사 필드를 **고정 스키마가 아니라 확장 메타**로 받는다. 고정 컬럼으로 만들면 고객사마다 컬럼 추가가 되고, 그건 스키마 마이그레이션이다.

📍 되짚기: `01-plan-vs-built.md` § 1 / `02-identity-and-session.md` § ④

### 1-4

**`1-c 인가권한 중간 관리자 위임기능`**에 대응한다. 계획표에 "조직 관리"라는 독립 항목은 없다.

독립 기능으로 이해하면 잃는 것: **"왜 조직을 만들었나"의 근거**다. 2강이 요구한 것은 위임이었고, 위임을 구현하려면 **범위를 표현할 단위**가 필요해서 조직이 생겼다. 계정에 `role: manager`만 붙이면 "무엇의 매니저인가"를 말할 수 없다.

이 인과를 놓치면 조직 노드가 왜 **정보/멤버/모델** 세 탭을 갖는지도 설명되지 않는다 — 위임의 대상이 멤버 관리와 모델 통제이기 때문이다.

📍 되짚기: `03-delegation-and-org.md` § 핵심 원리

### 1-5

**개인별 → 조직별.**

| | 개인별 (계획) | 조직별 (구현) |
|---|---|---|
| 결정 기준 | 그 사람의 사용량·역할 | 소속 조직 |
| 필요한 것 | 사용량 집계, 소진 감지, 대체 순위 | 조직 트리, 상속 규칙 |
| 해결하는 문제 | **토큰 예산** | **접근 권한** |

축소가 아니라 **다른 축**이라는 점이 핵심이다. 그리고 조직별을 택한 것이 합리적인 이유도 있다 — 조직 트리는 위임 때문에 이미 필요했으므로 **추가 비용이 작고**, 예산 축은 에이전트가 실제로 토큰을 쓰기 시작한 뒤에야 의미가 있다(그리고 에이전트는 다음 회차다).

📍 되짚기: `04-model-routing.md` § 핵심 원리

### 1-6

접힌 것: **개인별 할당량에 따른 자동 전환정책.**

2강에서 이것은 **"모델 라우터의 핵심 요구"**라고 불렸다 — 엔터프라이즈 할당 토큰이 소진되면 사내 LLM으로 **무중단 전환**하는 것.

자기 구현에서 남겨야 할 여지: 모델 결정을 계정에 미리 박지 말고 **호출 시점에 해석**하게 둔다. 그러면 나중에 "할당량을 보고 다른 프리셋으로 떨어뜨리는" 판단을 그 지점에 끼울 수 있다.

📍 되짚기: `01-plan-vs-built.md` § 3 / 2강 7장

### 1-7

넷 이상: 모노레포 경계(`common`/`server`/`front`)와 프로토콜 타입 위치 / i18n 8개 언어 강제와 키 타입화 / 퍼미션 미들웨어 층(기본 거부) / 파일 400줄 상한 / 5자리 포트 / 볼륨 하나 / 배포 검증·리포트 형식 / 날짜별 테스트 리포트 규정.

출처: **스킬**(`.codex/skills/`).

이 구분이 중요한 이유: 계획표와 스킬은 **층과 수명이 다르다.** 계획표는 이 제품의 것이고, 스킬은 다음 프로젝트에도 간다.

📍 되짚기: `01-plan-vs-built.md` § 5 / `06-skill-enforced-structure.md`

### 1-8

기준: **뒤집기 비용의 역순.** 비싼 결정을 미루면 그때까지 쌓은 코드가 잘못된 가정 위에 선다.

먼저 확정할 다섯:
1. **계정 영구 키** (이메일 / 사번 / 내부 불변 ID)
2. **세션 토큰 성질** (무상태 검증형 / 중앙 관리형)
3. **조직 루트 개수** (단일 / 복수)
4. **모노레포 경계** (프로토콜 타입 위치)
5. **i18n 도입 시점** (처음부터 / 나중에)

📍 되짚기: `01-plan-vs-built.md` § 결정 목록

### 1-9

| 결정 | 비용 | 함께 움직이는 것 |
|---|---|---|
| 마스터를 DB / 환경변수 | **낮음** | 재기동 절차만 |
| 계정 영구 키 이메일 / 사번 | **높음** | 감사 로그·조직 멤버십의 모든 참조. 이력이 섞인 뒤에는 분리 근거가 없다 |
| 유휴 7200 / 3600 | **낮음** | 설정값 하나 |
| 조직 루트 단일 / 복수 | **높음** | 스키마·조회 쿼리·트리 UI·권한 판정·모델 할당 상속 |
| 모델 등록 단위 모델 / 프리셋 | **높음** | 등록 화면·할당 화면·호출 해석 지점. 모델 단위면 용도별 설정을 담을 곳이 없다 |

흔한 오답: 유휴 시간을 "보안에 중요하니 비싸다"로 분류하는 것. **중요도와 뒤집기 비용은 다르다** — 중요하지만 값 하나만 바꾸면 되는 것이 있다.

📍 되짚기: `01-plan-vs-built.md` § 결정 목록

### 1-10

**"남겨야 할 여지"**를 함께 적는다. "안 만들었다"와 "결정하지 않았다"는 다르고, 후자는 나중에 앞선 결정과 충돌한다.

공유드라이브의 경우: **프로젝트 생성 경로를 코드에 고정하지 않는다.** 사내 GitLab·GitHub Enterprise 연동이 붙을 자리이고, 팀별·개인별 공간 설정은 S3 버킷 설정과 같은 성격의 작업이 된다. 지금 경로를 로컬 기준으로 하드코딩하면 나중에 그 자리가 막힌다.

📍 되짚기: `01-plan-vs-built.md` § 2 / 2강 9장

---

## 파트 2. 스킬 문장 고쳐쓰기

채점 포인트는 셋이다 — **① 위반의 지위가 명시됐는가 ② 실패 양상이 적혔는가 ③ 판정 가능한가.**

### 2-1

기준 답안 (강의자의 실제 문장):

> Every language file carries the **identical key set**. A key present in one file and missing from another is a **violation, not a to-do**.

채점: `가능하면`을 지웠는가 / **`violation, not a to-do`처럼 지위를 못박았는가** / "다 넣어 주세요"를 "동일 키셋"이라는 판정 가능한 조건으로 바꿨는가.

원문의 문제는 `가능하면`이다. 모델은 애매한 지시를 자기에게 유리하게 해석하므로, "가능하면"은 "안 해도 되는 경우가 있다"로 읽힌다.

📍 되짚기: `05-instructing-the-agent.md` § ④

### 2-2

기준 답안:

> Health is verified over the published port. **Do not assume `127.0.0.1` is the Docker host**; try the valid host candidates. **A deploy that never proved a response is not a successful deploy.**

채점: "확인해 주세요"를 **성공의 정의**로 바꿨는가 / 확인 대상(published port)을 특정했는가 / `127.0.0.1` 가정 금지처럼 **알려진 함정**을 막았는가.

핵심은 마지막 문장이다. "확인하라"는 확인하지 않을 여지를 주고, **"확인하지 않은 것은 성공이 아니다"**는 여지를 없앤다.

📍 되짚기: `07-build-cycle.md` § ②

### 2-3

기준 답안:

> Prefer one clear top-level function over a chain of single-use private helpers. First-level decomposition is fine; **nesting needs real duplication, a second caller, or a genuine boundary (parsing, validation, persistence, network IO, a nontrivial algorithm).**
>
> No helper for one expression, call, regex, `trim`/`toLowerCase`, or sanitization line.

채점: `적당히`를 **조건 열거**로 바꿨는가 / 열거된 조건이 대조 가능한가(하나씩 물어볼 수 있는가).

"적당히"는 판정이 불가능하다. 정당한 경우를 세면 모델도 리뷰어도 대조할 수 있다.

📍 되짚기: `05-instructing-the-agent.md` § ⑥ / `06-skill-enforced-structure.md` § ②

### 2-4

기준 답안:

> **Flat, not nested.** The key **is** the dotted path: `"app.shell.menu.open.button"`. Nesting **hides the namespace and makes a key impossible to grep.**

채점: `되도록`을 지웠는가 / **이유가 실패 양상으로** 적혔는가(grep 불가) / 키의 정체를 정의했는가(점 경로 자체가 키).

grep 가능성을 이유로 든 것이 중요하다. 검색이 안 되면 정적 검사 자체가 성립하지 않으므로, 이 규칙은 다른 규칙의 전제다.

📍 되짚기: `05-instructing-the-agent.md` § ⑧

### 2-5

기준 답안 — 형식 지정 + 근거 강제:

```
Everything lands in one report block. A deploy that succeeds silently cannot be reviewed.

deploy-report-begin
result:  status=<ok|failed> services=<...> compose=<refreshed|already-current|failed>
time:    total=<n>ms resolve=<n>ms install=<n>ms build=<n>ms compose=<n>ms verify=<n>ms
verify:  <one line per service and per health probe>
changed: files_edited=<...>
deploy-report-end
```

> **Base the final answer on that block** and carry its four summary lines (`result`, `time`, `verify`, `changed`) into the answer.

채점: 형식을 `key=value`로 **파싱 가능하게** 고정했는가 / 리포트를 요구하는 이유를 적었는가 / **마지막 한 문장**(최종 답변을 그 블록에 근거하게)을 넣었는가.

마지막 문장이 환각 방지 장치다. 형식만 요구하면 모델이 형식을 흉내내며 내용을 지어낼 수 있고, 답변을 블록에 묶으면 **보고와 실제가 어긋날 수 없다.**

📍 되짚기: `05-instructing-the-agent.md` § ⑨ / `07-build-cycle.md` § ②

### 2-6

기준 답안 (강의자의 실제 문장):

> `ar` Arabic — **forces right-to-left to be handled, not assumed**
>
> `ar` **is load-bearing.** Keeping a real RTL locale in the shipped set is what stops layout and iconography from **silently hard-coding one direction.** Do not drop it to "add later"; **the layout debt compounds.**

왜 이유를 반드시 적어야 하는가: 아랍어가 목록에 있는 이유는 시장이 아니라 **RTL을 가정하지 못하게 만드는 장치**다. 이유를 안 적으면 다음 사람이 "우리는 아랍권에 안 팔아요"라며 지우고, 그 순간 레이아웃과 아이코노그래피가 한 방향으로 굳는다. 그리고 그 부채는 화면이 늘어날수록 복리로 커진다.

일반화하면: **지워질 것 같은 항목에는 지우면 안 되는 이유를 미리 적는다.**

📍 되짚기: `05-instructing-the-agent.md` § ⑦

### 2-7

이유: **모델은 일반 코딩 지식을 이미 안다.** 스킬에 일반론을 적으면 **기반 컨텍스트 예산**(2강 3장의 5%)만 먹고 얻는 것이 없다. 스킬은 **이 레포에서만 참인 것**을 담아야 한다.

빼면 나빠지는 것: 본문이 길어져 예산을 잠식하고, 정작 이 레포 고유의 제약이 일반론에 묻힌다. 분량이 늘면서 강제력은 떨어진다.

📍 되짚기: `05-instructing-the-agent.md` § ①

### 2-8

빠진 것 둘: **무엇을 강제하는지**가 구체적이지 않고, **언제 로딩되는지**(트리거)가 없다.

기준 형태:

> description: Enforce the repository monorepo contract: TypeScript latest stable, Turbo plus npm workspaces, exact versions, package and app boundaries, domain-package shape, client/server protocol contracts, env-schema usage, and React plus shadcn/ui plus Express wiring. **Use when creating or reviewing packages, app service modules, `package.json`, `tsconfig`, workspace imports, wire/protocol types, env handling, or frontend/backend integration.**

채점: `Use when …` 절이 있는가 / 트리거가 **파일·작업 이름으로 열거**됐는가("아키텍처 작업 시" 같은 추상어가 아니라 `package.json`·`tsconfig`처럼).

트리거가 없으면 모델이 로딩 시점을 판단할 근거가 없다.

📍 되짚기: `05-instructing-the-agent.md` § ②

---

## 파트 3. 코딩 과제

정답은 이 파일에 없다. `tests/`의 명세가 판정하고 `solutions/`에 참고 구현이 있다.

막혔을 때의 되짚기 지점만 적는다.

| 과제 | 자주 막히는 곳 | 되짚기 |
|---|---|---|
| 3-1 세션 생명주기 | 보관 기간의 **기준 시점**(마지막 요청이 아니라 만료 시점) / 만료된 세션의 touch | `02-identity-and-session.md` |
| 3-2 조직 트리 | `roots`를 `find`로 구현 / `node`와 `subtree` 범위를 구별하지 않음 / 모델 할당을 합집합으로 | `03-delegation-and-org.md` |
| 3-3 i18n 감사 | **키셋 기준을 `en`으로 잡음**(합집합이어야 한다) / 중첩과 빈 값을 한 종류로 처리 | `06-skill-enforced-structure.md` § ④⑤ |

---

## 파트 4. 자기 구현 — 판정 체크리스트

**동작 여부로 채점하지 않는다.** 참조 구현과 다른 답이어도 되고, 화면이 덜 예뻐도 된다. 이 과제가 확인하는 것은 **계획을 결정으로 내리고, 그것을 어기지 못하게 시키고, 확인해서 남겼는가**다.

### 4-1 결정표

- [ ] 다섯 결정에 **자기 답**이 적혀 있다 (참조 구현 복사가 아니라)
- [ ] 각 답에 **근거**가 붙어 있다. 근거가 "강의에서 그랬으니까"면 미달이다 — 자기 조건(고객사·규모·배포 형태)이 언급돼야 한다
- [ ] 참조 구현과 **다른 선택이 하나라도** 있다면 왜 다른지 적혀 있다
- [ ] 계정 영구 키에 대해, 이메일을 고른 경우 **재사용 문제를 어떻게 다룰지**가 있다

### 4-2 스킬

- [ ] 스킬 문서가 **둘 이상**이고, 하나는 경계·하나는 검증을 강제한다
- [ ] 각 스킬에 `description`이 있고 **`Use when` 트리거**가 파일·작업 이름으로 적혀 있다
- [ ] 금지 규칙에 **이유가 실패 양상으로** 적혀 있다 ("권장하지 않음"이 아니라 "무엇이 어떻게 깨지는가")
- [ ] **위반의 지위를 못박은 문장이 하나 이상** 있다 (`violation, not a to-do` 계열)
- [ ] "적당히"·"가능하면"·"되도록" 같은 표현이 **0개**다
- [ ] **검사 스크립트가 하나 이상** 있고 실제로 돌아간다 — 규칙만 있고 검사가 없으면 이 항목은 미달이다
- [ ] 일반 코딩 지식이 본문에 없다 (`Skip generic coding knowledge`)

### 4-3 세션 분할

- [ ] 세션 목록이 있고, 입자가 **화면의 한 부분** 수준이다 ("어드민 만들기" 같은 통짜가 아니라)
- [ ] 수정 세션이 섞여 있다 — 한 번에 완성되지 않는 것이 정상이다
- [ ] 목록을 보고 **되돌릴 단위**를 지목할 수 있다

### 4-4 검증과 기록

- [ ] 스크린샷 또는 동등한 증거가 있다
- [ ] 배포·검증 결과가 **날짜별 산출물**로 남아 있다 (세션 로그로 대체하지 않았다)
- [ ] 성공의 정의가 문장으로 있다 — "응답을 증명하지 못한 것은 성공이 아니다" 계열
- [ ] 리포트에 실패한 것도 남는다 (성공만 기록하면 리뷰가 안 된다)

### 흔한 미달 셋

1. **결정표를 건너뛰고 바로 시킴** — 그러면 참조 구현을 베끼게 되고, 자기 조건이 다를 때 그 차이를 발견하지 못한다
2. **스킬은 썼는데 검사가 없음** — 규칙이 지시로만 남아 서서히 무너진다
3. **동작하는 화면을 성공으로 봄** — 두 번째 수정이 되는지가 기준이다

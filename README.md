# study — 학습 워크북 모노레포

학습 주제 하나가 패키지 하나다. 각 패키지는 **지식 문서**(읽는 것) · **문제**(푸는 것) · **테스트**(무엇을 만들지 정의하는 것)를 함께 담는다.

이 파일은 **레포 규약의 단일 진실 원천**이다. 자료를 생성하는 하네스(`cc-system`의 `study-material-generator`)는 이 규약을 중복 서술하지 않고 여기를 참조한다. 규약이 바뀌면 여기만 고친다.

## 구조

```
study/
├── pnpm-workspace.yaml     워크스페이스 정의
├── turbo.json              태스크 오케스트레이션 (test / typecheck / build)
├── package.json            루트 툴체인 (turbo, vitest, typescript, tsx)
├── tsconfig.base.json      공통 컴파일러 설정
├── README.md               ← 이 파일 (레포 규약)
└── packages/
    ├── testkit/            @study/testkit — 과제 테스트 공용 도구
    └── {주제-slug}/
        ├── package.json    test / typecheck 스크립트
        ├── tsconfig.json   base 상속
        ├── vitest.config.ts  defineStudyConfig 한 줄
        ├── docs/           지식 문서 — 00~09, 90 암기, 91 용어, 99 참고
        ├── workbook/       서술형 문항 — 92 문제 / 93 정답
        ├── tests/          📋 명세 — 학습자에게 **주어지는** Vitest 테스트
        ├── src/            🎯 문제 — TODO 스켈레톤 (학습자가 채운다)
        └── solutions/      ✅ 참고 구현 (src와 같은 파일명)
```

### 현재 패키지

| 패키지 | 주제 |
|---|---|
| `testkit` | 과제 테스트 공용 도구 (주제 패키지가 아니라 도구 패키지다) |
| `multi-agent-systems` | 멀티 에이전트 시스템 — LangGraph, 협업 패턴, 평가, RAG, 인프라 |
| `stateful-context-design` | 축적된 상태 설계 — KV 캐시, 슬라이딩 윈도우, 이벤트 소싱을 관통하는 네 원리 |
| `coding-agent-architecture` | 코딩 에이전트 만들기 — 에이전트 루프·도구·컨텍스트(1강)와 세션·컴팩션·기업 납품(2강). 회차가 늘어나는 시리즈라 `docs/`가 회차 폴더(`ep01-`, `ep02-`) + 누적 문서 구조다 |
| `ecs-fargate-iac` | CloudFormation으로 ECS Fargate 읽기 — IaC·네트워크·ALB·IAM·시크릿·알람·배포 |

> `multi-agent-systems`는 이 규약이 정해지기 전에 만들어졌다. 실습이 살아 있는 LLM API를 호출하는 성격이라 단위 테스트로 판정할 수 없어, `src/`(연습) ↔ `solutions/`(완성 구현) 두 폴더 구조를 그대로 둔다. `tests/`가 없는 유일한 주제 패키지다.

---

## 규약 1 — 문서화

**한 파일은 한 가지 일만 한다.**

| 파일 | 담는 것 | 담지 않는 것 |
|---|---|---|
| `docs/00-overview.md` | 학습 목표, 로드맵, 예상 시간 | 개념 설명 |
| `docs/01`~`0N` | 핵심 원리 → 필수 지식 → 암기 필수 → 자가 진단 | 정답을 요구하는 문항 |
| `docs/90-must-memorize.md` | 검색 없이 즉답할 항목만 (전체의 10~20%) | 부가 설명 |
| `docs/91-glossary.md` | 용어를 레이어로 묶고 인과까지 | 가나다순 나열 |
| `docs/99-references.md` | **실제로 확인한** 외부 URL만 | 추측 URL |
| `workbook/92-workbook.md` | 서술형 문항 | **정답 (0건)** |
| `workbook/93-solutions.md` | 그 정답·해설 + 📍 되짚기 | 문항 재기재 |

**H1은 한글 우선, 파일명은 영문 slug.** 노션·다른 채널에 올릴 때 H1이 페이지 제목이 되고, 파일명은 도구·git 호환을 위해 영문을 유지한다.

**자기완결성**: 핵심 내용은 이 문서만으로 이해 가능해야 한다. 공식 문서는 "더 깊이 알고 싶을 때" 가는 곳이고, "이해하려면 반드시 거쳐야 하는 경로"가 아니다.

---

## 규약 2 — 문제와 정답

### 분리가 원칙이다

**문제 파일에는 정답이 없다.** 접기(`<details>`)로 감추는 것은 분리가 아니다 — 렌더러가 지원하지 않으면 그대로 노출되고, 검색(⌘F)과 AI 요약은 접힌 내용까지 훑는다.

| | 문제 | 정답 |
|---|---|---|
| 서술형 | `workbook/92-workbook.md` | `workbook/93-solutions.md` |
| 코딩 | `src/3-1-kv-calc.ts` | `solutions/3-1-kv-calc.ts` |

**대응 키**: 서술형은 문항 번호(`1-3` → `## 1-3`), 코딩은 **파일명이 같다**.

### 한 파일 = 한 문제

코딩 문제는 파일 하나에 문제 하나만 정의한다. 파일명은 `{과제번호}-{slug}.ts`이고, 세 폴더에서 **같은 이름**을 쓴다.

```
tests/3-1-kv-calc.test.ts   📋 명세 — 주어진다
src/3-1-kv-calc.ts          🎯 스켈레톤 — 학습자가 채운다
solutions/3-1-kv-calc.ts    ✅ 참고 구현
```

### 테스트는 문제와 함께 주어진다

테스트는 정답이 아니라 **명세**다. 정답 폴더에 숨기지 않고 문제와 같이 준다. 무엇을 만들지 모르는 채로 코드를 쓰는 것은 학습이 아니라 추측이기 때문이다.

| | 산문으로 요구사항을 쓸 때 | 테스트로 명세를 줄 때 |
|---|---|---|
| 요구사항의 정확성 | 경계 조건이 모호하게 남는다 | 실행 가능해서 모호할 수 없다 |
| 성공 판정 | 주관적 | **객관적**(통과/실패) |
| 막혔을 때 | 무엇이 부족한지 스스로 추론 | 실패한 항목이 어디가 틀렸는지 지목 |
| 자료가 낡으면 | 조용히 틀린 채로 남는다 | 테스트가 깨져서 드러난다 |

**작성 규칙**

- 테스트 파일 상단에 **"이 파일은 고치지 않는다"**를 명시한다. 명세를 고쳐 통과시키는 것은 푸는 게 아니다.
- 인터페이스(함수명·시그니처)만 못박고 내부 구조는 열어 둔다.
- `it()` 설명은 **검사 항목이 아니라 성질**을 쓴다. `'bytesPerToken 테스트 2'`가 아니라 `'dtype 항이 실제로 작동한다 — fp8이면 정확히 절반'`.
- 틀리기 쉬운 지점에는 `retrace()`로 **도메인 힌트**를 붙인다. Vitest의 `expected 163840 to be 327680`은 숫자만 알려주지, 왜 반이 됐는지는 과제를 만든 사람만 안다.
- 경계 조건을 반드시 하나 이상 검사한다. 부등호 방향·내림·off-by-one이 학습자가 실제로 틀리는 곳이다.
- LLM 호출·네트워크·시계·난수는 `scripted()`로 대본화한다. 비결정적 테스트는 우연히 통과해서 틀린 구현을 통과시킨다.

### 참고 구현은 판정에 쓰지 않는다

`solutions/`는 **왜 그렇게 푸는지**를 담은 산문 딸린 구현이다. 판정은 언제나 `tests/`가 한다.

- 각 파일 상단에 `📍 되짚기`로 해당 문서 위치를 남긴다.
- 코드보다 **왜 이 형태인지**를 설명한다. 규칙의 적용 순서, 경계를 그렇게 잡은 이유, 흔한 오답이 왜 오답인지.
- "정답 하나"가 아니라 "성립하는 한 예"로 쓴다.

### 양방향 검증 — 과제를 만들 때 반드시 한다

같은 테스트를 두 방향으로 돌린다.

```bash
pnpm test                # src/ 대상 → 전부 실패해야 정상
pnpm test:solutions      # solutions/ 대상 → 전부 통과해야 정상
```

한 방향만 확인하면 **아무것도 검사하지 않는 테스트**가 통과한다. 스켈레톤에서 통과하는 항목이 있다면 그 테스트는 비어 있는 것이고, 정답에서 실패하는 항목이 있다면 명세가 성립 불가능한 것이다.

치환은 `@study/testkit`의 `defineStudyConfig`가 처리한다. 테스트 파일에는 평범한 상대 경로(`../src/3-1-kv-calc`)만 보이고, `STUDY_TARGET=solutions`일 때 그것이 `solutions/`로 바뀐다.

문제 스켈레톤에는 `🎯 TODO`를 남기고 `throw new Error('TODO: 함수명')`으로 시작한다 — 채우기 전에는 테스트가 실패하는 것이 정상이다.

---

## 규약 3 — 기술 스택

학습 자료가 특정 기술을 다루는 게 아니라면 다음 기본값을 쓴다.

| 층 | 기본값 | 이유 |
|---|---|---|
| 패키지 매니저 | **pnpm** 10 | 선언하지 않은 의존성을 import하면 실패한다. 학습 레포에서 유령 의존성은 "내 환경에선 됐는데"의 원인이 된다 |
| 런타임 | **Node.js** 20+ | |
| 언어 | **TypeScript** | |
| 테스트 | **Vitest** 4 | |
| 태스크 실행 | **Turborepo** 2 | 패키지 간 의존 순서와 캐시 |
| 단발 실행 | `tsx` | 빌드 없이 `.ts`를 바로 돌린다 |
| 서버가 필요하면 | **Fastify** 또는 **Express** | |

**이 기본값을 벗어나는 기술 선정이 필요하면 작업 전에 사용자에게 묻는다.** DB(Postgres? SQLite?), 프론트엔드(React? 바닐라?), 벡터 저장소 같은 선택은 임의로 정하지 않는다 — 학습자 환경과 어긋나면 과제가 실행조차 안 된다.

예외는 둘뿐이다: **학습 주제가 이미 기술을 정하고 있다**(Rust 소유권 자료라면 Rust), **선택의 여지가 없다**(CUDA 커널).

### @study/testkit

과제 테스트가 반복해서 필요로 하는 것만 담는다. 새 헬퍼는 **두 패키지 이상에서 필요해진 뒤에** 넣는다.

| 도구 | 언제 쓰나 |
|---|---|
| `retrace(hint, fn)` | 틀리기 쉬운 assertion에 도메인 힌트를 붙일 때 |
| `captureStdout(fn)` | 반환값 없이 화면에 그리는 함수를 검사할 때 |
| `scripted(steps, label?)` | 모델 응답·시계·외부 호출을 대본으로 고정할 때. 호출 인자도 기록되고, 대본이 소진되면 원인을 지목하며 던진다 |
| `defineStudyConfig(url)` | 패키지 `vitest.config.ts`에서 (양방향 검증 치환 포함) |

`testkit`은 `.js`로 빌드되어 배포된다(`tsc -p tsconfig.build.json`). Vite가 설정 파일의 워크스페이스 의존성을 externalize하기 때문에 `defineStudyConfig`가 Node가 직접 읽을 수 있는 형태여야 한다. `turbo.json`의 `dependsOn: ["^build"]`가 빌드 순서와 캐시 무효화를 같이 처리한다 — Turborepo는 내부 의존 패키지의 소스를 자동으로 해시에 넣지 않으므로, 이 선언이 없으면 testkit을 고쳐도 캐시된 옛 결과가 나온다.

---

## 규약 4 — 문제 풀이 방법

### 풀이는 별도 브랜치에서 한다

```
sol/{패키지명}/{과제번호}
```

```bash
git switch -c sol/stateful-context-design/3-1
cd packages/stateful-context-design
# tests/3-1-kv-calc.test.ts를 읽고 src/3-1-kv-calc.ts의 🎯 TODO를 채운다
pnpm test 3-1          # 또는 감시 모드로: pnpm test:watch 3-1
git add -A && git commit -m "sol(stateful-context-design): 3-1 KV 캐시 계산기"
```

**main으로 머지하지 않는다.** main은 문제 상태(스켈레톤)를 유지한다 — 그래야 재도전할 수 있고, 다른 사람이 같은 문제를 풀 수 있고, 풀이가 문제를 오염시키지 않는다.

풀이 브랜치는 남겨 둔다. 나중에 자기 풀이를 다시 보거나 접근을 비교할 때 쓴다.

### 순서

1. `docs/`를 읽는다
2. `workbook/92-workbook.md`의 서술형을 **자료를 덮고** 푼다 → `93`으로 대조
3. 풀이 브랜치를 만든다
4. **`tests/`를 먼저 읽는다** — 무엇을 만들지가 거기 있다
5. `src/`의 `🎯 TODO`를 채운다
6. 패키지 디렉토리에서 `pnpm test {과제번호}`로 판정한다. 실패 메시지의 `↳ 힌트`를 읽는다
   (루트에서는 `pnpm --filter {패키지} test {과제번호}` — 루트 `pnpm test`는 turbo를 거치므로 과제 번호를 넘길 수 없다)
7. 통과하면 커밋. 그러고 나서 `solutions/`를 열어 접근을 비교한다 — 먼저 열면 과제가 독해로 바뀐다

---

## 규약 5 — 패키지 추가

```bash
mkdir -p packages/{주제-slug}/{docs,workbook,tests,src,solutions}
```

`package.json`:
```json
{
  "name": "{주제-slug}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "{한 줄 설명}",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc"
  },
  "devDependencies": {
    "@study/testkit": "workspace:*"
  }
}
```

`tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "tests", "solutions", "vitest.config.ts"]
}
```

`vitest.config.ts`:
```ts
import { defineStudyConfig } from '@study/testkit/config';

export default defineStudyConfig(import.meta.url);
```

그리고 `pnpm install`로 워크스페이스 링크를 걸고, 위 "현재 패키지" 표에 한 줄 추가한다.

---

## 실행

```bash
corepack enable pnpm            # 최초 1회 (packageManager 필드가 버전을 고정한다)
pnpm install                    # 루트에서

pnpm test                       # 전체 — src/ 대상 (문제 상태에서는 실패가 정상)
pnpm test:solutions             # 전체 — solutions/ 대상 (전부 통과해야 정상)
pnpm typecheck                  # 전체 타입 체크
pnpm packages                   # 패키지 목록

pnpm --filter stateful-context-design test        # 한 패키지만
pnpm --filter stateful-context-design test 3-1    # 한 과제만 (파일명 부분 일치)
pnpm --filter stateful-context-design test:watch  # 감시 모드
```

## 자료 생성

새 학습 자료는 `cc-system`의 `study-material-generator` 스킬로 만든다. 그 스킬은 산출물 위치를 물을 때 이 레포를 후보로 제시하고, 형식은 위 규약을 따른다.

```
/study {학습 대상}
```

레포 자체의 운영(패키지 추가, 과제 추가, 규약 감사)은 이 레포의 `study-repo` 스킬이 담당한다.

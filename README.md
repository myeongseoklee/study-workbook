# study — 학습 워크북 모노레포

학습 주제 하나가 패키지 하나다. 각 패키지는 **지식 문서**(읽는 것) · **문제**(푸는 것) · **정답 테스트**(판정하는 것)를 함께 담는다.

이 파일은 **레포 규약의 단일 진실 원천**이다. 자료를 생성하는 하네스(`cc-system`의 `study-material-generator`)는 이 규약을 중복 서술하지 않고 여기를 참조한다. 규약이 바뀌면 여기만 고친다.

## 구조

```
study/
├── package.json            워크스페이스 루트 (툴체인은 여기에 호이스팅)
├── tsconfig.base.json      공통 컴파일러 설정
├── README.md               ← 이 파일 (레포 규약)
└── packages/
    └── {주제-slug}/
        ├── package.json    test:{과제번호} 스크립트
        ├── tsconfig.json   base 상속
        ├── docs/           지식 문서 — 00~09, 90 암기, 91 용어, 99 참고
        ├── workbook/       서술형 문항 — 92 문제 / 93 정답
        ├── src/            🎯 코딩 문제 (TODO 스켈레톤)
        └── solutions/      ✅ 정답 = 테스트 코드 (src와 같은 파일명)
```

### 현재 패키지

| 패키지 | 주제 |
|---|---|
| `multi-agent-systems` | 멀티 에이전트 시스템 — LangGraph, 협업 패턴, 평가, RAG, 인프라 |
| `stateful-context-design` | 축적된 상태 설계 — KV 캐시, 슬라이딩 윈도우, 이벤트 소싱을 관통하는 네 원리 |

> `multi-agent-systems`는 이 규약이 정해지기 전에 만들어져 `solutions/`에 **완성 구현**이 들어 있다(테스트가 아님). 앞으로 만드는 패키지는 아래 규약을 따른다.

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

| 문제 | 정답 |
|---|---|
| `workbook/92-workbook.md` | `workbook/93-solutions.md` |
| `src/3-1-kv-calc.ts` | `solutions/3-1-kv-calc.ts` |

**대응 키**: 서술형은 문항 번호(`1-3` → `## 1-3`), 코딩은 **파일명이 같다**.

### 한 파일 = 한 문제

코딩 문제는 파일 하나에 문제 하나만 정의한다. 파일명은 `{과제번호}-{slug}.ts`.

```
src/3-1-kv-calc.ts        ← 과제 3-1만
src/3-2-swa-mask.ts       ← 과제 3-2만
solutions/3-1-kv-calc.ts  ← 3-1의 테스트만
```

### 코딩 문제의 정답은 테스트 코드다

참고 구현(완성 골격)을 주지 않는다. 읽으면 베끼게 되고 그 순간 과제가 독해로 바뀐다.

| | 참고 구현을 줄 때 | 테스트를 줄 때 |
|---|---|---|
| 학습자 행동 | 읽고 대조 → 베끼기 | 자기 코드를 돌려 판정 |
| 성공 판정 | 주관적 | **객관적**(통과/실패) |
| 막혔을 때 | 답이 바로 보임 | 실패 메시지가 어디가 틀렸는지 가리킴 |

**작성 규칙**
- 테스트 항목이 문제 파일 상단의 성공 기준과 **1:1 대응**한다
- 인터페이스(함수명·시그니처)만 못박고 내부 구조는 열어 둔다
- 실패 메시지가 **무엇이 틀렸는지** 말한다 (`test 3 failed`는 정보가 없다)
- `tsx` 외 의존성 없음 — 테스트 프레임워크(Jest·Vitest)를 요구하지 않는다
- LLM 호출·네트워크·유료 API는 가짜로 대체한다
- 각 정답 파일 끝에 `📍 되짚기` 주석으로 해당 문서 위치를 남긴다

문제 스켈레톤에는 `🎯 TODO`를 남기고 `throw new Error('TODO: 함수명')`으로 시작한다 — 채우기 전에는 테스트가 실패하는 것이 정상이다.

---

## 규약 3 — 기술 스택

학습 자료가 특정 기술을 다루는 게 아니라면 다음 기본값을 쓴다.

| 층 | 기본값 |
|---|---|
| 런타임 | **Node.js** 20+ |
| 언어 | **TypeScript** |
| 실행 | `tsx` — 빌드 없이 `.ts`를 바로 돌린다 |
| 서버가 필요하면 | **Fastify** 또는 **Express** |

**이 기본값을 벗어나는 기술 선정이 필요하면 작업 전에 사용자에게 묻는다.** DB(Postgres? SQLite?), 프론트엔드(React? 바닐라?), 벡터 저장소 같은 선택은 임의로 정하지 않는다 — 학습자 환경과 어긋나면 과제가 실행조차 안 된다.

예외는 둘뿐이다: **학습 주제가 이미 기술을 정하고 있다**(Rust 소유권 자료라면 Rust), **선택의 여지가 없다**(CUDA 커널).

---

## 규약 4 — 문제 풀이 방법

### 풀이는 별도 브랜치에서 한다

```
sol/{패키지명}/{과제번호}
```

```bash
git switch -c sol/stateful-context-design/3-1
# src/3-1-kv-calc.ts의 🎯 TODO를 채운다
npm run test:3-1 --workspace stateful-context-design
git add -A && git commit -m "sol(stateful-context-design): 3-1 KV 캐시 계산기"
```

**main으로 머지하지 않는다.** main은 문제 상태(스켈레톤)를 유지한다 — 그래야 재도전할 수 있고, 다른 사람이 같은 문제를 풀 수 있고, 풀이가 문제를 오염시키지 않는다.

풀이 브랜치는 남겨 둔다. 나중에 자기 풀이를 다시 보거나 접근을 비교할 때 쓴다.

### 순서

1. `docs/`를 읽는다
2. `workbook/92-workbook.md`의 서술형을 **자료를 덮고** 푼다 → `93`으로 대조
3. 풀이 브랜치를 만든다
4. `src/`의 `🎯 TODO`를 채운다
5. `npm run test:{과제번호}`로 판정한다
6. 실패 항목의 메시지를 읽고 고친다 — **`solutions/`를 열어 답을 찾지 않는다** (그건 테스트이므로 답이 없다)
7. 통과하면 커밋

---

## 규약 5 — 패키지 추가

```bash
mkdir -p packages/{주제-slug}/{docs,workbook,src,solutions}
```

`package.json`:
```json
{
  "name": "{주제-slug}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "npm run test:3-1 && npm run test:3-2",
    "test:3-1": "tsx solutions/3-1-{slug}.ts",
    "typecheck": "tsc"
  }
}
```

`tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "solutions"]
}
```

그리고 위 "현재 패키지" 표에 한 줄 추가한다.

---

## 실행

```bash
npm install                                    # 루트에서 1회
npm test                                       # 전체 패키지 테스트
npm test --workspace stateful-context-design   # 한 패키지만
npm run test:3-1 --workspace stateful-context-design   # 한 과제만
npm run typecheck                              # 전체 타입 체크
npm run packages                               # 패키지 목록
```

## 자료 생성

새 학습 자료는 `cc-system`의 `study-material-generator` 스킬로 만든다. 그 스킬은 산출물 위치를 물을 때 이 레포를 후보로 제시하고, 형식은 위 규약을 따른다.

```
/study {학습 대상}
```

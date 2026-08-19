# 11. 도메인 사실 목록 (4강)

앞의 장들이 "왜"를 다뤘다. 이 장은 **캡처로 확인된 사실만** 모은다. 자기 구현을 할 때 참조하는 목록이고, 추론이나 보충 설명은 넣지 않았다 — 확인 안 된 것은 명시적으로 표시한다.

## 인프라

| 항목 | 사실 | 출처 |
|---|---|---|
| DB | 어드민이 SQLite → PostgreSQL로 이전. 에이전트는 별도 DB를 띄우지 않고 어드민의 DB를 참조 | `[08:30–12:00]` |
| 확장 1 | `pgvector` — 임베딩 검색(세션 히스토리 검색, 에이전트 자기 성찰용) | `[09:30–10:00]` |
| 확장 2 | `pgmq` — 이벤트 큐. 소스를 클론해 이미지 빌드 단계에서 설치 | `[09:30]`, `[05:30]` |
| 컨테이너 | 어드민 이미지가 노드 + pgvector 기반이고 그 위에 pgmq를 추가 빌드. 에이전트 이미지는 노드 알파인 기반 | `[08:30–09:30]` |
| 큐 동작 | 보내기 / 조회 / 취소 — 세 가지. 서버가 아는 인터페이스는 이 셋으로 한정 | `[1:09:00]`, 슬라이드 「큐처리」 |
| 폴링 | 푸시가 아니라 폴링. SQS와 같은 방식 | `[1:09:30]` |

## 봉투(envelope) 필드

슬라이드 「이벤트 봉투 설계」 전문. → 3장

| 묶음 | 필드 |
|---|---|
| 식별 키 | `eventKey`(고유 PK) · `transactionKey`(멱등 경계) · `parentEventKey` / `causationEventKey` / `correlationKey`(인과 그래프) |
| 계층 컨텍스트 | `sessionKey` → `runKey` → `turnKey` → `iterationKey` → `stepKey` → `toolCallKey` |
| 분류 축 | `kind`: request / response / progress / notice / heartbeat |
| | `state`: queued / accepted / running / waiting / completed / failed / cancelled / timed_out |
| | `scope`: session / run / turn / iteration / step / tool / process / event |
| | `sequence`: 단조 증가 번호 (스트림 재정렬·누락 감지) |
| 채널·결과 | `channel` / `replyChannel` · `AgentResult<T> = {ok:true,value} \| {ok:false,error}` · `AgentError.retryable` |

- `eventKey` 발급: **UUIDv7 등** — 강의자 표현이 *"UUIDv7이나 이런 걸로"* 이므로 확정 규격은 아니다 `[19:00]`
- 인과 키 3종: **미결정.** 강의자가 *"이 키를 쓸지 전부 다 트랜잭션 키로 퉁칠지 고민하고 있어요"* `[19:30]`
- 채널 분리(요청/응답 채널을 나눌지): **유보.** *"별로 그럴 생각도 없어요"* `[41:00]`

## 이벤트 패밀리 10종

슬라이드 「이벤트 패밀리」 전문. → 7장

| 패밀리 | 액션 |
|---|---|
| `session.*` | create / get / delete / cancel / resume + `SessionStatus` |
| `turn.*` | start / input.append / stop / final / cancelled / failed + usage 토큰 집계 |
| `iteration.*` | start / progress(델타·리즈닝) / merge / merged / failed + `nextAction` |
| `tool.*` | call / started / progress / stdout / stderr / completed / failed / cancel |
| `process.*` | 외부 프로세스 실행의 stdout / stderr / exit / timeout / cancel |
| `hook.*` | before / after × session · turn · iteration · tool · compaction |
| `model.*` | 모델 선택 · 변경 · 기본값 갱신 (2강 모델라우터가 붙는 자리) |
| `state.*` | kv put / get / delete / persist, `compaction.*`, `checkpoint.*` |
| `approval.*` | request / granted / rejected / expired + `expiresAt` |
| `artifact.*` | file / diff / patch / log / screenshot 등록 + `contentHash` |

설계 원칙: **도구는 논리적 호출, 프로세스는 물리적 실행으로 분리** — 어떤 언어의 프로그램도 붙일 수 있게 함.

## 타입 정의 (실제 코드)

캡처: `packages/agent_domain/src/common/protocol/vibe/index.ts` → 7장

```ts
export type VibeEvent =
  SessionEvent | TurnEvent | IterationEvent | ToolEvent | HookEvent |
  ModelEvent | StateEvent | ProcessEvent | ApprovalEvent | ArtifactEvent;

export type VibeAction =
  SessionAction | TurnAction | IterationAction | ToolAction | HookAction |
  ModelAction | StateAction | ProcessAction | ApprovalAction | ArtifactAction;

export type VibeEventEnvelope = AgentEvent<VibeAction>;
```

봉투 쪽에서 함께 내보내는 타입: `AgentError` · `AgentEventContext` · `AgentEventScope` · `AgentEventState` · `AgentResult` (from `../envelope/index.js`)

파일 배치: 패밀리별 디렉토리(`session/` `turn/` `iteration/` `tool/` `hook/` `model/` `state/` `process/` `approval/` `artifact/`) + `vibe/index.ts` 하나가 유니온 합성.

## 스키마 (실제 DDL)

캡처: `apps/admin/docker/postgres/initdb/001-extensions.sql` → 5장

```sql
CREATE TABLE IF NOT EXISTS agent_execution (
  transaction_key text PRIMARY KEY,
  request_event_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'completed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS agent_events (
  event_id text PRIMARY KEY,
  transaction_key text NOT NULL,
  action text NOT NULL,
  kind text NOT NULL,
  channel text NOT NULL,
  source text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_events_transaction_idx
  ON agent_events (transaction_key, created_at);
```

**런타임 마이그레이션이 별도로 있다** — `apps/agent/src/server/execution/store.ts`의 `ensureExecutionSchema(pool)`:

```
ALTER TABLE agent_execution ADD COLUMN IF NOT EXISTS payload_hash text
ALTER TABLE agent_execution DROP CONSTRAINT IF EXISTS agent_execution_status_check
ALTER TABLE agent_execution ADD CONSTRAINT agent_execution_status_check
  CHECK (status IN ('running', 'completed', ...))
```

즉 **DDL의 `CHECK (status IN ('running','completed'))`는 강의 시점의 중간 상태**이고, 코드는 `failed / timed_out / cancelled`까지 종결로 다룬다. `payload_hash`도 DDL에는 없고 마이그레이션으로 추가된다.

3강과 연결되는 테이블도 같은 파일에 있다 (조직별 모델 할당 — 3강 4장):

```sql
CREATE TABLE IF NOT EXISTS organization_inference_services (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint_id text NOT NULL REFERENCES model_endpoints(id) ON DELETE CASCADE,
  PRIMARY KEY (organization_id, endpoint_id)
);
CREATE TABLE IF NOT EXISTS organization_inference_models (
  organization_id text NOT NULL, endpoint_id text NOT NULL,
  model_id text NOT NULL REFERENCES model_definitions(id) ON DELETE CASCADE,
  active integer NOT NULL DEFAULT 1,
  PRIMARY KEY (organization_id, endpoint_id, model_id),
  FOREIGN KEY (organization_id, endpoint_id)
    REFERENCES organization_inference_services(organization_id, endpoint_id) ON DELETE CASCADE
);
```

## 멱등 검문소 (실제 코드)

캡처: `apps/agent/src/server/execution/store.ts` → 5장

| 함수 | 시그니처 | 역할 |
|---|---|---|
| `ensureExecutionSchema` | `(pool: Pool): Promise<void>` | 테이블·컬럼·제약 보정 |
| `claimExecution` | `(pool: Pool, event: AgentEvent): Promise<Claim>` | 삽입 시도 → 판정 |
| `completeExecution` | `(pool: Pool, transactionKey: string, result: unknown, status: "completed" \| "failed" \| ...)` | 종결 기록 |

`claimExecution` 반환 종류:

| `kind` | 조건 |
|---|---|
| `claimed` | `INSERT ... ON CONFLICT` 가 실제로 삽입됨 (`rowCount > 0`) |
| `conflict` (`reason: "transaction claim disappeared"`) | 삽입 실패했는데 조회 결과 행이 없음 |
| `conflict` (`reason: "transactionKey reused with a different ..."`) | 기존 행의 `payload_hash`가 현재 해시와 다름 |
| `duplicate` (`completed`, `result`) | 페이로드 일치. `completed`는 `["completed","failed","timed_out","cancelled"].includes(row.status)` |

`completeExecution`: `UPDATE agent_execution SET status = $2, result = $3::jsonb, updated_at = now(), completed_at = now() WHERE tra...`

## 워커 (실제 코드)

캡처: `apps/agent/src/server/worker/pool.ts`, `entry.ts` → 8장

| 항목 | 사실 |
|---|---|
| 기반 | 노드 표준 `worker_threads`. `postMessage` 통신 (웹워커와 동일 형태) |
| 풀 생성 | `createWorkerPool(options: { minWorkerThreads, maxWorkerThreads, maxQueue })` |
| 풀 인터페이스 | `run` 메소드만 노출 |
| 슬롯 | `interface WorkerSlot { worker, busy: boolean, retired: boolean, task? }` |
| 배정 | `dispatch()` — 유휴 슬롯을 찾아 `postMessage({ type:"run", id, event })` |
| 증설 | `if (queue.length > 0 && slots.length < options.maxWorkerThreads) slots.push(createSlot())` |
| 취소 | `task.abort = () => worker.postMessage({ type:"abort", id })`. `signal.aborted`를 먼저 검사한 뒤 `addEventListener("abort", ..., { once: true })` |
| 늦은 응답 | `if (!slot.task \|\| slot.task.id !== message.id) return` — 무시 |
| 사고 처리 | `worker.on("error")` → `slot.retired = true` → `task.reject` → `replaceSlot(slot)` |
| 종료 처리 | `worker.on("exit", code)` → `code !== 0 && !slot.retired` 이면 사고로 취급 |
| 워커 본체 | `entry.ts` — 모든 메시지를 async operation으로 처리 후 `parentPort`로 회신. **타입별 처리기는 미구현** `[1:24:30]` |
| 언어 | TypeScript. *"멀티스레드임에도 불구하고 그냥 노드로 짰어요, 좀 읽기 편하라고"* `[1:27:00]` |

**확인 안 된 것:** 강의 중 노드 버전 언급이 흔들린다("노드26", "LTS 23인가 22부터"). `worker_threads`는 Node.js 12부터 안정화된 표준 모듈이므로 **버전 숫자는 근거로 쓰지 않는다.**

## 프로젝트 구조 (캡처에서 읽힌 것)

```
apps/
├── admin/
│   ├── docker/postgres/initdb/001-extensions.sql
│   └── ...
└── agent/
    ├── docker/
    └── src/
        ├── front/
        └── server/
            ├── execution/store.ts     ← 멱등 검문소
            ├── pgmq/
            ├── queue/
            ├── stream/
            ├── transport/
            ├── worker/{entry.ts, pool.ts}
            ├── app.ts  consumer.ts  database.ts  env.ts  event-log.ts  index.ts
            └── ...
packages/
├── admin_domain/
└── agent_domain/src/common/protocol/
    ├── agent/  approval/  artifact/  envelope/  hook/  iteration/
    ├── model/  process/  session/  state/  tool/  turn/
    └── vibe/index.ts                 ← VibeEvent 유니온
```

- 모노레포는 Turborepo (`.turbo/` 존재, 2강 10장의 기술 스택과 일치)
- `AGENTS.md`가 앱·패키지마다 있고, `.codex/skills/` 아래 스킬 디렉토리(`web-deploy-docker`, `web-visual-design` 등)에 `SKILL.md` — 3강 5·6장의 스킬셋이 4강까지 이어진다
- 강의 중 열려 있던 문서: `lecture-04-agent-server.md`, `SKILL.md`, `docker-compose.yml`

## 다음 회차 예고 (강의자 발언)

| 언제 | 무엇 |
|---|---|
| 5강 | 코드 설명 + 실제 구현. **아주 간단한 바이브 코딩 에이전트 구동을 클라이언트까지 포함해서 구경하는 수준**까지 `[1:40:00]`, `[1:41:30]` |
| 6강 이후 | 고급 기능 구현 `[1:41:30]` |

이미 만들어진 것: 이벤트 소싱 베이스 서버(*"어차피 그건 지금 다 만들어져 있기 때문에"*). 버려진 것: **SSE 구현** (*"처음에는 SSE를 구현했다가 안 되겠더라고요. 그래서 날려버렸고"*) `[1:40:00]`

## 미결정·미구현으로 남은 것

자기 구현에서 열어 둬야 하는 자리들이다.

| 항목 | 상태 | 어디 |
|---|---|---|
| 인과 키 3종을 쓸지 트랜잭션 키로 통합할지 | 고민 중 | 3장 |
| 요청/응답 채널 분리 | 유보 (*"별로 그럴 생각도 없어요"*) | 3장 |
| 대용량 첨부(10MB PDF 등)의 직렬화 | 미해결. *"그걸 또 해결하는 여러 가지 방법들이 있거든요"* | 1장 |
| 아웃박스 패턴 | 언급만 (*"키워드나 던지고 가자"*) | 5장 |
| 이벤트 타입별 처리기(라우터) | 미구현. 개념만 | 7·8장 |
| 샤드 분리 | 계획만. *"이것까지 우리가 구현할지는 잘 모르겠어요"* | 9장 |

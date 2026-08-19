# 03. USE 방법 — 자원마다 세 개씩 묻는 체크리스트

## 학습 목표

USE의 세 항목을 Gregg의 정의 그대로 말하고, 각 항목의 측정 단위가 왜 다른지 설명할 수 있다. "자원 목록을 먼저 만든다"는 절차가 왜 도구부터 켜는 것보다 나은지, 그리고 이 방법이 **못 찾는 것**이 무엇인지 말할 수 있다.

## 선수 지식

[01](01-prerequisites.md) § 5(자원의 정의) · § 4(큐와 사용률). [02](02-golden-signals.md)의 Saturation.

## 핵심 원리 (WHY) — 도구가 아니라 질문에서 출발한다

성능 문제를 만났을 때 대부분의 사람이 하는 일은 **도구를 켜는 것**이다. `top`을 띄우고, `iostat`을 돌리고, APM 대시보드를 연다. Gregg는 이것을 "Tools Method"라 부르고, 문제를 지적한다: 도구가 보여주는 것만 보게 되므로 **시스템에 대한 불완전한 시야**를 얻는다.

USE Method는 순서를 뒤집는다.

> USE Method는 *"iterates over the system resources to create a complete list of questions to ask, then searches for tools to answer them."*
> — [Brendan Gregg, USE Method](https://www.brendangregg.com/usemethod.html)

**자원을 훑어 물어야 할 질문의 완전한 목록을 먼저 만들고, 그 다음에 답할 도구를 찾는다.** 이 순서의 값은 "빠뜨린 자원이 목록에서 눈에 보인다"는 것이다. 도구부터 켜면 도구가 없는 자원은 아예 의심 대상에서 사라진다 — 그리고 병목은 자주 그런 곳에 있다.

방법 전체가 한 문장으로 요약된다.

> **"For every resource, check utilization, saturation, and errors."**

## 필수 지식 (HOW)

### 세 항목 — 정의와 측정 단위

Gregg의 정의를 그대로 옮기면 이렇다.

| 항목 | 정의 (원문) | 우리말 | 표현 단위 |
|---|---|---|---|
| **Utilization** | *"the average time that the resource was busy servicing work"* | 자원이 일을 처리하며 바빴던 **평균 시간** | 시간 구간에 대한 **퍼센트** |
| **Saturation** | *"the degree to which the resource has extra work which it can't service, often queued"* | 자원이 처리하지 못해 **밀려 있는 일의 정도** | **큐 길이** |
| **Errors** | *"the count of error events"* | 에러 이벤트의 **개수** | **스칼라 카운트** |

**세 항목의 단위가 다른 것이 우연이 아니다.** 사용률은 비율이라 상한이 있고(100%), 포화는 큐 길이라 상한이 없으며, 에러는 개수라 누적된다. 이 차이 때문에 세 항목은 서로를 대체하지 못한다.

### Utilization의 두 가지 뜻 — 이것을 모르면 수치를 잘못 읽는다

Gregg는 각주에서 다른 정의를 명시한다.

> *"There is another definition where utilization describes the proportion of a resource that is used, and so 100% utilization means no more work can be accepted, unlike with the 'busy' definition above."*

| | 시간 기반 (Gregg의 주 정의) | 용량 기반 |
|---|---|---|
| 뜻 | 자원이 **바빴던 시간의 비율** | 자원 **용량 중 쓰인 비율** |
| 100%의 의미 | 쉬는 시간이 없었다 | **더 받을 수 없다** |
| 예 | CPU 사용률, 디스크 `%util` | 디스크 용량, 메모리 사용량 |

이 구분이 실무에서 사고를 만든다. **시간 기반 100%는 "더 못 받는다"는 뜻이 아니다.** 병렬 처리가 가능한 자원(RAID 배열, 현대 SSD/NVMe)은 "적어도 하나의 요청이 처리 중"인 시간이 100%여도 여유가 남아 있다. `iostat`의 `%util`이 정확히 이 함정이다 — 자세한 것은 [06](06-saturation-and-queueing.md) § `%util`의 거짓.

### 짧은 버스트를 평균이 지운다

Gregg가 붙이는 경고:

> *"A burst of high utilization can cause saturation and performance issues, even though utilization is **low** when averaged over a long interval."*

5분 평균 CPU 사용률 20%짜리 서버가 매 분 2초씩 100%를 치고 있을 수 있다. 그 2초 동안 큐가 쌓이고 p99가 튄다. **사용률 그래프는 평온하고 레이턴시 그래프는 비명을 지르는 상황**이 여기서 나온다.

그래서 사용률만으로 포화를 판정하지 않는다. **포화(큐 길이)를 별도로 재는 이유가 이것이다.**

### 해석 규칙 — 각 항목을 어떻게 읽나

Gregg가 주는 판정 기준은 항목마다 다르다.

**Utilization — 70%부터 의심한다**

> *"High utilization (eg, beyond 70%) can begin to be a problem for a couple of reasons:"*

두 이유:
1. **측정이 버스트를 가린다** — 수 초·수 분 평균에서 70%는 순간 100%를 품고 있을 수 있다
2. **선점 불가능한 자원이 있다** — 디스크처럼 진행 중인 작업을 우선순위 때문에 끊을 수 없는 자원은 70%를 넘으면 큐 지연이 잦고 눈에 보이게 된다

**Saturation — 0이 아니면 문제다**

> *"Saturation: any degree of saturation can be a problem (non-zero)."*

포화에는 "안전한 값"이 없다. 큐에 하나라도 앉아 있으면 누군가 기다린 것이다. 사용률이 70%, 80% 같은 임계선을 갖는 것과 대조된다 — **포화의 임계선은 0이다.**

**Errors — 0이 아니면 조사한다, 특히 늘어나는 중이면**

> *"non-zero error counters are worth investigating, especially if they are still increasing while performance is poor."*

여기서 "**아직 늘어나고 있다**"가 판정의 핵이다. 과거에 누적된 에러 카운터는 지금의 장애와 무관할 수 있다. **증가 중인지가 현재 관련성의 신호다.** 그래서 에러는 카운터의 절대값이 아니라 미분(증가 여부)을 본다.

### 순서 — 에러를 먼저 봐도 된다

> *"Note that errors can be checked before utilization and saturation, as a minor optimization (they are usually quicker and easier to interpret)."*

에러는 해석에 판단이 거의 필요 없다. "네트워크 인터페이스에 드롭 패킷 12,000개"는 그 자체로 결론에 가깝다. 반면 "CPU 68%"는 그것만으로 아무 결론도 아니다. **해석이 값싼 것을 먼저 본다** — 이것이 유일한 순서 규칙이다.

```
해석 비용이 낮은 순서

  Errors        임계 0    "0이 아니면 조사. 증가 중인가?"
     │
     ▼
  Saturation    임계 0    "0이 아니면 문제. 안전한 값이 없다"
     │
     ▼
  Utilization   임계 70%  "70%부터 의심. 확정이 아니다"

  ── 위로 갈수록 값 하나가 곧 결론에 가깝다
  ── 아래로 갈수록 다른 값과 함께 봐야 뜻이 생긴다
```

### 절차 — 자원 목록부터

1. **자원 목록을 만든다**: CPU, 메모리, 네트워크 인터페이스, 스토리지 장치, 스토리지 용량, 컨트롤러, 인터커넥트
2. 각 자원마다 **U / S / E 세 칸을 만든다** (자원 7개면 질문 21개)
3. 각 칸을 채울 **도구·명령을 찾는다** — 못 찾는 칸이 나오면 그것이 관측 공백이고, 기록해 둔다
4. 값을 읽고 위 해석 규칙을 적용해 **병목 후보를 지목한다**

3단계의 "못 찾는 칸"이 이 방법의 숨은 산출물이다. 도구가 없어서 못 보는 자원을 목록이 드러내 준다.

```
[1] 자원 목록          [2] 자원마다 세 질문       [3] 답할 도구를 찾는다
    CPU                    U  S  E                    vmstat · iostat · sar · ifconfig
    Memory                 U  S  E                             │
    Network                U  S  E                             │
    Storage I/O            U  S  E                             ▼
    Storage capacity       U  S  E                    못 채운 칸 = 관측 공백
    Controller             U  S  E                    (이 목록 자체가 산출물이다)
    Interconnect           U  S  E

    자원 7개 × 3 = 물어야 할 질문 21개
```

도구부터 켜면 3열이 1열을 결정한다 — 도구가 보여주는 자원만 의심 대상이 된다. 순서를 뒤집으면 1열이 3열을 결정하고, **채우지 못한 칸이 목록에 남는다.**

### Linux에서 각 칸을 채우는 지점

Gregg가 제시하는 구체 지점 중 자주 쓰는 것만 옮긴다 (전체 표는 [USE Method: Linux](https://www.brendangregg.com/USEmethod/use-linux.html)).

| 자원 | Utilization | Saturation | Errors |
|---|---|---|---|
| **CPU** | `vmstat 1` → `us+sy+st` | `vmstat 1` → **`r` > CPU 코어 수** (런큐) | `perf` — 프로세서별 에러 이벤트(ECC 등) |
| **메모리 용량** | `free -m` · `vmstat` → `free` | `vmstat 1` → **`si`/`so` (스와핑)**, `sar -B` → 스캔, **OOM killer**(`dmesg \| grep killed`) | `dmesg` (물리 장애), 실패한 `malloc()` 추적 |
| **네트워크 인터페이스** | `sar -n DEV 1` → `rxKB/s`·`txKB/s` ÷ 대역폭 | `ifconfig` → `overruns`·`dropped`, `netstat -s` → 재전송 | `ifconfig` → `errors`, `netstat -i` → `RX-ERR`/`TX-ERR` |
| **스토리지 장치 I/O** | `iostat -xz 1` → `%util` (⚠️ [06](06-saturation-and-queueing.md) 주의) | `iostat -xnz 1` → **`avgqu-sz` > 1** 또는 높은 `await` | `/sys/devices/.../ioerr_cnt`, `smartctl` |
| **스토리지 용량** | `df -h` · `swapon -s` | 가득 차면 **`ENOSPC`** | `strace`로 `ENOSPC` 포착, `/var/log/messages` |

이 표에서 눈에 띄는 패턴 하나: **포화 지표는 사용률 지표와 다른 명령에서 나온다.** CPU 사용률은 `us+sy`인데 포화는 런큐 길이이고, 메모리 사용률은 `free`인데 포화는 스와핑이다. 같은 명령의 다른 필드도 아니고 종종 다른 도구다. 그래서 "사용률만 보는 대시보드"가 만들어지기 쉽다 — 포화를 보려면 **의도적으로 다른 값을 찾아야** 한다.

### 소프트웨어 자원에도 쓴다 — 단 작은 것에만

Gregg가 명시하는 경계: 이 방법은 *"usually applies to smaller components of software, not entire applications"*.

적용 대상: **뮤텍스 락**(사용률 = 락을 잡고 있던 시간, 포화 = 락 대기 스레드 수), **스레드 풀**(사용률 = 바쁜 스레드 비율, 포화 = 큐에 대기 중인 작업 수), **프로세스/스레드 용량**(사용률 = 현재/최대, 포화 = 생성 실패).

적용 대상이 **아닌** 것: "결제 서비스", "주문 API". 이것들은 자원이 아니라 요청을 받는 서비스이고, 그것을 보는 방법이 [04](04-red-method.md)의 RED다. RED가 만들어진 계기가 정확히 이 경계였다.

## 이 방법의 한계 — Gregg 자신이 명시한다

> *"There are many problem types it doesn't solve, which will require other methods and longer time spans."*
> *"While the USE Method may find 80% of server issues, latency-based methodologies (eg, Method R) can approach finding 100% of all issues."*

**서버 문제의 80% 정도**를 잡는 방법이라고 저자가 직접 말한다. USE는 **자원 병목**에 특화되어 있으므로, 자원이 멀쩡한데 느린 문제 — 잘못된 알고리즘, 불필요한 직렬화, 잘못된 캐시 키, 외부 의존의 지연 — 는 잡지 못한다. 그런 문제는 요청의 시간을 따라 내려가는 레이턴시 기반 방법(Method R, 오늘날의 분산 트레이싱)이 잡는다.

이 한계를 알아야 하는 실용적 이유: **USE 체크리스트가 전부 초록이면 "문제 없음"이 아니라 "자원 병목 아님"이다.** 여기서 멈추지 않고 다음 층으로 내려가는 것이 정상 절차다.

### ⚠️ 암기 필수

- [ ] **USE = 모든 자원마다 Utilization · Saturation · Errors 세 개를 확인** — 사용률=퍼센트, 포화=큐 길이, 에러=카운트. (이유: 단위가 다르므로 서로를 대체할 수 없다. 사용률만 보는 대시보드가 놓치는 것이 포화다)
- [ ] **사용률 70%부터 의심, 포화는 0이 아니면 문제, 에러는 증가 중인지가 관련성 신호** (이유: 항목마다 임계 규칙이 다르다. 포화에 "안전한 값"을 잡으려는 시도 자체가 오류다)
- [ ] **Utilization에는 두 뜻이 있다 — 시간 기반(바빴던 시간)과 용량 기반(더 받을 수 있는가)** (이유: 병렬 자원에서 시간 기반 100%는 한계가 아니다. `iostat %util`이 이 함정)
- [ ] **긴 구간 평균은 짧은 버스트를 지운다** — 5분 평균 20%가 초당 100%를 품는다. (이유: 사용률 그래프는 평온한데 p99가 튀는 상황의 설명)
- [ ] **자원 목록을 먼저 만들고 도구를 나중에 찾는다** — 못 채운 칸이 관측 공백이다. (이유: 도구부터 켜면 도구 없는 자원은 의심 대상에서 사라지고, 병목은 자주 거기 있다)
- [ ] **USE는 서버 문제의 약 80%. 자원이 멀쩡한 느림은 못 잡는다** (이유: 체크리스트가 전부 초록일 때 "문제 없음"으로 결론 내리면 조사가 그 자리에서 끝난다)

## 자가 진단

- 우리 서버의 자원 목록을 적고, 각 자원의 **포화** 지표를 하나씩 댈 수 있는가? (사용률이 아니라 포화다)
- CPU 런큐 길이를 우리 대시보드에서 볼 수 있는가? 메모리 스와핑은?
- 최근 성능 문제 중 USE로는 못 찾았을 것이 있었는가? 그것은 어떤 종류였는가?

## 다음

→ [04-red-method.md](04-red-method.md) — 자원이 아니라 서비스를 보는 방법.

# 04. RED 방법 — 서비스마다 똑같은 세 개만 본다

## 학습 목표

RED의 세 항목을 정의하고, **Golden Signals에서 Saturation을 빼고 만든 이유**를 설명할 수 있다. "모든 서비스에 같은 세 지표를 붙인다"는 동형성이 기술적 이득이 아니라 **조직적 이득**이라는 점을 말할 수 있고, RED가 적용되지 않는 대상을 판별할 수 있다.

## 선수 지식

[02](02-golden-signals.md) 전체 (RED는 그것의 축약이다). [03](03-use-method.md) § 소프트웨어 자원의 경계.

## 핵심 원리 (WHY) — USE가 서비스에는 안 맞아서 만들어졌다

Tom Wilkie는 2015년 Weaveworks에서 RED를 제안했고, 2015년 런던 Prometheus 밋업에서 처음 발표했다. 만든 동기가 명확하다.

> *"The USE Method doesn't really apply to services; it applies to hardware, network disks, things like this."*
> — [Grafana Labs, The RED Method: How to Instrument Your Services](https://grafana.com/blog/the-red-method-how-to-instrument-your-services/)

USE는 자원의 언어로 되어 있다. "결제 서비스의 사용률"은 정의되지 않는다 — 무엇에 대한 비율인가? 스레드? CPU? 커넥션? 서비스는 여러 자원의 조합이라 하나의 사용률 숫자로 접히지 않는다.

그래서 Wilkie는 **Golden Signals를 요청 기반 서비스에 맞게 다듬었다.** 마이크로서비스는 자원이 아니라 **요청을 받는 상대**이므로, 요청의 관점에서만 재는 것이다.

## 필수 지식 (HOW)

### 세 항목

| 항목 | 정의 (원문) | 우리말 |
|---|---|---|
| **Rate** | *"the number of requests per second"* | 초당 요청 수 |
| **Errors** | *"the number of those requests that are failing"* | 그중 실패하는 요청 수 |
| **Duration** | *"the amount of time those requests take"* | 그 요청들이 걸린 시간 |

Golden Signals와 대응시키면 이렇게 된다.

| Golden Signals | RED | 관계 |
|---|---|---|
| Traffic | **Rate** | 같은 것 |
| Errors | **Errors** | 같은 것 |
| Latency | **Duration** | 같은 것 |
| Saturation | — | **빠졌다** |

**RED는 Golden Signals에서 Saturation을 뺀 것이다.** 그것이 이 방법을 이해하는 열쇠다.

```
Golden Signals              RED
  Traffic      ─────────▶     Rate
  Errors       ─────────▶     Errors
  Latency      ─────────▶     Duration
  Saturation   ────╳──▶       (없다)
       │
       │  서비스마다 병목 자원이 다르고 시간에 따라 바뀐다
       │  → 모든 서비스에 같은 정의로 붙일 수 없다 = 동형화 불가
       │
       └───────────────────▶  USE 가 담당한다 (자원 단위로는 정의된다)
```

### 왜 Saturation을 뺐나

서비스에는 포화도라는 값이 자연스럽게 존재하지 않는다. 서비스가 "얼마나 찼는지"를 재려면 그 서비스가 쓰는 자원 중 무엇이 병목인지를 이미 알아야 하는데, 그것은 **서비스마다 다르고 시간에 따라 바뀐다.** 오늘은 DB 커넥션이 병목이고 다음 주엔 스레드 풀이 병목이다.

즉 Saturation은 **동형화가 불가능한 항목**이다. 모든 서비스에 같은 정의로 붙일 수 없다. 그래서 RED는 그것을 코어에서 빼고 **선택적**으로 남겼다 — Wilkie는 발표에서 `kube-state-metrics`로 포화를 따로 재는 방법을 보여주지만, RED 프레임워크 안에 넣지 않았다.

이것이 **RED와 USE가 상호 보완인 이유**다. RED가 버린 축을 USE가 담당한다. 셋을 함께 쓰는 조합이 [08](08-composing-the-three.md)의 주제다.

### 동형성이 진짜 산출물이다 — 기술이 아니라 조직

RED의 값은 세 지표를 고른 데 있지 않다. **모든 서비스에 예외 없이 같은 세 지표를 같은 이름으로 붙인다**는 규율에 있다.

> *"You model this for every single service in your architecture."*
> *"this gives you a nice, consistent view of how your architecture is behaving. Giving this kind of consistency across services allows you to scale your operational team, and **allows you to put people on call for code they didn't write.**"*

마지막 문장이 RED의 존재 이유다. **자기가 쓰지 않은 코드에 대해 온콜을 설 수 있게 된다.**

이유를 풀어 보면 이렇다. 서비스마다 대시보드가 다르면, 새벽 3시에 알림을 받은 사람이 먼저 하는 일은 "이 서비스의 대시보드는 어떻게 읽는 것인가"를 배우는 일이다. 서비스가 40개면 40가지 읽는 법이 있고, 아무도 40개를 다 알 수 없다. 그래서 온콜이 **서비스를 만든 사람에게만** 가능해지고, 팀은 확장되지 않으며, 그 사람은 휴가를 갈 수 없다.

RED를 전면 적용하면 읽는 법이 하나가 된다. **"Rate가 정상인데 Errors가 튀었다"는 문장이 40개 서비스에서 같은 뜻**이므로, 처음 보는 서비스의 그래프를 30초 안에 판정할 수 있다.

이 성질은 알림에도 그대로 온다. 서비스마다 알림 규칙을 새로 설계하지 않고, **같은 템플릿을 서비스 라벨만 바꿔 복제**한다. 새 서비스를 배포하면 알림이 자동으로 따라온다.

### 측정 지점 — 어디서 재나

RED는 **요청을 받는 쪽(서버 사이드)에서** 재는 것이 기본이다. 각 서비스가 자기가 받은 요청을 세고, 실패를 세고, 처리 시간을 히스토그램으로 기록한다.

여기서 실무적으로 갈리는 지점이 셋 있다.

1. **Rate와 Errors는 같은 카운터에서 나와야 한다.** 요청 수를 로드밸런서에서 세고 에러 수를 애플리케이션에서 세면, 두 값의 분모가 달라 에러율이 틀린다. 에러율을 만들 두 값은 **같은 관측 지점**에서 나온다.
2. **Duration은 히스토그램으로 기록한다.** 평균만 기록하면 나중에 p99를 만들 수 없고, 서비스 인스턴스별 분위수를 사후에 합칠 수도 없다([05](05-percentiles-and-histograms.md) § 분위수는 평균낼 수 없다).
3. **실패의 정의를 서비스마다 다르게 두면 동형성이 깨진다.** "5xx만 실패"로 통일할지, "정책적 실패까지 포함"할지 조직 차원에서 한 번 정하고, 정한 대로 전부 적용한다. 절반의 서비스만 정책적 실패를 세면 두 그룹의 에러율을 비교할 수 없다.

### RED가 적용되지 않는 대상

RED는 **요청-응답 모델**을 전제한다. 그 전제가 없는 것에는 안 맞는다.

| 대상 | 왜 안 맞나 | 대안 |
|---|---|---|
| 배치 잡 | 요청이 없다. 실행이 있을 뿐 | 실행 성공률 · 처리 건수 · 소요 시간 · 지각 여부 |
| 스트리밍 소비자 | 요청 대신 **지속 소비**. Rate보다 중요한 것이 지체 | 컨슈머 랙(lag) · 처리 지연 · 재처리율 |
| 큐 워커 | 위와 같다 | 큐 깊이 · 처리율 · 나이(oldest message age) |
| 데이터 저장소 자체 | 요청이 있지만 자원 성격이 강하다 | RED + USE 병행 (TPS·에러·지연 + 디스크·메모리 포화) |

큐 기반 시스템에서 특히 중요한 것은 **랙(lag)** 이다. 랙은 Rate·Errors·Duration 어디에도 안 나타난다. 컨슈머가 초당 1,000건을 오류 없이 10ms에 처리하고 있어도, 프로듀서가 초당 5,000건을 넣고 있으면 지체는 계속 커진다. 세 지표가 전부 초록인 채로 시스템이 무너지는 대표적 사례다.

### ⚠️ 암기 필수

- [ ] **RED = Rate(초당 요청 수) · Errors(실패 요청 수) · Duration(요청 처리 시간)** — Golden Signals에서 **Saturation을 뺀 것**. (이유: 빠진 축이 무엇인지 알아야 USE로 보완할 지점을 안다)
- [ ] **Saturation을 뺀 이유: 서비스마다 병목 자원이 달라 동형화가 불가능하다** (이유: 이 한 가지가 RED와 USE의 역할 분담을 결정한다)
- [ ] **RED의 산출물은 동형성이다 — "자기가 안 쓴 코드에 온콜을 설 수 있게 된다"** (이유: 지표 선택이 아니라 전면 통일이 값이다. 절반만 적용하면 이득이 0에 가깝다)
- [ ] **Rate와 Errors는 같은 관측 지점에서 나와야 한다** (이유: 분모가 다른 두 값으로 만든 에러율은 틀린 값이고, 틀린 것이 눈에 안 보인다)
- [ ] **RED는 요청-응답 모델 전용. 큐·스트리밍 소비자에는 랙(lag)을 별도로 봐야 한다** (이유: R·E·D가 전부 초록인 채로 지체가 무한히 쌓이는 시스템이 실제로 있다)

## 자가 진단

- 우리 서비스들이 전부 같은 이름의 Rate·Errors·Duration 지표를 노출하는가? 예외는 몇 개인가?
- 처음 보는 우리 서비스의 대시보드를 열었을 때, 30초 안에 정상/이상을 판정할 수 있는가?
- 큐 컨슈머가 있다면 랙을 보고 있는가?

## 다음

→ [05-percentiles-and-histograms.md](05-percentiles-and-histograms.md) — Duration을 "제대로" 재는 일은 생각보다 까다롭다.

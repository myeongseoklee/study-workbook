# 99. 참고 자료 — 실제로 확인한 1차 출처

여기 있는 URL은 이 자료를 쓰면서 **실제로 열어 본문을 확인한 것만**이다. 추측한 링크는 없다. 확인 시점은 **2026-08-20**이다.

## Four Golden Signals

| 자료 | 확인한 내용 |
|---|---|
| [Google SRE Book, Ch.6 — Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) | 네 신호의 원문 정의 · "If you can only measure four metrics of your user-facing system, focus on these four" · 성공/실패 레이턴시 분리 · 세 종류 에러(explicit/implicit/by policy) · Saturation의 "most constrained" · "Latency increases are often a leading indicator of saturation" · 버킷 히스토그램 권고 |

저자는 Rob Ewaschuk(6장), 편집 Betsy Beyer 외. O'Reilly 출판, 온라인 전문은 CC BY-NC-ND 4.0으로 공개되어 있다.

**더 깊이 볼 곳**: 같은 책 4장(Service Level Objectives)이 SLI/SLO/에러 예산의 정의를 담고, SRE Workbook 2장이 SLI 구현 예제를 담는다.

## USE Method

| 자료 | 확인한 내용 |
|---|---|
| [Brendan Gregg — The USE Method](https://www.brendangregg.com/usemethod.html) | U/S/E의 원문 정의와 표현 단위 · "For every resource, check utilization, saturation, and errors" · 버스트가 평균에 가려지는 경고 · 해석 규칙(사용률 70%, 포화 non-zero, 증가 중인 에러) · 에러를 먼저 봐도 되는 이유 · 사용률의 두 정의(각주) · 소프트웨어 자원의 범위 · "may find 80% of server issues" 한계 |
| [USE Method: Linux Performance Checklist](https://www.brendangregg.com/USEmethod/use-linux.html) | 자원별 U/S/E 측정 명령 — CPU(`vmstat` `r`), 메모리(`si`/`so`, OOM killer), 네트워크(`ifconfig` overruns/dropped/errors), 스토리지 I/O(`iostat %util`·`avgqu-sz`·`await`), 스토리지 용량(`df`, ENOSPC) |

**더 깊이 볼 곳**: 같은 사이트에 Solaris·FreeBSD·Mac OS X용 체크리스트가 따로 있다. Gregg의 *Systems Performance* 2판이 이 방법론의 전체 맥락(Method R, 워크로드 특성화 등 다른 방법론과의 관계)을 담는다.

## RED Method

| 자료 | 확인한 내용 |
|---|---|
| [Grafana Labs — The RED Method: How to Instrument Your Services](https://grafana.com/blog/the-red-method-how-to-instrument-your-services/) | Rate/Errors/Duration 정의 · "The USE Method doesn't really apply to services" · Saturation을 코어에서 제외하고 선택적으로 둔 것 · "You model this for every single service" · "allows you to put people on call for code they didn't write" |
| [Tom Wilkie — The RED Method (GrafanaCon EU 2018 슬라이드, PDF)](https://grafana.com/files/grafanacon_eu_2018/Tom_Wilkie_GrafanaCon_EU_2018.pdf) | 저자 본인의 발표 자료. 계측 패턴과 대시보드 구성 예 |

Tom Wilkie는 2015년 Weaveworks 재직 중 이 방법을 제안했고 같은 해 런던 Prometheus 밋업에서 처음 발표했다. 현재 Grafana Labs CTO다.

## 꼬리 지연과 분위수

| 자료 | 확인한 내용 |
|---|---|
| [The Tail at Scale — Dean & Barroso, CACM 2013](https://research.google/pubs/the-tail-at-scale/) | 팬아웃 증폭 예시 — p99=1초인 서버 100개에 팬아웃하면 사용자 요청의 **63%**가 1초를 넘는다 · 헤지 요청으로 p99.9가 1,800ms → 74ms(추가 요청 2%) |
| [Prometheus — Histograms and summaries](https://prometheus.io/docs/practices/histograms/) | Summary(클라이언트 계산) vs Histogram(서버 계산) · "averaging the quantiles yields statistically nonsensical values" · 선형 보간과 "error is limited by the width of the bucket" · 200~300ms 버킷에서 p95 추정 295ms vs 실제 220ms · 필요한 경계 버킷이 없으면 결과를 반환하지 않는다 · `le` 라벨과 누적 버킷 |

**더 깊이 볼 곳**: Prometheus의 네이티브 히스토그램(native histogram)은 지수 버킷으로 같은 저장 비용에 훨씬 높은 해상도를 낸다 — 위 문서의 후반부.

## 큐잉과 포화

| 자료 | 확인한 내용 |
|---|---|
| [M/M/1 queue (Wikipedia)](https://en.wikipedia.org/wiki/M/M/1_queue) | ρ = λ/μ · 평균 응답 시간 W = 1/(μ-λ) (= S/(1-ρ)) · 평균 대기 인원 L = ρ/(1-ρ) · 안정 조건 λ < μ |
| [Marc Brooker — Two traps in iostat: %util and svctm](https://brooker.co.za/blog/2014/07/04/iostat-pct.html) | 병렬 처리 장치에서 `%util`이 성능 한계를 반영하지 못하는 이유 — "적어도 하나가 진행 중인 시간의 비율"이라는 정의의 한계 |
| [Percona — Looking at Disk Utilization and Saturation](https://www.percona.com/blog/looking-disk-utilization-and-saturation/) | 현대 SSD·RAID에서 `%util` 대신 `await`·큐 깊이를 봐야 하는 실측 근거 |

## SLO와 에러 예산

| 자료 | 확인한 내용 |
|---|---|
| [Google SRE Workbook, Ch.5 — Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) | 소진율 정의 · 소진율 ↔ 에러율 ↔ 고갈 시간 표(1→30일, 2→15일, 10→3일, 1,000→43분) · 다중 창·다중 소진율 권장 파라미터(1시간/5분 14.4 · 6시간/30분 6 · 3일/6시간 1) · "make the short window 1/12 the duration of the long window" |

**더 깊이 볼 곳**: 같은 장의 앞부분이 단순 임계값 알림부터 시작해 여섯 단계로 알림 전략을 발전시키는 과정을 보여준다 — 각 단계가 어떤 실패를 고치는지 보면 최종 형태의 이유가 더 명확해진다.

## 이 자료의 출발점이 된 강의

**[모니터링] 구글이 알려준 꼭 봐야할 지표 4가지** — 코딩하는기술사 채널, 13분 43초, 슬라이드 12장.

Four Golden Signals의 네 신호·함정·인과 사슬·실무 체크리스트·안티패턴이 이 강의의 본문이고, 본문의 `[MM:SS]` 좌표가 그 자리를 가리킨다. USE·RED는 이 강의에서 도입부 1분(`[00:30]`~`[01:30]`)에 이름만 등장하므로, 이 자료의 [03](03-use-method.md)·[04](04-red-method.md)는 **위 원저자 1차 출처로 새로 채운 것**이다. 어디까지가 강의이고 어디부터가 보강인지는 [00-overview.md](00-overview.md) § 이 자료의 근거에 표로 있다.

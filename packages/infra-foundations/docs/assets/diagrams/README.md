# 인프라 교재의 그림 원본

본문에는 별도 도구 없이 표시되는 PNG를 넣었다. Archify 그림은 SVG가 벡터 확대용, HTML이 탐색 뷰어, JSON이 편집 원본이다. 17장의 AWS 배치도·서비스 연결도는 stack-diagram의 자체 완결 HTML이 편집 원본이며 밝은·어두운 PNG를 파생한다. 모든 그림은 본문에 적힌 가정과 출처를 사용한다.

## 그림 색인

| 장 | 그림 | 확대·탐색 |
|---|---|---|
| 01 | [실행 중인 값과 오래 남길 값은 어디에 있을까](01-execution.png) | [SVG](01-execution.svg) · [HTML](01-execution.html) · [JSON](01-execution.json) |
| 01 | [같은 프로그램으로 시작해도 실행 상태는 따로다](01-processes.png) | [SVG](01-processes.svg) · [HTML](01-processes.html) · [JSON](01-processes.json) |
| 02 | [같은 주문 데이터에 계층별 정보가 붙는다](02-encapsulation.png) | [SVG](02-encapsulation.svg) · [HTML](02-encapsulation.html) · [JSON](02-encapsulation.json) |
| 02 | [같은 서버 포트로 들어와도 연결 소켓은 나뉜다](02-sockets.png) | [SVG](02-sockets.svg) · [HTML](02-sockets.html) · [JSON](02-sockets.json) |
| 03 | [이름은 내가 유지하고 IP 관리는 업체가 맡는다](03-cname.png) | [SVG](03-cname.svg) · [HTML](03-cname.html) · [JSON](03-cname.json) |
| 03 | [DNS에 주소를 묻는 일과 웹 요청은 다른 경로다](03-dns-http.png) | [SVG](03-dns-http.svg) · [HTML](03-dns-http.html) · [JSON](03-dns-http.json) |
| 03 | [DNS 변경 시각과 캐시 만료 시각은 다르다](03-ttl.png) | [SVG](03-ttl.svg) |
| 04 | [세 번째 ACK가 서버의 시작 번호까지 확인한다](04-handshake.png) | [SVG](04-handshake.svg) · [HTML](04-handshake.html) · [JSON](04-handshake.json) |
| 04 | [뒤 조각이 먼저 와도 앱에는 앞에서부터 전달한다](04-reassembly.png) | [SVG](04-reassembly.svg) · [HTML](04-reassembly.html) · [JSON](04-reassembly.json) |
| 04 | [TCP 연결 뒤 TLS를 준비하고 HTTP를 보호한다](04-tls.png) | [SVG](04-tls.svg) · [HTML](04-tls.html) · [JSON](04-tls.json) |
| 05 | [/26의 경계는 마지막 숫자의 중간에 있다](05-cidr.png) | [SVG](05-cidr.svg) |
| 05 | [NAT는 나갈 때 바꾼 주소·포트의 대응을 기억한다](05-nat.png) | [SVG](05-nat.svg) · [HTML](05-nat.html) · [JSON](05-nat.json) |
| 05 | [길·통신 허용·수신 준비는 서로 다른 조건이다](05-route-policy.png) | [SVG](05-route-policy.svg) · [HTML](05-route-policy.html) · [JSON](05-route-policy.json) |
| 06 | [요청의 대기와 CPU 사용 시간을 나누어 보자](06-concurrency.png) | [SVG](06-concurrency.svg) |
| 06 | [둘 다 3을 읽으면 두 번 빼도 2가 남을 수 있다](06-race.png) | [SVG](06-race.svg) · [HTML](06-race.html) · [JSON](06-race.json) |
| 06 | [CPU를 기다리는 상태와 I/O를 기다리는 상태](06-states.png) | [SVG](06-states.svg) · [HTML](06-states.html) · [JSON](06-states.json) |
| 07 | [이미지는 공유해도 컨테이너의 변경은 따로다](07-layers.png) | [SVG](07-layers.svg) · [HTML](07-layers.html) · [JSON](07-layers.json) |
| 07 | [컨테이너를 바꿔도 이어 읽을 데이터는 밖에 둔다](07-storage-life.png) | [SVG](07-storage-life.svg) · [HTML](07-storage-life.html) · [JSON](07-storage-life.json) |
| 07 | [파일을 준비하는 것과 프로세스를 시작하는 것은 다른 단계다](07-startup.png) | [SVG](07-startup.svg) · [HTML](07-startup.html) · [JSON](07-startup.json) |
| 08 | [인덱스는 맞지 않는 범위를 건너뛰게 한다](08-index.png) | [SVG](08-index.svg) · [HTML](08-index.html) · [JSON](08-index.json) |
| 08 | [DB가 쉬어도 연결을 빌리기 전부터 기다릴 수 있다](08-pool.png) | [SVG](08-pool.svg) · [HTML](08-pool.html) · [JSON](08-pool.json) |
| 09 | [행 경쟁을 기다린 뒤 조건을 다시 평가한다](09-stock.png) | [SVG](09-stock.svg) · [HTML](09-stock.html) · [JSON](09-stock.json) |
| 09 | [성공 응답보다 먼저 복구 근거를 영속 기록한다](09-wal.png) | [SVG](09-wal.svg) · [HTML](09-wal.html) · [JSON](09-wal.json) |
| 10 | [앱을 늘려도 공통 DB의 처리 능력은 그대로다](10-bottleneck.png) | [SVG](10-bottleneck.svg) · [HTML](10-bottleneck.html) · [JSON](10-bottleneck.json) |
| 10 | [다음 요청이 B로 가도 공유 세션을 찾는다](10-session.png) | [SVG](10-session.svg) · [HTML](10-session.html) · [JSON](10-session.json) |
| 11 | [같은 키의 경쟁과 주문 기록을 한 DB에서 조정한다](11-idempotency.png) | [SVG](11-idempotency.svg) · [HTML](11-idempotency.html) · [JSON](11-idempotency.json) |
| 11 | [손님의 시간 초과 뒤에도 주문은 남아 있을 수 있다](11-timeout.png) | [SVG](11-timeout.svg) · [HTML](11-timeout.html) · [JSON](11-timeout.json) |
| 12 | [캐시가 없을 때만 원본을 읽는 기본 경로](12-cache.png) | [SVG](12-cache.svg) · [HTML](12-cache.html) · [JSON](12-cache.json) |
| 12 | [주문과 보낼 일을 함께 남긴 뒤 큐로 전달한다](12-outbox.png) | [SVG](12-outbox.svg) · [HTML](12-outbox.html) · [JSON](12-outbox.json) |
| 12 | [수신은 완료가 아니다 — 완료 확인 없이 끝나면 다시 전달](12-redelivery.png) | [SVG](12-redelivery.svg) · [HTML](12-redelivery.html) · [JSON](12-redelivery.json) |
| 13 | [배정 중단과 프로세스 종료 사이에 남은 요청을 끝낸다](13-draining.png) | [SVG](13-draining.svg) · [HTML](13-draining.html) · [JSON](13-draining.json) |
| 13 | [새 대상 준비 뒤에 기존 대상을 줄인다](13-rollout.png) | [SVG](13-rollout.svg) · [HTML](13-rollout.html) · [JSON](13-rollout.json) |
| 14 | [옛 읽기·쓰기가 사라진 증거를 모은 뒤 구조를 지운다](14-migration.png) | [SVG](14-migration.svg) · [HTML](14-migration.html) · [JSON](14-migration.json) |
| 15 | [150ms 요청의 시간은 어디에 쓰였을까](15-request-time.png) | [SVG](15-request-time.svg) |
| 15 | [평균 195ms 속에 2초를 기다린 손님이 있다](15-tail-latency.png) | [SVG](15-tail-latency.svg) |
| 16 | [연결 성공·신원 확인·작업 허용은 다른 관문이다](16-auth.png) | [SVG](16-auth.svg) · [HTML](16-auth.html) · [JSON](16-auth.json) |
| 16 | [역할 이름이 아니라 검증된 임시 자격으로 요청한다](16-role.png) | [SVG](16-role.svg) · [HTML](16-role.html) · [JSON](16-role.json) |
| 17 | [실행을 준비하는 권한과 앱이 사용하는 권한을 나눈다](17-control-roles.png) | [SVG](17-control-roles.svg) · [HTML](17-control-roles.html) · [JSON](17-control-roles.json) |
| 17 | [DNS 조회와 주문 요청은 서로 다른 경로다](17-request.png) | [원본 HTML](17-request.html) · [어두운 PNG](17-request-dark.png) |
| 17 | [VPC는 여러 AZ에 걸치고, 서브넷은 한 AZ 안에 둔다](17-placement.png) | [원본 HTML](17-placement.html) · [어두운 PNG](17-placement-dark.png) |
| 17 | [주문을 받기 전에 태스크 준비가 먼저 필요하다](17-task-start.png) | [SVG](17-task-start.svg) · [HTML](17-task-start.html) · [JSON](17-task-start.json) |
| 17 | [주문 요청과 확정 결과는 연결별로 왕복한다](17-order-sequence.png) | [SVG](17-order-sequence.svg) · [HTML](17-order-sequence.html) · [JSON](17-order-sequence.json) |

## 그림을 고칠 때

17장의 AWS 배치도·연결도는 `visual-doc`의 요소별 도구 선택에 따라 stack-diagram으로 만든다. 같은 이름의 HTML에서 배치·라벨을 수정하고 브라우저로 밝은·어두운 PNG를 다시 캡처한다. 공식 아이콘은 HTML에 내장하며 원본 아이콘 파일·패키지는 레포에 복사하지 않는다. 최신 렌더링 검사는 [브라우저 검사 기록](17-stack-browser-check.json)에 남겼다.

나머지 Archify 구조도·순서도·흐름도는 같은 이름의 JSON을 수정하고 Archify로 검증·렌더링한다. 아래 명령은 이 폴더에서 실행하며 `archify_cli`에는 설치된 Archify CLI 경로를 지정한다.

```bash
archify_cli=/path/to/archify/bin/archify.mjs
node "$archify_cli" finalize sequence 04-handshake.json 04-handshake.html --quality showcase --out-dir /tmp/infra-handshake-review --json
```

변경한 HTML 뷰어에서 내보내기로 PNG·SVG를 갱신한다. JSON만 바꾸고 본문의 이미지를 그대로 두지 않는다. 그래프는 [render-charts.py](render-charts.py)로 생성하며 Python의 Matplotlib과 한글 글꼴이 필요하다. 실행하면 이 폴더의 그래프 PNG·SVG 다섯 쌍을 갱신한다. 그래프 수치는 본문 예시와 함께 고친다.

```bash
python render-charts.py
```

PNG·SVG는 본문을 보조하는 그림이며 HTML의 인터랙션까지 포함하지 않는다. Archify 뷰어와 내장 글꼴의 저작권·라이선스 고지는 각 HTML·SVG에 포함돼 있다. stack-diagram HTML의 아이콘 출처는 AWS Architecture Icons와 Lucide이며 서비스 로고의 권리는 각 소유자에게 있다.

## 본문 미리보기 갱신

본문은 클릭해서 원본을 여는 축소 미리보기다. 원본을 바꾸면 Pillow가 있는 Python 환경에서 `python render-previews.py`로 미리보기도 갱신한다. 가로·세로 크기에 상한을 두며, 수치축이 없는 구조도·흐름도만 빈 세로 여백을 줄인다. 순서도와 수치 그래프의 내부 간격·축은 보존한다.

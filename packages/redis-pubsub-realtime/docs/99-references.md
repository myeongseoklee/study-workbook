# 공식 문서 색인

이 자료의 주장 가운데 외부 권위 자료로 확인한 것들의 출처입니다. **모든 URL은 이 자료를 만들면서 실제로 열어 본문을 확인한 것**이고, 확인하지 못한 것은 아래 「확인하지 못한 것」 절에 따로 적었습니다. 마지막 확인일은 모두 2026-09-03입니다.

## Redis Pub/Sub

- [Redis Pub/Sub](https://redis.io/docs/latest/develop/pubsub/) — 이 자료의 뼈대가 되는 문서입니다. RESP2 구독 상태에서 허용되는 명령 아홉 개의 목록, RESP3에서 그 제약이 사라진다는 문장, at-most-once 전달 보장, 패턴 구독의 메시지 형식과 중복 전달, Pub/Sub이 데이터베이스 번호와 무관하다는 규정, Sharded Pub/Sub의 도입 버전과 전파 제한 효과가 모두 여기 있습니다.
- [RESP 프로토콜 명세](https://redis.io/docs/latest/develop/reference/protocol-spec/) — 접속이 RESP2 모드로 시작한다는 규정, RESP2 커넥션이 구독하면 푸시 프로토콜로 의미론이 바뀐다는 설명.
- [HELLO 명령](https://redis.io/docs/latest/commands/hello/) — 프로토콜 버전 협상.

## 명령 문서

- [PUBLISH](https://redis.io/docs/latest/commands/publish/) — 반환값이 "메시지가 전송된 클라이언트의 수"라는 정의와, 클러스터에서 발행 클라이언트와 같은 노드의 클라이언트만 센다는 규정. 시간 복잡도 표기가 패턴 수를 포함합니다.
- [PUBSUB NUMSUB](https://redis.io/docs/latest/commands/pubsub-numsub/) — 패턴 구독자를 제외한다는 규정과, 클러스터에서 그 노드의 Pub/Sub 문맥만 보고한다는 설명.
- [SSUBSCRIBE](https://redis.io/docs/latest/commands/ssubscribe/) — 도입 버전 7.0.0, 한 번의 호출에 넣는 샤드 채널이 모두 같은 슬롯이어야 한다는 제약, `-MOVED` 응답 가능성.
- [XACK](https://redis.io/docs/latest/commands/xack/) — 대기 항목 목록에서 지우는 동작과 반환값의 정의.
- [XAUTOCLAIM](https://redis.io/docs/latest/commands/xautoclaim/) — 도입 버전 6.2.0, 소유권 이전과 최소 유휴 시간, `COUNT` 기본값 100과 훑는 범위가 그 열 배라는 규정, 소유권 이전이 유휴 시간을 초기화한다는 설명.
- [XTRIM](https://redis.io/docs/latest/commands/xtrim/) — `MAXLEN`과 `MINID` 두 전략의 정의, `~`가 뜻하는 근사 자르기, `LIMIT`의 기본값.
- [CLIENT LIST](https://redis.io/docs/latest/commands/client-list/) — `omem`·`obl`·`oll`·`tot-mem`·`tot-net-out`·`sub`·`psub` 필드의 뜻과 `flags`의 `P`·`A` 값.

## 운영과 클러스터

- [Redis 클라이언트 처리](https://redis.io/docs/latest/develop/reference/clients/) — Pub/Sub 클라이언트의 기본 한계가 hard 32MB, soft 8MB, 60초라는 서술, 한계에 도달하면 연결을 닫고 로그에 남긴다는 규정, `timeout` 설정이 Pub/Sub 클라이언트에 적용되지 않는다는 설명.
- [redis.conf 예제](https://github.com/redis/redis/blob/unstable/redis.conf) — `client-output-buffer-limit`의 문법과 세 클래스의 기본값, hard 판정과 soft 판정의 차이, 0으로 두면 해제된다는 주석.
- [Redis Cluster 명세](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/) — 발행된 메시지를 다른 모든 노드로 브로드캐스트한다는 규정과, 클러스터 버스가 그 전파 경로라는 설명.

## Redis Streams

- [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/) — Pub/Sub과의 근본적 차이, 소비자 그룹이 제공하는 통제 수준의 열거, `XGROUP`·`XREADGROUP`·`XACK`의 역할, 자르기, 지속성이 비동기 복제와 AOF 정책에 달려 있다는 서술, 정확히 한 번의 처리는 일반적으로 얻을 수 없다는 단서.

## 클라이언트 라이브러리

- [redis-py](https://github.com/redis/redis-py) — RESP3 지원이 5.0부터라는 설명, 8.0부터 통신을 기본적으로 RESP3로 한다는 설명, `protocol` 인자로 명시하는 방법. 판본별 기본값은 리포지토리의 `DEFAULT_RESP_VERSION` 상수로 확인했습니다.

## Server-Sent Events (보조)

- [MDN: Server-Sent Events 사용하기](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) — HTTP/2가 아닐 때의 동시 연결 수 제약과 HTTP/2에서의 차이. **다만 이 문서가 그 근거로 인용한 것이 규격 문서가 아니므로, 이 자료는 숫자 6을 규범이 아니라 브라우저 구현의 관행으로 소개합니다.**
- [RFC 9112 (HTTP/1.1) 9.4절 Concurrency](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.4) — 특정한 최대 연결 수를 규정하지 않고 보수적일 것을 권한다는 조항. 이전 판이 제시했던 수가 실용적이지 않은 것으로 드러났다는 서술이 함께 있습니다.
- [RFC 9113 (HTTP/2) 6.5.2절](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.5.2) — `SETTINGS_MAX_CONCURRENT_STREAMS`의 정의, 처음에는 한계가 없다는 규정, 100보다 작지 않게 두라는 권고.

## 원본 강의

- [실전개발: Redis Pub/Sub를 활용한 실시간 알림 구현 with FastAPI](https://youtu.be/I6ioHc1yspg) — 채널 「코딩하는기술사」, 28분 54초, 2026-08-30 공개. 본문의 `[MM:SS]` 좌표가 이 영상을 가리킵니다.

## 확인하지 못한 것

정확성을 위해 밝혀 둡니다.

| 항목 | 상태 |
|---|---|
| 폴링·SSE·웹소켓 가운데 폴링이 차지하는 비율 | 강의가 「90% 이상」이라고 말하지만 `[01:30]` 근거를 확인할 자료를 찾지 못했습니다. 그래서 이 자료는 수치를 옮기지 않고 판단 기준만 남겼습니다 |
| Sharded Pub/Sub이 패턴 구독을 다루지 않는다는 사실 | Redis 구현에서 확인했으나 명령 문서의 산문에는 이를 밝힌 문장이 없습니다. 옮기기 전에 실제 환경에서 한 번 확인하시기를 권합니다 |
| 실습 코드의 `redis.from_url(...)` 두 번째 인자 | 강의 화면에서 오른쪽이 잘려 확인하지 못했습니다. [04](04-realtime-notification.md)에 그 사실을 표시했습니다 |
| 실습 코드의 `/pub_sub` 엔드포인트 본문 | 강의 화면 아래로 잘려 확인하지 못했습니다. [04](04-realtime-notification.md)에 자리만 남겼습니다 |
| Kafka의 구체적인 성질과 수치 | 강의가 이름만 언급하므로 이 자료도 「Redis 밖의 메시지 큐」라는 선택지로만 다루고 수치를 적지 않았습니다. 필요하면 Apache Kafka 공식 문서를 따로 확인하십시오 |

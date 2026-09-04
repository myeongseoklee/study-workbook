# 실시간 알림 구현 읽기

## 학습 목표

- [ ] 발행용 커넥션과 구독용 커넥션이 코드의 어느 자리에서 갈라지는지 짚을 수 있습니다.
- [ ] `get_message`에 타임아웃을 주는 진짜 이유를 성능이 아닌 제어 흐름으로 설명할 수 있습니다.
- [ ] 메타데이터를 걸러 내는 두 겹의 검사가 각각 무엇을 막는지 구분할 수 있습니다.
- [ ] 무한 반복문에 짧은 대기를 넣지 않으면 무엇이 무너지는지 설명할 수 있습니다.

## 선수 지식

- [02-core-principles.md](02-core-principles.md)의 원리 2, 구독한 커넥션은 성격이 달라진다
- [03-connection-isolation.md](03-connection-isolation.md)의 커넥션 분리 처방
- [01-prerequisites.md](01-prerequisites.md)의 비동기 제너레이터

## 실습 코드 전문

강의가 화면에 띄운 `pub_sub_server.py`입니다. 자동 자막이 식별자를 거의 전부 다르게 적어 놓았기 때문에, 아래 코드는 화면 캡처 `[07:56]`, `[09:04]`, `[12:28]`, `[14:10]`, `[15:18]` 다섯 곳을 읽어 재구성한 것입니다.

```python
import asyncio
import redis.asyncio as redis
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 시작 시 Redis 연결 풀 생성
    # ⚠️ 두 번째 인자는 화면에서 잘려 확인하지 못했습니다. 아래 표를 보십시오
    app.state.redis = redis.from_url("redis://localhost:6379/0", decode_responses=True)
    yield
    # 서버 종료 시 연결 해제
    await app.state.redis.aclose()


app = FastAPI(lifespan=lifespan)

# 공지사항용 채널명
NOTICE_CHANNEL = "system:notices"


@app.get("/pub_sub")
async def pub_sub_page():
    """테스트용 클라이언트 HTML 페이지를 반환한다. Pub/Sub과는 무관하다."""
    ...


@app.post("/publish-notice")
async def send_notice(message: str, request: Request):
    """[발행자] Swagger에서 공지를 발행합니다."""
    rd = request.app.state.redis
    # 채널에 메시지 전송 (밀어 넣은 커넥션 수를 반환)
    subscriber_count = await rd.publish(NOTICE_CHANNEL, message)
    return {"status": "success", "received_subscribers": subscriber_count}


@app.get("/stream-notices")
async def stream_notices(request: Request):
    """[수신자] SSE를 통해 실시간 알림을 수신합니다."""

    async def event_generator():
        # [핵심] rd.pubsub()으로 구독 전용 객체 생성 (커넥션 분리)
        async with request.app.state.redis.pubsub() as pubsub:
            await pubsub.subscribe(NOTICE_CHANNEL)
            try:
                while True:
                    # 메시지 대기 (ignore_subscribe_messages=True로 설정)
                    message = await pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=1.0
                    )
                    if message and message['type'] == 'message':
                        data = message['data']
                        # SSE 표준 포맷 전송 (data: [내용]\n\n)
                        yield f"data: {data}\n\n"

                    # 브라우저가 창을 닫으면 루프를 종료하여 커넥션 반환
                    if await request.is_disconnected():
                        break

                    await asyncio.sleep(0.01)
            finally:
                # 작업 종료 시 명시적 구독 해제
                await pubsub.unsubscribe(NOTICE_CHANNEL)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

### 확인하지 못한 두 곳

정확성을 위해 밝혀 둡니다. 아래 두 곳은 화면에서 직접 읽지 못했으므로 단정하지 마십시오.

| 위치 | 상황 |
|---|---|
| `redis.from_url(...)`의 두 번째 인자 | 캡처에서 `decode_` 까지만 보이고 오른쪽이 화면 밖으로 잘렸습니다. 문맥상 `decode_responses=True`가 거의 확실하지만 눈으로 확인한 것은 아닙니다 |
| `/pub_sub` 엔드포인트의 본문 | 화면 아래로 잘려 보이지 않아 자리만 남겼습니다. 강사는 이 엔드포인트가 테스트용 HTML을 반환한다고만 설명했습니다 `[08:00]`~`[08:30]` |

`decode_responses`는 Redis가 돌려주는 바이트열을 문자열로 바꿀지 정하는 설정입니다. 이 값이 참이 아니면 `message['data']`가 `b'...'` 형태의 바이트열로 나오므로 그대로 문자열에 끼워 넣었을 때 브라우저 화면에 `b'공지 내용'`처럼 접두사가 따라 붙습니다. 강의 실습에서 그런 접두사가 보이지 않았으므로 참이었다고 보는 것이 자연스럽습니다.

## 핵심 내용

### 커넥션이 갈라지는 자리

코드에서 커넥션이 갈라지는 지점은 정확히 한 줄입니다.

| 자리 | 무엇을 쓰는가 |
|---|---|
| `lifespan` | 애플리케이션 전체가 공유하는 연결 풀을 만듭니다 |
| `/publish-notice` | 그 풀의 **일반 커넥션**으로 `publish`를 보냅니다. 요청과 응답이 한 번에 끝나므로 풀에 곧바로 돌아갑니다 |
| `/stream-notices` | `.pubsub()`으로 **구독 전용 객체**를 따로 만듭니다. 이 객체가 잡은 커넥션은 구독 상태로 들어가므로 일반 요청에 쓰이면 안 됩니다 |

`async with`를 쓰는 까닭이 여기 있습니다. 이 블록을 벗어나면 구독 전용 객체가 잡고 있던 자원이 자동으로 정리됩니다. 클라이언트가 어떤 방식으로 떠나든 정리가 보장되어야 하고, 그렇지 않으면 떠난 클라이언트의 구독 커넥션이 계속 쌓입니다.

### 타임아웃은 성능 설정이 아니다

`get_message(timeout=1.0)`의 타임아웃을 처리량을 위한 값으로 오해하기 쉽지만, 이 코드에서 그 값이 하는 일은 **제어를 반복문 아래쪽으로 돌려주는 것**입니다 `[11:30]`~`[14:00]`.

타임아웃이 없으면 `get_message`는 메시지가 올 때까지 블로킹 상태로 머뭅니다. 그러면 그 아래에 있는 `request.is_disconnected()` 검사에 영원히 도달하지 못합니다. 브라우저가 창을 닫고 떠났어도 코드는 그 사실을 알 수 없고, 다음 메시지가 발행되어야만 비로소 알게 됩니다. 공지가 하루에 몇 건뿐인 시스템이라면 떠난 클라이언트의 구독 커넥션이 하루 종일 남습니다.

타임아웃을 1초로 주면 흐름이 이렇게 바뀝니다.

```
  get_message(timeout=1.0)
        │
        ├─ 메시지가 왔다     ->  yield 로 클라이언트에 전달하고
        │                        루프 아래로 내려간다
        │
        └─ 1초가 지났다      ->  None 을 돌려주고 함수가 끝나므로
                                 루프 아래로 내려간다
```

**이 그림이 말하는 것은 하나입니다.** 두 갈래가 모두 반복문 아래쪽에 도달하므로 그 자리에서 `request.is_disconnected()`를 확인할 수 있습니다. 타임아웃이 만드는 것은 속도가 아니라 점검할 틈입니다.

같은 자리에 넣을 수 있는 다른 점검거리도 많습니다. 토큰 만료 확인, 종료 신호 확인, 하트비트 전송이 전부 이 틈에 들어갑니다. 실무에서 무한 대기 대신 타임아웃을 두는 구현이 흔한 이유가 그것입니다.

### 메타데이터를 거르는 두 겹

Redis는 구독이 성공했다는 사실이나 구독이 해제되었다는 사실도 같은 스트림으로 밀어 보냅니다. 실제 공지 내용만 클라이언트에게 전달하려면 그것들을 걸러 내야 합니다. 코드에는 걸러 내는 장치가 두 겹으로 보이는데, **두 겹이 막는 것이 서로 다릅니다.**

| 장치 | 실제로 막는 것 |
|---|---|
| `ignore_subscribe_messages=True` | 구독·구독 해제 확인 같은 메타데이터를 걸러냅니다 `[11:30]`~`[12:30]` |
| `if message and ...` 의 앞부분 | **타임아웃으로 돌아온 `None`을 막습니다.** 이것이 없으면 다음 줄에서 곧바로 오류가 납니다 |
| `... message['type'] == 'message'` | 첫 번째 장치가 이미 한 일을 한 번 더 합니다 |

즉 겹치는 것은 첫 번째와 세 번째뿐이고, 가운데의 `message and`는 겹치지 않는 필수 검사입니다. 세 번째를 방어적으로 남겨 두는 것 자체는 나쁘지 않지만, **그것을 "메타데이터를 거르는 유일한 장치"라고 이해하면 첫 번째 설정을 지웠을 때 무엇이 깨지는지 예측하지 못합니다.**

### 무한 반복문에 짧은 대기를 넣는 까닭

`await asyncio.sleep(0.01)`은 두 가지를 막습니다 `[14:30]`~`[15:00]`.

1. 반복문이 CPU를 과도하게 쓰는 것
2. 반복문이 이벤트 루프를 독점해 같은 프로세스의 다른 비동기 작업이 실행 기회를 얻지 못하는 것

둘째가 더 중요합니다. 이 서버는 알림 스트림만 처리하는 것이 아니라 발행 요청도 함께 처리하므로, 스트림 반복문이 제어를 놓지 않으면 발행 API가 응답하지 못합니다. 자세한 설명은 [01-prerequisites.md](01-prerequisites.md)의 필수 개념 4에 있습니다.

### 종료할 때 명시적으로 구독을 해제한다

`finally` 절의 `unsubscribe`는 `async with`가 이미 정리해 줄 자원을 한 번 더 정리하는 것처럼 보입니다. 그래도 남겨 두는 편이 낫습니다. 정리 순서를 코드에 드러내면 나중에 이 블록에 다른 처리를 덧붙일 때 어디에 넣어야 할지가 분명해지고, 반복문이 예외로 빠져나가는 경로에서도 구독 해제가 먼저 일어난다는 것이 보장되기 때문입니다.

## 실습을 재현하는 절차

강의의 검증 방법은 같은 애플리케이션을 두 대 띄워 한쪽에서 발행한 것을 양쪽이 함께 받는지 확인하는 것입니다 `[20:00]`~`[26:00]`.

1. 같은 애플리케이션을 `uvicorn`으로 포트 8000과 8001에 각각 띄웁니다.
2. 브라우저 두 개를 열어 각각 `http://localhost:8000/pub_sub`과 `http://localhost:8001/pub_sub`에 접속합니다. 이 페이지가 서버로 SSE 연결을 엽니다.
3. 어느 쪽이든 Swagger UI(`/docs`)에서 `/publish-notice`를 호출해 공지를 발행합니다.
4. 발행한 쪽과 발행하지 않은 쪽 브라우저에 **같은 순간에** 공지가 나타나면 성공입니다.

두 서버는 서로를 전혀 모릅니다. 중앙의 Redis만 공유하고 있고, 그것만으로 8001번 서버가 8000번 서버의 발행을 받습니다. 이것이 [02-core-principles.md](02-core-principles.md)의 원리 1이 코드로 확인되는 자리입니다.

## ⚠️ 암기 필수

- [ ] **`get_message`에 타임아웃을 주는 이유는 성능이 아니라 반복문에서 다른 상태를 점검할 틈을 만드는 것이다.**
  - 이유: 이 이유를 모르면 "어차피 메시지를 기다릴 텐데 왜 굳이"라고 판단해 타임아웃을 지우게 되고, 그러면 떠난 클라이언트를 감지하는 경로가 통째로 사라집니다. 증상은 커넥션 누수로 나타나므로 원인을 짚기 어렵습니다.

## 우리 프로젝트 적용

이 코드는 **메커니즘을 이해하기 위한 샘플이지 그대로 옮겨 쓸 구조가 아닙니다.** 강사 자신이 그렇게 밝힙니다 `[15:30]`, `[26:00]`. 클라이언트가 접속할 때마다 구독 전용 객체를 만드는 부분이 문제이고, 그것을 어떻게 고쳐야 하는지가 [05-fanout-registry.md](05-fanout-registry.md)의 주제입니다.

## 자가 진단

<details>
<summary>Q1: `get_message(timeout=1.0)`에서 타임아웃을 지우면 무엇이 깨지는가?</summary>

브라우저가 떠났는지 확인하는 경로가 사라집니다. 타임아웃이 없으면 `get_message`가 메시지를 받을 때까지 블로킹 상태로 머무르므로 그 아래의 `request.is_disconnected()` 검사에 도달하지 못합니다. 다음 메시지가 발행되기 전까지 떠난 클라이언트의 구독 커넥션이 계속 남고, 발행 빈도가 낮은 시스템일수록 오래 남습니다.

</details>

<details>
<summary>Q2: `if message and message['type'] == 'message'`에서 `message and` 부분을 지우면 어떻게 되는가?</summary>

타임아웃으로 `None`이 돌아왔을 때 다음 줄에서 곧바로 오류가 납니다. 이 부분은 메타데이터를 거르는 장치가 아니라 타임아웃 반환값을 막는 장치이므로, `ignore_subscribe_messages=True`와 겹치지 않는 필수 검사입니다.

</details>

<details>
<summary>Q3: `asyncio.sleep(0.01)`을 지우면 실제로 어떤 증상이 나타나겠는가?</summary>

같은 프로세스가 처리해야 할 다른 요청이 응답하지 못합니다. 스트림 반복문이 `await`를 만나지 않고 계속 돌면 이벤트 루프가 그 반복문에서 벗어날 기회를 얻지 못하기 때문입니다. 발행 API를 호출해도 응답이 오지 않는 것으로 나타나고, CPU 사용률이 한 코어만큼 올라가 있는 것이 함께 보입니다.

</details>

## 공식 문서

- [Redis Pub/Sub](https://redis.io/docs/latest/develop/pubsub/) — 구독 확인 메시지가 실제 데이터와 같은 스트림으로 오는 이유와 그 형식
- [PUBLISH 명령](https://redis.io/docs/latest/commands/publish/) — `publish`가 돌려주는 값의 정의

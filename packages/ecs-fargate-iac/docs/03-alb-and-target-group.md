# 03. ALB와 타겟그룹 — 바뀌는 목적지 앞에 고정된 주소를 세운다

## 학습 목표

이 문서를 다 읽으면 (1) 로드밸런서·리스너·타겟그룹의 역할 분담을 설명할 수 있고, (2) **헬스체크 설정값에서 "장애 감지까지 몇 초 걸리는가"를 계산**할 수 있고, (3) TLS 종료와 인증서가 왜 로드밸런서에 있는지, 그리고 이 템플릿이 `SslPolicy`를 명시한 이유를 말할 수 있다.

## 선수 지식

[02 네트워크](02-network-vpc-sg.md)의 public/private 서브넷과 보안 그룹 체인. HTTP 상태 코드와 HTTP 메서드(GET/HEAD)의 차이.

---

## 핵심 원리 (WHY)

### 목적지가 계속 바뀐다는 문제

Fargate 태스크는 배포마다 새 ENI를 받고, 그때마다 사설 IP가 바뀐다. 스케일 아웃하면 태스크가 늘고, 헬스체크에 실패하면 교체된다. **어제 접속했던 IP가 오늘은 존재하지 않는다.**

그런데 클라이언트에게 줄 주소는 고정돼야 한다. 이 간극을 메우는 것이 로드밸런서다. 로드밸런서는 다음 네 가지를 한꺼번에 해결한다.

1. **고정된 진입점** — 클라이언트는 변하지 않는 DNS 이름 하나만 안다
2. **분배** — 태스크 여러 개에 요청을 나눈다
3. **건강 판정** — 죽은 태스크에는 요청을 보내지 않는다
4. **TLS 종료** — 인증서를 한 곳에서 관리하고 암호화를 대신 처리한다

세 번째가 특히 중요하다. 로드밸런서가 없다면 "어느 태스크가 살아 있는지"를 클라이언트가 알아야 하고, 그건 클라이언트에게 인프라 지식을 요구하는 설계다.

AWS의 로드밸런서는 세 종류이며, 이 템플릿은 **ALB(Application Load Balancer)**를 쓴다.

| 종류 | 계층 | 판단 근거 | 쓸 때 |
|---|---|---|---|
| **ALB** | L7 (HTTP) | 경로·호스트·헤더 | HTTP/HTTPS 서비스 |
| NLB | L4 (TCP) | IP·포트만 | 초고성능, 비HTTP 프로토콜, 고정 IP 필요 |
| CLB | 구세대 | — | 신규 사용 안 함 |

ALB를 고른 이유는 HTTP 서비스이기 때문이다. ALB는 HTTP를 이해하므로 `/health` 경로에 GET을 보내 응답 코드를 확인할 수 있고, 나중에 경로별로 다른 서비스로 보내는 라우팅도 가능하다. NLB는 TCP 연결 성공 여부만 보므로 "포트는 열렸지만 애플리케이션이 500을 뱉는" 상태를 건강하다고 판정한다.

### 세 리소스로 쪼개진 이유

ALB는 CloudFormation에서 최소 세 리소스로 나뉜다.

```
[LoadBalancer]  ─ 어디에 있고 누구에게 보이는가 (서브넷, 스킴, 보안 그룹)
      │
[Listener]      ─ 어떤 포트/프로토콜로 받고, 인증서는 무엇이며, 기본 행동은 무엇인가
      │
[TargetGroup]   ─ 누구에게 보내고, 건강을 어떻게 판정하는가
      │
   (Targets)    ─ 실제 태스크들. ECS가 자동으로 등록·해제한다
```

이 분리가 왜 필요한가. **각 층의 수명이 다르기 때문이다.**

- 로드밸런서는 한 번 만들면 오래 유지된다 (DNS 이름이 바뀌면 클라이언트가 다 깨진다)
- 리스너는 인증서 갱신·TLS 정책 변경으로 바뀔 수 있다
- 타겟은 배포마다 전부 교체된다

한 리소스였다면 타겟이 바뀔 때마다 로드밸런서 전체를 건드려야 했다. 쪼개져 있으므로 **ECS가 타겟그룹의 타겟 목록만 갱신하고, 로드밸런서와 리스너는 그대로 있다.**

그리고 이 분리 때문에 [01](01-iac-and-cloudformation.md)에서 본 `DependsOn`이 필요해진다. 서비스는 타겟그룹을 참조하지만 리스너는 참조하지 않아서, 리스너 없이 서비스가 먼저 만들어질 수 있고 그러면 트래픽 경로가 없는 상태에서 헬스체크가 시작된다.

### TargetType: ip — awsvpc의 필연적 결과

```yaml
  TargetGroup:
    Properties:
      TargetType: ip
```

타겟 타입은 세 가지다.

| 타입 | 타겟이 무엇인가 | 언제 |
|---|---|---|
| `instance` | EC2 인스턴스 ID | EC2 인스턴스에 직접 부하 분산 |
| `ip` | IP 주소 | **`awsvpc` 모드 ECS 태스크**, 온프레미스 서버 |
| `lambda` | Lambda 함수 | 서버리스 백엔드 |

[02](02-network-vpc-sg.md)에서 봤듯 Fargate 태스크는 `awsvpc` 모드라 각자 사설 IP를 갖는다. 그러니 타겟은 IP다. **`instance`를 쓸 수 없다** — Fargate에는 당신이 볼 수 있는 인스턴스가 없기 때문이다.

이 조합에서 얻는 부수 효과가 하나 있다. `ip` 타입은 태스크의 IP와 **컨테이너 포트로 직접** 트래픽을 보낸다. EC2 시절에는 호스트의 임의 포트가 컨테이너 포트로 매핑돼서 포트 관리가 복잡했는데, 그 층이 사라진다.

### ⭐ 헬스체크 — "건강하다"를 정의하는 여섯 개의 숫자

```yaml
      HealthCheckPath: /health
      HealthCheckProtocol: HTTP
      HealthCheckIntervalSeconds: 30
      HealthCheckTimeoutSeconds: 5
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3
      Matcher:
        HttpCode: "200"
```

각 값의 의미와, **이 값들이 결정하는 시간**이 핵심이다.

| 설정 | 의미 |
|---|---|
| `HealthCheckPath` | 어디로 요청을 보내는가 |
| `HealthCheckProtocol` | 어떤 프로토콜로 (여기서는 HTTP — ALB↔태스크 구간은 암호화하지 않음) |
| `HealthCheckIntervalSeconds` | 몇 초마다 확인하는가 |
| `HealthCheckTimeoutSeconds` | 몇 초 안에 응답이 없으면 실패로 보는가 |
| `HealthyThresholdCount` | 연속 몇 번 성공하면 건강으로 되돌리는가 |
| `UnhealthyThresholdCount` | 연속 몇 번 실패하면 비정상으로 보는가 |
| `Matcher.HttpCode` | 어떤 상태 코드를 성공으로 볼 것인가 |

**이 설정으로 장애 감지까지 걸리는 시간을 계산할 수 있다.**

```
비정상 판정까지  = Interval × UnhealthyThresholdCount = 30 × 3 = 최대 90초
건강 복귀까지    = Interval × HealthyThresholdCount   = 30 × 2 = 최대 60초
```

즉 태스크가 죽어도 **최대 90초 동안은 ALB가 그 태스크로 요청을 계속 보낸다.** 이 시간을 줄이려면 `Interval`을 낮추거나 `UnhealthyThresholdCount`를 낮춘다. 하지만 둘 다 대가가 있다.

- `Interval`을 낮추면 → 헬스체크 요청이 늘어 애플리케이션에 부하가 생긴다
- `UnhealthyThresholdCount`를 낮추면 → 일시적 지연(GC 일시정지, 순간 부하)에 건강한 태스크가 쫓겨난다

**이것이 감지 속도와 안정성의 트레이드오프이며, 어느 쪽으로도 공짜가 없다.** 임계값 1은 네트워크 순간 오류 한 번에 태스크가 교체된다는 뜻이고, 임계값 5는 죽은 태스크가 2분 반 동안 요청을 받는다는 뜻이다. 30초 × 3회는 그 사이의 보수적 기본값이다.

`Matcher.HttpCode: "200"`은 200만 성공으로 본다는 뜻이다. 범위(`200-299`)나 목록(`200,204`)도 쓸 수 있다. **여기를 좁게 잡을수록 판정이 엄격해진다** — 애플리케이션이 헬스체크에 204를 반환하도록 바뀌면 갑자기 모든 태스크가 unhealthy가 된다.

### ⭐ 함정 — HEAD로 확인하면 GET 전용 라우트가 실패한다

같은 `/health`를 확인하는데도 **어떤 HTTP 메서드로 요청하는가**가 문제가 된다.

`wget --spider`는 편의상 헬스체크에 자주 쓰이지만 **HEAD 요청을 보낸다.** 그리고 웹 프레임워크에서 `app.get('/health', ...)`로 등록한 라우트는 HEAD 요청을 잡지 않는다. HEAD 요청은 라우트에 매칭되지 않아 다음 미들웨어로 흘러가고, 그게 인증 미들웨어라면 **401**을 반환한다.

결과: 컨테이너 헬스체크가 계속 실패하고, 태스크가 unhealthy로 판정되고, 배포가 실패한다. 그런데 브라우저로 `/health`를 열면 200이 잘 나온다 — 브라우저는 GET을 보내기 때문이다.

이 템플릿의 주석이 정확히 이 사고를 기록해 뒀다.

```yaml
          HealthCheck:
            Command:
              - CMD-SHELL
              # GET 사용(-O /dev/null). --spider는 HEAD 요청인데 /health는 .get() 전용 라우트라
              # HEAD가 401로 빠져 unhealthy 오판 위험
              - !Sub wget -q -O /dev/null http://localhost:${ContainerPort}/health || exit 1
```

`-O /dev/null`은 "본문을 받아서 버려라"는 뜻이고, 본문을 받으려면 GET이어야 하므로 결과적으로 GET이 된다. ALB의 타겟 헬스체크는 항상 GET을 보내므로, **컨테이너 헬스체크도 GET으로 맞춰 두 판정이 어긋나지 않게** 한 것이다.

### 헬스체크가 두 곳에 있는 이유

혼동하기 쉬운 지점이라 정리한다. 이 템플릿에는 헬스체크가 **두 개** 있고, 서로 다른 것을 본다.

| | 타겟그룹 헬스체크 | 컨테이너 헬스체크 |
|---|---|---|
| 정의 위치 | `TargetGroup.HealthCheckPath` | `TaskDefinition.ContainerDefinitions[].HealthCheck` |
| 누가 실행 | ALB가 **밖에서** 태스크 IP로 요청 | ECS 에이전트가 **컨테이너 안에서** 명령 실행 |
| 확인하는 것 | 네트워크 경로 + 애플리케이션 응답 | 애플리케이션 프로세스 상태 |
| 실패하면 | ALB가 트래픽을 안 보낸다 | ECS가 태스크를 교체한다 |

둘이 겹쳐 보이지만 잡는 실패가 다르다. **보안 그룹이 잘못돼 ALB가 태스크에 닿지 못하면** 타겟그룹 헬스체크만 실패한다(컨테이너 안에서는 `localhost`로 확인하므로 성공). 반대로 **애플리케이션이 멈췄지만 포트는 열려 있으면** 둘 다 실패한다.

그리고 두 판정이 서비스의 배포 완료 조건에 함께 들어간다 — 이 부분은 [04](04-ecs-fargate.md)에서 다룬다.

### 등록 해제 지연 — 태스크를 즉시 끊지 않는 이유

```yaml
      TargetGroupAttributes:
        - Key: deregistration_delay.timeout_seconds
          Value: "30"
```

배포로 옛 태스크를 내릴 때, ALB는 그 태스크를 타겟그룹에서 즉시 빼지 않는다. **처리 중인 요청(in-flight request)이 끝날 시간을 준다.**

과정은 이렇다.

1. 타겟이 `draining` 상태가 된다 — 새 요청은 안 보내고, 기존 연결은 유지
2. `deregistration_delay` 시간이 지나면 `unused`가 되고 실제로 해제된다
3. 단, 처리 중인 요청과 활성 연결이 없으면 **기다리지 않고 즉시** 해제한다

기본값은 **300초**다. 이 템플릿은 30초로 줄였다.

기본값 300초를 그대로 두면 배포가 느려진다. 옛 태스크마다 최대 5분을 기다리게 되므로, 태스크 몇 개짜리 서비스도 배포에 10분 이상 걸릴 수 있다. 반대로 너무 짧게 잡으면 **처리 중인 요청이 잘려 클라이언트가 500번대 오류를 받는다** — 문서가 명시하듯, draining 중인 타겟이 지연 시간이 끝나기 전에 연결을 끊으면 클라이언트는 500번대 응답을 받는다.

**적절한 값은 "가장 느린 정상 요청이 끝나는 시간"이다.** 이 서비스는 관리 API라 요청이 짧으므로 30초로 충분하다. 30초 넘게 걸리는 배치성 요청이 있는 서비스라면 그만큼 늘려야 한다.

### TLS 종료 — 인증서가 로드밸런서에 있는 이유

```yaml
  AlbListener:
    Properties:
      Protocol: HTTPS
      Port: 443
      SslPolicy: ELBSecurityPolicy-TLS13-1-2-2021-06
      Certificates:
        - CertificateArn: !Ref AcmCertificateArn
```

클라이언트↔ALB 구간은 HTTPS이고, ALB↔태스크 구간은 HTTP다(타겟그룹의 `Protocol: HTTP`). 이 구조를 **TLS 종료(TLS termination)**라 한다. 암호화가 ALB에서 끝나고, 그 안쪽은 평문이다.

왜 이렇게 하는가.

1. **인증서 관리가 한 곳으로 모인다.** 태스크마다 인증서를 넣으면 갱신할 때 전부 재배포해야 한다.
2. **애플리케이션이 TLS를 몰라도 된다.** 애플리케이션 코드에 인증서 경로·갱신 로직이 없다.
3. **암호화·복호화 CPU 비용을 ALB가 진다.**
4. **ALB가 HTTP 내용을 봐야 L7 라우팅을 할 수 있다.** 암호화된 채로 넘기면 경로 기반 분기가 불가능하다.

내부 구간이 평문인 것이 문제인가. VPC 안이고 보안 그룹으로 ALB만 접근 가능하므로 통상 허용된다. 규제 요건이 종단간 암호화를 요구하면 타겟그룹 프로토콜을 HTTPS로 올리는데, 그러면 태스크에 인증서가 필요해지고 위 네 가지 이점을 다시 잃는다.

**ACM(AWS Certificate Manager)**은 인증서를 발급·보관·자동 갱신한다. 이 템플릿은 `*.example.com` 와일드카드 인증서를 쓴다.

```yaml
  AcmCertificateArn:
    Default: arn:aws:acm:ap-northeast-2:111122223333:certificate/12345678-...
    Description: ACM certificate (*.example.com) for the HTTPS 443 listener.
```

**와일드카드는 한 레벨만 커버한다.** `*.example.com`은 `orders-dev.example.com`을 커버하지만 `admin.dev.example.com`(점이 하나 더)은 커버하지 않는다. 도메인 이름을 설계할 때 이 제약이 서브도메인 깊이를 결정한다.

ACM 인증서는 자동 갱신되지만 **조건이 있다**: DNS 검증(도메인의 DNS에 검증용 CNAME 레코드가 유지)이 성립해야 한다. 검증 레코드를 지우면 갱신이 조용히 실패하고, 인증서 만료일에 서비스 전체가 TLS 오류를 뱉는다. 그래서 만료 임박을 알람으로 감시할 값어치가 있다.

### ⭐ SslPolicy를 반드시 명시해야 하는 이유

`SslPolicy`는 "어떤 TLS 버전과 암호 스위트를 받아줄 것인가"를 정하는 이름표다. 그리고 여기에 **놓치기 쉬운 기본값 함정**이 있다.

**HTTPS 리스너에서 `SslPolicy`를 지정하지 않으면 기본 정책이 적용되는데, 그 기본값이 만든 방법에 따라 다르다.**

| 만든 방법 | 기본 `SslPolicy` |
|---|---|
| AWS 콘솔 | 최신 정책 (TLS 1.3 포함) |
| **CloudFormation·CLI·CDK** | **`ELBSecurityPolicy-2016-08`** |

`ELBSecurityPolicy-2016-08`은 이름 그대로 2016년 정책이고, **TLS 1.0과 TLS 1.1을 허용한다.** 콘솔에서 만들 때는 최신 정책이 붙으니 문제를 인지하지 못하는데, CloudFormation으로 만들면 조용히 구식 정책이 붙는다. 보안 점검에서 "TLS 1.0 허용"으로 지적받고 나서야 발견되는 종류의 문제다.

그래서 이 템플릿은 명시했다.

```yaml
      SslPolicy: ELBSecurityPolicy-TLS13-1-2-2021-06
```

이름을 해석하면 정책의 내용이 나온다.

```
ELBSecurityPolicy-TLS13-1-2-2021-06
                  └┬─┘ └┬┘ └──┬──┘
                   │    │     └─ 정책 발표 시점 (2021년 6월)
                   │    └─────── 최소 TLS 버전 = 1.2
                   └──────────── TLS 1.3 지원
```

즉 **TLS 1.3과 1.2만 허용하고 1.1·1.0은 거부한다.** 이 정책은 TLS 1.3 계열 중 가장 널리 쓰이는 선택이다 — TLS 1.3만 허용하는 정책(`TLS13-1-3-2021-06`)은 더 안전하지만 TLS 1.2만 지원하는 오래된 클라이언트를 끊는다.

**`SslPolicy`는 명시하는 편이 항상 낫다.** 기본값에 의존하면 (1) 만든 방법에 따라 결과가 달라지고, (2) 나중에 AWS가 기본값을 바꾸면 예고 없이 동작이 바뀐다.

### 리스너의 기본 행동

```yaml
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref TargetGroup
```

리스너는 규칙(rule) 목록을 가지며, 어느 규칙에도 안 맞는 요청은 `DefaultActions`로 처리한다. 이 템플릿에는 규칙이 없으므로 **모든 요청이 하나의 타겟그룹으로 간다.**

나중에 경로별로 나눌 수 있다 — `/admin/*`은 이 타겟그룹, `/api/*`은 다른 타겟그룹처럼. 이때 알아둘 제약이 하나 있다: **한 타겟그룹은 한 로드밸런서에만 연결된다.** 그래서 [01](01-iac-and-cloudformation.md)에서 본 ALB 교체 상황에서, 같은 타겟그룹이 새 ALB와 옛 ALB에 동시에 연결되려 하며 실패하는 함정이 생긴다.

HTTP(80) 리스너는 없다. 평문 접근을 아예 받지 않는다는 뜻이다. 80을 443으로 리다이렉트하는 구성도 흔하지만, 이 서비스는 브라우저로 직접 접근하는 대상이 아니라 리다이렉트의 편의가 필요하지 않다.

### WAF 연결 — 조건부 보안 계층

```yaml
  WafAssociation:
    Type: AWS::WAFv2::WebACLAssociation
    Condition: HasWaf
    Properties:
      ResourceArn: !Ref Alb
      WebACLArn: !Ref WafWebAclArn
```

**WAF(Web Application Firewall)**는 SQL 인젝션·XSS 같은 애플리케이션 계층 공격 패턴을 요청 내용에서 찾아 차단한다. 보안 그룹이 "누가 접속할 수 있나"(IP·포트)를 보는 반면, WAF는 "요청 내용이 공격인가"를 본다. **다른 층을 보므로 둘은 대체 관계가 아니다.**

DEV에서는 `WafWebAclArn`이 빈 문자열이라 이 리소스가 생기지 않는다. WAF는 처리 요청 수에 따라 과금되고, DEV는 접근이 두 IP로 제한돼 있어 얻는 것이 적기 때문이다. **PROD에서 ARN을 넘기면 그때 붙는다** — [01](01-iac-and-cloudformation.md)의 조건이 이런 환경별 차이를 표현하는 자리다.

---

## 필수 지식 (HOW)

### 요청이 컨테이너에 도달하는 전체 경로

지금까지의 층을 하나로 이으면 이렇다.

```
1. 클라이언트가 DNS로 ALB 이름을 조회 → public 서브넷의 ALB 노드 공인 IP
2. 443/HTTPS로 접속
   ├─ ALB 보안 그룹 인그레스 확인: 출발지 IP가 사무실/VPN/내부 SG인가?  ← 아니면 여기서 끊김
   └─ TLS 핸드셰이크: SslPolicy가 허용하는 버전인가? 인증서가 도메인과 맞나?
3. ALB가 리스너 규칙 평가 → DefaultActions → 타겟그룹
4. 타겟그룹에서 healthy 타겟 하나 선택 (기본 라운드 로빈)
5. 태스크 사설 IP:8080으로 HTTP 요청 (평문)
   └─ Service 보안 그룹 인그레스 확인: 출발지가 ALB 보안 그룹인가?      ← 아니면 여기서 끊김
6. 컨테이너가 응답 → ALB가 TLS로 감싸 클라이언트에게 반환
```

**"접속이 안 된다"를 진단할 때 이 여섯 단계를 순서대로 확인한다.** 어느 단계에서 끊기는지에 따라 증상이 다르다.

| 증상 | 끊긴 지점 |
|---|---|
| 연결 타임아웃 | 2단계 — ALB 보안 그룹에 내 IP가 없다 |
| TLS 오류 / 인증서 경고 | 2단계 — 도메인이 인증서와 안 맞거나 클라이언트 TLS 버전이 낮다 |
| **503 Service Unavailable** | 4단계 — **healthy 타겟이 하나도 없다** |
| 504 Gateway Timeout | 5~6단계 — 태스크가 응답하지 않는다 (또는 응답이 너무 느리다) |
| 502 Bad Gateway | 5~6단계 — 태스크가 유효하지 않은 응답을 보냈다 |

**503은 특히 알아둘 값어치가 있다.** ALB가 정상 동작하면서 "보낼 곳이 없다"고 말하는 것이므로, 원인은 항상 타겟 쪽이다 — 태스크가 안 떴거나, 헬스체크에 실패하거나, Service 보안 그룹이 ALB를 막고 있다.

### 이 템플릿의 ALB 관련 리소스

| 리소스 | 핵심 속성 | 왜 그 값인가 |
|---|---|---|
| `Alb` | `Scheme: internet-facing`, public 서브넷 2개, `Name` **미지정** | 외부 검증 필요 / 교체 시 이름 충돌 회피 |
| `TargetGroup` | `TargetType: ip`, `/health`, 30초×3, 등록해제 30초 | `awsvpc` 필연 / 90초 감지, 배포 지연 최소화 |
| `AlbListener` | HTTPS 443, TLS13-1-2 정책, ACM 와일드카드 | 평문 미허용, 기본값(구식 정책) 회피 |
| `WafAssociation` | `Condition: HasWaf` | DEV에서는 만들지 않음 |

`TargetGroup`에는 `Name`이 지정돼 있다(`orders-server-dev-tg`). 여기는 고정 이름을 줘도 되는가? 타겟그룹도 교체될 수 있으므로 위험은 있다. 다만 타겟그룹은 ALB보다 교체를 유발하는 속성이 적고(포트·프로토콜·VPC 변경), 알람 디멘션에서 이름으로 지목하는 편의가 있다. **일관성 있게 자동 명명으로 가는 것이 더 안전한 선택이지만, 현재 템플릿은 여기서 편의를 택했다** — 이런 비대칭은 실제 코드에서 흔하고, 알아두면 다음 변경에서 판단할 수 있다.

---

### ⚠️ 암기 필수

- [ ] **CloudFormation·CLI로 HTTPS 리스너를 만들 때 `SslPolicy` 기본값은 `ELBSecurityPolicy-2016-08`이며 TLS 1.0/1.1을 허용한다.** 항상 명시한다. (이유: 콘솔과 기본값이 달라서 조용히 구식 정책이 붙는다)
- [ ] **비정상 판정까지 걸리는 시간 = `HealthCheckIntervalSeconds` × `UnhealthyThresholdCount`.** 30×3 = 최대 90초. (이유: "장애 후 몇 초 동안 요청이 죽은 태스크로 가는가"를 즉답해야 한다)
- [ ] **등록 해제 지연 기본값은 300초다.** 줄이지 않으면 배포가 느려지고, 너무 줄이면 처리 중 요청이 잘려 500번대 오류가 난다. (이유: 기본값을 모르면 배포가 느린 원인을 못 찾는다)
- [ ] **ALB의 503은 healthy 타겟이 없다는 뜻이다.** 원인은 항상 타겟 쪽(태스크 미기동·헬스체크 실패·보안 그룹 차단). (이유: 장애 중 가장 빠른 분기점)
- [ ] **`wget --spider`는 HEAD 요청이라 GET 전용 라우트에서 401/404가 되어 unhealthy 오판을 부른다.** `-O /dev/null`로 GET을 쓴다. (이유: 브라우저로는 200이 나와서 원인을 찾기 어렵다)
- [ ] **와일드카드 인증서 `*.example.com`은 한 레벨만 커버한다.** `a.b.example.com`은 커버하지 않는다. (이유: 도메인 설계 시점에 결정되고 나중에 바꾸기 비싸다)
- [ ] **한 타겟그룹은 한 로드밸런서에만 연결된다.** (이유: ALB 교체 시 신·구 ALB에 같은 타겟그룹이 붙으려다 실패하는 함정의 근거)
- [ ] **Fargate + `awsvpc`에서 타겟 타입은 `ip`다.** `instance`는 쓸 수 없다. (이유: 볼 수 있는 인스턴스가 없다)

---

## 우리 프로젝트와의 연결

- `internet-facing` ALB를 public 서브넷 2개에 두고, 접근은 보안 그룹으로 사무실·VPN IP만 허용
- 타겟그룹 헬스체크 `/health` 30초×3 → 장애 감지 최대 90초, 복귀 최대 60초
- 등록 해제 지연을 기본 300초에서 **30초로 축소** — 관리 API라 긴 요청이 없음
- 컨테이너 헬스체크가 `wget -q -O /dev/null`(GET)로 작성됨 — `--spider`(HEAD)가 401을 부른 전례 반영
- `SslPolicy`를 `ELBSecurityPolicy-TLS13-1-2-2021-06`으로 **명시** — CloudFormation 기본값(2016-08)이 TLS 1.0/1.1을 허용하므로
- HTTP(80) 리스너 없음 — 평문 접근 미허용
- ALB에 `Name` 미지정, 타겟그룹에는 `Name` 지정 (비대칭 — ALB 쪽이 교체 위험이 크다)
- WAF는 `HasWaf` 조건부로 DEV에서 미생성

---

## 자가 진단

1. 로드밸런서·리스너·타겟그룹이 왜 세 리소스로 나뉘어 있는가?
2. `HealthCheckIntervalSeconds: 10`, `UnhealthyThresholdCount: 2`면 장애 감지에 몇 초가 걸리는가? 30×3에 비해 무엇을 얻고 무엇을 잃는가?
3. `SslPolicy`를 지우고 CloudFormation으로 배포하면 어떤 TLS 버전이 허용되는가?
4. ALB가 503을 반환한다. 확인할 세 가지는?
5. 브라우저로 `/health`를 열면 200인데 컨테이너 헬스체크는 실패한다. 왜?
6. 등록 해제 지연을 0으로 두면 무슨 일이 일어나는가?
7. `*.example.com` 인증서로 `admin.dev.example.com`에 접속하면?

## 공식 문서

- [타겟그룹 속성 편집](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-target-group-attributes.html) — 등록 해제 지연 기본 300초와 draining 동작
- [ALB 보안 정책](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html) — 정책별 TLS 버전 지원 표와 생성 방법별 기본값
- [타겟그룹 헬스체크](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html) — 임계값과 상태 전이
- [ALB 문제 해결](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html) — 502·503·504 원인별 정리

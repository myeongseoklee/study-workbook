# 04. ECS와 Fargate — 컨테이너를 대신 돌려주는 서비스, 그리고 무중단 교체의 산수

## 학습 목표

이 문서를 다 읽으면 (1) 클러스터·서비스·태스크 정의의 역할 분담을 설명할 수 있고, (2) **`MinimumHealthyPercent`와 `MaximumPercent`로 배포 중 태스크 수 범위를 계산**할 수 있고, (3) 서킷 브레이커의 실패 임계값을 계산할 수 있고, (4) Fargate Spot을 쓸 수 있는 조건과 대가를 판단할 수 있다.

## 선수 지식

[02](02-network-vpc-sg.md)의 `awsvpc` 모드와 보안 그룹, [03](03-alb-and-target-group.md)의 타겟그룹과 헬스체크. 컨테이너 이미지라는 개념(Dockerfile을 빌드하면 이미지가 되고, 이미지를 실행하면 컨테이너가 된다).

---

## 핵심 원리 (WHY)

### 컨테이너를 직접 돌리면 생기는 일

서버 한 대에 SSH로 들어가 `docker run`을 하면 컨테이너가 돈다. 문제는 그다음이다.

- 컨테이너가 죽으면? 누군가 알아채고 다시 띄워야 한다
- 서버가 죽으면? 다른 서버에 옮겨야 한다
- 새 버전을 배포하려면? 옛것을 멈추고 새것을 띄우는 동안 서비스가 끊긴다
- 트래픽이 늘면? 서버를 늘리고 로드밸런서에 등록해야 한다

**컨테이너 오케스트레이터**는 이 운영 노동을 "원하는 상태를 선언하면 유지해준다"로 바꾼다. [01](01-iac-and-cloudformation.md)에서 본 선언형 발상이 런타임으로 내려온 것이다. "태스크 2개가 항상 돌고 있어야 한다"고 선언하면, 하나가 죽든 서버가 죽든 오케스트레이터가 2개를 맞춘다.

AWS에는 두 선택지가 있다.

| | ECS | EKS |
|---|---|---|
| 정체 | AWS 자체 오케스트레이터 | 관리형 Kubernetes |
| 학습 곡선 | 낮음 (AWS 개념만) | 높음 (쿠버네티스 생태계) |
| 이식성 | AWS 종속 | 다른 클라우드로 옮길 수 있음 |
| 제어판 비용 | 무료 | 클러스터당 시간당 요금 |

**ECS를 고른 이유는 서비스 몇 개를 AWS에서만 돌리는 데 쿠버네티스의 복잡도가 필요하지 않기 때문이다.** 쿠버네티스는 팀에 전담 인력이 있고 여러 클라우드·온프레미스를 아울러야 할 때 값을 한다.

### Fargate — 서버가 어디 있는지 모르는 상태

ECS로 컨테이너를 돌릴 방법은 두 가지다.

| | EC2 시작 유형 | **Fargate** |
|---|---|---|
| 컨테이너가 도는 곳 | 내가 만든 EC2 인스턴스 | AWS가 관리하는 보이지 않는 기반 |
| 내가 하는 일 | 인스턴스 개수·타입·AMI 패치·스케일링 관리 | 태스크의 CPU/메모리만 지정 |
| 과금 | 인스턴스 시간 (놀아도 과금) | 태스크가 쓴 vCPU·메모리 시간 |
| 유리한 상황 | 인스턴스를 빈틈없이 채울 수 있을 때, GPU·특수 커널 필요 | 태스크 수가 적거나 변동이 큰 경우, 운영 인력이 적은 경우 |

**Fargate에서는 SSH로 들어갈 서버가 없다.** 이것이 이 문서 여러 곳의 근거다 — 타겟 타입이 `ip`인 이유([03](03-alb-and-target-group.md)), 컨테이너 안을 들여다보려면 ECS Exec라는 별도 장치가 필요한 이유가 모두 여기서 나온다.

Fargate의 대가는 **단가가 비싸다는 점**이다. 같은 vCPU·메모리를 EC2로 사는 것보다 시간당 단가가 높다. 대신 노는 용량이 없고 인스턴스 관리 노동이 없다. 태스크 하나를 24시간 돌리는 DEV 환경에서는 관리 노동 절감이 단가 차이를 이긴다.

### 세 층 — 클러스터, 태스크 정의, 서비스

ECS의 구조는 처음에 헷갈리는데, **각 층이 답하는 질문이 다르다**고 보면 정리된다.

```
[Cluster]         "어느 논리적 묶음에 속하는가"
    │
[Task Definition] "무엇을 어떻게 실행하는가"  ← 청사진. 실행되지 않는다
    │
[Service]         "그것을 몇 개, 어디에, 어떻게 유지하는가"
    │
 (Tasks)          실제로 도는 컨테이너들
```

**클러스터**는 그룹 이름에 가깝다. Fargate에서는 클러스터에 서버가 없으므로 실체가 거의 없고, 접근 제어·지표 집계·논리적 구분의 단위로만 쓰인다.

```yaml
  Cluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub admin-${Env}
      ClusterSettings:
        - Name: containerInsights
          Value: enabled
```

`containerInsights: enabled`는 CloudWatch에 태스크 단위 지표(CPU·메모리 사용률, 실행 중 태스크 수)를 보내게 한다. **추가 비용이 있지만 이게 없으면 "태스크가 몇 개 돌고 있나"를 지표로 알 수 없다** — 뒤에서 볼 알람 하나가 이 지표에 의존한다.

**태스크 정의**는 청사진이다. 컨테이너 이미지, CPU, 메모리, 환경변수, 로그 설정, 헬스체크를 담지만 **그 자체로는 아무것도 실행하지 않는다.**

여기서 중요한 성질: **태스크 정의는 리비전 단위로 불변(immutable)이다.** 태스크 정의를 "수정"하면 실제로는 새 리비전이 만들어진다.

```
orders-server-dev:1   ← 옛 이미지
orders-server-dev:2   ← 새 이미지. :1은 그대로 남아 있다
```

이 불변성이 롤백을 가능하게 한다. `:2`가 문제면 서비스가 다시 `:1`을 쓰도록 하면 되고, `:1`의 정의는 그대로 보존돼 있다. **가변 리소스라면 롤백할 대상이 사라진다.**

**서비스**는 "이 태스크 정의를 몇 개 유지하라"를 맡는다. 스케줄러가 계속 감시하며 실제 개수가 원하는 개수와 다르면 맞춘다.

### ⭐ Fargate의 CPU와 메모리는 정해진 조합만 가능하다

```yaml
      Cpu: !Ref TaskCpu       # "512"
      Memory: !Ref TaskMemory # "1024"
```

여기서 `Cpu: 512`는 코어 수가 아니라 **CPU 유닛**이며, 1024 유닛 = 1 vCPU다. 그래서 512는 0.5 vCPU다.

**임의의 조합이 되지 않는다.** CPU 값마다 허용되는 메모리 값이 정해져 있다(Linux 기준).

| CPU | 허용 메모리 |
|---|---|
| 256 (.25 vCPU) | 512 MiB, 1 GB, 2 GB |
| **512 (.5 vCPU)** | **1 GB, 2 GB, 3 GB, 4 GB** |
| 1024 (1 vCPU) | 2 GB ~ 8 GB (1 GB 단위) |
| 2048 (2 vCPU) | 4 GB ~ 16 GB (1 GB 단위) |
| 4096 (4 vCPU) | 8 GB ~ 30 GB (1 GB 단위) |
| 8192 (8 vCPU) | 16 GB ~ 60 GB (4 GB 단위) |
| 16384 (16 vCPU) | 32 GB ~ 120 GB (8 GB 단위) |

이 템플릿의 512 / 1024는 유효한 최소 조합이다. **`Cpu: 512` / `Memory: 512`는 유효하지 않다** — 0.5 vCPU에서 메모리 하한이 1 GB다. 이 조합을 쓰면 태스크 정의 등록 자체가 실패한다.

`TaskCpu`에는 `AllowedValues`가 걸려 있지만 `TaskMemory`에는 없다. 그래서 잘못된 조합이 CloudFormation 검증을 통과해 **AWS API 호출 단계에서 실패한다.** 실패 지점이 늦어질 뿐 결과는 같지만, 이 비대칭을 알아두면 배포 실패 메시지를 빨리 해석할 수 있다.

```yaml
      RuntimePlatform:
        OperatingSystemFamily: LINUX
        CpuArchitecture: X86_64
```

**아키텍처 명시가 중요하다.** Apple Silicon 맥에서 `docker build`를 하면 기본으로 arm64 이미지가 나온다. 그 이미지를 X86_64 태스크로 실행하면 컨테이너가 기동하지 못한다. 로컬에서 빌드해 푸시할 때는 `--platform linux/amd64`가 필요하고, 이 실패는 "exec format error"로 나타나 원인이 잘 드러나지 않는다.

### 컨테이너 정의 읽기

```yaml
      ContainerDefinitions:
        - Name: orders-server
          Image: !Sub ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/orders-server:${ImageTag}
          Essential: true
          PortMappings:
            - ContainerPort: !Ref ContainerPort
              Protocol: tcp
```

`Essential: true`는 **"이 컨테이너가 멈추면 태스크 전체를 멈춰라"**는 뜻이다. 한 태스크에 여러 컨테이너를 넣을 때(예: 앱 + 로그 수집 사이드카) 어느 것이 본체인지 구분하는 장치다. 컨테이너가 하나면 항상 `true`여야 한다 — `false`로 두면 앱이 죽어도 태스크가 살아 있는 것으로 취급돼 ECS가 교체하지 않는다.

환경변수는 두 방식으로 들어간다.

```yaml
          Environment:                          # 평문. 태스크 정의에 값이 그대로 남는다
            - Name: NODE_ENV
              Value: production
            - Name: ACCOUNT_DB_PASSWORD
              Value: !Ref AccountDbPassword     # ← 평문으로 남는다
          Secrets:                              # 참조. 태스크 정의에는 ARN만 남는다
            - Name: GRAPH_REFRESH_TOKEN
              ValueFrom: !Ref GraphRefreshTokenSecret
```

두 방식의 차이와 이 템플릿이 왜 둘을 섞어 쓰는지는 [06 시크릿](06-secrets.md)에서 다룬다. 여기서 알아둘 것은 **`Secrets`로 넣은 값은 컨테이너 안에서 보통 환경변수와 똑같이 보인다**는 점이다. 애플리케이션 코드는 차이를 모른다.

```yaml
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref LogGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: ecs
              mode: blocking
```

`awslogs` 드라이버는 컨테이너의 표준 출력을 CloudWatch Logs로 보낸다. `mode`의 선택이 트레이드오프를 담는다.

| `mode` | 로그 버퍼가 찼을 때 | 대가 |
|---|---|---|
| `blocking` | 애플리케이션을 **멈춘다** (쓰기가 블록됨) | 로그 폭주 시 애플리케이션 성능 저하 |
| `non-blocking` | 로그를 **버린다** | 장애 순간의 로그가 사라질 수 있다 |

`blocking`을 고른 이유는 **DEV에서는 로그 유실이 성능 저하보다 비싸기 때문이다.** 디버깅 중인 환경에서 "그 순간의 로그가 없다"는 것은 조사 자체를 불가능하게 만든다. 트래픽이 많은 운영 환경에서는 반대 판단이 정당할 수 있다.

### ⭐ 용량 공급자 — Fargate Spot을 쓰는 조건

```yaml
  Cluster:
    Properties:
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE_SPOT
          Weight: 1
          Base: 0
```

**Fargate Spot**은 AWS의 남는 용량으로 태스크를 돌리고 **최대 70% 할인**을 준다. 대가는 명확하다: **AWS가 용량을 회수하면 태스크가 중단된다.**

중단은 이렇게 진행된다.

1. AWS가 회수를 결정 → **2분 경고**
2. 경고가 두 경로로 온다: EventBridge에 태스크 상태 변경 이벤트 + 컨테이너에 **SIGTERM**
3. `stopTimeout` 시간이 지나면 SIGKILL로 강제 종료 (기본 30초, 최대 120초)

즉 **애플리케이션이 SIGTERM을 처리해야 한다.** 무시하면 30초 뒤 강제 종료되고, 처리 중이던 요청이 잘리거나 쓰던 데이터가 깨진다. 우아한 종료(graceful shutdown)는 이런 순서다: 새 요청 수신 중단 → 처리 중 요청 완료 대기 → 연결 정리 → 종료.

`Weight`와 `Base`는 용량을 어떻게 섞을지 정한다.

- **`Base`** — 이 공급자로 **먼저 확보할 최소 태스크 수**. 하나의 공급자만 가질 수 있다
- **`Weight`** — Base를 채운 뒤 남은 태스크를 나눌 **비율**

예시로 감을 잡으면:

| 전략 | DesiredCount 10일 때 |
|---|---|
| `SPOT: Weight 1, Base 0` | Spot 10개 (이 템플릿) |
| `FARGATE: Base 2, Weight 1` + `SPOT: Weight 3` | 일반 2개 확보 후 남은 8개를 1:3 → 일반 2+2=4, Spot 6 |
| `FARGATE: Weight 1` + `SPOT: Weight 0` | 일반 10개 (Weight 0은 배치에 쓰이지 않음) |

이 템플릿은 **Spot 100%**다. `DesiredCount: 1`이므로 Spot이 회수되면 **서비스가 완전히 멈춘다.** 문서가 명시하듯 태스크 하나짜리 서비스는 용량이 다시 생길 때까지 중단되며, **Fargate는 Spot을 일반 용량으로 자동 대체하지 않는다.**

이것이 정당한가. DEV 환경이므로 그렇다 — 몇 분 중단이 허용되고 비용 절감이 크다. **운영 환경이라면 잘못된 선택이다.** 운영에서는 최소 개수를 일반 Fargate로 확보(`Base`)하고 초과분만 Spot으로 돌린다.

### ⭐ 롤링 배포의 산수 — 두 퍼센트가 결정하는 것

```yaml
      DeploymentConfiguration:
        MinimumHealthyPercent: 100
        MaximumPercent: 200
```

새 버전을 배포할 때 ECS는 옛 태스크를 새 태스크로 하나씩 갈아치운다. 그 과정에서 태스크 수가 어디까지 내려가고 어디까지 올라갈 수 있는지를 이 두 값이 정한다.

```
최소 유지 태스크 = ceil(DesiredCount × MinimumHealthyPercent / 100)   ← 올림
최대 허용 태스크 = floor(DesiredCount × MaximumPercent / 100)         ← 내림
```

올림과 내림 방향이 다른 것은 의도된 설계다. **최소는 올려서 가용성을 지키고, 최대는 내려서 비용 한도를 지킨다.**

이 템플릿의 값(100/200, `DesiredCount: 1`)을 넣어 보면:

```
최소 유지 = ceil(1 × 100/100) = 1   → 항상 1개는 살아 있어야 한다
최대 허용 = floor(1 × 200/100) = 2  → 최대 2개까지 띄울 수 있다
```

그래서 배포가 이렇게 진행된다.

```
시작:  [옛1]                     1개
1단계: [옛1] [새1(기동중)]        2개 ← 최대 2를 쓴다
2단계: [옛1] [새1(healthy)]      2개 ← 새것이 건강해지길 기다린다
3단계:       [새1]                1개 ← 이제 옛것을 내린다
```

**새것이 건강해진 뒤에 옛것을 내리므로 서비스가 끊기지 않는다.** 이것이 100/200 조합의 의미다.

기본값도 마침 100/200이다(레플리카 서비스 기준). 그러니 이 두 줄은 동작을 바꾸지 않고 **의도를 명시**한다 — 나중에 누군가 값을 만질 때 "여기는 무중단을 의도한 자리"임을 알 수 있다.

값을 바꾸면 어떻게 되는지 보면 원리가 굳는다.

| 설정 | `DesiredCount: 1` | `DesiredCount: 4` |
|---|---|---|
| 100 / 200 | 최소 1, 최대 2 → **무중단** | 최소 4, 최대 8 → 무중단 |
| 100 / 100 | 최소 1, 최대 1 → **교착!** 내릴 수도 띄울 수도 없다 | 최소 4, 최대 4 → 교착 |
| 50 / 100 | 최소 1(올림), 최대 1 → **교착** | 최소 2, 최대 4 → 2개씩 교체, 여유 용량 불필요 |
| 0 / 100 | 최소 0, 최대 1 → **중단 발생**(옛것 내리고 새것 띄움) | 최소 0, 최대 4 → 전체 중단 |

**100/100 조합의 교착이 실제로 나오는 실수다.** 스케줄러가 태스크를 하나도 멈출 수 없고 하나도 시작할 수 없어 배포가 진행되지 않으며, ECS가 "서비스 배포 설정 때문에 태스크를 멈추거나 시작할 수 없다"는 이벤트 메시지를 보낸다. `DesiredCount: 1`에서는 50/100도 같은 결과다 — 올림 때문에 최소가 1이 되기 때문이다.

**`DesiredCount: 1`에서 무중단을 원하면 `MaximumPercent`는 반드시 200이어야 한다.** 태스크 하나를 유지하면서 새것을 띄울 자리가 필요하기 때문이다.

### ⭐ 서킷 브레이커 — 실패한 배포를 자동으로 되돌린다

```yaml
        DeploymentCircuitBreaker:
          Enable: true
          Rollback: true
```

새 태스크가 계속 기동에 실패하면 어떻게 되는가. 서킷 브레이커가 없다면 ECS는 **무한히 재시도한다.** 배포가 끝나지 않고, 파이프라인이 타임아웃까지 기다리며, 그동안 실패한 태스크가 계속 만들어진다.

서킷 브레이커는 실패 횟수를 세다가 임계값에 닿으면 배포를 `FAILED`로 만든다. `Rollback: true`면 **마지막으로 `COMPLETED` 상태였던 배포로 되돌린다.**

**실패 임계값 계산**이 알아둘 값어치가 있다. 기본 방식은 `BOUNDED_PERCENT`, 기본 비율은 50%다.

```
임계값 = clamp(0.5 × DesiredCount, 최소 3, 최대 200)
```

`clamp`는 계산값을 최소·최대 사이로 가둔다는 뜻이다. 예시:

| DesiredCount | 계산 | 임계값 |
|---|---|---|
| **1** | 0.5 × 1 = 0.5 | **3** (최소값에 걸림) |
| 25 | 0.5 × 25 = 12.5 | 13 (올림) |
| 400 | 0.5 × 400 = 200 | 200 (최대값에 걸림) |

이 템플릿은 `DesiredCount: 1`이라 **임계값이 3이다.** 즉 태스크 기동이 3번 실패하면 배포가 실패로 판정된다.

판정은 두 단계로 이뤄진다.

1. **1단계** — 태스크가 `RUNNING`에 도달하는지 본다. 도달하지 못하면 실패 카운트 +1
2. **2단계** — `RUNNING`인 태스크가 하나라도 있으면 이 단계로 넘어와, 헬스체크(ALB 타겟 헬스체크·컨테이너 헬스체크·Cloud Map)를 본다. 실패하면 카운트 +1

기본 동작(`resetOnHealthyTask: true`)에서는 **건강한 태스크가 하나 뜨면 카운트가 0으로 초기화된다.** 그래서 "간헐적으로 실패하다 결국 뜨는" 애플리케이션이 배포에 성공할 수 있다.

**⭐ 첫 배포에는 되돌릴 곳이 없다.** 서킷 브레이커가 롤백 대상으로 찾는 것은 `COMPLETED` 상태의 배포인데, 스택을 처음 만들 때는 그런 배포가 존재하지 않는다. 그러면 롤백이 일어나지 않고 **배포가 그대로 멈춘다.**

이 상황이 더 나빠지는 조합이 있다. 첫 생성에서 CloudFormation 스택 전체가 롤백되면 **로그 그룹까지 삭제된다.** 실패 원인이 컨테이너 로그에 있는데 그 로그가 사라지는 것이다. 그래서 첫 배포는 `DesiredCount: 0`으로 인프라만 세운 뒤 `1`로 올리는 두 단계로 나누는 것이 안전하다 — 그러면 태스크 기동 실패가 스택 롤백을 유발하지 않고, 로그를 읽으며 원인을 찾을 수 있다.

### 유예 기간 — 기동 중인 태스크를 죽이지 않기 위해

```yaml
      HealthCheckGracePeriodSeconds: 60
```

애플리케이션이 뜨는 데 시간이 걸린다. Node.js 서버라면 프로세스 시작, 의존성 로드, DB 커넥션 풀 준비까지 수십 초가 갈 수 있다. 그동안 ALB 헬스체크는 실패한다 — 아직 준비가 안 됐으니까.

**유예 기간은 태스크가 시작된 뒤 이 시간 동안은 헬스체크 실패를 무시하게 한다.** 없으면 부팅 중인 태스크가 unhealthy로 판정돼 교체되고, 새 태스크도 같은 이유로 교체되어 **영원히 기동하지 못하는 순환**에 빠진다.

컨테이너 헬스체크에도 같은 목적의 값이 있다.

```yaml
          HealthCheck:
            Interval: 30
            Timeout: 5
            Retries: 3
            StartPeriod: 30    # ← 컨테이너 쪽 유예 기간
```

`StartPeriod` 동안의 실패는 `Retries` 카운트에 들어가지 않는다. 두 값(60초 / 30초)이 다른 이유는 대상이 다르기 때문이다 — ALB는 네트워크를 거쳐 확인하므로 더 여유를 준다.

**두 유예 기간을 지나치게 늘리면 반대 문제가 생긴다.** 진짜로 기동 못 하는 태스크를 오래 살려 두므로 배포 실패 판정이 늦어진다.

### ECS Exec — 서버 없는 환경에서 컨테이너 안을 보는 법

```yaml
      EnableExecuteCommand: true
```

Fargate에는 SSH로 들어갈 서버가 없다. 그런데 "컨테이너 안에서 DB 포트로 연결이 되는지" 같은 확인은 안에서만 할 수 있다.

**ECS Exec**는 AWS Systems Manager Session Manager를 통해 컨테이너 안에서 명령을 실행하게 해준다. 필요한 SSM 에이전트 바이너리를 ECS가 컨테이너에 마운트해 주므로, 이미지에 아무것도 넣지 않아도 된다.

```bash
aws ecs execute-command \
  --cluster orders-dev --task <task-id> \
  --container orders-server --interactive --command "/bin/sh"
```

동작하려면 **태스크 롤**에 SSM 채널 권한이 있어야 한다.

```yaml
  TaskRole:
    Properties:
      Policies:
        - PolicyName: EcsExecSsmMessages
          PolicyDocument:
            Statement:
              - Effect: Allow
                Action:
                  - ssmmessages:CreateControlChannel
                  - ssmmessages:CreateDataChannel
                  - ssmmessages:OpenControlChannel
                  - ssmmessages:OpenDataChannel
                Resource: "*"
```

**왜 태스크 롤이고 실행 롤이 아닌가.** 이 채널은 컨테이너가 **자기 안에서** 여는 것이고, 컨테이너 안에서 쓰는 권한은 태스크 롤이다. 실행 롤은 컨테이너를 띄우기 전에 ECS 에이전트가 쓰는 권한이다. 이 구분은 [05 IAM](05-iam-roles.md)의 핵심이다.

주의할 제약 둘.

- **`readonlyRootFilesystem`을 켜면 ECS Exec가 동작하지 않는다.** SSM 에이전트가 컨테이너 파일 시스템에 디렉토리와 파일을 만들어야 한다
- **실행 중인 태스크에는 나중에 켤 수 없다.** `EnableExecuteCommand`를 바꾸면 새 배포가 필요하다 — 장애 대응 중에 켜려 하면 태스크가 교체되어 조사 대상이 사라진다

### 나머지 속성

```yaml
      PlatformVersion: LATEST
```

Fargate 플랫폼 버전은 컨테이너를 돌리는 기반의 버전이다. `LATEST`는 최신을 쓰라는 뜻이고, 특정 버전(`1.4.0`)으로 고정할 수도 있다. **`LATEST`는 AWS가 플랫폼을 올릴 때 함께 올라간다** — 새 배포 시점에 적용되므로 예고 없이 도는 태스크가 바뀌지는 않지만, 다음 배포에서 기반이 달라질 수 있다.

```yaml
      LoadBalancers:
        - ContainerName: orders-server
          ContainerPort: !Ref ContainerPort
          TargetGroupArn: !Ref TargetGroup
```

여기가 서비스와 타겟그룹을 잇는 자리다. ECS가 태스크를 띄우면 그 IP를 타겟그룹에 등록하고, 태스크를 내릴 때 해제한다. **`ContainerName`이 태스크 정의의 컨테이너 이름과 정확히 같아야 한다** — 다르면 배포가 실패하며, 오타로 인한 실패가 흔하다.

---

## 필수 지식 (HOW)

### 배포 한 번의 전체 흐름

`--force-new-deployment`나 새 태스크 정의로 서비스를 갱신했을 때 일어나는 일:

```
1. ECS가 새 태스크 정의로 태스크를 띄운다 (MaximumPercent 한도 안에서)
2. 태스크가 PENDING → 이미지 pull → 컨테이너 시작
   └─ 실행 롤이 ECR에서 이미지를, Secrets Manager에서 시크릿 값을 가져온다
3. 태스크가 RUNNING → 유예 기간(60초) 시작
4. 컨테이너 헬스체크 시작 (StartPeriod 30초 후부터 카운트)
5. ECS가 태스크 IP를 타겟그룹에 등록 → ALB 헬스체크 시작
6. 두 헬스체크 통과 → 태스크가 "healthy"로 집계 (MinimumHealthyPercent 판정에 들어감)
7. 옛 태스크를 draining으로 → 등록 해제 지연(30초) 대기 → 종료
8. 모든 태스크가 새 정의로 교체되면 배포 COMPLETED

실패 경로: 2~6에서 실패 카운트가 3에 닿으면 → 배포 FAILED → 마지막 COMPLETED로 롤백
```

**6번이 병목이다.** 태스크가 `RUNNING`인데 healthy로 집계되지 않는 상태가 오래 가면 배포가 진행되지 않는다. 이때 확인할 것: ALB 타겟 헬스 상태, 컨테이너 헬스체크 명령의 정확성, Service 보안 그룹이 ALB를 허용하는지.

### 증상별 원인 표

| 증상 | 흔한 원인 | 확인 |
|---|---|---|
| 태스크가 `PENDING`에서 `STOPPED`, `CannotPullContainerError` | private 서브넷에 NAT/엔드포인트 경로 없음, 이미지 태그 오타, ECR 권한 없음 | 라우팅 테이블, 실행 롤 |
| 태스크가 `STOPPED`, `ResourceInitializationError`(시크릿) | 실행 롤에 `secretsmanager:GetSecretValue` 없음, 시크릿에 버전 없음 | [06](06-secrets.md) |
| 컨테이너가 즉시 종료, `exec format error` | arm64 이미지를 X86_64 태스크로 실행 | `--platform linux/amd64`로 재빌드 |
| 태스크가 반복 교체 (기동 → unhealthy → 교체) | 유예 기간 부족, DB 연결 실패, 헬스체크 명령이 HEAD | 컨테이너 로그, `StartPeriod`·유예 기간 |
| 배포가 진행되지 않고 이벤트에 "설정 때문에 시작·중단 불가" | `MaximumPercent`가 `DesiredCount`에 여유를 주지 않음(100/100) | `DeploymentConfiguration` |
| 배포가 3번 실패 후 멈춤, 롤백 안 됨 | 첫 배포라 `COMPLETED` 배포가 없음 | `DesiredCount: 0 → 1` 2단계 배포 |
| 태스크가 갑자기 사라짐, 중단 이유 `SpotInterruption` | Fargate Spot 회수 | 정상 동작. 운영이면 `Base`로 일반 용량 확보 |

---

### ⚠️ 암기 필수

- [ ] **Fargate CPU 512(.5 vCPU)의 허용 메모리는 1·2·3·4 GB뿐이다.** 512 MiB는 256 CPU에서만 가능. (이유: 조합을 틀리면 태스크 정의 등록 자체가 실패하고, `TaskMemory`에 `AllowedValues`가 없어 CloudFormation 검증을 통과해 버린다)
- [ ] **최소 유지 = `ceil(DesiredCount × MinimumHealthyPercent/100)`, 최대 허용 = `floor(DesiredCount × MaximumPercent/100)`.** 올림·내림 방향이 다르다. (이유: 배포 중 태스크 수를 즉시 계산해야 무중단 여부를 판단할 수 있다)
- [ ] **롤링 업데이트 기본값은 `MinimumHealthyPercent: 100`, `MaximumPercent: 200`이다.** (이유: 명시한 값이 기본값과 같은지 알면 그 두 줄이 동작 변경인지 의도 표명인지 구분된다)
- [ ] **`DesiredCount: 1`에서 `MaximumPercent: 100`이면 배포가 교착된다.** 무중단을 원하면 200이 필요하다. (이유: 실제로 자주 나는 실수이고, 증상이 "배포가 멈춤"이라 원인이 안 보인다)
- [ ] **서킷 브레이커 실패 임계값 = `clamp(0.5 × DesiredCount, 3, 200)`.** `DesiredCount: 1`이면 3이다. (이유: "몇 번 실패하면 포기하나"를 알아야 배포 실패 판정 시점을 예측한다)
- [ ] **첫 배포에는 `COMPLETED` 배포가 없어 롤백할 곳이 없고, 스택 롤백이 로그 그룹까지 지운다.** 첫 배포는 `DesiredCount: 0 → 1` 두 단계로. (이유: 실패 원인이 담긴 로그가 사라진다)
- [ ] **Fargate Spot은 최대 70% 할인, 회수 시 2분 경고 + SIGTERM, `stopTimeout` 기본 30초·최대 120초.** 태스크 1개면 회수 시 서비스가 멈추고 일반 용량으로 자동 대체되지 않는다. (이유: Spot을 운영에 쓸 수 있는 조건을 가르는 선)
- [ ] **태스크 정의 리비전은 불변이다.** 수정은 새 리비전 생성이며 옛 리비전이 롤백 대상으로 남는다. (이유: 롤백이 가능한 근거)
- [ ] **ECS Exec 권한(`ssmmessages:*`)은 태스크 롤에 있어야 하고, `readonlyRootFilesystem`과 함께 쓸 수 없으며, 도는 태스크에 나중에 켤 수 없다.** (이유: 장애 대응 중에 켜려 하면 조사 대상 태스크가 교체된다)

---

## 우리 프로젝트와의 연결

- 클러스터 `orders-dev`에 Container Insights 활성 — 뒤의 알람 하나가 이 지표에 의존
- 태스크 512 CPU / 1024 MB — 유효한 최소 조합. X86_64 명시
- `Essential: true`, 컨테이너 하나
- 로그 드라이버 `mode: blocking` — DEV에서 로그 유실보다 성능 저하를 택함
- **Fargate Spot 100%**(`Base: 0`) + `DesiredCount: 1` — 회수되면 서비스 중단. DEV에서만 정당
- 100/200 + 서킷 브레이커 + 롤백 — 무중단 배포, 3회 실패 시 자동 롤백
- 유예 기간 60초(ALB) / `StartPeriod` 30초(컨테이너)
- `EnableExecuteCommand: true` + 태스크 롤의 `ssmmessages` 4개 액션 — 서버 없는 환경의 진단 통로
- `PlatformVersion: LATEST`

---

## 자가 진단

1. 태스크 정의와 서비스의 차이는? 태스크 정의만 만들면 무엇이 도는가?
2. `Cpu: 512` / `Memory: 512`로 배포하면? 언제 실패하는가?
3. `DesiredCount: 4`, `MinimumHealthyPercent: 50`, `MaximumPercent: 100`이면 배포 중 태스크 수 범위는? 여유 용량이 필요한가?
4. `DesiredCount: 2`일 때 서킷 브레이커 임계값은?
5. 첫 배포가 실패했는데 롤백이 안 된다. 왜이고, 어떻게 예방하는가?
6. Fargate Spot을 쓰는 서비스에서 애플리케이션이 반드시 처리해야 하는 신호는? 처리하지 않으면?
7. 태스크가 뜨자마자 unhealthy로 교체되는 순환에 빠졌다. 어떤 값을 먼저 보는가?
8. ECS Exec 권한을 실행 롤에 넣으면 왜 동작하지 않는가?

## 실습

**과제 04-01 — 롤링 배포 범위·서킷 브레이커 계산기** (`src/04-01-rolling-deploy/index.ts`)

`DesiredCount`와 두 퍼센트로 배포 중 태스크 수 범위를 계산하고, 교착 여부를 판정하고, 서킷 브레이커 임계값을 구한다. 올림·내림 방향과 `clamp` 경계가 채점 대상이다.

무엇을 만들지는 `tests/04-01-rolling-deploy/index.test.ts`가 정의한다. **먼저 읽고** `src/04-01-rolling-deploy/index.ts`의 `🎯 TODO`를 채운다.

```bash
cd packages/ecs-fargate-iac
pnpm test 04-01
```

## 공식 문서

- [Fargate 태스크 정의의 차이점](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html) — CPU/메모리 유효 조합 표, `awsvpc` 강제, 이미지 pull 경로
- [태스크 교체 방식 배포(롤링 업데이트)](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html) — 두 퍼센트의 반올림 방향
- [DeploymentConfiguration API](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_DeploymentConfiguration.html) — 기본값 100/200
- [서킷 브레이커의 실패 감지](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html) — 임계값 공식과 두 단계 판정
- [Fargate 클러스터와 Spot](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html) — 2분 경고, `Base`/`Weight`
- [ECS Exec](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html) — 필요 권한과 제약

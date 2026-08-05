# 91. 용어 해설집 — 레이어별로 묶어 읽는 AWS 어휘

AWS 어휘는 두 가지 이유로 어렵다. **약어가 많고**(ARN·ENI·ACM·OIDC·CIDR·IGW·SG·TG), **이름이 내용을 설명해주지 않는다**(`FromPort`는 출발 포트가 아니고, `TargetGroupFullName`은 이름이 아니라 경로 문자열이다).

그래서 가나다순 사전이 아니라 **층별로 묶고 인과를 함께** 적었다. 같은 층의 용어들은 서로를 설명하므로, 하나가 막히면 옆을 보면 풀린다.

---

## 레이어 0. 어디서나 나오는 것

### ARN (Amazon Resource Name)
AWS 리소스의 전역 고유 주소.

```
arn:aws:secretsmanager:ap-northeast-2:111122223333:secret:orders-server/dev/graph-refresh-token-AbCdEf
└┬┘ └┬┘ └──────┬─────┘ └──────┬─────┘ └────┬────┘ └┬───┘ └────────────┬──────────────┘
 │   │         │              │            │       │                 └─ 리소스 식별자
 │   │         │              │            │       └─ 리소스 타입
 │   │         │              │            └─ 계정 ID (12자리)
 │   │         │              └─ 리전
 │   │         └─ 서비스
 │   └─ 파티션 (aws / aws-cn / aws-us-gov)
 └─ 고정 접두사
```

IAM 정책의 `Resource`가 ARN을 요구하므로 **권한을 좁히는 단위가 곧 ARN이다.** 주의: Secrets Manager ARN 끝의 여섯 글자 임의 접미사(`-AbCdEf`)는 AWS가 붙이므로 **이름만으로 ARN을 조립할 수 없다** — `!Ref`로 받아야 한다.

### 리전(Region)과 가용 영역(AZ, Availability Zone)
**리전**은 지리적 위치(`ap-northeast-2` = 서울). **가용 영역**은 리전 안에서 전력·냉각·네트워크가 물리적으로 분리된 데이터센터 묶음.

AZ가 존재하는 이유는 하나가 죽어도 다른 하나가 살아 있게 하는 것이며, **서브넷이 AZ에 묶여 있으므로 고가용성 설계는 "서브넷을 두 개 이상 쓴다"로 표현된다.** ALB는 최소 2개 AZ를 규칙으로 요구한다.

### 의사 파라미터(Pseudo Parameter)
CloudFormation이 자동으로 채워주는 값. `AWS::AccountId`, `AWS::Region`, `AWS::StackName`, `AWS::NoValue`.

이걸 쓰면 템플릿이 계정·리전에 대해 이식 가능해진다. 하드코딩하면 다른 계정으로 옮길 때 고쳐야 하고, 잊으면 **다른 계정의 리소스를 참조하다 권한 오류로 실패한다.**

---

## 레이어 1. CloudFormation — 선언과 차이 메우기

### IaC (Infrastructure as Code, 코드형 인프라)
인프라의 모습을 파일로 적어 관리하는 방식. 해결하는 문제는 셋: **재현 불가**(콘솔 클릭 순서를 기억할 수 없다), **현재 상태 불명**(왜 이 규칙이 있는지 아무도 모른다), **정리 누락**(무엇을 지워야 하는지 목록이 없다).

### 선언형(Declarative) vs 명령형(Imperative)
**명령형**은 절차를 적는다(`aws elbv2 create-load-balancer ...`) — 두 번 실행하면 "이미 있다"로 실패한다. **선언형**은 결과를 적는다 — 도구가 현재 상태와의 차이를 계산해 그만큼만 바꾼다.

선언형의 대가는 **차이를 어떻게 메울지에 대한 판단을 도구에 넘긴다는 것**이다. 이 위임이 아래 "교체"의 뿌리다.

### 스택(Stack)
템플릿 한 장을 적용한 결과로 생긴 리소스 묶음. 논리 이름 ↔ 실제 리소스 ID 대응표, 마지막 템플릿·파라미터, 이벤트 이력을 기억한다.

**이 기억 때문에** 일괄 삭제·롤백·차이 계산이 가능하다. 기억이 없으면 "현재 상태"를 알 수 없어 차이를 낼 수 없다.

### 교체(Replacement)
속성을 바꿨을 때 CloudFormation이 **새 리소스를 만들고 옛것을 삭제**하는 것. 물리적 ID가 바뀐다.

순서가 "새것 생성 → 참조 갱신 → 옛것 삭제"이므로 **새것을 만드는 시점에 옛것이 아직 살아 있다.** 템플릿이 고정 이름을 쓰면 이름이 겹쳐 실패하고, 롤백 도중 또 다른 충돌이 겹치는 연쇄가 생긴다. → **교체 가능성이 있는 리소스에는 고정 `Name`을 주지 않는다.**

### 변경 불가 속성(Immutable Property)
값을 바꿀 수 없어 반드시 교체를 유발하는 속성. 보안 그룹의 `GroupDescription`, ALB의 `Scheme`이 대표적.

위험한 이유: 스택을 만든 **뒤에** 템플릿에서 이걸 고치면 다음 배포가 그 변경을 교체로 감지한다. 오타 수정 같은 무해한 변경이 실서비스 리소스 교체를 부른다.

### 드리프트(Drift)
템플릿·스택 기록과 실제 리소스가 어긋난 상태. 누군가 콘솔에서 손으로 바꿀 때 생긴다.

위험은 값이 다르다는 것 자체가 아니라 **다음 배포가 그 차이를 되돌리려 한다**는 점이다. → **한 리소스는 한 곳에서만 관리한다.**

### `DeletionPolicy` / `UpdateReplacePolicy`
`DeletionPolicy` = 스택 삭제·리소스 제거 시 실물을 어떻게 할지. `UpdateReplacePolicy` = **교체**로 옛 리소스가 버려질 때 어떻게 할지.

**미지정 기본값은 `Delete`.** 둘은 서로를 대신하지 못하므로 함께 쓴다. `Retain`의 대가: 고정 이름 리소스가 남아 있으면 **같은 이름으로 스택 재생성이 실패한다.**

### `AWS::NoValue`
"값이 없음"이 아니라 **"이 속성을 쓰지 않은 것으로 하라"**는 지시. 빈 리스트 `[]`와 다르다 — 어떤 리소스는 빈 리스트를 오류로 보고, 기본값이 있는 속성은 미지정과 빈 값의 결과가 다르다.

### `NoEcho`
파라미터 값을 CloudFormation 콘솔·이벤트·`describe-stacks`에서 `****`로 가린다.

**암호화가 아니다.** 표시면에서만 가려지고, 그 값이 태스크 정의 환경변수로 흘러가면 태스크 정의를 읽는 사람은 값을 본다. → 시크릿 관리의 최소선일 뿐 [시크릿 관리](#레이어-6-시크릿--값을-코드에-두지-않기)가 아니다.

### `DependsOn`
참조(`!Ref`·`!GetAtt`)로 드러나지 않는 순서를 손으로 지정하는 것.

`DependsOn`이 필요하다는 것은 **"코드에 드러나지 않는 실제 의존이 있다"는 신호**다 — 그런 자리에는 주석을 남길 값어치가 있다. 예: 서비스는 타겟그룹을 참조하지만 리스너는 참조하지 않는데, 리스너 없이 서비스가 뜨면 트래픽 경로가 없어 헬스체크가 실패한다.

### `Export` / `ImportValue`
스택이 내놓은 값을 다른 스택이 가져다 쓰는 장치. export 이름은 **리전 안에서 유일**해야 하고(그래서 이름에 환경을 넣는다), **import하는 스택이 있으면 export를 삭제할 수 없다**(삭제 순서 제약이 된다).

---

## 레이어 2. 네트워크 — 길과 문

### VPC (Virtual Private Cloud)
계정에 주어지는 논리적으로 독립된 네트워크. 다른 계정의 VPC는 IP가 겹쳐도 서로 보이지 않는다.

### CIDR 표기
IP 범위를 쓰는 방법.

```
10.1.0.0/16   앞 16비트 고정 → 주소 65,536개
10.1.1.0/24   앞 24비트 고정 → 256개
1.2.3.4/32    32비트 전부 고정 → 딱 1개 (특정 IP)
```

`/32`는 방화벽 규칙에서 "이 IP만 허용"의 관용 표현이다.

### 서브넷(Subnet)
VPC의 IP 범위를 나눈 조각. **하나의 AZ에 속한다.**

### 라우팅 테이블(Route Table) · IGW · NAT 게이트웨이
**서브넷이 public인지 private인지를 결정하는 것이 라우팅 테이블이다.** 이름·태그와 무관하다.

```
public 서브넷:   0.0.0.0/0 → igw-xxxx   (인터넷 게이트웨이. 양방향)
private 서브넷:  0.0.0.0/0 → nat-xxxx   (NAT 게이트웨이. 나가기만)
```

**IGW**는 인터넷과 양방향 통신을 가능하게 한다(공인 IP가 있을 때). **NAT**는 나가는 요청의 출발지를 자기 공인 IP로 바꿔 보내고 응답만 되돌려주므로, **밖에서 먼저 말을 걸 방법이 없다.** 이 비대칭이 "인터넷에서 패키지를 받아야 하지만 접속당하고 싶지 않은" 서버의 배치를 만든다.

주의: private 서브넷 + `AssignPublicIp: DISABLED`에서 NAT나 VPC 엔드포인트가 없으면 **컨테이너 이미지 pull과 로그 전송이 모두 실패한다**(둘 다 AWS API 호출이다).

### 보안 그룹(SG, Security Group)
ENI 앞에 붙는 방화벽. 세 성질을 알면 나머지는 유도된다.

1. **허용만 쓴다(화이트리스트)** — 거부 규칙이 없고 순서 개념도 없다. 하나라도 맞으면 통과
2. **상태를 기억한다(stateful)** — 요청 방향만 열면 응답은 자동으로 통과
3. **기본값이 비대칭** — 인바운드 전부 거부 / **아웃바운드 전부 허용**. `SecurityGroupEgress`를 한 번 쓰면 전체 허용이 사라진다

### 인그레스(Ingress) / 이그레스(Egress)
들어오는 규칙 / 나가는 규칙. **연결에는 출발지의 이그레스 + 목적지의 인그레스가 모두 필요하다.**

전용 보안 그룹은 아웃바운드가 전부 열려 있어 이그레스를 신경 쓰지 않게 되는데, **이그레스가 제한된 공용 보안 그룹을 재사용하면** 조용한 차단이 시작된다. 서명 증상: `/health`는 200인데 비즈니스 API만 500.

### 보안 그룹 참조(SG Reference)
규칙의 출발지를 IP가 아니라 **다른 보안 그룹**으로 지정하는 것(`SourceSecurityGroupId`).

IP는 계속 바뀌지만(ALB 노드 증감, 태스크 재배포) 보안 그룹은 안 바뀌므로 **규칙이 계속 맞는다.** 보안 그룹이 방화벽이면서 동시에 "역할 라벨"로 작동하는 것이며, 이게 SG 체인(ALB SG → Service SG → DB SG)을 가능하게 한다.

### `FromPort` / `ToPort`
"출발 포트 / 도착 포트"가 아니라 **포트 범위의 시작과 끝**이다. 같은 값을 넣으면 포트 하나만 여는 것. 이름이 오해를 자주 부른다.

### `DependencyViolation`
"이 리소스를 참조하는 것이 남아 있어 지울 수 없다"는 오류. **수동으로 추가한 보안 그룹 규칙이 스택 삭제를 막는 대표 사례**다 — CloudFormation은 그 규칙의 존재를 모른다.

### ENI (Elastic Network Interface, 탄력적 네트워크 인터페이스)
가상 네트워크 카드. 사설 IP와 보안 그룹이 여기에 붙는다.

### `awsvpc` 네트워크 모드
**태스크마다 ENI를 붙이고 서브넷에서 사설 IP를 하나 할당하는 모드. Fargate는 이것만 쓴다.**

결과 셋: (1) **보안 그룹을 태스크에 직접 붙일 수 있다** → 서비스 단위 네트워크 격리가 가능해진다, (2) 호스트 포트 매핑이 없어 포트 충돌 개념이 사라진다, (3) 태스크가 서브넷 IP를 하나 소비한다 → **서브넷 IP가 마르면 태스크가 안 뜬다**(증상은 ENI 할당 실패).

---

## 레이어 3. 트래픽 분배 — 바뀌는 목적지 앞의 고정 주소

### ALB (Application Load Balancer)
HTTP를 이해하는 L7 로드밸런서. 네 가지를 한꺼번에 한다: **고정 진입점 / 분배 / 건강 판정 / TLS 종료.**

L7이므로 경로·호스트·헤더로 분기할 수 있고, `/health`에 GET을 보내 응답 코드를 확인할 수 있다. NLB(L4)는 TCP 연결 성공만 보므로 "포트는 열렸는데 500을 뱉는" 상태를 건강하다고 판정한다.

### `Scheme`: `internet-facing` / `internal`
ALB 노드에 공인 IP를 줄지 정한다. `internet-facing`은 public 서브넷에 있어야 한다(공인 IP가 있어도 IGW 경로가 없으면 응답이 나가지 못한다).

**교체를 유발하는 속성**이므로 `internal → internet-facing` 전환은 ALB 삭제·재생성을 부른다.

### 리스너(Listener)
어떤 포트·프로토콜로 받고, 인증서는 무엇이며, 규칙에 안 맞는 요청을 어디로 보낼지(`DefaultActions`) 정한다.

### 타겟그룹(TG, Target Group)
트래픽을 받을 대상 묶음 + 건강 판정 규칙. **한 타겟그룹은 한 로드밸런서에만 연결된다** — ALB 교체 시 신·구 ALB에 같은 타겟그룹이 붙으려다 실패하는 함정의 근거다.

### `TargetType`: `ip` / `instance` / `lambda`
`awsvpc` 모드 ECS 태스크는 **`ip`**다. Fargate에는 볼 수 있는 인스턴스가 없어 `instance`를 쓸 수 없다.

### 헬스체크 임계값
```
비정상 판정까지 = HealthCheckIntervalSeconds × UnhealthyThresholdCount
건강 복귀까지  = HealthCheckIntervalSeconds × HealthyThresholdCount
```

줄이면 감지가 빨라지지만 일시적 지연(GC 일시정지, 순간 부하)에 건강한 태스크가 쫓겨난다. **감지 속도와 안정성의 트레이드오프에 공짜가 없다.**

### 등록 해제 지연(Deregistration Delay) · draining
타겟을 내릴 때 처리 중인 요청이 끝날 시간을 주는 것. 그 동안 상태가 `draining`이고, 지연이 끝나면 `unused`가 된다. 처리 중 요청과 활성 연결이 없으면 기다리지 않고 즉시 완료한다.

**기본값 300초.** 안 줄이면 배포가 느려지고, 너무 줄이면 요청이 잘려 클라이언트가 500번대를 받는다. 적정값 = 가장 느린 정상 요청이 끝나는 시간.

### TLS 종료(TLS Termination)
암호화가 ALB에서 끝나고 그 안쪽(ALB↔태스크)은 평문인 구조.

이유 넷: 인증서 관리가 한 곳으로 모인다 / 애플리케이션이 TLS를 몰라도 된다 / 암복호 CPU를 ALB가 진다 / **ALB가 HTTP 내용을 봐야 L7 라우팅이 가능하다.** 종단간 암호화로 바꾸면 이 네 이점을 다시 잃는다.

### ACM (AWS Certificate Manager)
인증서 발급·보관·자동 갱신 서비스.

**와일드카드는 한 레벨만 커버한다** — `*.example.com`은 `orders-dev.example.com`을 커버하지만 `admin.dev.example.com`은 아니다. 자동 갱신은 **DNS 검증 레코드가 유지될 때만** 성립하고, 지우면 갱신이 조용히 실패해 만료일에 서비스 전체가 TLS 오류를 낸다.

### `SslPolicy`
허용할 TLS 버전과 암호 스위트의 이름표. 이름 규칙이 내용을 담는다.

```
ELBSecurityPolicy-TLS13-1-2-2021-06
                  └┬─┘ └┬┘ └──┬──┘
                   │    │     └─ 정책 발표 시점
                   │    └─────── 최소 TLS 버전 1.2
                   └──────────── TLS 1.3 지원
```

**CloudFormation·CLI로 리스너를 만들 때 생략하면 기본값이 `ELBSecurityPolicy-2016-08`(TLS 1.0/1.1 허용)이다.** 콘솔은 최신 정책이 붙어서 차이를 인지하기 어렵다 → **항상 명시한다.**

### WAF (Web Application Firewall)
요청 **내용**에서 SQL 인젝션·XSS 같은 공격 패턴을 찾아 차단. 보안 그룹이 "누가 접속하나"(IP·포트)를 보는 것과 **다른 층**이므로 대체 관계가 아니다.

### `TargetGroupFullName` / `LoadBalancerFullName`
이름이 아니라 CloudWatch 디멘션용 경로 문자열(`targetgroup/orders-server-dev-tg/1234abcd`). ARN을 문자열로 자르지 않고 `!GetAtt`의 전용 속성으로 얻는다.

---

## 레이어 4. 컨테이너 실행

### 컨테이너 오케스트레이터
"원하는 상태를 선언하면 유지해주는" 런타임. [선언형](#선언형declarative-vs-명령형imperative) 발상이 런타임으로 내려온 것.

### ECS (Elastic Container Service) vs EKS
ECS = AWS 자체 오케스트레이터(학습 곡선 낮음, AWS 종속, 제어판 무료). EKS = 관리형 쿠버네티스(학습 곡선 높음, 이식성, 클러스터당 요금).

### Fargate vs EC2 시작 유형
Fargate = AWS가 관리하는 보이지 않는 기반에서 태스크를 돌린다. **SSH로 들어갈 서버가 없다.**

이 사실이 여러 곳의 근거다: 타겟 타입이 `ip`인 이유, 컨테이너 안을 보려면 [ECS Exec](#ecs-exec)가 필요한 이유. 대가는 시간당 단가가 EC2보다 비싸다는 점이고, 얻는 것은 노는 용량이 없고 인스턴스 관리 노동이 없다는 점이다.

### 클러스터(Cluster)
논리적 묶음. Fargate에서는 서버가 없으므로 실체가 거의 없고, 접근 제어·지표 집계·구분 단위로만 쓰인다.

### 태스크 정의(Task Definition)와 리비전(Revision)
청사진. 이미지·CPU·메모리·환경변수·로그·헬스체크를 담지만 **그 자체로는 실행되지 않는다.**

**리비전 단위로 불변이다** — "수정"하면 새 리비전이 만들어지고 옛 리비전은 그대로 남는다. **이 불변성이 롤백을 가능하게 한다**(가변이라면 되돌릴 대상이 사라진다).

### 서비스(Service)와 태스크(Task)
서비스 = "이 태스크 정의를 몇 개 유지하라"를 맡는 스케줄러. 태스크 = 실제로 도는 컨테이너 묶음.

### CPU 유닛
**1024 유닛 = 1 vCPU.** `Cpu: 512`는 0.5 vCPU.

Fargate는 **정해진 조합만** 허용한다. 512 → 1·2·3·4 GB. `Cpu: 512` + `Memory: 512`는 불가(512 MiB는 256 CPU에서만).

### `Essential`
"이 컨테이너가 멈추면 태스크 전체를 멈춰라". 컨테이너가 하나면 항상 `true`여야 한다 — `false`면 앱이 죽어도 태스크가 살아 있는 것으로 취급돼 ECS가 교체하지 않는다.

### 용량 공급자(Capacity Provider) · `Base` / `Weight`
어떤 용량으로 태스크를 돌릴지(`FARGATE` / `FARGATE_SPOT`)와 섞는 비율.

- **`Base`** = 이 공급자로 먼저 확보할 최소 태스크 수. **하나의 공급자만** 가질 수 있다
- **`Weight`** = Base를 채운 뒤 남은 태스크를 나눌 비율. Weight 0인 공급자는 배치에 쓰이지 않는다

### Fargate Spot
남는 용량으로 태스크를 돌려 **최대 70% 할인.** 회수 시 **2분 경고**(EventBridge 이벤트 + 컨테이너에 **SIGTERM**), `stopTimeout`(기본 30초, 최대 120초) 뒤 SIGKILL.

**태스크 1개 서비스는 회수되면 용량이 생길 때까지 멈추고, 일반 Fargate로 자동 대체되지 않는다.** → 운영에서는 `Base`로 최소 개수를 일반 용량에 확보한다.

### `MinimumHealthyPercent` / `MaximumPercent`
```
최소 유지 = ceil(DesiredCount × MinimumHealthyPercent / 100)   ← 올림
최대 허용 = floor(DesiredCount × MaximumPercent / 100)         ← 내림
```

**최소는 올려서 가용성을, 최대는 내려서 비용 한도를 지킨다.** 기본값 100/200. `DesiredCount: 1` + `MaximumPercent: 100`은 **교착**(하나도 멈출 수 없고 하나도 시작할 수 없다).

### 배포 서킷 브레이커(Deployment Circuit Breaker)
태스크 기동 실패가 임계값에 닿으면 배포를 `FAILED`로 만들고, `Rollback: true`면 마지막 `COMPLETED` 배포로 되돌린다.

**임계값 = `clamp(0.5 × DesiredCount, 3, 200)`** (기본 `BOUNDED_PERCENT`, 비율 50%). 판정은 2단계(RUNNING 도달 여부 → 헬스체크). 기본 동작에서는 건강한 태스크가 하나 뜨면 카운트가 0으로 초기화된다.

**첫 배포에는 `COMPLETED` 배포가 없어 롤백 대상이 없다** → 배포가 그대로 멈춘다.

### `HealthCheckGracePeriodSeconds` / `StartPeriod`
태스크·컨테이너가 시작된 뒤 헬스체크 실패를 무시하는 기간.

없으면 부팅 중인 태스크가 unhealthy로 판정돼 교체되고, 새 태스크도 같은 이유로 교체되어 **영원히 기동하지 못하는 순환**에 빠진다. 반대로 지나치게 늘리면 진짜로 못 뜨는 태스크를 오래 살려 배포 실패 판정이 늦어진다.

### ECS Exec
Systems Manager Session Manager로 컨테이너 안에서 명령을 실행하는 통로. Fargate에 SSH가 없으므로 이것이 유일한 내부 진단 경로다.

제약 셋: 권한(`ssmmessages:*` 4개)이 **태스크 롤**에 있어야 한다 / **`readonlyRootFilesystem`과 함께 쓸 수 없다** / **도는 태스크에 나중에 켤 수 없다**(새 배포가 필요 → 장애 대응 중에 켜면 조사 대상이 사라진다).

### Container Insights
클러스터 설정. 켜면 `ECS/ContainerInsights` 네임스페이스에 태스크 단위 지표(`DesiredTaskCount`·`RunningTaskCount` 등)를 보낸다. 추가 비용이 있고, **끄면 그 지표에 의존하는 알람이 영원히 데이터를 받지 못한다.**

### `awslogs` 드라이버의 `mode`
`blocking` = 버퍼가 차면 애플리케이션을 멈춘다(로그를 잃지 않지만 성능 저하). `non-blocking` = 로그를 버린다(성능은 지키지만 **장애 순간의 로그가 사라질 수 있다**).

---

## 레이어 5. 권한과 신원

### IAM 롤(Role)
권한 묶음. **사용자가 아니고 로그인 대상도 아니다.** 자격을 갖춘 주체가 롤을 **맡아(assume)** 짧은 수명의 임시 자격증명을 받는다. ECS 태스크에서는 SDK가 태스크 메타데이터 엔드포인트에서 자격증명을 받아 자동 갱신하므로 **코드에 키가 없고 갱신 로직도 없다.**

### 신뢰 정책(Trust Policy) vs 권한 정책(Permission Policy)
```
AssumeRolePolicyDocument       → 누가 맡을 수 있나 (문)
Policies / ManagedPolicyArns   → 맡으면 무엇을 할 수 있나 (방 안의 일)
```

**둘을 헷갈리면 진단이 어긋난다.** 맡을 자격이 없으면 권한 목록은 볼 기회조차 없다. 오류 발생 단계도 다르다 — 신뢰 정책 거부는 `AssumeRole` 시점, 권한 부족은 실제 API 호출 시점.

### `Principal`
신뢰 정책에서 "누구"를 지목하는 자리.
- `Service: ecs-tasks.amazonaws.com` — AWS 서비스
- `Federated: …oidc-provider/token.actions.githubusercontent.com` — 외부 신원 공급자

### 정책 문장의 네 요소 · 평가 규칙
`Effect`(허용/거부) · `Action`(어떤 API) · `Resource`(어떤 대상) · `Condition`(어떤 상황).

**평가: 명시적 `Deny` > `Allow` > 암묵적 거부.** 정책이 없으면 아무것도 못 한다.

### 실행 롤(Task Execution Role) vs 태스크 롤(Task Role)
**경계는 시점이다.**

| | 실행 롤 | 태스크 롤 |
|---|---|---|
| 누가 | ECS·Fargate 에이전트 | 컨테이너 안 내 코드 |
| 언제 | 컨테이너를 **띄우기 전·중** | 컨테이너가 **돌고 있는 동안** |
| 컨테이너에서 보이나 | **아니다** | 그렇다 |

신뢰 정책은 둘 다 똑같이 `ecs-tasks.amazonaws.com`이고, 태스크 정의의 `ExecutionRoleArn`/`TaskRoleArn` 자리가 역할을 정한다. 합치면 애플리케이션 취약점으로 실행 롤 권한까지 넘어간다.

### 관리형 정책(Managed Policy) vs 인라인 정책(Inline Policy)
관리형 = AWS 또는 계정이 유지하며 여러 롤에 붙일 수 있다. 인라인 = 롤에 직접 박히고 롤과 함께 사라진다.

**`AmazonECSTaskExecutionRolePolicy`에는 `secretsmanager:GetSecretValue`가 없다** — 이름이 포괄적으로 읽혀서 함정이 된다. 시크릿을 참조하면 인라인으로 추가해야 하고, 없으면 태스크가 `ResourceInitializationError`로 기동 실패한다(증상이 이미지 문제로 오인된다).

### `iam:PassRole`
**다른 롤을 AWS 서비스에 넘겨줄 수 있는 권한.**

왜 별도인가: 파이프라인이 태스크 정의에 관리자 롤 ARN을 적으면 그 태스크를 통해 무엇이든 할 수 있다 — **자기 권한보다 강한 권한을 우회 획득하는 경로**다. 그래서 `Resource`로 넘길 롤을 한정하고 **`Condition: iam:PassedToService`**로 넘길 대상 서비스까지 못박는다.

없으면 `RegisterTaskDefinition`이 AccessDenied로 실패하고, **오류 메시지가 넘겨질 롤 이름을 언급해서 엉뚱한 롤을 뒤지게 만든다.**

### 리소스 레벨 권한 미지원 액션
모든 API가 리소스 단위 제한을 지원하지는 않는다. `ecr:GetAuthorizationToken`(레지스트리 전체 대상), `ecs:RegisterTaskDefinition`(아직 없는 것을 만드는 호출), ELBv2 `Describe*`(조회 API).

`Resource: '*'`가 불가피하며, **그럴 때는 주석으로 이유를 남긴다** — 조일 수 있는데 안 조인 것과 구분되어야 한다.

### `CAPABILITY_IAM` / `CAPABILITY_NAMED_IAM`
IAM 리소스를 만들 때 / **이름까지 지정**할 때 배포 명령에 필요한 확인 플래그. 남이 만든 템플릿을 무심코 배포해 관리자 롤이 생기는 사고를 막는 장치다. 없으면 `InsufficientCapabilities`로 즉시 실패한다.

### OIDC (OpenID Connect) 페더레이션
AWS가 외부 신원 공급자(GitHub 등)를 직접 신뢰하고, 그 공급자가 발급한 짧은 수명의 JWT로 롤을 맡게 하는 구조. **저장되는 장기 비밀이 없다.**

### `sub` / `aud` 클레임
JWT에 담긴 필드. 신뢰 정책의 `Condition`이 이 값을 검증한다.

- **`aud`** = `sts.amazonaws.com` (이 토큰이 AWS를 대상으로 발급됐는가)
- **`sub`** = 어느 리포지토리의 어느 스코프인가

```
환경 스코프:   repo:OWNER/REPO:environment:ENV_NAME
브랜치 스코프: repo:OWNER/REPO:ref:refs/heads/BRANCH
```

**`sub` 조건이 없으면 GitHub의 아무 리포지토리나 그 롤을 맡을 수 있다** — 롤 ARN은 비밀이 아니므로 ARN만 알면 된다. 환경 스코프가 나은 이유: GitHub 환경에 승인 규칙을 걸 수 있어 통제가 GitHub과 AWS 양쪽에서 걸린다.

### `permissions: id-token: write`
워크플로가 OIDC JWT를 발급받을 수 있게 하는 GitHub Actions 권한. 리소스를 바꾸는 권한이 아니라 **토큰 생성 허용**이다. 없으면 토큰 자체를 못 얻어 `AssumeRoleWithWebIdentity`가 불가능하다.

---

## 레이어 6. 시크릿 — 값을 코드에 두지 않기

### `Environment` vs `Secrets` (태스크 정의)
**컨테이너 안에서는 둘 다 똑같은 환경변수로 보인다.** 차이는 값이 태스크 정의에 남는지다.

```
Environment: { "name": "X", "value": "실제값" }     ← 값이 남는다
Secrets:     { "name": "X", "valueFrom": "arn:…" }  ← ARN만 남는다
```

`describe-task-definition` 권한은 흔히 넓게 부여되므로, `Secrets` 방식은 **"권한의 두 번째 관문"**을 만든다.

### 주입 시점
**컨테이너 시작 시점에 한 번만 해석된다.** 값을 갱신해도 도는 컨테이너는 옛 값을 들고 있다 → `aws ecs update-service --force-new-deployment`.

이 성질 때문에 **회전이 필요한 값은 환경변수만으로 표현할 수 없다**(프로세스가 자기 환경변수를 다음 기동에 반영되게 바꿀 수 없다).

### Secrets Manager vs SSM Parameter Store
둘 다 KMS로 암호화된 키-값 저장소. **Secrets Manager만 갖는 것: 자동 회전, 무작위 시크릿 생성, 계정 간 공유.** 그 기능이 필요 없으면 Parameter Store가 싸다(표준 파라미터 무료 vs 시크릿당 **월 $0.40** + API 1만 건당 $0.05).

### 플레이스홀더 패턴
스택은 시크릿 **리소스만** 만들고 값은 사람이 한 번 주입한다. 초기값은 빈 문자열이 아니라 표식 문자열을 둔다.

이유 둘: (1) **버전(값) 없는 시크릿은 `secrets:` 해석이 실패해 태스크가 기동하지 못한다** — 운영 중이면 곧 장애, (2) 표식은 **미주입 상태를 드러내** 진단을 한 걸음으로 만든다.

**함정: 값 주입 후에는 그 리소스 블록의 어떤 속성도 수정하지 않는다.** `Description`만 고쳐도 CloudFormation이 `UpdateSecret`에 `SecretString`(표식)을 함께 실어 실제 값이 되돌아갈 수 있다.

---

## 레이어 7. 관측과 알람

### 로그 그룹 / 로그 스트림
그룹 = 보존 기간·권한·암호화 설정 단위. 스트림 = 태스크 하나. 배포마다 스트림이 새로 생기므로 **스트림 목록이 배포 이력에 가깝다.**

**`RetentionInDays`를 지정하지 않으면 만료 없이 영구 보존된다**(요금이 계속 늘어난다). 값은 정해진 목록(1·3·5·7·14·30·60·90·180·365…)만 받는다.

### 네임스페이스 / 지표 이름 / 디멘션 / 통계
지표 하나를 특정하는 네 요소. **디멘션은 좌표이며 정확히 일치해야 데이터가 나온다** — 하나를 빼면 그 조합의 지표가 존재하지 않아 **오류 없이 데이터 없음**이 되고, 알람이 영원히 `INSUFFICIENT_DATA`에 머문다(감시한다고 믿는 것이 감시되지 않는다).

**통계 선택이 의미를 바꾼다.** 가용성 지표에는 최악을 보는 통계(`Minimum` for healthy count)가 맞다 — `Average`는 "30초간 완전히 죽었던" 사실을 평균에 묻는다.

### 알람 상태 3종
`OK` / `ALARM` / `INSUFFICIENT_DATA`. **세 번째는 `ALARM`이 아니라서 알람 액션이 발동하지 않는다.**

### M out of N (`DatapointsToAlarm` / `EvaluationPeriods`)
최근 N개 중 M개가 위반이면 `ALARM`. M을 생략하면 M = N.

**알람이 늦으면 장애가 길어지고, 민감하면 사람이 알람을 무시하게 된다.** 두 번째가 더 위험하다 — 오탐이 반복되면 진짜 알람도 함께 무시된다.

### `TreatMissingData`
결손 데이터를 무엇으로 취급할지. **기본값은 `missing`** → 전부 결손이면 `INSUFFICIENT_DATA`(알림 없음).

| 옵션 | 결손을 | 결과 |
|---|---|---|
| `notBreaching` | 정상으로 | 데이터 없으면 `OK` |
| `breaching` | 위반으로 | 데이터 없으면 `ALARM` |
| `ignore` | 판단 안 함 | 현재 상태 유지 |
| `missing` (기본) | 결손 그대로 | `INSUFFICIENT_DATA` |

**선택 기준: 정상일 때 항상 데이터가 오는가?**
```
예 (연속 지표: healthy 호스트 수, 실행 중 태스크 수) → breaching
아니오 (이벤트 지표: 5xx 건수)                      → notBreaching
```

반대로 하면 하나는 **평온할 때 계속 울리고**(사람이 알람을 끈다) 하나는 **최악에 침묵한다**(태스크 전멸이 지표를 멈추게 하므로).

### 평가 범위(Evaluation Range)
CloudWatch가 `EvaluationPeriods`보다 더 많은 데이터 포인트를 가져오는 범위. **실제 데이터가 N개 이상 모이면 `TreatMissingData` 설정은 쓰이지 않는다** — 결손 처리는 데이터가 부족할 때만 적용된다. 이 설계가 간헐적 결손에서 오탐을 줄인다.

### 메트릭 수식(Metric Math) · `ReturnData`
여러 지표를 `Id`로 가져와 `Expression`으로 계산하는 것. "부족"처럼 **하나의 지표로 표현할 수 없는 것**을 잡을 때 필요하다(`desired - running`).

**`ReturnData: true`는 정확히 하나여야 한다** — 재료 지표는 `false`. 여러 개면 판정 기준이 모호해 배포가 실패한다.

### `HTTPCode_Target_5XX_Count` vs `HTTPCode_ELB_5XX_Count`
**타겟(컨테이너)이 낸 5xx** vs **ALB 자체가 낸 5xx**(healthy 타겟 없음으로 인한 503 등). 구분하지 못하면 애플리케이션 에러와 인프라 문제를 섞어 본다.

### `AlarmActions` / `OKActions`
ALARM 전이 시 / OK 복귀 시 실행할 것(보통 SNS 토픽).

**`OKActions`를 함께 넣는 것이 중요하다** — 복구 알림이 오면 스스로 나은 문제인지 개입이 필요한 문제인지 구분된다. 그리고 **알람은 상태가 바뀔 때만 액션을 실행한다**(ALARM에 머무는 동안 반복 알리지 않는다) → 알림을 놓치면 다시 오지 않는다.

---

## 레이어 8. 이미지와 배포

### ECR (Elastic Container Registry)
AWS의 컨테이너 이미지 저장소. 구조는 레지스트리(계정×리전당 하나) → 리포지토리(서비스당 하나) → 태그.

**리포지토리는 환경을 나누지 않는다.** 나누면 같은 이미지를 환경마다 다시 push해야 하고, **"STAGE에서 검증한 이미지가 PROD의 그 이미지와 같다"는 보장이 사라진다.**

### 가변 태그(Mutable Tag) vs 불변 태그(Immutable Tag)
`dev` = 가변(항상 최신을 가리킨다). `dev-a2238c6` = 불변(커밋 SHA가 들어가 겹치지 않는다).

**가변 태그만 쓰면 롤백 대상을 지목할 수 없다** — 옛 이미지가 태그를 잃고 `<untagged>`가 된다. 둘을 함께 push해서 평시에는 `dev`가 현재를, 롤백에는 SHA 태그가 특정 커밋을 가리키게 한다.

`latest`를 운영에서 쓰지 않는 이유: **어느 환경의 최신인지 모호하다** — dev 빌드가 갱신하는데 prod가 참조하면 검증되지 않은 이미지가 운영에 들어간다.

### 이미지 다이제스트 고정
ECS는 기본적으로 태스크 정의의 이미지 태그를 **다이제스트(내용 해시)로 해석해 고정한다.** 서비스 안 모든 태스크가 동일한 이미지를 돌리게 하기 위한 것(컨테이너 정의의 `versionConsistency`로 조절).

**결과: 같은 태그에 새 이미지를 push해도 도는 서비스는 바뀌지 않는다** → `--force-new-deployment` 필요. "push했는데 안 바뀌네"의 원인.

### `exec format error`
arm64 이미지를 X86_64 태스크로 실행했을 때의 오류. Apple Silicon에서 `docker build`를 하면 기본으로 arm64가 나오므로 **`--platform linux/amd64`**가 필요하다. 메시지가 불친절해서 원인이 잘 드러나지 않는다.

### `workflow_dispatch`
GitHub Actions의 수동 트리거. **"머지"와 "배포"를 분리해 배포 시점을 사람이 정한다.**

대가: 배포 빈도가 낮아지고, 그러면 한 번에 나가는 변경이 커져 문제 발생 시 원인 특정이 어려워진다. **어느 쪽도 공짜가 아니며** 팀 규모와 서비스 중요도가 선택을 정한다.

---

## 이름이 오해를 부르는 것들 — 한눈에

| 이름 | 오해 | 실제 |
|---|---|---|
| `FromPort` / `ToPort` | 출발 포트 / 도착 포트 | 포트 **범위**의 시작과 끝 |
| `NoEcho` | 값을 암호화한다 | CloudFormation **표시면에서만** 가린다 |
| `AWS::NoValue` | 값이 없음 | **이 속성을 쓰지 않은 것으로** 처리 |
| `TargetGroupFullName` | 타겟그룹 이름 | 디멘션용 **경로 문자열** |
| `AmazonECSTaskExecutionRolePolicy` | 실행 롤에 필요한 모든 것 | **시크릿 권한이 빠져 있다** |
| `INSUFFICIENT_DATA` | 알람의 한 종류 | `ALARM`이 아니므로 **알림이 안 간다** |
| `id-token: write` | 리소스를 바꾸는 권한 | OIDC **토큰 생성 허용** |
| `latest` (태그) | 최신 안정 버전 | **어느 환경의** 최신인지 모호 |
| public 서브넷 | 이름이 public인 서브넷 | 라우팅 테이블에 **IGW 경로가 있는** 서브넷 |
| `wget --spider` | 가벼운 GET | **HEAD 요청** (GET 전용 라우트에서 실패) |

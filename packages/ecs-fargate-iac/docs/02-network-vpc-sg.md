# 02. 네트워크 — VPC·서브넷·보안 그룹으로 트래픽의 길과 문을 만든다

## 학습 목표

이 문서를 다 읽으면 (1) 서브넷이 public인지 private인지를 무엇이 결정하는지 설명할 수 있고, (2) 보안 그룹 규칙을 보고 어떤 트래픽이 통과하는지 판정할 수 있고, (3) **"연결이 안 된다"는 증상에서 인그레스·이그레스·라우팅 중 어디가 원인인지** 좁힐 수 있다.

## 선수 지식

[01](01-iac-and-cloudformation.md)의 `!Ref`와 조건. TCP 포트라는 개념. IP 주소가 숫자 네 개라는 정도.

---

## 핵심 원리 (WHY)

### VPC — 남의 서버 옆에 내 서버를 두는 문제

AWS의 물리 서버는 수많은 고객이 공유한다. 아무 조치가 없다면 당신의 데이터베이스와 옆 회사의 웹서버가 같은 네트워크에 있게 되고, IP만 알면 서로에게 패킷을 보낼 수 있다. 이건 성립할 수 없는 모델이다.

**VPC(Virtual Private Cloud)**는 이 문제를 "각 고객에게 논리적으로 독립된 네트워크를 준다"로 해결한다. VPC를 만들면 내가 IP 범위를 정하고, 그 안에서만 통신이 일어나며, 밖으로 나가려면 명시적으로 출구를 만들어야 한다. 다른 계정의 VPC는 IP가 겹쳐도 서로 보이지 않는다.

VPC를 만들 때 정하는 IP 범위는 **CIDR 표기**로 쓴다.

```
10.1.0.0/16
└─┬────┘ └┬┘
  │       └─ 앞 16비트가 고정, 뒤 16비트가 자유 → 주소 65,536개
  └───────── 네트워크 주소
```

`/16`은 "32비트 중 앞 16비트가 고정"이라는 뜻이고, 남은 16비트가 자유롭게 변하므로 2^16 = 65,536개 주소를 담는다. `/24`면 256개, `/32`면 딱 1개다.

`/32`는 특정 IP 하나를 가리키는 관용 표현이라서, 방화벽 규칙에서 "이 IP만 허용"을 표현할 때 쓴다. 학습 대상 템플릿의 사무실·VPN 허용 규칙이 이 형태다.

```yaml
  OfficeCidr:
    Type: String
    Default: 203.0.113.10/32     # 사무실 공인 IP 딱 하나
```

### 서브넷 — 가용 영역에 묶인 IP 조각

VPC의 IP 범위를 잘게 나눈 것이 **서브넷(subnet)**이다. 서브넷은 하나의 **가용 영역(Availability Zone, AZ)**에 속한다. AZ는 같은 리전 안에서 전력·냉각·네트워크가 물리적으로 분리된 데이터센터 묶음이며, 하나가 죽어도 다른 하나는 살아 있도록 설계돼 있다.

**서브넷이 AZ에 묶여 있다는 사실이 고가용성 설계의 출발점이다.** 서브넷 하나에만 리소스를 두면 그 AZ가 죽을 때 서비스가 죽는다. 그래서 학습 대상 템플릿은 서브넷을 두 개씩 받는다.

```yaml
  PrivateSubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
    Default: subnet-0aaa1111bbbb2222a,subnet-0ccc3333dddd4444b   # 서로 다른 AZ

  PublicSubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
    Default: subnet-0eee5555ffff6666c,subnet-0999777788889999d   # 서로 다른 AZ
```

ALB는 **최소 두 개 AZ의 서브넷을 요구한다** — 규칙으로 강제된다. 반면 ECS 태스크는 하나여도 만들어지지만, 그러면 AZ 장애에 무방비다.

### ⭐ public과 private을 나누는 것은 라우팅 테이블이다

여기가 초보자가 가장 헷갈리는 지점이다. 서브넷에 "public"이라는 스위치가 있는 게 아니다. 이름에도 아무 힘이 없다 — `subnet-public-1`이라고 이름을 붙여도 그것만으로 public이 되지 않는다.

**서브넷의 라우팅 테이블에 인터넷 게이트웨이(IGW)로 가는 경로가 있으면 public, 없으면 private이다.** 그게 전부다.

```
[public 서브넷의 라우팅 테이블]        [private 서브넷의 라우팅 테이블]
  10.1.0.0/16  → local                    10.1.0.0/16  → local
  0.0.0.0/0    → igw-xxxx  ← 이 줄        0.0.0.0/0    → nat-xxxx
```

`0.0.0.0/0`은 "그 외 전부"라는 뜻의 기본 경로다. 이 경로가 **IGW**를 가리키면 그 서브넷의 리소스는 공인 IP를 가질 때 인터넷과 양방향으로 통신할 수 있다. **NAT 게이트웨이**를 가리키면 나가기만 할 수 있다.

이 비대칭이 NAT의 존재 이유다. NAT는 나가는 요청의 출발지 주소를 자기 공인 IP로 바꿔 보내고, 돌아온 응답을 원래 요청자에게 되돌려준다. **밖에서 먼저 말을 걸 방법이 없다** — NAT는 자기가 보낸 요청의 응답만 안으로 들여보내기 때문이다. 그래서 "인터넷에서 패키지를 받아야 하지만 인터넷에서 접속당하고 싶지는 않은" 서버가 private 서브넷 + NAT 조합을 쓴다.

학습 대상 템플릿의 배치가 정확히 이 모양이다.

| 리소스 | 서브넷 | 이유 |
|---|---|---|
| **ALB** | public | 인터넷에서 들어오는 요청을 받아야 하므로 |
| **ECS 태스크** | private | 밖에서 직접 접근할 수 없어야 하므로 |

```yaml
  Alb:
    Properties:
      Scheme: internet-facing
      Subnets: !Ref PublicSubnetIds       # ← public

  Service:
    Properties:
      NetworkConfiguration:
        AwsvpcConfiguration:
          Subnets: !Ref PrivateSubnetIds  # ← private
          AssignPublicIp: DISABLED
```

**`Scheme`은 ALB에 공인 IP를 줄지 결정한다.** `internet-facing`이면 ALB 노드가 공인 IP를 받고 DNS가 그것을 반환한다. `internal`이면 사설 IP만 받아 VPC 안에서만 접근된다. 그리고 `internet-facing` ALB는 반드시 public 서브넷에 있어야 한다 — 공인 IP가 있어도 IGW 경로가 없으면 응답이 나가지 못한다.

**`Scheme`은 교체를 유발하는 속성이다.** `internal`로 만든 뒤 `internet-facing`으로 바꾸면 ALB가 삭제·재생성되고, [01](01-iac-and-cloudformation.md)에서 본 이름 충돌 연쇄가 시작된다. 이 템플릿이 ALB에 `Name`을 주지 않은 이유가 여기 있다.

### awsvpc 모드 — 태스크마다 자기 네트워크 카드를 준다

Fargate 태스크는 **`awsvpc` 네트워크 모드만** 쓸 수 있다. 선택이 아니라 강제다.

`awsvpc`는 태스크 하나마다 **탄력적 네트워크 인터페이스(ENI, Elastic Network Interface)**를 붙이고, 서브넷에서 사설 IP를 하나 할당한다. 그 결과 태스크가 EC2 인스턴스처럼 취급된다.

- 태스크가 자기 사설 IP를 갖는다 → **보안 그룹을 태스크에 직접 붙일 수 있다**
- 컨테이너 포트가 호스트 포트와 매핑되지 않는다 → 포트 충돌 개념이 사라진다
- 태스크가 서브넷의 IP를 하나 소비한다 → **서브넷 IP가 부족하면 태스크가 안 뜬다**

첫 번째가 가장 중요하다. `awsvpc`가 아니었다면 여러 태스크가 EC2 인스턴스의 IP를 공유하므로 보안 그룹도 공유하게 되고, "이 서비스만 DB에 접근"이라는 규칙을 표현할 수 없다. **`awsvpc` 덕분에 서비스 단위 네트워크 격리가 가능해진다.**

세 번째는 함정이다. `/24` 서브넷(256개, 그중 AWS가 5개 예약)에 태스크를 수백 개 띄우려면 IP가 마른다. 이때 오류는 `ENI 할당 실패`로 나타나고, 컨테이너나 이미지 문제로 오해하기 쉽다.

### ⭐ 보안 그룹 — 상태를 기억하는 화이트리스트

**보안 그룹(Security Group, SG)**은 ENI 앞에 붙는 방화벽이다. 세 가지 성질을 기억하면 나머지는 유도된다.

**성질 1 — 허용만 쓴다(화이트리스트).** 거부 규칙이 없다. 규칙에 없는 트래픽은 자동으로 막힌다. "이건 막고 저건 열고"를 순서대로 평가하는 전통적 방화벽(ACL)과 다르며, 순서 개념이 아예 없다. 여러 규칙 중 하나라도 맞으면 통과다.

**성질 2 — 상태를 기억한다(stateful).** 들어온 요청에 대한 응답은 이그레스 규칙 없이도 나간다. 반대도 같다. 나간 요청의 응답은 인그레스 규칙 없이 들어온다.

이게 왜 중요한가. HTTP 요청 하나를 생각해 보자. 클라이언트가 ALB의 443으로 접속하면, ALB의 응답은 클라이언트의 **임의 높은 포트**(예: 54321)로 돌아간다. 상태를 기억하지 않는 방화벽이라면 "1024~65535 아웃바운드 허용" 같은 규칙을 손으로 넣어야 하고, 그건 사실상 전부 열어두는 것과 다르지 않다. 보안 그룹은 연결을 추적하므로 **요청 방향만 적으면 된다.**

**성질 3 — 기본값이 비대칭이다.** 새 보안 그룹은 **인바운드 전부 거부, 아웃바운드 전부 허용**으로 시작한다.

```yaml
  AlbSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: !Sub orders-server ${Env} internet-facing ALB
      VpcId: !Ref VpcId
      # SecurityGroupEgress를 안 썼다 → 아웃바운드 전부 허용(0.0.0.0/0)이 유지된다
```

이 템플릿은 어느 보안 그룹에도 `SecurityGroupEgress`를 쓰지 않았다. 의도한 것이다 — 태스크가 DB·Secrets Manager·ECR·Microsoft Graph API로 나가야 하고, 각각을 열거하는 것보다 전부 허용이 단순하다. 다만 **`SecurityGroupEgress`를 한 번이라도 쓰면 기본 전체 허용이 사라지고 적은 것만 남는다.** 이그레스를 조이려다 하나를 빼먹으면 그 통신만 조용히 막힌다.

### 보안 그룹 참조 — IP가 아니라 "역할"로 규칙을 쓴다

보안 그룹 규칙의 출발지는 두 가지로 쓸 수 있다.

```yaml
# 방식 A — IP 범위로
CidrIp: 203.0.113.10/32

# 방식 B — 다른 보안 그룹으로
SourceSecurityGroupId: !Ref AlbSecurityGroup
```

방식 B가 클라우드에서 결정적으로 유용하다. "ALB에서 오는 트래픽만 허용"이라고 쓰면, **ALB의 IP가 무엇이든, 몇 개든, 언제 바뀌든 규칙이 계속 맞는다.** ALB는 부하에 따라 노드를 늘리며 IP가 바뀌고, 태스크는 배포마다 새 IP를 받는다. IP로 규칙을 쓴다면 이 변화를 따라다녀야 한다.

방식 B는 IP 목록을 유지하는 대신 **"어떤 역할의 리소스인가"로 규칙을 쓴다.** 보안 그룹이 방화벽 규칙이면서 동시에 그룹 라벨로 작동하는 것이다.

### SG 체인 — 계층마다 하나 앞만 허용한다

이 발상을 서비스 전체에 적용하면 사슬이 된다.

```
인터넷 — 사무실 IP · VPN IP · 내부 서비스 SG
   │ 443
   ▼
ALB SG          인그레스: 사무실 /32, VPN /32, 내부 SG
   │ 8080
   ▼
Service SG      인그레스: ALB SG만
   │ 3306
   ▼
DB SG           인그레스: Service SG만
```

각 계층은 **바로 앞 계층만** 허용한다. 이 구조에서 얻는 것:

- 사무실 IP에서 태스크의 8080에 직접 붙을 수 없다 (Service SG가 ALB SG만 허용)
- 태스크가 침해돼도 DB SG를 통과하는 다른 서비스는 늘지 않는다
- "누가 DB에 접근하나"를 DB SG 인그레스 목록만 보고 답할 수 있다

템플릿에서 이 사슬이 그대로 나타난다.

```yaml
  # 1단 — 외부에서 ALB로 (443)
  AlbIngressOffice443:
    Type: AWS::EC2::SecurityGroupIngress
    Properties:
      GroupId: !Ref AlbSecurityGroup
      FromPort: 443
      ToPort: 443
      CidrIp: !Ref OfficeCidr

  # 2단 — ALB에서 태스크로 (8080)
  ServiceSecurityGroup:
    Properties:
      SecurityGroupIngress:
        - FromPort: !Ref ContainerPort
          ToPort: !Ref ContainerPort
          SourceSecurityGroupId: !Ref AlbSecurityGroup

  # 3단 — 태스크에서 DB로 (3306)
  DbIngressFromService:
    Type: AWS::EC2::SecurityGroupIngress
    Properties:
      GroupId: !Ref DbSecurityGroupId
      FromPort: 3306
      ToPort: 3306
      SourceSecurityGroupId: !Ref ServiceSecurityGroup
```

`FromPort`/`ToPort`는 "출발 포트/도착 포트"가 아니라 **포트 범위의 시작과 끝**이다. 둘을 같은 값으로 두면 포트 하나만 여는 것이다. 이 이름은 오해를 자주 부른다.

### 인그레스를 규칙으로 뺀 이유 — 두 가지 쓰기 방식

보안 그룹 규칙은 두 방식으로 쓸 수 있다.

```yaml
# 방식 1 — 보안 그룹 안에 인라인으로
  ServiceSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      SecurityGroupIngress:
        - SourceSecurityGroupId: !Ref AlbSecurityGroup

# 방식 2 — 별도 리소스로
  AlbIngressOffice443:
    Type: AWS::EC2::SecurityGroupIngress
    Properties:
      GroupId: !Ref AlbSecurityGroup
      CidrIp: !Ref OfficeCidr
```

방식 2가 필요한 경우가 둘 있다.

**첫째, 순환 참조를 피할 때.** ALB SG가 Service SG를 참조하고 Service SG가 ALB SG를 참조하면 인라인 방식으로는 표현할 수 없다 — 서로를 먼저 만들어야 한다. 규칙을 밖으로 빼면 보안 그룹 둘을 먼저 만들고 규칙을 나중에 붙일 수 있다.

**둘째, 남의 보안 그룹에 규칙을 넣을 때.** `DbSecurityGroupId`는 이 스택이 만든 것이 아니라 파라미터로 받은 공용 보안 그룹이다. 인라인으로 쓸 자리가 없으므로 별도 리소스로만 가능하다.

조건부 규칙도 방식 2에서만 자연스럽다.

```yaml
  AlbIngressInternal443:
    Type: AWS::EC2::SecurityGroupIngress
    Condition: HasInternalSg      # 파라미터가 비어 있으면 이 규칙 자체가 없음
```

### ⭐ 함정 1 — 수동 규칙이 스택 삭제를 막는다

DB 인그레스를 콘솔이나 CLI로 넣었다고 하자.

```bash
# 이렇게 하면 안 되는 이유
aws ec2 authorize-security-group-ingress \
  --group-id sg-0db1111222233334 \
  --source-group sg-service-xxxx --port 3306 --protocol tcp
```

이 규칙은 Service SG를 **참조**한다. 그리고 CloudFormation은 이 규칙의 존재를 모른다. 나중에 스택을 지우려 하면:

1. CloudFormation이 Service SG를 삭제하려 한다
2. AWS가 거부한다 — "이 보안 그룹을 참조하는 규칙이 남아 있다" (`DependencyViolation`)
3. 스택 삭제가 멈춘다

멈춘 삭제를 풀려면 수동 규칙을 손으로 지워야 하는데, 그 규칙은 공용 보안 그룹에 있어서 다른 서비스에 영향이 없는지 확인이 필요하다. 결국 사람 시간이 든다.

**그래서 이 템플릿은 DB 인그레스를 CloudFormation 안에 넣었다.** 스택 생성 시 자동으로 부여되고, 삭제 시 Service SG보다 먼저 정리된다(의존 순서가 자동 계산되므로). 주석이 이 판단을 기록해 뒀다.

```yaml
  DbSecurityGroupId:
    Description: shared-dev-db-sg. ECS task의 MySQL(3306) 인그레스를 CFN이 관리
                 (수동 룰 대신 — 스택 삭제 시 svc-sg DependencyViolation 방지).
```

대가는 소유 경계의 흐려짐이다. 이 스택이 공용 DB 보안 그룹을 건드리게 되므로, DB 보안 그룹의 인그레스 목록을 볼 때 "이건 어느 스택이 넣은 거지?"가 생긴다. **두 문제 중 어느 쪽이 싼가의 선택이며, 여기서는 삭제가 막히는 쪽이 더 비싸다고 판단했다.**

### ⭐ 함정 2 — 이그레스 누락은 조용히 실패한다

보안 그룹 연결은 **양쪽이 필요하다**: 출발지의 이그레스 허용 + 목적지의 인그레스 허용. 기본값이 "아웃바운드 전부 허용"이므로 보통 이그레스를 신경 쓰지 않는데, **전용 보안 그룹을 새로 만들지 않고 이그레스가 제한된 공용 보안 그룹을 재사용하면** 문제가 된다.

실제로 있었던 일이다. 다른 서비스가 이그레스를 80·443과 특정 포트만 허용하는 공용 보안 그룹을 태스크에 붙였다. 결과:

- `/health` 엔드포인트는 200을 반환했다 (DB·Redis를 확인하지 않는 단순 응답이었으므로)
- 배포는 성공으로 판정됐다 (ALB 헬스체크가 통과했으므로)
- 비즈니스 API만 500을 뱉었다 (Redis 6379 아웃바운드가 막혀 있었으므로)

**헬스체크가 통과하는데 API가 실패하는 조합**이 이 함정의 서명이다. 원인이 애플리케이션 코드로 보이지만 네트워크다.

진단 순서: 태스크 안으로 들어가([04](04-ecs-fargate.md)의 ECS Exec) 목적지 포트로 TCP 연결을 시도해 본다. 연결이 안 되면 인그레스·이그레스 중 하나이고, 목적지 인그레스에 출발지 보안 그룹이 있는지 먼저 확인한 뒤 출발지 이그레스를 본다.

이 템플릿은 `orders-server-dev-svc-sg`라는 **전용 보안 그룹**을 만들고 `SecurityGroupEgress`를 쓰지 않아 이 함정을 피한다.

### 함정 3 — 보안 그룹 설명은 ASCII만 받는다

AWS에 등록되는 `Description`과 `GroupDescription`은 허용 문자가 제한적이다. 한글, `→` 같은 비ASCII 문자는 거부되고, **`>`도 거부된다** — ASCII이지만 허용 집합 밖이라서 `->`조차 실패한다.

```yaml
      Description: Internal caller SG to HTTPS 443      # ✅ "to"를 쓴다
    # Description: 내부 호출자 SG → HTTPS 443            # ❌ 한글·화살표
    # Description: Internal SG -> HTTPS 443             # ❌ '>' 거부
```

이 제약은 **런타임 제약이라 템플릿 문법 검사(`cfn-lint`)로는 잡히지 않는다.** 배포 중에 실패한다. 그래서 배포 전에 비허용 문자를 grep으로 훑는 습관이 필요하다.

주의할 것은 파라미터의 `Description`은 CloudFormation 소유라서 한글이 된다는 점이다. 템플릿에 한글 `Description`과 영문 `Description`이 섞여 있는 이유가 이것이다 — 앞은 CloudFormation에, 뒤는 AWS EC2에 전달된다.

```yaml
  OfficeCidr:
    Description: 사무실(사무실 WiFi) 공인 IP — ALB 443 영구 허용.   # CFN 소유 → 한글 OK

  AlbIngressOffice443:
    Properties:
      Description: Office 사무실 WiFi to HTTPS 443                # EC2로 전달 → ASCII만
```

---

## 필수 지식 (HOW)

### 이 템플릿의 보안 그룹 다섯 개 읽기

| 리소스 | 종류 | 무엇을 하는가 |
|---|---|---|
| `AlbSecurityGroup` | 보안 그룹 | ALB에 붙는 방화벽. 규칙은 밖에 있다 |
| `AlbIngressInternal443` | 인그레스 규칙 | 내부 서비스 보안 그룹 → ALB 443 (`HasInternalSg` 조건부) |
| `AlbIngressOffice443` | 인그레스 규칙 | 사무실 공인 IP → ALB 443 |
| `AlbIngressVpn443` | 인그레스 규칙 | VPN 출구(NAT) 공인 IP → ALB 443 |
| `ServiceSecurityGroup` | 보안 그룹 | 태스크에 붙는 방화벽. ALB 보안 그룹 → 8080 인라인 |
| `DbIngressFromService` | 인그레스 규칙 | Service 보안 그룹 → 공용 DB 보안 그룹 3306 |

사무실과 VPN의 공인 IP를 열어 둔 이유는 **DEV 환경을 개발자가 브라우저로 직접 검증하기 위해서다.** `internet-facing` ALB지만 보안 그룹 화이트리스트가 있으므로 실제로는 두 IP에서만 접근된다. 이 구조에서 "internet-facing인데 안전한가?"의 답은 **"보안 그룹이 앞에 있으니 안전하다"**이며, 반대로 **보안 그룹을 전부 열면 그 순간 인터넷에 노출된다.**

`PartnerCidrList` 파라미터는 빈 값으로 남아 있다. 외부 파트너가 호출하는 서비스라면 그쪽 고정 출구 IP를 여기 넣는 자리인데, orders-server에는 외부 호출자가 없어서 비어 있다. **쓰지 않는 구멍은 열어두지 않는다**는 원칙이 파라미터 기본값으로 표현된 것이다.

### private 서브넷에서 컨테이너 이미지는 어떻게 받아오는가

`AssignPublicIp: DISABLED` + private 서브넷 조합에서 자연스러운 의문이다. ECR에서 이미지를 당겨오는 것도 인터넷 통신인데?

세 가지 경로 중 하나여야 한다.

| 경로 | 조건 | 비용 |
|---|---|---|
| **NAT 게이트웨이** | private 서브넷의 라우팅 테이블이 NAT를 가리킴 | NAT 시간당 요금 + 처리 데이터 요금 |
| **VPC 인터페이스 엔드포인트** | ECR·S3·CloudWatch Logs 엔드포인트를 VPC에 만듦 | 엔드포인트당 시간당 요금 |
| public 서브넷 + `AssignPublicIp: ENABLED` | 태스크에 공인 IP 부여 | (권장하지 않음 — 태스크가 인터넷에 노출) |

이 템플릿은 첫 번째를 전제한다. `shared-dev` VPC의 private 서브넷에 이미 NAT 경로가 있고, 그래서 템플릿에 NAT 관련 리소스가 없다. **템플릿에 없는 것이 없어도 된다는 뜻이 아니라, 다른 곳에서 이미 만들어져 있다는 뜻이다.**

만약 NAT 경로가 없다면 증상은 이렇게 나온다: 태스크가 `PENDING`에서 오래 머물다 `STOPPED`가 되고, 중단 이유에 `CannotPullContainerError`가 찍힌다. 이미지 이름이나 권한을 의심하기 쉽지만 네트워크 경로다.

주의할 것은 **로그도 같은 문제를 겪는다**는 점이다. `awslogs` 드라이버는 CloudWatch Logs API를 호출하므로 경로가 필요하다. 경로가 없으면 태스크는 뜨지만 로그가 비어서, 디버깅해야 할 때 아무 정보가 없다.

---

### ⚠️ 암기 필수

- [ ] **서브넷이 public인지는 라우팅 테이블에 IGW 경로(`0.0.0.0/0 → igw`)가 있는지로 결정된다.** 이름과 무관하다. (이유: "public 서브넷에 뒀는데 왜 안 되죠"의 8할이 라우팅 확인 누락)
- [ ] **보안 그룹은 상태를 기억한다(stateful) — 요청 방향만 열면 응답은 자동으로 통과한다.** (이유: 응답용 이그레스 규칙을 넣으려다 필요 이상으로 넓게 여는 일을 막는다)
- [ ] **새 보안 그룹의 기본값은 인바운드 전부 거부 / 아웃바운드 전부 허용이다.** `SecurityGroupEgress`를 한 번 쓰면 기본 전체 허용이 사라진다. (이유: 이그레스를 조이는 순간 조용한 차단이 시작된다)
- [ ] **연결에는 출발지 이그레스 + 목적지 인그레스가 모두 필요하다.** (이유: 인그레스만 확인하고 "규칙 있는데 왜 안 돼"에서 멈추는 것을 막는다)
- [ ] **`/health`는 200인데 비즈니스 API만 500이면 이그레스 차단을 먼저 의심한다.** (이유: 헬스체크가 외부 의존을 확인하지 않으면 배포가 성공으로 판정되고 원인이 코드로 오인된다)
- [ ] **수동으로 넣은 보안 그룹 규칙이 스택 삭제를 막는다(`DependencyViolation`).** 규칙도 CloudFormation으로 관리한다. (이유: 삭제가 멈춘 스택을 푸는 데 사람 시간이 든다)
- [ ] **AWS에 등록되는 보안 그룹 `Description`은 ASCII만, `>`도 거부된다.** `->` 대신 `to`. (이유: `cfn-lint`로 안 잡히고 배포 중에 실패한다)
- [ ] **Fargate는 `awsvpc` 모드만 쓰며, 태스크마다 ENI와 사설 IP를 갖는다.** (이유: 태스크 단위로 보안 그룹을 붙일 수 있는 근거이자, 서브넷 IP 소진이 태스크 기동 실패로 나타나는 이유)

---

## 우리 프로젝트와의 연결

- ALB는 public 서브넷 2개, 태스크는 private 서브넷 2개 — 두 AZ에 걸쳐 배치
- `Scheme: internet-facing`이지만 실제 접근은 사무실·VPN 두 IP로 제한 (보안 그룹이 안전판)
- `AssignPublicIp: DISABLED` — 태스크는 공인 IP를 갖지 않고, ECR·로그·Graph API 통신은 NAT 경유
- 어느 보안 그룹에도 `SecurityGroupEgress`를 쓰지 않음 — 아웃바운드 전체 허용 유지가 의도된 선택
- `DbIngressFromService`로 공용 DB 보안 그룹 인그레스를 CloudFormation이 관리 — 스택 삭제 차단 회피
- `PartnerCidrList` 기본값 빈 문자열 — 외부 파트너 호출자가 없어 구멍을 열지 않음
- 보안 그룹 규칙 `Description`은 전부 영문 (`to` 사용), 파라미터 `Description`은 한글 허용

---

## 자가 진단

1. 서브넷 이름이 `subnet-public-a`인데 트래픽이 인터넷으로 못 나간다. 무엇을 확인하는가?
2. 태스크에서 밖으로 나가는 HTTPS 응답을 받기 위해 인그레스 규칙이 필요한가? 왜?
3. Service 보안 그룹 인그레스에 `SourceSecurityGroupId: !Ref AlbSecurityGroup`을 쓰는 것이 ALB의 IP 목록을 쓰는 것보다 나은 이유는?
4. `/health`는 200인데 `/api/vendors`가 500이다. 먼저 볼 곳은?
5. 스택 삭제가 Service 보안 그룹에서 멈췄다. 원인과 예방책은?
6. `Description: 내부 SG → 443`이 배포에서 실패한다. 왜이고, `cfn-lint`가 왜 못 잡았는가?

## 실습

**과제 02-01 — 보안 그룹 도달성 판정기** (`src/02-01-sg-reachability/index.ts`)

보안 그룹과 규칙 집합을 받아 "A에서 B의 포트 P로 트래픽이 갈 수 있는가"를 판정한다. 이그레스와 인그레스를 모두 확인하고, 상태 저장 성질 때문에 응답 방향은 검사하지 않는 것까지가 과제다.

무엇을 만들지는 `tests/02-01-sg-reachability/index.test.ts`가 정의한다. **먼저 읽고** `src/02-01-sg-reachability/index.ts`의 `🎯 TODO`를 채운다.

```bash
cd packages/ecs-fargate-iac
pnpm test 02-01
```

## 공식 문서

- [VPC와 서브넷](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html) — public/private 판정 기준
- [보안 그룹 규칙](https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html) — 상태 저장 동작과 기본값
- [Fargate 태스크 네트워킹](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html) — `awsvpc` 모드와 ENI, 이미지 pull 경로
- [NAT 게이트웨이](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) — 단방향 출구의 동작

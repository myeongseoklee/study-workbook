# 01. 코드형 인프라(IaC)와 CloudFormation — 원하는 결과를 적으면 차이를 메워주는 도구

## 학습 목표

이 문서를 다 읽으면 (1) 왜 인프라를 콘솔에서 클릭하지 않고 YAML로 적는지 설명할 수 있고, (2) 템플릿의 여섯 섹션과 참조 함수를 해석할 수 있고, (3) **템플릿을 고쳤을 때 리소스가 그대로 수정될지 삭제·재생성될지 판단**할 수 있다. 세 번째가 이 문서의 핵심이다 — 실무 사고의 대부분이 여기서 난다.

## 선수 지식

YAML 문법(들여쓰기, 리스트, 맵). AWS 계정과 리전이라는 개념. 그 외에는 없다.

---

## 핵심 원리 (WHY)

### 왜 클릭하지 않는가

AWS 콘솔에서 ECS 서비스 하나를 세우려면 대략 40~60번을 클릭한다. 보안 그룹을 만들고, 로드밸런서를 만들고, 타겟그룹을 붙이고, 롤을 만들고, 태스크 정의를 등록하고, 서비스를 만든다. 다 끝나면 동작한다. 문제는 그다음이다.

**문제 1 — 재현할 수 없다.** 두 달 뒤 TEST 환경을 같은 모양으로 만들어야 한다. 무엇을 어떤 순서로 어떤 값으로 클릭했는지 아무도 정확히 기억하지 못한다. 미묘하게 다른 환경이 생기고, "DEV에서는 되는데 TEST에서는 안 된다"가 시작된다.

**문제 2 — 지금 상태를 알 수 없다.** 여섯 달 뒤 누군가 "이 보안 그룹 443 인그레스는 왜 열려 있죠?"라고 묻는다. 콘솔에는 규칙만 있고 이유가 없다. 열어준 사람은 퇴사했다.

**문제 3 — 지울 때 남는다.** 검증이 끝나 정리하려는데, 무엇이 이 서비스에 속한 리소스인지 목록이 없다. 로드밸런서는 지웠는데 타겟그룹이 남고, 보안 그룹이 남고, 로그 그룹이 남아서 계속 과금된다.

세 문제 모두 **"인프라의 현재 모습이 사람의 기억에만 있다"**는 하나의 원인에서 나온다. 코드형 인프라(Infrastructure as Code, IaC)는 그 모습을 파일로 옮긴다. 파일이니까 git에 들어가고, 리뷰를 받고, 주석으로 이유를 남기고, 복사해서 다른 환경을 만들고, 지울 때 목록이 된다.

### 선언형이라는 발상 — 절차가 아니라 결과를 적는다

IaC 도구는 두 갈래다.

**명령형(imperative)**은 절차를 적는다. 셸 스크립트가 그렇다.

```bash
aws elbv2 create-load-balancer --name admin-alb ...
aws elbv2 create-target-group --name admin-tg ...
aws elbv2 create-listener --load-balancer-arn $ALB_ARN ...
```

이 스크립트는 **한 번만** 안전하게 돌아간다. 두 번째 실행은 "이미 있다"는 오류를 낸다. 중간에 실패하면 어디까지 만들어졌는지 직접 확인하고 그 지점부터 이어 붙여야 한다. 결국 "이미 있으면 건너뛰기" 분기를 손으로 쓰게 되고, 스크립트가 상태 관리 코드로 부풀어 오른다.

**선언형(declarative)**은 결과를 적는다. CloudFormation이 그렇다.

```yaml
Resources:
  Alb:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Scheme: internet-facing
      Type: application
```

이 파일은 "ALB가 이런 모습으로 존재해야 한다"만 말한다. 어떻게 만들지, 이미 있으면 어떻게 할지는 CloudFormation이 정한다. 그래서 **같은 파일을 몇 번 적용해도 결과가 같다**(멱등성, idempotence). CloudFormation은 매번 이렇게 동작한다.

```
[내가 원하는 상태: 템플릿]  ─┐
                            ├─→ 차이 계산 → 차이만큼 API 호출
[현재 실제 상태: 스택 기록]  ─┘
```

이 "차이 계산"이 선언형의 전부다. 처음 적용하면 차이가 곧 전체라서 다 만들고, 두 번째는 차이가 없어서 아무것도 하지 않고, 값 하나를 고치면 그 하나만 바꾼다. **당신이 절차를 쓰지 않는 대신, 차이를 어떻게 메울지에 대한 판단을 도구에 넘긴 것이다.** 이 위임이 뒤에서 다룰 "교체(replacement)" 함정의 뿌리다 — 도구가 당신이 예상하지 않은 방식으로 차이를 메울 수 있다.

### 스택 — 리소스를 함께 살고 함께 죽게 묶는 단위

CloudFormation의 배포 단위는 **스택(stack)**이다. 스택은 템플릿 한 장을 적용한 결과로 생긴 리소스들의 묶음이며, 다음을 기억한다.

- 어떤 리소스가 이 스택에 속하는지 (논리적 이름 ↔ 실제 리소스 ID 대응표)
- 마지막으로 적용된 템플릿과 파라미터 값
- 지금까지의 이벤트 이력

이 기억 때문에 세 가지가 가능해진다.

1. **일괄 삭제** — 스택을 지우면 속한 리소스가 의존 관계의 역순으로 지워진다. "무엇을 지워야 하나" 목록을 사람이 만들 필요가 없다.
2. **롤백** — 업데이트 중 하나가 실패하면 이전 상태로 되돌린다. 절반만 반영된 인프라가 남지 않는다.
3. **차이 계산** — 위에서 본 그것. 기억이 없으면 "현재 상태"를 알 수 없어 차이를 낼 수 없다.

한 서비스 = 한 스택이 기본이다. 학습 대상 템플릿도 스택 두 개로 나뉘어 있는데, 이 분리에는 이유가 있다. `orders-server-dev` 스택(서비스 본체)은 이미지 태그가 바뀔 때마다 자주 업데이트되지만, `orders-server-dev-deploy-role` 스택(배포 권한)은 거의 바뀌지 않는다. **수명 주기가 다른 것을 한 스택에 넣으면, 자주 바뀌는 쪽을 업데이트할 때마다 안 바뀌는 쪽까지 위험에 노출된다.** 게다가 IAM 롤 생성은 `CAPABILITY_NAMED_IAM`이라는 별도 승인 플래그를 요구해서 배포 명령 자체가 달라진다.

---

## 필수 지식 (HOW)

### 템플릿의 여섯 섹션

```yaml
AWSTemplateFormatVersion: "2010-09-09"   # 템플릿 문법 버전. 값이 하나뿐이라 사실상 상수
Description: orders-server ECS Fargate ... # 스택 목록에 보이는 한 줄 설명

Parameters:    # 배포할 때 넣는 입력값
Conditions:    # 참/거짓 이름 — 리소스를 만들지 말지 결정
Resources:     # ⭐ 유일한 필수 섹션. 만들 것들
Outputs:       # 스택이 밖으로 내놓는 값
```

`Resources`만 필수다. 나머지는 없어도 배포된다. `AWSTemplateFormatVersion`의 값 `2010-09-09`는 날짜처럼 보이지만 버전 식별자이고, 지금까지 이 값 하나뿐이다 — 그래서 의미를 따질 필요가 없다.

### Parameters — 같은 템플릿으로 여러 환경을 만드는 장치

파라미터는 템플릿에 구멍을 뚫어 배포 시점에 값을 채우게 한다. 학습 대상 템플릿의 `Env` 파라미터가 전형적이다.

```yaml
Parameters:
  Env:
    Type: String
    Default: dev
    AllowedValues: [dev]
    Description: DEV only for now.
```

`AllowedValues`는 검증이다. `Env=prod`로 배포를 시도하면 CloudFormation이 **리소스를 만들기 전에** 거부한다. 지금 이 템플릿은 dev만 허용하므로, 실수로 prod에 배포되는 사고가 문법 수준에서 막힌다.

**타입이 검증을 대신한다.** 파라미터 타입은 단순 문자열 말고도 AWS 리소스 타입을 쓸 수 있다.

| 타입 | 의미 | 얻는 것 |
|---|---|---|
| `String` / `Number` | 문자열 / 숫자 | — |
| `CommaDelimitedList` | 쉼표로 구분된 문자열 목록 | 문자열을 리스트로 쪼개 줌 |
| `AWS::EC2::VPC::Id` | 실존하는 VPC ID | **존재 검증** + 콘솔에서 드롭다운 |
| `List<AWS::EC2::Subnet::Id>` | 실존하는 서브넷 ID 목록 | 같음 |

`Type: AWS::EC2::VPC::Id`로 적으면, 오타 난 VPC ID나 이미 지워진 VPC ID로는 배포가 시작조차 되지 않는다. `Type: String`으로 적었다면 오타는 리소스를 만드는 중간에 발견되고, 그때는 이미 절반이 만들어진 뒤라 롤백을 겪는다. **타입을 좁히는 것은 실패를 앞으로 당기는 일이다.**

`NoEcho: true`는 값을 가린다.

```yaml
  AccountDbPassword:
    Type: String
    NoEcho: true
```

이 값은 콘솔·`describe-stacks` 응답·스택 이벤트에서 `****`로 표시된다. **주의: 값이 암호화되는 것이 아니라 CloudFormation의 표시면에서만 가려진다.** 이 값이 태스크 정의의 환경변수로 흘러 들어가면 태스크 정의를 읽을 수 있는 사람은 그 값을 본다. `NoEcho`는 시크릿 관리가 아니라 시크릿 관리의 최소선이다 — 이 구분은 [06 시크릿](06-secrets.md)에서 다시 다룬다.

### Conditions — 리소스를 만들지 말지 결정하는 이름

`Conditions`는 참/거짓 식에 이름을 붙인다.

```yaml
Conditions:
  HasWaf: !Not [!Equals [!Ref WafWebAclArn, ""]]
```

`HasWaf`는 "`WafWebAclArn` 파라미터가 빈 문자열이 아니다"라는 뜻이다. 이 이름을 리소스에 붙이면 조건이 참일 때만 만들어진다.

```yaml
  WafAssociation:
    Type: AWS::WAFv2::WebACLAssociation
    Condition: HasWaf
```

DEV에서는 `WafWebAclArn`이 빈 문자열이라 이 리소스가 아예 생기지 않고, PROD에서 ARN을 넘기면 생긴다. **한 템플릿으로 환경별 구성 차이를 표현하는 방법이 이것이다.** 대안은 환경마다 템플릿을 복사하는 것인데, 그러면 공통 부분을 고칠 때 여러 파일을 동시에 고쳐야 하고 하나를 빼먹는다.

조건은 속성값 안에서도 쓸 수 있고, 이때 `AWS::NoValue`가 짝을 이룬다.

```yaml
      AlarmActions:
        Fn::If:
          - HasAlarmSns
          - - Ref: AlarmSnsTopicArn    # 참이면 [SNS 토픽 ARN] 리스트
          - Ref: AWS::NoValue          # 거짓이면 이 속성 자체를 없앤 것으로 처리
```

`AWS::NoValue`는 "값이 없음"이 아니라 **"이 속성을 쓰지 않은 것으로 하라"**는 지시다. 빈 리스트 `[]`를 넣는 것과 다르다 — 어떤 리소스는 빈 리스트를 오류로 보고, 어떤 속성은 기본값이 있어서 빈 리스트와 미지정의 결과가 다르다.

`Fn::If`만 `!If` 축약형 대신 긴 형태로 쓰인 것이 눈에 걸릴 수 있다. `!If`와 `Fn::If`는 완전히 같지만, YAML에서 축약 태그(`!`)는 중첩할 수 없다 — `!If [cond, !Ref X, ...]`처럼 태그 안에 태그를 넣으면 파서가 거부한다. 그래서 중첩이 필요하면 긴 형태를 쓴다.

### 참조 함수 — 리소스를 서로 연결하는 네 가지 방법

값을 하드코딩하지 않고 다른 곳에서 가져오는 함수들이다. 이 네 개면 학습 대상 템플릿의 모든 참조를 읽을 수 있다.

**`!Ref` — 파라미터 값 또는 리소스의 "대표값"**

```yaml
VpcId: !Ref VpcId                    # 파라미터 → 그 값
GroupId: !Ref AlbSecurityGroup       # 리소스 → 그 리소스의 대표값
```

파라미터에 쓰면 값을 그대로 준다. 리소스에 쓰면 **리소스 타입마다 다른 값**을 준다. 이게 초보자가 가장 많이 걸리는 지점이다.

| 리소스 | `!Ref`가 주는 것 |
|---|---|
| `AWS::EC2::SecurityGroup` | 보안 그룹 ID (`sg-0abc…`) |
| `AWS::ECS::Cluster` | 클러스터 **이름** (ARN이 아니다) |
| `AWS::ElasticLoadBalancingV2::TargetGroup` | 타겟그룹 **ARN** |
| `AWS::SecretsManager::Secret` | 시크릿 **ARN** |
| `AWS::IAM::Role` | 롤 **이름** (ARN이 아니다) |

규칙이 없어 보이는 이유는 실제로 규칙이 없기 때문이다. 각 리소스 타입 문서의 "Return values"에 적혀 있고, 외울 대상이 아니라 **찾아볼 대상**이다. 다만 자주 쓰는 것에는 패턴이 있다 — 이름을 요구하는 API가 많은 리소스(클러스터·롤)는 이름을, ARN으로만 지목되는 리소스(타겟그룹·시크릿)는 ARN을 준다.

**`!GetAtt` — 리소스의 특정 속성**

`!Ref`가 주지 않는 값이 필요할 때 쓴다.

```yaml
ExecutionRoleArn: !GetAtt TaskExecutionRole.Arn   # 롤의 ARN (Ref는 이름을 준다)
Value: !GetAtt Alb.DNSName                        # ALB의 DNS 이름
Value: !GetAtt TargetGroup.TargetGroupFullName    # 알람 디멘션용 전체 이름
```

세 번째 예시가 특히 흥미롭다. CloudWatch 알람이 "어느 타겟그룹의 지표인가"를 지목할 때 ARN이 아니라 `targetgroup/orders-server-dev-tg/1234abcd` 형태의 문자열을 요구한다. ARN에서 이 부분을 문자열 조작으로 잘라낼 수도 있지만, `TargetGroupFullName`이라는 속성으로 제공된다. **필요한 형태가 이미 속성으로 있는지 먼저 확인하는 습관**이 문자열 조작을 줄인다.

**`!Sub` — 문자열 안에 값 끼워넣기**

```yaml
LogGroupName: !Sub /ecs/orders-server-${Env}
Image: !Sub ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/orders-server:${ImageTag}
```

`${}` 안에는 파라미터 이름, 리소스의 `!Ref` 값, 또는 의사 파라미터가 들어간다. **의사 파라미터(pseudo parameter)**는 CloudFormation이 자동으로 채워주는 값이다.

| 의사 파라미터 | 값 |
|---|---|
| `AWS::AccountId` | 지금 배포 중인 계정 ID (12자리) |
| `AWS::Region` | 지금 배포 중인 리전 (`ap-northeast-2`) |
| `AWS::StackName` | 이 스택의 이름 |
| `AWS::NoValue` | (위에서 본) 속성 제거 표식 |

두 번째 예시의 ECR 이미지 URI는 의사 파라미터의 가치를 잘 보여준다. `111122223333.dkr.ecr.ap-northeast-2.amazonaws.com/...`으로 하드코딩하면 다른 계정·리전으로 이 템플릿을 옮길 때 반드시 고쳐야 하고, 고치는 것을 잊으면 **다른 계정의 이미지를 당겨오려 하다 권한 오류로 실패한다.** 의사 파라미터를 쓰면 템플릿이 계정·리전에 대해 이식 가능해진다.

`!GetAtt`를 `!Sub` 안에서 쓰려면 점 표기를 그대로 넣는다: `!Sub "${Alb.DNSName}"`.

### 의존 순서 — 대부분 자동, 때로는 손으로

CloudFormation은 `!Ref`와 `!GetAtt`를 보고 **의존 그래프를 세워 순서를 정한다.** `ServiceSecurityGroup`이 `!Ref AlbSecurityGroup`을 쓰면, ALB 보안 그룹이 먼저 만들어진다. 리소스를 파일에 적은 순서는 아무 의미가 없다 — 알파벳 순으로 섞어 놔도 결과가 같다.

이 자동 판정이 놓치는 경우가 있고, 그때 `DependsOn`을 쓴다.

```yaml
  Service:
    Type: AWS::ECS::Service
    DependsOn:
      - AlbListener
```

서비스 정의는 타겟그룹을 참조하지만 **리스너는 참조하지 않는다.** 그런데 리스너가 없는 상태에서 서비스를 만들면, ECS가 타겟그룹에 태스크를 등록해도 트래픽을 받을 경로가 없어 헬스체크가 실패하고 배포가 무너진다. 참조 관계가 없으니 CloudFormation은 이 순서를 알 수 없고, 사람이 알려줘야 한다.

**`DependsOn`이 필요하다는 것은 "코드에 드러나지 않는 실제 의존이 있다"는 신호다.** 이런 자리에는 주석을 남길 값어치가 있다.

### ⭐ 업데이트의 세 가지 결과 — 이 절이 이 문서의 핵심

템플릿의 속성값을 바꿔 스택을 업데이트하면, CloudFormation은 속성마다 정해진 세 가지 중 하나를 한다.

| 결과 | 무슨 일이 일어나는가 | 예 |
|---|---|---|
| **중단 없음** (No interruption) | 리소스가 그대로 유지되며 값만 바뀐다 | 로그 그룹의 `RetentionInDays`, 서비스의 `DesiredCount` |
| **일부 중단** (Some interruption) | 리소스는 유지되지만 잠시 멈춘다 | (EC2 인스턴스 타입 변경 등) |
| **교체** (Replacement) | **새 리소스를 만들고 옛것을 삭제한다. 물리적 ID가 바뀐다** | ALB의 `Scheme`, 보안 그룹의 `GroupDescription`, 타겟그룹의 `Name` |

교체가 위험한 이유는 삭제가 일어나기 때문이 아니다. **이름이 충돌하기 때문이다.**

교체의 순서는 "새것 생성 → 참조 갱신 → 옛것 삭제"다. 그러니 새것을 만드는 시점에 옛것이 아직 살아 있다. 이때 템플릿이 이름을 고정해 뒀다면:

```yaml
  Alb:
    Properties:
      Name: orders-server-dev-alb      # ← 고정 이름
      Scheme: internal                # ← 이걸 internet-facing으로 바꾸면
```

새 ALB를 `orders-server-dev-alb`라는 이름으로 만들려는데 그 이름은 옛 ALB가 쓰고 있다. `DuplicateLoadBalancerName` 오류가 나고, 업데이트가 실패하고, 롤백이 시작된다. 그리고 롤백 도중에 또 다른 리소스가 같은 문제를 일으켜 롤백마저 실패하는 연쇄가 생긴다.

**해법은 이름을 CloudFormation에 맡기는 것이다.** 학습 대상 템플릿의 주석이 정확히 이 판단을 기록해 뒀다.

```yaml
  Alb:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    # Name 미지정(CFN 자동 명명) — internal<->internet-facing 전환 함정 회피.

  AlbSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    # GroupName 미지정(자동 명명): GroupDescription은 EC2 immutable이라
    # 향후 변경 시 replacement를 유발한다.
```

이름을 지정하지 않으면 CloudFormation이 `orders-server-dev-Alb-1A2B3C4D` 같은 이름을 붙인다. 사람이 읽기에는 나쁘지만, **교체가 언제든 안전해진다.** 사람이 알아볼 필요는 `Name` 태그로 채운다.

```yaml
      Tags:
        - Key: Name
          Value: !Sub orders-server-${Env}-alb-sg
```

태그는 식별자가 아니라 라벨이라 중복이 허용되고, 콘솔의 이름 열에 표시되며, 바꿔도 교체가 일어나지 않는다. **"고정 이름은 편의, 자동 이름은 안전"이며, 교체 가능성이 있는 리소스에서는 안전을 택한다.**

여기서 파생되는 규율이 하나 더 있다. `GroupDescription`처럼 **변경 불가(immutable) 속성**은 스택을 만든 뒤에 템플릿에서 고치면, 다음 배포가 그 변경을 교체로 감지한다. 배포할 의도가 전혀 없던 오타 수정이 실서비스 리소스의 교체를 부른다. 그래서 **변경 불가 속성을 고치기 전에는 실제 리소스의 현재 값과 템플릿을 비교**해야 한다.

### DeletionPolicy와 UpdateReplacePolicy — 스택보다 오래 사는 리소스

기본 동작은 명확하다. **`DeletionPolicy`를 지정하지 않으면 스택 삭제 시 리소스도 삭제된다.**

일부 리소스는 이 기본값이 곤란하다. 학습 대상 템플릿의 시크릿이 그렇다.

```yaml
  GraphRefreshTokenSecret:
    Type: AWS::SecretsManager::Secret
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
```

`Retain`은 "스택에서 제외하되 실물은 남긴다"는 뜻이다. 이 시크릿에 담긴 값은 담당자가 브라우저 로그인을 거쳐 발급받은 토큰이라, 스택을 지웠다가 다시 만들 때 자동으로 복원할 방법이 없다. 그래서 남긴다.

두 속성의 차이:

| 속성 | 언제 적용되는가 |
|---|---|
| `DeletionPolicy` | 스택이 삭제될 때, 또는 템플릿에서 리소스를 뺐을 때 |
| `UpdateReplacePolicy` | 속성 변경으로 **교체**가 일어나 옛 리소스가 버려질 때 |

둘은 서로를 대신하지 못한다. `DeletionPolicy: Retain`만 걸어 두고 교체가 일어나면 옛 리소스는 삭제된다 — 그래서 둘을 함께 쓴다.

**`Retain`은 대가를 부른다.** 시크릿 이름이 `orders-server/dev/graph-refresh-token`으로 고정돼 있으므로, 스택을 지운 뒤 같은 템플릿으로 다시 만들면 **남아 있는 시크릿과 이름이 충돌해 스택 생성이 실패한다.** 재생성 전에 남은 것을 확인하고 살릴지 정리할지 먼저 정해야 한다.

```bash
aws secretsmanager list-secrets \
  --filters Key=name,Values="orders-server/dev/" \
  --query 'SecretList[].Name'
```

Secrets Manager에는 함정이 하나 더 있다. CloudFormation이 시크릿을 삭제할 때의 기본 동작은 `ForceDeleteWithoutRecovery`, 즉 **복구 대기 기간 없는 즉시 삭제**다. Secrets Manager를 콘솔이나 CLI로 지우면 기본 7~30일의 복구 기간이 생기는데, CloudFormation 경로에는 그 안전망이 없다. `Retain`을 붙이는 이유가 하나 더 늘어난 셈이다.

### Outputs와 Export — 스택 사이로 값 넘기기

`Outputs`는 스택이 만든 값을 밖으로 내놓는다.

```yaml
Outputs:
  AlbDnsName:
    Value: !GetAtt Alb.DNSName
    Export:
      Name: !Sub orders-server-${Env}-alb-dns
```

`Value`만 있으면 조회용이다. 배포 파이프라인이 `describe-stacks`로 읽어 검증에 쓰거나, 사람이 콘솔에서 확인한다.

`Export`를 붙이면 **다른 스택이 `!ImportValue`로 가져다 쓸 수 있다.** 이때 두 가지가 따라온다.

1. **export 이름은 리전 안에서 유일해야 한다.** 그래서 `${Env}`가 이름에 들어간다 — 안 넣으면 dev와 test 스택이 같은 export 이름을 다투다 나중 것이 실패한다.
2. **다른 스택이 import하고 있는 export는 삭제할 수 없다.** 의존이 생기고, 그 의존이 스택 삭제 순서를 강제한다.

두 번째는 양날이다. 실수로 하위 스택이 쓰는 값을 없애는 일을 막아주지만, 정리하려 할 때 **import하는 스택을 먼저 지워야 하는** 순서 제약이 된다. 학습 대상 템플릿은 export를 8개 내놓지만 아직 import하는 스택이 없다 — 나중에 쓸 수 있게 열어 둔 상태다.

### 드리프트 — 템플릿과 실물이 어긋나는 것

누군가 콘솔에서 보안 그룹 규칙을 하나 추가했다고 하자. 실제 리소스는 바뀌었지만 템플릿과 스택 기록은 그대로다. 이 어긋남을 **드리프트(drift)**라 하고, CloudFormation은 이를 감지하는 기능을 제공한다(`detect-stack-drift`).

드리프트가 위험한 이유는 값이 다르다는 것 자체가 아니라 **다음 배포가 그 차이를 되돌리려 한다**는 점이다. 수동으로 추가한 규칙은 다음 스택 업데이트에서 조용히 사라질 수 있고, 사라진 뒤에야 "왜 갑자기 DB 접속이 안 되죠?"가 시작된다.

그래서 학습 대상 템플릿은 원래 수동으로 관리했던 DB 인그레스 규칙까지 CloudFormation 안으로 끌어왔다.

```yaml
  DbIngressFromService:
    Type: AWS::EC2::SecurityGroupIngress
    Properties:
      GroupId: !Ref DbSecurityGroupId          # 공용 DB 보안 그룹 (다른 스택 소유)
      SourceSecurityGroupId: !Ref ServiceSecurityGroup
```

**한 리소스는 한 곳에서만 관리한다** — 이 원칙이 드리프트 대응의 전부다. 다만 여기엔 소유 경계 문제가 따라온다. `DbSecurityGroupId`는 여러 서비스가 공유하는 보안 그룹이고, 이 스택이 그 안에 규칙을 넣게 된다. 이 선택의 근거(수동 규칙이 스택 삭제를 막는 문제)는 [02 네트워크](02-network-vpc-sg.md)에서 다룬다.

---

### ⚠️ 암기 필수

- [ ] **`DeletionPolicy`를 지정하지 않으면 스택 삭제 시 리소스도 삭제된다.** (이유: 기본값을 착각하면 지우면 안 되는 것을 지운다. RDS 클러스터·`DBClusterIdentifier` 없는 DB 인스턴스만 예외로 기본 `Snapshot`)
- [ ] **`Retain`으로 남긴 리소스가 고정 이름을 쓰면 스택 재생성이 이름 충돌로 실패한다.** (이유: 재생성 직전에 반드시 확인해야 하는 항목. 실패 시점이 스택 생성 초반이라 원인이 안 보인다)
- [ ] **교체(replacement)를 유발할 수 있는 리소스에는 고정 `Name`을 주지 않는다.** (이유: 교체는 "새것 생성 → 옛것 삭제" 순서라 이름이 겹친다. 식별은 `Name` 태그로)
- [ ] **`GroupDescription`은 변경 불가 속성이라 수정하면 보안 그룹이 교체된다.** (이유: 오타 수정 같은 무해해 보이는 변경이 실서비스 리소스 교체를 부른다)
- [ ] **`NoEcho: true`는 CloudFormation 표시면에서만 가린다 — 암호화가 아니다.** (이유: 이걸 시크릿 관리로 착각하면 값이 태스크 정의 평문으로 새는 것을 놓친다)
- [ ] **`!Ref`가 리소스에 반환하는 값은 타입마다 다르다.** 롤·클러스터는 **이름**, 타겟그룹·시크릿은 **ARN**. (이유: ARN이 필요한 자리에 이름이 들어가면 배포는 되고 런타임에 깨진다)

---

## 우리 프로젝트와의 연결

학습 대상 템플릿에서 이 문서의 내용이 드러나는 자리:

- `Env` 파라미터의 `AllowedValues: [dev]` — 아직 dev만 열린 상태를 문법으로 못박음
- `HasAlarmSns` / `HasInternalSg` / `HasWaf` 세 조건 — 파라미터가 빈 문자열이면 해당 리소스를 만들지 않음
- ALB와 ALB 보안 그룹의 **고정 이름 없음** + `Name` 태그 — 과거 다른 서비스에서 `internal → internet-facing` 전환 시 다섯 번 롤백을 겪은 뒤 얻은 규율
- 시크릿의 `DeletionPolicy: Retain` + `UpdateReplacePolicy: Retain` — 토큰 재발급에 사람의 재로그인이 필요하므로
- `Service`의 `DependsOn: [AlbListener]` — 참조 관계로는 드러나지 않는 실제 의존
- `DbIngressFromService` — 원래 수동으로 넣던 규칙을 스택 안으로 끌어와 드리프트와 삭제 차단을 동시에 해결
- Outputs 8종 전부 `Export` — 아직 소비자는 없고, 배포 파이프라인이 `describe-stacks`로 읽는 데 쓰인다

---

## 자가 진단

막히면 해당 절로 돌아간다.

1. 같은 템플릿을 세 번 배포하면 리소스가 세 벌 생기는가? 왜?
2. `!Ref MyRole`과 `!GetAtt MyRole.Arn`은 무엇이 다른가? 태스크 정의의 `ExecutionRoleArn`에 `!Ref`를 쓰면?
3. 보안 그룹의 `GroupDescription` 오타를 고치고 배포하면 어떤 일이 일어나는가?
4. `DeletionPolicy: Retain`이 붙은 시크릿이 있는 스택을 지우고 같은 템플릿으로 다시 만들면?
5. `Service`에 `DependsOn: AlbListener`가 없으면 무엇이 깨지는가?
6. `AWS::NoValue`와 빈 리스트 `[]`는 왜 다른가?

## 실습

**과제 1-1 — CFN 의존성 순서 계산기** (`src/1-1-cfn-dep-order.ts`)

`!Ref`·`!GetAtt`·`DependsOn`으로 표현된 의존을 받아 CloudFormation이 리소스를 만드는 순서를 계산한다. 순환 의존을 감지하는 것까지가 과제다.

무엇을 만들지는 `tests/1-1-cfn-dep-order.test.ts`가 정의한다. **먼저 읽고** `src/1-1-cfn-dep-order.ts`의 `🎯 TODO`를 채운다.

```bash
cd packages/ecs-fargate-iac
pnpm test 1-1
```

## 공식 문서

- [DeletionPolicy 속성](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-deletionpolicy.html) — 네 가지 옵션과 리소스별 기본값 예외
- [UpdateReplacePolicy 속성](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatereplacepolicy.html) — 교체 시 옛 리소스 처리
- [내장 함수 레퍼런스](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference.html) — `Ref`·`GetAtt`·`Sub`·`If` 전체 목록
- [의사 파라미터 레퍼런스](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html) — `AWS::AccountId` 등
- [스택 드리프트 감지](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-stack-drift.html) — 감지 방법과 지원 리소스

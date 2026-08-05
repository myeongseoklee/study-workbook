# 05. IAM 롤 — 누가 맡을 수 있고, 맡으면 무엇을 할 수 있는가

## 학습 목표

이 문서를 다 읽으면 (1) 롤이 왜 문서 두 개(신뢰 정책 + 권한 정책)로 이뤄지는지 설명할 수 있고, (2) **실행 롤과 태스크 롤의 경계를 판정**할 수 있고, (3) `PassRole`이 없으면 무엇이 실패하는지, 그리고 일부 액션이 왜 `Resource: "*"`를 피할 수 없는지 말할 수 있다.

## 선수 지식

[04](04-ecs-fargate.md)의 태스크 정의와 컨테이너 기동 순서. JSON 문법.

---

## 핵심 원리 (WHY)

### 왜 키를 컨테이너에 넣지 않는가

컨테이너 안의 코드가 Secrets Manager에서 값을 읽어야 한다. 가장 단순한 방법은 액세스 키와 시크릿 키를 환경변수로 넣는 것이다. 이 방법이 만드는 문제는 셋이다.

1. **키가 만료되지 않는다.** 유출되면 무기한 유효하고, 누출을 알아채기 전까지 계속 쓸 수 있다
2. **회전이 노동이다.** 90일마다 키를 바꾸려면 키를 쓰는 모든 곳을 찾아 갱신해야 한다
3. **어디에 복사됐는지 알 수 없다.** 환경변수는 로그·에러 리포트·`docker inspect` 출력으로 새어 나간다

**IAM 롤**은 이 문제를 "장기 키를 없애고, 필요할 때 짧게 사는 임시 자격증명을 발급한다"로 해결한다.

롤은 사용자가 아니다. **누구도 롤에 "로그인"하지 않는다.** 롤은 권한 묶음이고, 자격을 갖춘 주체가 그 롤을 **맡아(assume)** 임시 자격증명을 받는다. 임시 자격증명은 몇 시간 뒤 만료되고, 만료되면 자동으로 갱신된다.

ECS 태스크에서는 이 갱신이 완전히 투명하다. AWS SDK가 태스크 메타데이터 엔드포인트에서 자격증명을 받아오고 만료 전에 갱신한다. **애플리케이션 코드에 키가 없고, 갱신 코드도 없다.**

### 롤은 문서 두 개로 이뤄진다

여기가 IAM에서 가장 자주 혼동되는 지점이다. 롤에는 성격이 완전히 다른 두 문서가 붙는다.

```
                  ┌─────────────────────────────────────┐
누가 맡을 수 있나 │ AssumeRolePolicyDocument (신뢰 정책) │
                  ├─────────────────────────────────────┤
맡으면 뭘 하나    │ Policies / ManagedPolicyArns          │
                  └─────────────────────────────────────┘
```

**신뢰 정책(trust policy)**은 문(door)이다. 누가 이 롤을 맡을 수 있는지 정한다.

```yaml
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com    # ← ECS 태스크 서비스만
            Action: sts:AssumeRole
```

`Principal`이 "누구"를 지목한다. `ecs-tasks.amazonaws.com`은 ECS의 태스크 실행 주체를 가리키는 서비스 이름이며, **이 롤은 ECS 태스크만 맡을 수 있다.** 당신이 CLI로 이 롤을 맡으려 하면 거부된다.

**권한 정책(permission policy)**은 방 안에서 할 수 있는 일이다.

```yaml
      Policies:
        - PolicyName: SecretsInjection
          PolicyDocument:
            Statement:
              - Effect: Allow
                Action: secretsmanager:GetSecretValue
                Resource: !Ref GraphRefreshTokenSecret
```

**두 문서를 헷갈리면 진단이 어긋난다.** "권한을 줬는데 AccessDenied가 난다"의 상당수는 권한 정책이 아니라 신뢰 정책 문제다 — 맡을 자격이 없으면 권한 목록은 볼 기회조차 없다. 오류 메시지도 다르다: 신뢰 정책 거부는 `AssumeRole` 단계에서, 권한 부족은 실제 API 호출 단계에서 난다.

`Version: "2012-10-17"`은 정책 문법 버전이며 [01](01-iac-and-cloudformation.md)의 `AWSTemplateFormatVersion`처럼 사실상 상수다. 값을 바꿀 이유가 없다.

### 정책 문장의 네 요소

```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue"],
  "Resource": "arn:aws:secretsmanager:ap-northeast-2:111122223333:secret:orders-server/dev/graph-refresh-token-AbCdEf",
  "Condition": { "StringEquals": { "iam:PassedToService": "ecs-tasks.amazonaws.com" } }
}
```

| 요소 | 답하는 질문 | 비고 |
|---|---|---|
| `Effect` | 허용인가 거부인가 | `Allow` / `Deny` |
| `Action` | 어떤 API 호출인가 | `서비스:작업` 형식. `s3:*` 같은 와일드카드 가능 |
| `Resource` | 어떤 대상에 대해 | ARN. 일부 액션은 `"*"`만 가능 |
| `Condition` | 어떤 상황에서만 | 없으면 항상 |

평가 규칙은 단순하다: **명시적 `Deny`가 하나라도 있으면 거부. 없고 `Allow`가 하나라도 있으면 허용. 둘 다 없으면 거부(암묵적 거부).** 그래서 "아무 정책도 없는 롤"은 아무것도 못 한다.

**ARN(Amazon Resource Name)**은 AWS 리소스의 전역 고유 주소다.

```
arn:aws:secretsmanager:ap-northeast-2:111122223333:secret:orders-server/dev/graph-refresh-token-AbCdEf
└┬┘ └┬┘ └──────┬─────┘ └──────┬─────┘ └────┬────┘ └┬───┘ └──────────────┬──────────────────┘
 │   │         │              │            │       │                    └─ 리소스 식별자
 │   │         │              │            │       └─ 리소스 타입
 │   │         │              │            └─ 계정 ID
 │   │         │              └─ 리전
 │   │         └─ 서비스
 │   └─ 파티션 (aws / aws-cn / aws-us-gov)
 └─ 고정 접두사
```

Secrets Manager ARN 끝의 `-AbCdEf` 같은 여섯 글자는 AWS가 붙이는 임의 접미사다. 그래서 **시크릿 ARN은 이름만으로 조립할 수 없고**, 이 템플릿처럼 `!Ref`로 받아야 한다.

### ⭐ 실행 롤과 태스크 롤 — 시점이 다르다

ECS에는 롤이 두 개 필요하고, 이 구분이 이 문서의 핵심이다.

```yaml
      ExecutionRoleArn: !GetAtt TaskExecutionRole.Arn   # 롤 A
      TaskRoleArn: !GetAtt TaskRole.Arn                 # 롤 B
```

경계를 정하는 것은 **"누가 언제 쓰는가"**다.

| | 실행 롤 (TaskExecutionRole) | 태스크 롤 (TaskRole) |
|---|---|---|
| **누가 쓰나** | ECS·Fargate 에이전트 (AWS 쪽 인프라) | 컨테이너 안에서 도는 **내 코드** |
| **언제 쓰나** | 컨테이너를 **띄우기 전과 띄우는 중** | 컨테이너가 **돌고 있는 동안** |
| 전형적 권한 | ECR 이미지 pull, CloudWatch Logs 쓰기, 시크릿 값 조회해 주입 | 앱이 호출하는 모든 AWS API (S3, DynamoDB, SQS…) |
| 컨테이너에서 보이나 | **아니다** — 컨테이너는 이 자격증명에 접근할 수 없다 | 그렇다 — SDK가 자동으로 가져온다 |

시간 순서로 보면 명확하다.

```
[배포 시작]
   │
   ├─ 실행 롤로: ECR에서 이미지 pull
   ├─ 실행 롤로: Secrets Manager에서 값 읽어 환경변수에 주입
   ├─ 실행 롤로: 로그 스트림 생성
   │
[컨테이너 시작] ─────── 여기가 경계선
   │
   ├─ 태스크 롤로: 앱이 회전된 토큰을 PutSecretValue로 되쓰기
   └─ 태스크 롤로: ECS Exec 채널 열기
```

**왜 나누는가.** 하나로 합치면 컨테이너 안의 코드가 실행 롤의 권한까지 갖는다. 실행 롤은 ECR pull 권한을 갖고 있으므로, 애플리케이션 취약점으로 코드 실행이 가능해진 공격자가 다른 이미지를 조회할 수 있게 된다. **권한 분리의 목적은 "침해 시 얻는 것을 줄이는 것"이고, 시점이 다른 권한을 시점으로 나누는 것이 가장 자연스러운 경계다.**

두 롤의 신뢰 정책은 **완전히 같다** — 둘 다 `ecs-tasks.amazonaws.com`이 맡는다. 이게 헷갈리는 지점인데, 맡는 주체는 같고 **쓰이는 시점이 다를 뿐**이다. 어느 롤이 어느 시점에 쓰이는지는 태스크 정의의 `ExecutionRoleArn` / `TaskRoleArn` 자리가 결정한다.

### ⭐ 관리형 정책만으로는 시크릿 주입이 안 된다

```yaml
  TaskExecutionRole:
    Properties:
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
      Policies:
        - PolicyName: SecretsInjection
          PolicyDocument:
            Statement:
              - Effect: Allow
                Action: secretsmanager:GetSecretValue
                Resource: !Ref GraphRefreshTokenSecret
```

**관리형 정책(managed policy)**은 AWS가 만들어 유지하는 정책이다. 흔한 용도에 필요한 권한이 모여 있고, AWS가 새 기능에 필요한 권한을 추가해 준다. `AmazonECSTaskExecutionRolePolicy`에는 ECR 이미지 pull과 CloudWatch Logs 쓰기 권한이 들어 있다.

**그런데 Secrets Manager 권한은 없다.** 공식 문서가 명시한다 — 태스크 정의에서 시크릿을 참조하려면 `secretsmanager:GetSecretValue`를 **직접 추가**해야 한다.

이걸 모르면 이렇게 된다.

1. 관리형 정책만 붙인 실행 롤로 배포
2. 태스크가 `PENDING` → `STOPPED`
3. 중단 이유: `ResourceInitializationError: unable to pull secrets or registry auth`
4. 이미지 문제로 오해하고 이미지를 다시 빌드한다 (아무 효과 없음)

이 함정이 흔한 이유는 **관리형 정책 이름이 "TaskExecutionRolePolicy"라서 실행 롤에 필요한 모든 것이 들어 있을 것처럼 읽히기 때문이다.** 실제로는 "가장 흔한 용도"의 집합이다.

주석이 이 사실을 기록해 뒀다.

```yaml
        # AmazonECSTaskExecutionRolePolicy에는 secretsmanager 권한이 없다.
        # 태스크 정의 `Secrets:` 주입은 실행 롤이 수행하므로 여기에 GetSecretValue가 없으면 태스크가 기동하지 못한다.
```

**인라인 정책(inline policy)**은 롤에 직접 박아 넣는 정책이다. 관리형 정책과 비교하면:

| | 관리형 정책 | 인라인 정책 |
|---|---|---|
| 재사용 | 여러 롤에 붙일 수 있다 | 이 롤 전용 |
| 수명 | 롤을 지워도 남는다 | 롤과 함께 사라진다 |
| 적합한 용도 | 공통 권한 | **이 롤에만 필요한 좁은 권한** |

시크릿 접근처럼 "이 서비스의 이 시크릿"에만 해당하는 권한은 인라인이 맞다. 관리형으로 만들면 다른 롤에 실수로 붙을 수 있다.

### 태스크 롤 — 런타임에 필요한 두 가지

```yaml
  TaskRole:
    Properties:
      Policies:
        - PolicyName: EcsExecSsmMessages       # ① ECS Exec 채널
          ...
        - PolicyName: SecretsManagerAccess     # ② 시크릿 읽기 + 쓰기
          PolicyDocument:
            Statement:
              - Effect: Allow
                Action:
                  - secretsmanager:GetSecretValue
                  - secretsmanager:PutSecretValue
                Resource: !Ref GraphRefreshTokenSecret
```

①은 [04](04-ecs-fargate.md)에서 본 ECS Exec 통로다.

②가 흥미롭다. **`GetSecretValue`가 실행 롤에도 있고 태스크 롤에도 있다.** 중복 같지만 목적이 다르다.

- 실행 롤의 `GetSecretValue` — 컨테이너 시작 시 환경변수로 **주입**하기 위해
- 태스크 롤의 `GetSecretValue` — 런타임에 앱이 **다시 읽기** 위해

왜 다시 읽어야 하는가. 주입은 **컨테이너 시작 시점에 한 번만** 일어난다. 시크릿 값이 그 뒤에 바뀌면 환경변수는 옛 값을 들고 있다. 이 서비스가 다루는 토큰은 갱신마다 새 값으로 회전하므로, 앱이 최신 값을 확인해야 한다.

그리고 `PutSecretValue`가 있다 — **앱이 시크릿에 쓴다.** 이건 흔하지 않은 구조이고 이유가 있다: 이 토큰은 갱신할 때마다 발급 측이 새 토큰을 내주는 방식이라, 앱이 새 값을 저장하지 않으면 다음 재기동 때 만료된 옛 값으로 시작해 동작이 멈춘다. 자세한 메커니즘은 [06 시크릿](06-secrets.md)에서 다룬다.

**두 정책 모두 `Resource`가 그 시크릿 하나로 한정돼 있다.** `secretsmanager:*` + `Resource: "*"`로 쓰면 이 태스크가 계정의 모든 시크릿을 읽고 쓸 수 있다. 침해 시 피해 범위가 시크릿 하나에서 전부로 확대된다.

### ⭐ PassRole — 롤을 넘겨주는 권한

배포 롤(`orders-server-dev-deploy-role`)에 눈에 잘 안 띄는 문장이 있다.

```yaml
              - Sid: PassTaskRoles
                Effect: Allow
                Action: iam:PassRole
                Resource:
                  - !Sub arn:aws:iam::${AWS::AccountId}:role/orders-server-dev-task-execution-role
                  - !Sub arn:aws:iam::${AWS::AccountId}:role/orders-server-dev-task-role
                Condition:
                  StringEquals:
                    iam:PassedToService: ecs-tasks.amazonaws.com
```

**`iam:PassRole`은 "다른 롤을 AWS 서비스에 넘겨줄 수 있는 권한"이다.**

왜 이런 권한이 따로 있는가. 배포 파이프라인이 새 태스크 정의를 등록할 때, 그 정의에는 실행 롤과 태스크 롤의 ARN이 들어간다. 즉 **파이프라인이 "이 롤로 태스크를 돌려라"고 ECS에 지시한다.**

이게 통제되지 않으면 권한 상승 통로가 된다. 파이프라인이 관리자 권한 롤의 ARN을 태스크 정의에 적어 넣으면, 태스크가 관리자 권한으로 돌고 파이프라인은 그 태스크를 통해 무엇이든 할 수 있다. **자기 권한보다 강한 권한을 우회로 획득하는 것이다.**

그래서 AWS는 롤을 넘기는 행위 자체를 별도 권한으로 분리했다. 이 템플릿은 두 겹으로 조인다.

1. **`Resource`로 넘길 수 있는 롤을 두 개로 한정** — 다른 롤은 못 넘긴다
2. **`Condition`으로 넘길 대상 서비스를 한정** — `ecs-tasks.amazonaws.com`에만 넘길 수 있다

두 번째가 없으면 이 롤을 Lambda나 EC2에도 넘길 수 있다. `iam:PassedToService` 조건은 그 경로를 막는다.

**`PassRole`이 없으면 `RegisterTaskDefinition`이 AccessDenied로 실패한다.** 이 실패의 오류 메시지는 IAM 롤 이름을 언급하는데, "롤에 권한이 없다"로 읽혀서 실행 롤·태스크 롤의 정책을 뒤지게 만든다. 실제로 부족한 것은 **배포 롤의 `PassRole`**이다.

### 리소스 레벨 권한을 지원하지 않는 액션

배포 롤에 `Resource: '*'`인 문장이 셋 있다.

```yaml
              # ECR login token (리소스 레벨 미지원 -> '*')
              - Sid: EcrAuth
                Action: ecr:GetAuthorizationToken
                Resource: '*'

              # ECS task definition describe/register (리소스 레벨 미지원 -> '*')
              - Sid: EcsTaskDefRegister
                Action:
                  - ecs:RegisterTaskDefinition
                  - ecs:DescribeTaskDefinition
                Resource: '*'

              # 배포 검증 — ALB target health (ELBv2 describe는 리소스 레벨 미지원 -> '*')
              - Sid: ElbTargetHealth
                Action:
                  - elasticloadbalancing:DescribeTargetHealth
                  - elasticloadbalancing:DescribeTargetGroups
                Resource: '*'
```

**모든 AWS API가 리소스 단위 제한을 지원하는 것은 아니다.** 지원하지 않는 액션에 ARN을 적으면 정책이 아무것도 허용하지 않게 되어 호출이 실패한다.

각 경우의 이유:

- `ecr:GetAuthorizationToken` — 특정 리포지토리가 아니라 **레지스트리 전체에 대한 로그인 토큰**을 받는 호출이라 대상이 될 리소스가 없다
- `ecs:RegisterTaskDefinition` — **아직 존재하지 않는 것을 만드는** 호출이라 지목할 ARN이 없다
- `elasticloadbalancing:Describe*` — 조회 API는 필터가 파라미터로 들어가고 IAM 리소스 제한이 없다

**`Resource: '*'`가 항상 게으름의 표시는 아니다.** 다만 그렇게 쓸 때는 (1) 정말 지원하지 않는지 확인하고, (2) **주석으로 이유를 남겨야** 한다. 남기지 않으면 다음 사람이 "여기 왜 와일드카드지?"에서 시간을 쓰고, 조일 수 있는데 안 조인 것으로 오해한다. 이 템플릿의 `Sid`(문장 식별자)와 주석이 그 역할을 한다.

리소스 레벨을 지원하는 액션은 확실히 좁혀 놨다.

```yaml
              - Sid: EcsServiceDeploy
                Action:
                  - ecs:UpdateService
                  - ecs:DescribeServices
                Resource: !Sub arn:aws:ecs:${AWS::Region}:${AWS::AccountId}:service/orders-dev/orders-server-dev
                Condition:
                  ArnEquals:
                    ecs:cluster: !Sub arn:aws:ecs:${AWS::Region}:${AWS::AccountId}:cluster/orders-dev
```

`Resource`로 서비스 하나를 지목하고, `Condition`으로 클러스터까지 한 번 더 못박았다. 이 배포 롤은 **다른 서비스를 건드릴 수 없다.**

### 최소 권한을 실제로 적용하는 방법

"최소 권한(least privilege)"은 원칙으로는 자명하지만 실천이 어렵다. 이 템플릿에서 쓰인 기법을 정리하면 넷이다.

**1. 액션을 열거한다.** `ecr:*`가 아니라 필요한 것만.

```yaml
                Action:
                  - ecr:BatchCheckLayerAvailability
                  - ecr:InitiateLayerUpload
                  - ecr:UploadLayerPart
                  - ecr:CompleteLayerUpload
                  - ecr:PutImage
                  - ecr:BatchGetImage
                  - ecr:GetDownloadUrlForLayer
```

이 일곱 개가 "이미지 push/pull"에 필요한 전부다. `ecr:DeleteRepository`가 없으므로 이 롤로는 리포지토리를 지울 수 없다.

**2. 리소스를 지목한다.** 리포지토리 하나, 서비스 하나, 시크릿 하나.

**3. 조건을 건다.** `iam:PassedToService`, `ecs:cluster`, OIDC의 `sub`.

**4. 스택을 나눈다.** 배포 롤을 서비스 스택과 다른 스택에 둬서 롤 정의를 바꿀 때 서비스에 영향이 없게 한다.

역방향 접근도 유효하다: **넓게 시작해 CloudTrail로 실제 호출을 관찰한 뒤 좁힌다.** 처음부터 정확한 목록을 만들려 하면 누락으로 배포가 실패하며 시간을 잃는다. 다만 "나중에 좁히기"가 실제로 일어나야 한다.

### 이름을 고정한 IAM 롤과 배포 플래그

```yaml
  TaskExecutionRole:
    Properties:
      RoleName: !Sub orders-server-${Env}-task-execution-role
```

[01](01-iac-and-cloudformation.md)에서 "고정 이름을 피하라"고 했는데 롤에는 이름을 줬다. 이유가 둘 있다.

1. **IAM 롤은 교체를 유발하는 속성이 거의 없다.** ALB의 `Scheme`처럼 흔히 바뀌는 immutable 속성이 없다
2. **다른 스택이 이름으로 이 롤을 지목해야 한다.** 배포 롤의 `PassRole`이 `role/orders-server-dev-task-execution-role`을 문자열로 적고 있다 — 자동 명명이면 이 참조를 쓸 수 없다

두 번째가 결정적이다. 두 스택이 export/import 없이 이름 규약으로만 연결돼 있으므로, 이름이 계약이다. **대신 이름을 바꾸면 다른 스택이 조용히 깨진다** — 배포 롤이 존재하지 않는 롤에 `PassRole` 권한을 갖게 되고, 배포가 AccessDenied로 실패한다.

이름을 지정한 롤을 만들 때는 배포 명령에 플래그가 필요하다.

```bash
aws cloudformation deploy --capabilities CAPABILITY_NAMED_IAM ...
```

| 플래그 | 언제 필요한가 |
|---|---|
| `CAPABILITY_IAM` | 템플릿이 IAM 리소스를 만들 때 |
| `CAPABILITY_NAMED_IAM` | IAM 리소스에 **이름을 지정**할 때 |

이 확인 절차가 있는 이유는 **IAM 변경이 계정 전체의 보안에 영향을 주기 때문이다.** 남이 만든 템플릿을 무심코 배포해 관리자 롤이 생기는 사고를 막는 장치다. 이름을 지정하면 한 겹 더 요구하는 것은, 고정 이름이 다른 정책의 참조 대상이 될 수 있어 영향 범위가 넓기 때문이다.

배포 롤 템플릿의 주석이 이 요구사항을 기록해 뒀다.

```yaml
# 배포: aws cloudformation deploy --capabilities CAPABILITY_NAMED_IAM
```

---

## 필수 지식 (HOW)

### 이 프로젝트의 롤 세 개

| 롤 | 누가 맡나 | 무엇을 하나 | 어느 스택 |
|---|---|---|---|
| `orders-server-dev-task-execution-role` | `ecs-tasks.amazonaws.com` | ECR pull, 로그 쓰기, 시크릿 값 조회해 주입 | 서비스 스택 |
| `orders-server-dev-task-role` | `ecs-tasks.amazonaws.com` | ECS Exec 채널, 시크릿 읽기·쓰기 | 서비스 스택 |
| `orders-server-dev-deploy-role` | GitHub Actions (OIDC) | ECR push, 태스크 정의 등록, 서비스 갱신, 배포 검증 | 배포 롤 스택 |

배포 롤의 신뢰 정책만 형태가 다르다.

```yaml
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Federated: !Sub arn:aws:iam::${AWS::AccountId}:oidc-provider/token.actions.githubusercontent.com
            Action: sts:AssumeRoleWithWebIdentity
            Condition:
              StringEquals:
                token.actions.githubusercontent.com:aud: sts.amazonaws.com
                token.actions.githubusercontent.com:sub: repo:my-org/orders-server:environment:dev
```

`Principal`이 `Service`가 아니라 `Federated`이고, `Action`이 `sts:AssumeRole`이 아니라 `sts:AssumeRoleWithWebIdentity`다. **AWS 밖의 신원 공급자를 신뢰한다는 뜻**이며, 이 구조의 자세한 동작은 [08 배포 파이프라인](08-deploy-pipeline.md)에서 다룬다. 여기서 알아둘 것은 **신뢰 정책의 `Condition`이 "누가 맡을 수 있나"를 좁히는 자리**라는 점이다 — 조건이 없으면 GitHub의 아무 리포지토리나 이 롤을 맡을 수 있다.

### AccessDenied를 만났을 때의 진단 순서

1. **어느 주체가 무엇을 호출하다 실패했는가** — 오류 메시지에 롤 ARN과 액션이 나온다
2. **그 주체가 그 롤을 맡을 수 있는가** — 신뢰 정책의 `Principal`과 `Condition` 확인
3. **롤에 그 액션이 있는가** — 관리형 정책은 이름만으로 판단하지 말고 실제 내용을 본다
4. **`Resource`가 대상을 포함하는가** — ARN 오타, 리전·계정 불일치, 시크릿 ARN의 임의 접미사
5. **`Condition`이 막고 있지 않은가** — `iam:PassedToService` 같은 조건이 현재 호출과 맞는가
6. **다른 롤을 넘기는 호출인가** — 그렇다면 `iam:PassRole`을 확인한다

**3번에서 관리형 정책의 실제 내용을 확인하는 습관이 시간을 아낀다.** `AmazonECSTaskExecutionRolePolicy`처럼 이름이 포괄적으로 읽히는 정책이 특정 권한을 빠뜨리는 경우가 실제로 있다.

---

### ⚠️ 암기 필수

- [ ] **롤은 문서 두 개다: 신뢰 정책(누가 맡나) + 권한 정책(맡으면 뭘 하나).** AccessDenied의 원인이 어느 쪽인지 먼저 가른다. (이유: 신뢰 정책 문제인데 권한 정책을 뒤지면 원인을 못 찾는다)
- [ ] **실행 롤은 컨테이너를 띄우기 전·중에 ECS 에이전트가 쓰고, 태스크 롤은 컨테이너 안 코드가 쓴다.** 컨테이너는 실행 롤 자격증명에 접근할 수 없다. (이유: 권한을 어느 롤에 넣을지 판단하는 유일한 기준)
- [ ] **`AmazonECSTaskExecutionRolePolicy`에는 `secretsmanager:GetSecretValue`가 없다.** 시크릿을 참조하면 인라인 정책으로 추가해야 한다. (이유: 없으면 태스크가 `ResourceInitializationError`로 기동 실패하고, 증상이 이미지 문제로 오인된다)
- [ ] **`iam:PassRole`은 다른 롤을 서비스에 넘기는 별도 권한이며, 없으면 `RegisterTaskDefinition`이 실패한다.** (이유: 오류 메시지가 넘겨질 롤 이름을 언급해서 엉뚱한 롤의 정책을 뒤지게 만든다)
- [ ] **`PassRole`에는 `iam:PassedToService` 조건을 함께 건다.** (이유: 없으면 그 롤을 Lambda·EC2 등 다른 서비스에도 넘길 수 있어 권한 상승 경로가 남는다)
- [ ] **일부 액션은 리소스 레벨 권한을 지원하지 않아 `Resource: '*'`가 불가피하다** (`ecr:GetAuthorizationToken`, `ecs:RegisterTaskDefinition`, ELBv2 `Describe*`). 그럴 때는 주석으로 이유를 남긴다. (이유: 조일 수 있는데 안 조인 것과 구분되어야 한다)
- [ ] **IAM 리소스를 만들면 `CAPABILITY_IAM`, 이름까지 지정하면 `CAPABILITY_NAMED_IAM`이 필요하다.** (이유: 플래그 없이 배포하면 `InsufficientCapabilities`로 즉시 실패한다)
- [ ] **명시적 `Deny` > `Allow` > 암묵적 거부.** 정책이 없으면 아무것도 못 한다. (이유: 정책 평가의 유일한 규칙)

---

## 우리 프로젝트와의 연결

- 롤 세 개: 실행 롤 · 태스크 롤(서비스 스택) · 배포 롤(별도 스택)
- 실행 롤 = 관리형 `AmazonECSTaskExecutionRolePolicy` + 인라인 `SecretsInjection` — 관리형에 시크릿 권한이 없어서
- 태스크 롤 = `ssmmessages` 4개(ECS Exec) + 시크릿 `Get`/`Put` — 런타임 재조회와 토큰 회전 되쓰기
- 두 롤의 시크릿 권한 모두 **해당 시크릿 ARN 하나로 한정**, 와일드카드 없음
- 배포 롤은 `PassRole`을 두 롤로 한정 + `iam:PassedToService: ecs-tasks.amazonaws.com` 조건
- 배포 롤의 `ecs:UpdateService`는 서비스 ARN 한정 + `ecs:cluster` 조건으로 이중 제한
- `Resource: '*'`인 세 문장에 각각 "리소스 레벨 미지원" 주석
- IAM 롤에는 고정 이름 부여 — 배포 롤이 이름으로 참조하므로. 배포 시 `CAPABILITY_NAMED_IAM` 필요

---

## 자가 진단

1. 신뢰 정책과 권한 정책은 각각 무엇을 정하는가? 어느 쪽이 없으면 `AssumeRole` 단계에서 실패하는가?
2. 실행 롤과 태스크 롤의 신뢰 정책이 같은데 왜 두 롤로 나누는가?
3. 태스크가 `ResourceInitializationError: unable to pull secrets`로 죽는다. 어느 롤의 무엇이 없는가?
4. 배포 파이프라인이 `RegisterTaskDefinition`에서 AccessDenied를 받는다. 어느 롤의 무슨 권한인가?
5. `PassRole`에 `iam:PassedToService` 조건이 없으면 어떤 공격 경로가 남는가?
6. `ecr:GetAuthorizationToken`에 특정 리포지토리 ARN을 적으면?
7. 왜 IAM 롤에는 고정 이름을 줬는데 ALB에는 주지 않았는가?

## 실습

**과제 05-01 — IAM 정책 평가기** (`src/05-01-iam-policy-eval/index.ts`)

정책 문장 목록과 요청(주체·액션·리소스·컨텍스트)을 받아 허용/거부를 판정한다. 와일드카드 매칭, `Deny` 우선, `Condition` 평가, 암묵적 거부를 모두 다룬다.

무엇을 만들지는 `tests/05-01-iam-policy-eval/index.test.ts`가 정의한다. **먼저 읽고** `src/05-01-iam-policy-eval/index.ts`의 `🎯 TODO`를 채운다.

```bash
cd packages/ecs-fargate-iac
pnpm test 05-01
```

## 공식 문서

- [ECS 태스크 실행 IAM 롤](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html) — 관리형 정책이 담는 것과 추가해야 하는 권한
- [ECS 태스크 IAM 롤](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html) — 컨테이너 안 코드의 권한
- [IAM 정책 평가 로직](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html) — Deny 우선과 암묵적 거부
- [서비스에 롤 전달 권한 부여](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_passrole.html) — `PassRole`과 권한 상승 방지
- [서비스별 액션·리소스·조건 키](https://docs.aws.amazon.com/service-authorization/latest/reference/reference_policies_actions-resources-contextkeys.html) — 어떤 액션이 리소스 레벨을 지원하는지
- [CloudFormation IAM 기능 승인](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-template.html#using-iam-capabilities) — `CAPABILITY_IAM` / `CAPABILITY_NAMED_IAM`

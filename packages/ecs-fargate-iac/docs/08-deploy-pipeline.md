# 08. 배포 파이프라인 — ECR과 OIDC로 장기 키 없이 배포한다

## 학습 목표

이 문서를 다 읽으면 (1) 이미지 태그 전략이 롤백 가능성을 어떻게 결정하는지 설명할 수 있고, (2) **OIDC 페더레이션이 액세스 키를 대체하는 방식과 신뢰 정책의 `sub` 조건이 왜 필수인지** 말할 수 있고, (3) CloudFormation과 배포 파이프라인의 책임 경계를 그을 수 있다.

## 선수 지식

[05](05-iam-roles.md)의 신뢰 정책과 `PassRole`, [04](04-ecs-fargate.md)의 태스크 정의 리비전과 배포 흐름.

---

## 핵심 원리 (WHY)

### 코드에서 도는 컨테이너까지

배포는 세 번의 변환이다.

```
[소스 코드]
    │ docker build
[컨테이너 이미지]
    │ docker push → ECR
[레지스트리의 이미지]
    │ 태스크 정의 등록 + 서비스 갱신
[도는 태스크]
```

각 단계에 필요한 것이 다르다. 빌드에는 Dockerfile, push에는 레지스트리 인증, 서비스 갱신에는 ECS 권한. **이 문서는 그 인증과 권한을 어떻게 안전하게 얻는가에 초점을 둔다** — 배포 파이프라인이 침해되면 임의 이미지를 운영에 밀어넣을 수 있으므로, 여기가 공급망의 급소다.

### ECR — 이미지를 담는 곳

**ECR(Elastic Container Registry)**은 AWS의 컨테이너 이미지 저장소다. Docker Hub와 같은 역할이지만 IAM으로 접근을 통제하고, VPC 안에서 통신할 수 있고, ECS와 통합돼 있다.

구조는 두 층이다.

```
[레지스트리]  111122223333.dkr.ecr.ap-northeast-2.amazonaws.com   ← 계정 × 리전당 하나
   └─ [리포지토리]  orders-server                                   ← 서비스당 하나
        ├─ [이미지] :dev          ← 태그
        ├─ [이미지] :dev-a2238c6
        └─ [이미지] :latest
```

**리포지토리는 서비스당 하나이며 환경을 나누지 않는다.** dev·test·prod가 태그로 구분된다. 리포지토리를 환경별로 만들면 같은 이미지를 환경마다 다시 push해야 하고, 그러면 **"STAGE에서 검증한 이미지가 PROD의 그 이미지와 같다"는 보장이 사라진다.**

이미지 URI는 [01](01-iac-and-cloudformation.md)에서 본 의사 파라미터로 조립된다.

```yaml
          Image: !Sub ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/orders-server:${ImageTag}
```

계정 ID와 리전을 하드코딩하지 않으므로 다른 계정으로 이 템플릿을 옮겨도 그 계정의 ECR을 가리킨다.

### ⭐ 태그 전략 — 가변 태그와 불변 태그를 함께 쓴다

같은 이미지에 태그를 여러 개 붙일 수 있고, 이 선택이 롤백 가능성을 결정한다.

| 태그 | 성격 | 무엇에 쓰나 |
|---|---|---|
| `dev` | **가변(mutable)** — 새 이미지를 push하면 이 태그가 새것을 가리킨다 | ECS 서비스가 참조하는 "현재 dev" |
| `dev-a2238c6` | **불변(immutable)** — 커밋 SHA가 들어가 절대 겹치지 않는다 | **롤백 대상 지목**, 추적 |
| `latest` | 가변 | 보조용. 운영에서는 권장하지 않는다 |

**가변 태그만 쓰면 롤백할 수 없다.** `dev` 태그가 항상 최신을 가리키므로 "3번 전 버전"을 지목하는 방법이 없다. 옛 이미지는 태그를 잃고 `<untagged>` 상태로 남으며, 다이제스트(내용 해시)를 직접 알아야 지목할 수 있다.

**불변 태그만 쓰면 태스크 정의를 매번 고쳐야 한다.** 배포마다 이미지 URI가 바뀌므로 태스크 정의를 새로 등록해야 한다 — 실제로 파이프라인이 그렇게 한다.

둘을 함께 쓰면: **평시에는 `dev`가 현재를 가리키고, 롤백할 때는 `dev-a2238c6`으로 특정 커밋의 이미지를 지목한다.**

`latest`를 운영에서 쓰지 않는 이유는 **어느 환경의 최신인지 모호하기 때문이다.** dev 빌드가 `latest`를 갱신하는데 prod가 `latest`를 참조하면 검증되지 않은 이미지가 운영에 들어간다.

### 이미지 다이제스트 고정 — 태그가 흔들려도 태스크는 일관되다

가변 태그에는 위험이 하나 더 있다. 서비스가 태스크 여러 개를 띄우는 중에 `dev` 태그가 갱신되면, 먼저 뜬 태스크와 나중에 뜬 태스크가 **다른 이미지**를 돌릴 수 있다.

ECS는 이 문제를 스스로 막는다. **기본적으로 태스크 정의의 이미지 태그를 다이제스트로 해석해 고정한다.** 서비스가 첫 태스크를 띄울 때 태그가 가리키는 다이제스트를 확정하고, 이후 모든 태스크와 향후 갱신에 그 다이제스트를 쓴다.

**그래서 서비스 안의 모든 태스크가 동일한 이미지를 돌린다.** 이 동작을 컨테이너 정의의 `versionConsistency` 파라미터로 조절할 수 있다.

여기서 파생되는 성질이 하나 있다. **`dev` 태그에 새 이미지를 push해도 도는 서비스는 바뀌지 않는다.** 다이제스트가 고정돼 있으므로 새 배포를 트리거해야 한다.

```bash
aws ecs update-service --cluster orders-dev --service orders-server-dev --force-new-deployment
```

이건 [06](06-secrets.md)에서 본 시크릿 갱신 후의 조치와 같은 명령이다. **"push했는데 안 바뀌네"의 원인이 여기 있다.**

### ⭐ 왜 액세스 키를 GitHub에 넣지 않는가

GitHub Actions가 AWS에 배포하려면 자격증명이 필요하다. 전통적 방법은 IAM 사용자를 만들고 액세스 키를 GitHub Secrets에 넣는 것이다. 이 방법의 문제는 [05](05-iam-roles.md)에서 본 것과 같지만, CI 환경에서는 더 심각하다.

1. **키가 만료되지 않는다** — 유출되면 무기한 유효하다
2. **회전 노동이 있다** — 90일마다 사람이 갱신해야 하고, 잊으면 배포가 어느 날 갑자기 깨진다
3. **CI 로그·서드파티 액션으로 새어 나갈 수 있다** — 워크플로가 쓰는 액션이 환경변수를 읽는다
4. **누가 썼는지 모른다** — CloudTrail에 IAM 사용자 이름만 남고, 어느 워크플로 실행이었는지는 알 수 없다

**OIDC(OpenID Connect) 페더레이션**은 이 넷을 한꺼번에 없앤다. **AWS가 GitHub을 신원 공급자로 직접 신뢰하고, GitHub이 워크플로 실행마다 발급하는 짧은 수명의 토큰으로 롤을 맡게 한다.** 저장되는 장기 비밀이 존재하지 않는다.

### OIDC 흐름 — 다섯 단계

```
1. 워크플로가 시작된다
   └─ GitHub이 이 실행에 대한 JWT를 발급한다
      (안에 들어가는 것: 리포지토리, 브랜치 또는 환경, 워크플로, 실행 ID…)

2. 워크플로가 AWS STS를 호출한다
   sts:AssumeRoleWithWebIdentity(role_arn, web_identity_token=JWT)

3. STS가 JWT를 검증한다
   ├─ 서명이 진짜 GitHub의 것인가?  (OIDC 공급자에 등록된 공개키로 확인)
   ├─ aud 클레임이 신뢰 정책과 맞나?
   └─ sub 클레임이 신뢰 정책과 맞나?     ← 여기가 접근 통제의 핵심

4. 통과하면 임시 자격증명 발급 (기본 1시간)

5. 워크플로가 그 자격증명으로 ECR·ECS를 호출한다
```

**3번의 검증이 전부다.** 신뢰 정책이 이 검증의 규칙을 담는다.

```yaml
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
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

각 줄을 해석하면:

| 요소 | 값 | 의미 |
|---|---|---|
| `Principal.Federated` | `oidc-provider/token.actions.githubusercontent.com` | GitHub의 OIDC 공급자를 신뢰한다 |
| `Action` | `sts:AssumeRoleWithWebIdentity` | 외부 신원으로 롤을 맡는 호출 |
| `aud` 조건 | `sts.amazonaws.com` | 이 토큰이 **AWS를 대상으로** 발급됐는가 |
| **`sub` 조건** | `repo:my-org/orders-server:environment:dev` | **어느 리포지토리의 어느 환경인가** |

**⭐ `sub` 조건이 없으면 GitHub의 아무 리포지토리나 이 롤을 맡을 수 있다.**

이게 얼마나 위험한지 구체적으로 보면: 누구든 GitHub에 리포지토리를 만들고, 워크플로에서 이 롤 ARN으로 `AssumeRoleWithWebIdentity`를 호출하면 된다. GitHub의 서명은 진짜이고 `aud`도 맞으므로 STS가 자격증명을 내준다. **롤 ARN만 알면 되고, ARN은 비밀이 아니다.**

`sub` 조건은 이 문을 리포지토리 하나로 좁힌다. 형식은 스코프에 따라 다르다.

| 스코프 | `sub` 형식 |
|---|---|
| **환경** | `repo:OWNER/REPO:environment:ENV_NAME` |
| 브랜치 | `repo:OWNER/REPO:ref:refs/heads/BRANCH` |
| 태그 | `repo:OWNER/REPO:ref:refs/tags/TAG` |
| 풀 리퀘스트 | `repo:OWNER/REPO:pull_request` |

이 템플릿은 **환경 스코프**를 골랐다. `repo:my-org/orders-server:environment:dev`는 "my-org/orders-server 리포지토리에서 dev 환경을 대상으로 실행되는 워크플로만"을 뜻한다.

**환경 스코프를 고른 이유**는 GitHub 환경에 승인 규칙과 접근 제한을 붙일 수 있기 때문이다. prod 환경에 리뷰어 승인을 걸면 승인 없이는 토큰의 `sub`가 `environment:prod`가 되지 않고, 따라서 prod 롤을 맡을 수 없다. **접근 통제가 GitHub의 승인 절차와 AWS의 신뢰 정책 양쪽에서 걸린다.**

브랜치 스코프는 이 통제가 약하다. 브랜치는 누구나 만들 수 있으므로 `ref:refs/heads/*` 같은 와일드카드를 쓰면 사실상 리포지토리 전체를 허용하는 것이 된다.

워크플로 쪽에서는 권한 선언이 필요하다.

```yaml
permissions:
  id-token: write     # OIDC 토큰 발급 허용
  contents: read      # 코드 체크아웃
```

`id-token: write`는 **"GitHub의 OIDC 공급자가 이 실행에 대한 JWT를 만들 수 있게 한다"**는 뜻이다. 쓰기 권한처럼 보이지만 리소스를 바꾸는 권한이 아니라 토큰 생성 허용이다. 없으면 토큰을 얻을 수 없어 `AssumeRoleWithWebIdentity` 자체가 불가능하다.

**`permissions`를 선언하면 선언한 것만 부여된다.** `contents: read`를 빼면 체크아웃이 실패한다 — 기본값이 사라지기 때문이다.

### 배포 롤의 권한을 배포 흐름과 맞춰 보기

[05](05-iam-roles.md)에서 정책 문법을 봤으니, 이제 **각 권한이 배포의 어느 단계에 쓰이는지** 이어 보자.

| 단계 | 필요 권한 | 리소스 범위 |
|---|---|---|
| 1. 체크아웃 | (AWS 무관) | — |
| 2. 롤 맡기 | 신뢰 정책 통과 | `sub`가 `environment:dev`인 토큰만 |
| 3. ECR 로그인 | `ecr:GetAuthorizationToken` | `*` (리소스 레벨 미지원) |
| 4. 이미지 push | `ecr:InitiateLayerUpload`, `UploadLayerPart`, `CompleteLayerUpload`, `PutImage`, `BatchCheckLayerAvailability` | `repository/orders-server` 한정 |
| 5. 현재 태스크 정의 조회 | `ecs:DescribeTaskDefinition` | `*` (리소스 레벨 미지원) |
| 6. 새 태스크 정의 등록 | `ecs:RegisterTaskDefinition` + **`iam:PassRole`** | 롤 두 개 한정 + `PassedToService` 조건 |
| 7. 서비스 갱신 | `ecs:UpdateService` | 서비스 ARN 한정 + `ecs:cluster` 조건 |
| 8. 안정화 대기 | `ecs:DescribeServices` | 같음 |
| 9. 스택 출력 조회 | `cloudformation:DescribeStacks` | `stack/orders-server-dev/*` 한정 |
| 10. 타겟 헬스 확인 | `elasticloadbalancing:DescribeTargetHealth`, `DescribeTargetGroups` | `*` (리소스 레벨 미지원) |

**6단계의 `PassRole`이 이 표에서 가장 놓치기 쉽다.** 새 태스크 정의에 실행 롤·태스크 롤 ARN이 들어가므로, 파이프라인이 그 롤을 ECS에 넘기는 권한이 필요하다. 없으면 `RegisterTaskDefinition`이 AccessDenied로 실패하고, 오류 메시지가 넘겨질 롤 이름을 언급해서 **엉뚱한 롤의 정책을 뒤지게 만든다.**

**9·10단계가 있는 것이 이 파이프라인의 특징이다.** 배포를 "서비스 갱신 성공"에서 끝내지 않고, 스택 출력에서 타겟그룹 ARN을 읽어 **실제로 타겟이 healthy가 됐는지 확인한다.** [03](03-alb-and-target-group.md)에서 본 대로 태스크가 `RUNNING`인 것과 ALB가 트래픽을 보내는 것은 다른 상태이므로, 이 확인이 없으면 "배포 성공했는데 503"이 나온다.

`ecs wait services-stable`도 같은 목적이지만 ECS 관점의 안정화만 본다. **ALB 타겟 헬스는 별도 확인이 필요하다.**

### CloudFormation과 파이프라인의 경계

같은 서비스를 두 도구가 건드린다. 경계가 없으면 서로의 변경을 되돌린다.

| | CloudFormation | 배포 파이프라인 |
|---|---|---|
| 만들고 바꾸는 것 | ALB·보안 그룹·롤·클러스터·시크릿·알람 | 이미지, 태스크 정의 리비전 |
| 실행 빈도 | 인프라가 바뀔 때 (드물게) | 코드가 바뀔 때 (자주) |
| 실행 주체 | 사람 또는 인프라 파이프라인 | GitHub Actions |

**태스크 정의가 겹친다.** CloudFormation도 태스크 정의를 만들고, 파이프라인도 새 리비전을 등록한다. 이때 [01](01-iac-and-cloudformation.md)에서 본 드리프트가 생긴다 — 스택이 기억하는 리비전은 `:5`인데 서비스는 파이프라인이 만든 `:9`를 쓰고 있다.

이 어긋남을 다루는 방법이 둘 있다.

**방법 A — `ImageTag` 파라미터로 CloudFormation이 계속 소유한다.**

```yaml
  ImageTag:
    Type: String
    Default: dev
    Description: ECR image tag to run. Mutable environment tag is recommended for DEV bootstrap.
```

CloudFormation을 다시 돌려 배포한다. 스택이 유일한 진실이 되어 드리프트가 없지만, **배포마다 스택 업데이트가 일어난다** — 코드만 바뀌었는데 인프라 변경 절차를 밟는 것이고, 스택 업데이트는 실패하면 롤백이 인프라 전체에 영향을 준다.

**방법 B — 파이프라인이 태스크 정의를 소유한다.**

파이프라인이 현재 정의를 조회해 이미지 URI만 바꿔 새 리비전을 등록하고 서비스를 갱신한다. 배포가 빠르고 인프라와 분리되지만, **스택과 실물이 어긋난다.** 다음 스택 업데이트가 옛 리비전으로 되돌릴 수 있다.

이 프로젝트는 **B**를 쓴다. 배포 롤의 권한 목록(`RegisterTaskDefinition`, `UpdateService`)이 그 증거다. `ImageTag` 파라미터는 `Description`이 말하듯 **첫 부트스트랩용**이다.

**B를 쓸 때의 규율: 스택 업데이트 전에 서비스가 어느 태스크 정의 리비전을 쓰고 있는지 확인한다.** 확인하지 않고 업데이트하면 옛 이미지로 되돌아가고, 증상이 "왜 코드가 예전 것으로 돌아갔지"로 나타나 원인이 잘 안 보인다.

### 수동 트리거를 쓰는 이유

이 파이프라인은 `workflow_dispatch`(사람이 버튼을 눌러 실행)로 동작하고, push 자동 트리거가 없다.

**자동 트리거의 문제는 배포 시점을 사람이 통제하지 못한다는 점이다.** 금요일 저녁 머지가 곧 운영 배포가 되고, 배포 중 문제가 생겼을 때 대응할 사람이 없을 수 있다. 수동 트리거는 "머지"와 "배포"를 분리해 **배포 시점을 사람이 정한다.**

대가는 배포 빈도가 낮아지는 것이고, 배포가 드물면 한 번에 나가는 변경이 커져 문제 발생 시 원인 특정이 어려워진다. **어느 쪽도 공짜가 아니며, 팀 규모와 서비스 중요도가 선택을 정한다.** 사람이 상시 대응 가능하고 롤백이 빠른 조직은 자동 트리거로 작게 자주 배포하는 편이 낫다.

### 시크릿 이원화 — 기존 배포와 공존하기

배포 롤 ARN을 GitHub에 등록할 때 이름을 조심해야 한다는 지침이 주석에 있다.

```yaml
# 생성 후 role ARN을 GitHub repo의 dev environment 시크릿에 등록한다: AWS_ECS_ROLE_DEV
```

표준 이름은 `AWS_ROLE_ARN_DEV`인데 `AWS_ECS_ROLE_DEV`를 쓴다. 이유: **기존 배포 방식(Elastic Beanstalk)이 이미 `AWS_ROLE_ARN_DEV`를 쓰고 있으면, 권한이 다른 ECS 전용 롤을 같은 시크릿에 넣는 순간 기존 배포가 AccessDenied로 깨진다.**

두 롤 모두 같은 OIDC `sub`를 신뢰할 수 있으므로 롤 자체는 공존한다. 문제는 GitHub 시크릿이라는 **이름 하나에 값이 하나**라는 제약이다. 그래서 이행 기간에는 시크릿을 둘로 나눠 병행하고, 옛 방식을 폐기한 뒤 표준 이름으로 되돌린다.

**이런 종류의 이름 충돌은 마이그레이션에서 반복된다.** 신구 시스템이 같은 이름의 설정을 다투므로, 병행 기간에는 이름을 분리하고 정리 시점에 되돌리는 것이 안전하다.

### 이미지 빌드에서 알아둘 두 가지

CloudFormation 밖의 이야기지만 배포 실패의 흔한 원인이라 짚는다.

**아키텍처.** [04](04-ecs-fargate.md)에서 본 대로 태스크는 `X86_64`다. Apple Silicon 맥에서 `docker build`를 하면 arm64가 나오므로 `--platform linux/amd64`가 필요하다. 빠뜨리면 컨테이너가 `exec format error`로 즉시 죽는다.

**이미지 크기.** 멀티스테이지 빌드로 빌드 도구와 개발 의존성을 최종 이미지에서 빼면 크기가 크게 줄고, 크기가 줄면 태스크 기동이 빨라진다. Fargate는 태스크를 띄울 때마다 이미지를 당겨오므로 **이미지 크기가 배포 시간과 스케일 아웃 속도에 직접 들어간다.**

---

## 필수 지식 (HOW)

### 배포 실패 진단표

| 증상 | 원인 | 확인 |
|---|---|---|
| `AssumeRoleWithWebIdentity` 실패, `Not authorized to perform sts:AssumeRoleWithWebIdentity` | `sub`·`aud` 조건 불일치 (환경 이름 오타, 브랜치 스코프인데 환경 스코프로 설정) | 신뢰 정책의 `sub` 문자열, 워크플로의 `environment:` 선언 |
| OIDC 토큰을 얻지 못함 | `permissions: id-token: write` 누락 | 워크플로 `permissions` 블록 |
| ECR push가 403 | 리포지토리 ARN 불일치, 액션 목록 누락 | 배포 롤의 `EcrPushRepo` 문장 |
| `RegisterTaskDefinition` AccessDenied | **`iam:PassRole` 누락** 또는 `PassedToService` 조건 불일치 | 배포 롤의 `PassTaskRoles` 문장 |
| `UpdateService` AccessDenied | 서비스 ARN·클러스터 조건 불일치 | 배포 롤의 `EcsServiceDeploy` 문장 |
| push했는데 서비스가 안 바뀜 | 이미지 다이제스트가 고정돼 있음 | `--force-new-deployment` |
| 배포 후 코드가 예전 것으로 돌아감 | CloudFormation 업데이트가 옛 태스크 정의 리비전을 되돌림 | 서비스의 현재 리비전과 스택 기록 비교 |
| 컨테이너가 `exec format error`로 즉시 종료 | arm64 이미지를 X86_64 태스크로 실행 | `--platform linux/amd64`로 재빌드 |
| 기존(EB 등) 배포가 갑자기 AccessDenied | 같은 GitHub 시크릿 이름에 권한이 다른 롤 ARN을 넣음 | 시크릿 이름 분리 |

---

### ⚠️ 암기 필수

- [ ] **OIDC 신뢰 정책에 `sub` 조건이 없으면 GitHub의 아무 리포지토리나 그 롤을 맡을 수 있다.** 롤 ARN은 비밀이 아니다. (이유: 이 한 줄 누락이 계정 침해로 직결된다)
- [ ] **`sub` 형식은 환경 스코프가 `repo:OWNER/REPO:environment:NAME`, 브랜치 스코프가 `repo:OWNER/REPO:ref:refs/heads/BRANCH`다.** `aud`는 `sts.amazonaws.com`. (이유: 오타 한 글자로 `AssumeRole`이 실패하고, 형식을 외우지 않으면 디버깅이 길어진다)
- [ ] **워크플로에 `permissions: id-token: write`가 없으면 OIDC 토큰을 얻을 수 없다.** (이유: 이것부터 확인하지 않으면 신뢰 정책을 헛되게 뒤진다)
- [ ] **가변 태그(`dev`)만 쓰면 롤백 대상을 지목할 수 없다.** 불변 태그(`dev-<git-sha>`)를 함께 push한다. (이유: 롤백이 필요한 순간에 옛 이미지가 태그를 잃은 상태다)
- [ ] **ECS는 태스크 정의의 이미지 태그를 다이제스트로 고정한다.** 같은 태그에 새 이미지를 push해도 도는 서비스는 바뀌지 않으며 `--force-new-deployment`가 필요하다. (이유: "push했는데 안 바뀌네"의 원인)
- [ ] **파이프라인이 태스크 정의를 소유하는 구조에서는 스택 업데이트가 옛 리비전으로 되돌릴 수 있다.** 업데이트 전에 현재 리비전을 확인한다. (이유: 증상이 "코드가 예전으로 돌아감"이라 원인이 안 보인다)
- [ ] **`ecs wait services-stable` 통과는 ALB 타겟이 healthy라는 뜻이 아니다.** 타겟 헬스를 별도로 확인한다. (이유: 배포 성공 판정 직후 503이 나는 경우)
- [ ] **Apple Silicon에서 빌드하면 arm64가 나온다. X86_64 태스크에는 `--platform linux/amd64`가 필요하다.** (이유: `exec format error`의 유일한 원인이며 메시지가 불친절하다)

---

## 우리 프로젝트와의 연결

- ECR 리포지토리 `orders-server` 하나를 모든 환경이 공유하고, 태그로 환경을 구분
- 이미지 URI를 의사 파라미터로 조립 — 계정·리전 하드코딩 없음
- 배포 롤은 **별도 스택**(`orders-server-iam-deploy-roles.cfn.yaml`) — 수명 주기가 다르고 `CAPABILITY_NAMED_IAM`이 필요하므로
- OIDC 신뢰를 `repo:my-org/orders-server:environment:dev`로 **환경 스코프** 제한 — 타 환경·타 리포지토리 배포 차단
- 배포 롤 권한이 배포 단계와 1:1로 대응, ECR은 리포지토리 한정, ECS는 서비스 ARN + 클러스터 조건으로 이중 제한
- `PassRole`을 실행 롤·태스크 롤 두 개로 한정 + `iam:PassedToService` 조건
- 배포 검증까지 권한에 포함 — `cloudformation:DescribeStacks`로 타겟그룹 ARN을 읽고 `DescribeTargetHealth`로 실제 healthy 확인
- GitHub 시크릿 이름을 `AWS_ECS_ROLE_DEV`로 분리 — 기존 배포 방식과 병행하기 위해
- `ImageTag` 파라미터는 첫 부트스트랩용, 이후 태스크 정의는 파이프라인이 소유

---

## 자가 진단

1. OIDC 신뢰 정책에서 `sub` 조건을 지우면 무엇이 가능해지는가? `aud`만으로는 왜 부족한가?
2. `repo:my-org/orders-server:environment:dev`와 `repo:my-org/orders-server:ref:refs/heads/main`의 차이는? 환경 스코프가 나은 이유는?
3. 가변 태그 `dev`만 쓰면 롤백에서 무엇이 막히는가?
4. `dev` 태그에 새 이미지를 push했는데 서비스가 옛 코드를 돌린다. 왜인가?
5. `RegisterTaskDefinition`이 AccessDenied다. 어느 권한이고 왜 오류 메시지가 오해를 부르는가?
6. 파이프라인이 태스크 정의를 소유할 때, 그 뒤 CloudFormation 스택을 업데이트하면?
7. `ecs wait services-stable`이 통과했는데 접속이 503이다. 무엇을 더 확인해야 했는가?

## 공식 문서

- [GitHub Actions OIDC와 AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws) — 신뢰 정책 구성과 `sub` 형식
- [OIDC 클레임 레퍼런스](https://docs.github.com/en/actions/concepts/security/openid-connect) — 토큰에 담기는 클레임 전체
- [ECS 롤링 업데이트와 이미지 다이제스트 고정](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html) — `versionConsistency`
- [ECR 이미지 태그 변경 가능성](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html) — 가변·불변 태그 설정
- [웹 신원으로 롤 맡기(STS)](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html) — 임시 자격증명 수명

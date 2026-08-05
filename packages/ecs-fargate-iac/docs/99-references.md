# 99. 외부 참고 문서 색인

여기 실린 URL은 **모두 실제로 접속해 응답을 확인한 것**이다(2026-08-05 기준). 추측 URL은 없다.

공식 문서는 **더 깊이 알고 싶을 때** 가는 곳이지, 이 자료를 이해하기 위해 반드시 거쳐야 하는 경로가 아니다. 핵심 내용은 각 문서 본문에 완결적으로 서술돼 있다.

---

## 수치·기본값의 근거

암기 카드에 들어간 값들의 출처다. **의심이 들면 여기서 원문을 확인한다** — 특히 기본값은 AWS가 바꿀 수 있다.

| 확인한 사실 | 출처 |
|---|---|
| Fargate CPU 512 → 메모리 1·2·3·4 GB (조합 표 전체) | [Fargate 태스크 정의의 차이점 § Task CPU and memory](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html) |
| Fargate는 `awsvpc` 모드만 사용 | 같은 문서 § Task networking |
| private 서브넷 태스크의 이미지 pull에 NAT 또는 VPC 엔드포인트 필요 | 같은 문서 § Task networking |
| 등록 해제 지연 기본값 **300초**, draining → unused, 지연 전 연결 종료 시 클라이언트가 500번대 수신 | [타겟그룹 속성 편집 § Deregistration delay](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-target-group-attributes.html) |
| `minimumHealthyPercent` 기본 **100%**(레플리카), `maximumPercent` 기본 **200%** | [DeploymentConfiguration API](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_DeploymentConfiguration.html) |
| 최소는 올림, 최대는 내림 | [태스크 교체 방식 배포](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html) |
| 설정이 교착이면 "태스크를 멈추거나 시작할 수 없다" 서비스 이벤트 발생 | 같은 문서 |
| 서킷 브레이커 임계값 = `clamp(0.5 × desiredCount, 3, 200)`, 기본 `BOUNDED_PERCENT`·값 50 | [서킷 브레이커의 실패 감지 § Failure threshold](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html) |
| `COMPLETED` 배포가 없으면 롤백 불가·배포 정지 | 같은 문서 |
| `resetOnHealthyTask` 기본 `true`(건강한 태스크에 카운트 초기화) | 같은 문서 |
| Fargate Spot **최대 70% 할인** | [Fargate 요금](https://aws.amazon.com/fargate/pricing/) |
| Spot 회수 시 **2분 경고** + SIGTERM, `stopTimeout` 기본 30초·최대 120초, 일반 용량으로 자동 대체 없음 | [Fargate 클러스터와 Spot § termination notices](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html) |
| 용량 공급자 전략에서 `base`는 하나만, `weight` 기본값(API/CLI는 0) | 같은 문서 |
| `TreatMissingData` 기본값 **`missing`**, 네 옵션의 동작, 평가 범위 규칙 | [알람의 결손 데이터 처리](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarms-and-missing-data.html) |
| 알람은 상태 전이 시에만 액션 실행 | [CloudWatch 알람 사용](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html) |
| `DeletionPolicy` 미지정 시 **삭제**, RDS 예외, Secrets Manager는 `ForceDeleteWithoutRecovery`로 삭제 | [DeletionPolicy 속성](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-deletionpolicy.html) |
| CloudFormation·CLI·CDK의 HTTPS 리스너 기본 정책 = **`ELBSecurityPolicy-2016-08`** (콘솔은 다름), `TLS13-1-2-2021-06`은 TLS 1.3·1.2만 지원 | [ALB 보안 정책](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html) |
| `AmazonECSTaskExecutionRolePolicy`에 시크릿 권한 없음 → `secretsmanager:GetSecretValue` 직접 추가 | [ECS 태스크 실행 IAM 롤 § Secrets Manager 권한](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html) |
| 시크릿 값 변경 시 새 배포 또는 태스크 재시작 필요 | [ECS 컨테이너에 민감한 데이터 전달](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html) |
| Secrets Manager **시크릿당 월 $0.40**, API **1만 건당 $0.05** | [Secrets Manager 요금](https://aws.amazon.com/secrets-manager/pricing/) |
| ECS Exec 권한은 태스크 롤, `readonlyRootFilesystem` 미지원, 도는 태스크에 켤 수 없음, 유휴 20분 타임아웃 | [ECS Exec](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html) |
| 이미지 태그를 다이제스트로 해석해 고정, `versionConsistency`로 조절 | [태스크 교체 방식 배포 § Container image resolution](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html) |
| OIDC `sub` 형식(`environment:` / `ref:refs/heads/`), `aud` = `sts.amazonaws.com`, `id-token: write`의 역할 | [GitHub Actions OIDC와 AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws) |

---

## 문서별 링크

### [01 IaC와 CloudFormation](01-iac-and-cloudformation.md)

- [DeletionPolicy 속성](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-deletionpolicy.html) — 네 옵션과 리소스별 기본값 예외
- [UpdateReplacePolicy 속성](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatereplacepolicy.html) — 교체 시 옛 리소스 처리
- [내장 함수 레퍼런스](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference.html) — `Ref`·`GetAtt`·`Sub`·`If` 전체. **`!Ref`가 리소스별로 무엇을 반환하는지는 각 리소스 타입 문서의 "Return values"에서 찾는다**
- [의사 파라미터 레퍼런스](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html) — `AWS::AccountId`·`AWS::Region`·`AWS::NoValue` 등
- [스택 드리프트 감지](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-stack-drift.html) — 감지 방법과 지원 리소스

### [02 네트워크](02-network-vpc-sg.md)

- [VPC 서브넷 구성](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html) — public/private 판정 기준
- [보안 그룹 규칙](https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html) — 상태 저장 동작과 기본값
- [NAT 게이트웨이](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) — 단방향 출구의 동작
- [Fargate 태스크 네트워킹](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html) — `awsvpc` 모드와 ENI

### [03 ALB와 타겟그룹](03-alb-and-target-group.md)

- [타겟그룹 속성 편집](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-target-group-attributes.html) — 등록 해제 지연, 라우팅 알고리즘, 슬로 스타트
- [ALB 보안 정책](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html) — 정책별 TLS 버전 지원 표, 생성 방법별 기본값
- [타겟그룹 헬스체크](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html) — 임계값과 상태 전이
- [ALB 문제 해결](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html) — 502·503·504 원인별 정리

### [04 ECS와 Fargate](04-ecs-fargate.md)

- [Fargate 태스크 정의의 차이점](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html) — CPU/메모리 조합 표, `awsvpc` 강제, 이미지 pull 경로, 로그 드라이버
- [태스크 교체 방식 배포(롤링 업데이트)](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html) — 두 퍼센트의 반올림, 이미지 다이제스트 고정
- [DeploymentConfiguration API](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_DeploymentConfiguration.html) — 기본값과 healthy 판정 조건
- [서킷 브레이커의 실패 감지](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html) — 임계값 공식, 두 단계 판정, 롤백 대상
- [Fargate 클러스터와 Spot](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html) — 2분 경고, `base`/`weight`
- [Fargate 요금](https://aws.amazon.com/fargate/pricing/) — Spot 할인율. **리전별 단가는 이 페이지 또는 요금 계산기에서 확인한다(시점마다 바뀐다)**
- [ECS Exec](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html) — 필요 권한과 제약

### [05 IAM 롤](05-iam-roles.md)

- [ECS 태스크 실행 IAM 롤](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html) — 관리형 정책이 담는 것과 추가해야 하는 권한
- [ECS 태스크 IAM 롤](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html) — 컨테이너 안 코드의 권한, ECS Exec 권한
- [IAM 정책 평가 로직](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html) — Deny 우선과 암묵적 거부
- [서비스에 롤 전달 권한 부여](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_passrole.html) — `PassRole`과 권한 상승 방지
- [서비스별 액션·리소스·조건 키](https://docs.aws.amazon.com/service-authorization/latest/reference/reference_policies_actions-resources-contextkeys.html) — **어떤 액션이 리소스 레벨 권한을 지원하는지 확인하는 곳**
- [CloudFormation IAM 기능 승인](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-template.html) — `CAPABILITY_IAM` / `CAPABILITY_NAMED_IAM`

### [06 시크릿](06-secrets.md)

- [ECS 컨테이너에 민감한 데이터 전달](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html) — `secrets` 필드, 값 변경 시 새 배포 필요, 사이드카·S3 대안
- [Secrets Manager 요금](https://aws.amazon.com/secrets-manager/pricing/) — 시크릿당 $0.40/월, API 1만 건당 $0.05
- [AWS::SecretsManager::Secret (CloudFormation)](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-secretsmanager-secret.html) — `SecretString`과 업데이트 동작
- [put-secret-value CLI](https://docs.aws.amazon.com/cli/latest/reference/secretsmanager/put-secret-value.html) — `file://` 입력 방식

### [07 관측과 알람](07-observability.md)

- [알람의 결손 데이터 처리](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarms-and-missing-data.html) — 네 옵션, 기본값, 평가 범위 규칙과 예시 표. **이 문서의 표 두 개는 직접 볼 값어치가 있다**
- [CloudWatch 알람 사용](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html) — 상태 3종, 액션 실행 조건, 평가 기간 한도
- [메트릭 수식 사용](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html) — `Expression`과 `ReturnData`
- [ALB CloudWatch 지표](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html) — `HealthyHostCount`, Target 5XX와 ELB 5XX의 차이, **디멘션 조합**
- [ECS Container Insights 지표](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-metrics-ECS.html) — `DesiredTaskCount`·`RunningTaskCount`와 디멘션
- [CloudWatch Logs 보존 정책 API](https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_PutRetentionPolicy.html) — 허용되는 일수 목록

### [08 배포 파이프라인](08-deploy-pipeline.md)

- [GitHub Actions OIDC와 AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws) — 신뢰 정책 구성과 `sub` 형식
- [OIDC 개념과 클레임](https://docs.github.com/en/actions/concepts/security/openid-connect) — 토큰에 담기는 클레임 전체
- [ECR 이미지 태그 변경 가능성](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html) — 가변·불변 태그 설정
- [AssumeRoleWithWebIdentity (STS API)](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html) — 임시 자격증명 수명과 파라미터

---

## 이 자료를 넘어서려면

여기까지가 **템플릿 두 장을 읽는 데 필요한 범위**다. 다음 단계로 갈 때 볼 곳:

| 하고 싶은 것 | 볼 곳 |
|---|---|
| 운영 환경(STAGE/PROD)으로 확장 | Fargate 요금 계산기로 비용 추정, `Base`로 일반 용량 확보, 알람 임계값을 비율 기반으로 전환 |
| 무중단 배포를 더 안전하게 | [태스크 교체 방식 배포](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html)의 `BLUE_GREEN`·`CANARY`·`LINEAR` 전략과 `bakeTimeInMinutes` |
| 알람을 애플리케이션 지표로 확장 | [메트릭 수식](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html)으로 5xx **비율** 계산, 배포 실패 판정에 CloudWatch 알람 연동 |
| NAT 비용을 줄이기 | [Fargate 태스크 네트워킹](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html)의 VPC 인터페이스 엔드포인트 |
| 권한을 실제 사용 기록으로 좁히기 | CloudTrail로 호출을 관찰한 뒤 [액션·리소스·조건 키 레퍼런스](https://docs.aws.amazon.com/service-authorization/latest/reference/reference_policies_actions-resources-contextkeys.html)로 정책 축소 |
| 컨테이너 기동을 빠르게 | [Fargate 태스크 정의의 차이점](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html)의 Seekable OCI(SOCI) 지연 로딩 |

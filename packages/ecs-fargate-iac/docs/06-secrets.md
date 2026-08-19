# 06. 시크릿 — 값을 코드에 두지 않으면서 컨테이너에 넣는 방법

## 학습 목표

이 문서를 다 읽으면 (1) 환경변수 평문과 Secrets Manager 참조의 차이를 설명할 수 있고, (2) **이 템플릿이 DB 비밀번호와 Graph 토큰을 다르게 취급하는 근거**를 말할 수 있고, (3) 시크릿 값을 CloudFormation에 두지 않는 플레이스홀더 패턴과 그 패턴이 만드는 세 가지 함정을 피할 수 있다.

## 선수 지식

[01](01-iac-and-cloudformation.md)의 `NoEcho`와 `DeletionPolicy`, [04](04-ecs-fargate.md)의 컨테이너 기동 순서, [05](05-iam-roles.md)의 실행 롤 / 태스크 롤 경계.

---

## 핵심 원리 (WHY)

### 시크릿이 새는 경로는 생각보다 많다

DB 비밀번호를 코드에 적으면 안 된다는 것은 다 안다. 문제는 "코드에 안 적었으면 안전한가"다. 값이 새는 경로를 열거해 보면 방어할 지점이 보인다.

| 경로 | 어디서 새는가 |
|---|---|
| git 이력 | 한 번 커밋되면 `git log -p`로 영구히 조회된다. 나중에 지운 커밋도 남는다 |
| CI 로그 | 배포 스크립트가 값을 에코하면 빌드 로그에 박힌다 |
| 셸 히스토리 | `--secret-string "값"`으로 넘기면 `~/.zsh_history`에 남는다 |
| 프로세스 목록 | 명령줄 인자는 같은 호스트의 다른 프로세스에서 `ps`로 보인다 |
| CloudFormation 이벤트·`describe-stacks` | 파라미터 값이 그대로 기록된다 |
| 태스크 정의 | `describe-task-definition`을 호출할 수 있으면 환경변수 평문이 보인다 |
| 애플리케이션 오류 리포트 | 스택 트레이스에 환경변수 전체를 첨부하는 라이브러리가 있다 |

**한 곳을 막아도 다른 곳으로 나간다.** 그래서 시크릿 관리는 "어디에 두는가" 하나의 결정이 아니라 **경로마다 조치가 필요한 문제**다. 아래에서 이 템플릿이 각 경로에 어떻게 대응하는지 보게 된다.

### 세 가지 보관 방식

AWS에서 컨테이너에 값을 넣는 방식은 실질적으로 셋이다.

| 방식 | 값이 어디 있나 | 태스크 정의에 남는 것 | 비용 |
|---|---|---|---|
| **환경변수 평문** | 태스크 정의 안 | **값 자체** | 없음 |
| **SSM Parameter Store** (SecureString) | Parameter Store | 파라미터 이름 | 표준 파라미터는 무료 |
| **Secrets Manager** | Secrets Manager | 시크릿 ARN | **시크릿당 월 $0.40** + API 호출 1만 건당 $0.05 |

Parameter Store와 Secrets Manager는 둘 다 KMS로 암호화된 키-값 저장소이며 겹치는 부분이 많다. **Secrets Manager만 갖는 것은 자동 회전, 무작위 시크릿 생성, 계정 간 공유다.** 그 기능이 필요 없다면 Parameter Store가 싸다.

### 태스크 정의에서 두 필드의 차이

```yaml
          Environment:                          # ① 평문
            - Name: ACCOUNT_DB_PASSWORD
              Value: !Ref AccountDbPassword
          Secrets:                              # ② 참조
            - Name: GRAPH_REFRESH_TOKEN
              ValueFrom: !Ref GraphRefreshTokenSecret
```

**컨테이너 안에서는 둘이 구별되지 않는다.** 둘 다 환경변수로 보이고, `process.env.ACCOUNT_DB_PASSWORD`와 `process.env.GRAPH_REFRESH_TOKEN`은 똑같이 문자열을 준다. 애플리케이션 코드는 차이를 모른다.

차이는 **값이 태스크 정의에 남는지**다.

```
① Environment 방식
   태스크 정의: { "name": "ACCOUNT_DB_PASSWORD",
                  "value": "실제비밀번호" }
                  ▲ 값이 여기 있다

② Secrets 방식
   태스크 정의: { "name": "GRAPH_REFRESH_TOKEN",
                  "valueFrom": "arn:aws:secretsmanager:...:secret:orders-server/dev/graph-refresh-token-AbCdEf" }
                  ▲ ARN만 있다. 값은 Secrets Manager에
```

`describe-task-definition`은 ECS 읽기 권한만 있으면 호출할 수 있고, 그 권한은 흔히 넓게 부여된다. ①이면 그 순간 값이 보이고, ②면 ARN만 보인다. ARN을 알아도 값을 읽으려면 Secrets Manager 권한이 별도로 필요하다.

**②가 만드는 것은 "권한의 두 번째 관문"이다.** 태스크 정의 조회 권한과 시크릿 조회 권한이 분리되므로, 한쪽만 가진 사람은 값에 닿지 못한다.

### ⭐ 주입은 컨테이너 시작 시점에 한 번만 일어난다

`Secrets` 방식의 동작 순서:

```
1. ECS가 태스크를 시작하려 한다
2. 실행 롤로 Secrets Manager를 호출해 값을 읽는다   ← 여기서 한 번
3. 읽은 값을 환경변수로 컨테이너에 넣는다
4. 컨테이너가 시작된다
```

**2번은 한 번만 일어난다.** 시크릿 값이 그 뒤에 바뀌어도 도는 컨테이너의 환경변수는 옛 값을 들고 있다. 환경변수는 프로세스 시작 시 결정되는 것이라 밖에서 바꿀 방법이 없다.

그래서 **값을 갱신한 뒤에는 태스크를 새로 띄워야 한다.** 공식 문서가 이를 명시한다.

```bash
aws ecs update-service --cluster orders-dev --service orders-server-dev --force-new-deployment
```

`--force-new-deployment`는 태스크 정의가 바뀌지 않았어도 새 배포를 시작한다. 새 태스크가 뜰 때 2번이 다시 일어나 최신 값을 읽는다.

**이 한 번만 성질이 이 문서 뒷부분의 여러 설계를 설명한다.** 값이 자주 바뀌는 시크릿을 주입만으로 다루면 매번 재배포가 필요하고, 그건 재기동 없이 값이 회전해야 하는 상황과 맞지 않는다.

### ⭐ 왜 두 시크릿을 다르게 취급하는가

이 템플릿에는 민감한 값이 둘 있고, 서로 다르게 다뤄진다. **이 비대칭이 의도된 것**이라는 점이 이 문서에서 가장 중요한 내용이다.

| | `ACCOUNT_DB_PASSWORD` | `GRAPH_REFRESH_TOKEN` |
|---|---|---|
| 보관 | CloudFormation 파라미터 → 환경변수 **평문** | Secrets Manager → `Secrets` 참조 |
| 값이 바뀌나 | 거의 안 바뀐다 | **갱신마다 새 값으로 회전한다** |
| 앱이 값을 쓸 수 있어야 하나 | 아니다 | **그렇다** |
| 유출 시 피해 | DEV 공용 계정의 특정 스키마 접근 | 특정 사서함의 읽기 권한 전체 |
| 노출면 | 태스크 정의 한 곳 | Secrets Manager (권한으로 통제) |

**결정적 차이는 "회전이 필요한가"다.**

DB 비밀번호는 값이 고정이다. 환경변수 평문으로 주입해도 개념적으로 어긋나지 않는다. 노출면을 좁히는 조치는 취해져 있다.

- CloudFormation 파라미터에 `NoEcho: true` → 콘솔·이벤트·`describe-stacks`에서 가려진다
- 값이 git에 없고 배포 시점에 CI 시크릿으로 주입된다
- 값 자체가 DEV 공용 자격이라 운영 데이터에 닿지 않는다

남는 노출면은 태스크 정의 한 곳이며, **의식적으로 남긴 것이다.** 이 상태를 개선하는 것과 다른 일 중 무엇을 먼저 할지는 별개 판단이고, 이 템플릿은 "지금은 여기까지"를 명시적으로 선택했다.

Graph 토큰은 사정이 다르다. **환경변수로는 표현 자체가 안 된다.**

- 갱신할 때마다 발급 측이 **새 토큰을 내준다** → 앱이 새 값을 어딘가에 저장해야 한다
- 환경변수는 프로세스가 자기 자신의 값을 바꿀 수 없다(다음 기동에 반영되지 않는다)
- 저장하지 않으면 다음 무인 재기동 때 만료된 옛 토큰으로 시작해 기능이 멈춘다

그리고 유출 시 피해가 다르다. 사서함 읽기 권한을 통째로 내주는 값이므로 접근을 IAM으로 통제해야 한다.

**"성격이 다르면 다르게 다룬다"는 것이 이 비대칭의 원칙이다.** 모든 값을 Secrets Manager에 넣는 것은 일관돼 보이지만, 시크릿당 월 $0.40이 붙고 관리 대상이 늘고 회전 필요 없는 값에 회전 인프라를 붙이는 것이 된다. 그래서 템플릿은 **실제로 그 값을 쓰는 태스크가 생길 때 함께 추가한다**는 규칙을 세워 뒀다 — 쓰지 않는 시크릿을 미리 만들어두지 않는다.

### ⭐ 플레이스홀더 패턴 — 스택은 그릇만 만든다

시크릿 값을 CloudFormation 템플릿에 적으면 값이 git에 들어간다. 그러면 시크릿 관리의 의미가 사라진다. 그래서 **스택은 시크릿 리소스만 만들고, 값은 사람이 따로 넣는다.**

```yaml
  GraphRefreshTokenSecret:
    Type: AWS::SecretsManager::Secret
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      Name: !Sub orders-server/${Env}/graph-refresh-token
      Description: Microsoft Graph 위임 권한 refresh token. 갱신마다 새 값으로 회전한다.
      SecretString: PLACEHOLDER_SET_VIA_PUT_SECRET_VALUE
```

스택 생성 직후 값은 `PLACEHOLDER_SET_VIA_PUT_SECRET_VALUE`이고, 사람이 한 번 실제 값을 주입한다.

**왜 빈 문자열이 아니라 표식인가.** 이유가 두 겹이다.

**첫째, 빈 시크릿은 태스크를 기동 불가로 만든다.** Secrets Manager 시크릿은 값이 없으면 "버전 없음" 상태가 되고, 태스크 정의의 `Secrets:` 해석이 실패한다. 실행 롤이 값을 못 읽으므로 컨테이너가 시작되지 않는다. 운영 중인 서비스에 스택을 업데이트하는 상황이라면 이건 곧 장애다.

**둘째, 표식은 미주입 상태를 드러낸다.** 값이 `PLACEHOLDER_SET_VIA_PUT_SECRET_VALUE`면 태스크는 정상 기동하고, 그 값을 쓰는 기능만 실패한다. 실패 메시지에 이 문자열이 보이면 원인이 즉시 확정된다 — "인증이 왜 안 되지?"에서 "아, 값을 안 넣었네"까지 한 걸음이다. 빈 문자열이나 `dummy`였다면 진단이 길어진다.

**값 주입 시 셸 히스토리와 프로세스 목록을 피하는 방법**도 규정돼 있다.

```bash
ENV=dev
umask 077 && : > /tmp/secret.txt   # 600 권한으로 빈 파일 생성 후 에디터로 값을 채운다

aws secretsmanager put-secret-value \
  --secret-id "orders-server/${ENV}/graph-refresh-token" \
  --secret-string "file:///tmp/secret.txt"

rm -P /tmp/secret.txt
```

`--secret-string "실제값"`으로 직접 넘기면 값이 셸 히스토리와 `ps` 출력에 남는다. 파일 경유(`file://`)로 넘기면 명령줄에는 경로만 남는다. `umask 077`은 파일을 소유자만 읽게 만들고, `rm -P`는 삭제 전에 덮어쓴다.

주입 후에는 위에서 본 대로 태스크를 새로 띄워야 값이 반영된다.

### ⭐ 함정 — 값 주입 후에는 시크릿 리소스 블록을 건드리지 않는다

이 패턴의 가장 위험한 함정이다.

값을 주입한 뒤 템플릿의 시크릿 리소스에서 **`Description`만** 고쳤다고 하자. 값과는 무관한 변경이다. 그런데 CloudFormation이 `UpdateSecret` API를 호출할 때, **템플릿에 적힌 `SecretString`(표식)을 함께 실어 보낸다.** 결과: 실제 값이 표식으로 되돌아갈 수 있다.

```
[주입 후 상태]     값 = 실제 토큰
[Description만 수정 → 배포]
[결과]             값 = PLACEHOLDER_SET_VIA_PUT_SECRET_VALUE  ← 토큰 소실
```

이 토큰은 담당자가 브라우저 로그인을 거쳐 재발급받아야 하는 값이므로, 소실은 사람의 시간을 요구한다.

**규칙: 값이 주입된 시크릿 리소스는 어떤 속성도 수정하지 않는다.** 이름이나 설명을 꼭 바꿔야 한다면 변경 후 값을 다시 주입한다.

템플릿 주석이 이 규칙을 상세히 남겼다.

```yaml
  # ⚠️ 주입 후에는 이 리소스 블록의 **어떤 속성도 수정하지 않는다** — CFN이 UpdateSecret을 보낼 때
  #    SecretString(표식)을 함께 재적용해 실제 값이 날아갈 수 있다. 값을 비우는 대신 표식을 둔 이유는,
  #    버전 없는 빈 시크릿이면 `secrets:` 해석이 실패해 태스크가 기동하지 못하고 운영 중인 서비스가 멈추기 때문이다.
```

**근본적으로는 "CloudFormation이 값을 알면 안 되는데 값 필드를 갖고 있다"는 구조적 어긋남이다.** 대안은 시크릿 리소스를 CloudFormation 밖에서 만들고 템플릿은 ARN을 파라미터로 받는 것인데, 그러면 스택이 시크릿의 존재를 보장하지 못하고 생성 절차가 문서로만 남는다. 어느 쪽도 완전하지 않으며, 이 템플릿은 "스택이 그릇을 만들되 값 필드는 건드리지 않는다"는 규율로 대응한다.

### 토큰 회전 — 앱이 시크릿에 쓰는 이유

Graph 토큰의 회전 구조를 이해하면 [05](05-iam-roles.md)에서 본 태스크 롤의 `PutSecretValue`가 왜 필요한지 알 수 있다.

```
1. 앱이 시크릿에서 refresh token을 읽는다
2. 그 토큰으로 access token을 요청한다 (grant_type=refresh_token)
3. 발급 측이 access token과 함께 **새 refresh token**을 준다
4. 앱이 새 refresh token을 PutSecretValue로 시크릿에 되쓴다   ← 없으면 여기서 끊긴다
5. 다음 갱신은 새 토큰으로
```

**4번을 빠뜨리면 조용히 망가진다.** 앱이 도는 동안은 메모리에 새 토큰이 있어 정상이지만, 다음 재기동 때 시크릿에서 읽어오는 값은 3번에서 이미 소비된 옛 토큰이다. 그 토큰은 유효하지 않아 갱신이 실패하고 기능이 멈춘다. **재기동 시점에 실패하므로 배포와 시간 간격이 벌어져 원인 추적이 어렵다.**

쓰기 대상을 앱에 알려주는 방식도 눈여겨볼 만하다.

```yaml
          Environment:
            # 시크릿 값이 아니라 쓰기 대상 식별자다.
            - Name: GRAPH_REFRESH_TOKEN_SECRET_ID
              Value: !Ref GraphRefreshTokenSecret     # ARN
```

시크릿 ARN을 환경변수로 준다. 앱은 이 값을 `PutSecretValue`의 `--secret-id`로 쓴다.

**왜 코드에 이름을 박지 않는가.** 시크릿 이름이 `orders-server/dev/graph-refresh-token`으로 환경마다 다르기 때문이다. 코드에 박으면 환경별 분기가 코드에 들어가고, 이름을 바꿀 때 코드를 배포해야 한다. **ARN을 주입하면 인프라 변경이 코드 변경을 요구하지 않는다.**

그리고 이건 시크릿이 아니라 **식별자**다. ARN이 노출돼도 값을 읽으려면 IAM 권한이 필요하므로, `Environment` 평문으로 두는 것이 맞다.

### 시크릿 리소스의 수명 — Retain의 대가

```yaml
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
```

[01](01-iac-and-cloudformation.md)에서 본 내용이지만 시크릿 맥락에서 다시 짚을 값어치가 있다.

`Retain`을 붙인 이유: 토큰 재발급에 사람의 재로그인이 필요하므로, 스택을 지우면서 값을 잃으면 복구가 비싸다.

**대가: 같은 이름으로 스택을 다시 만들면 이름 충돌로 실패한다.** 시크릿 이름이 `!Sub orders-server/${Env}/graph-refresh-token`으로 고정돼 있으므로, 남아 있는 시크릿과 부딪힌다.

재생성 전 확인:

```bash
aws secretsmanager list-secrets \
  --filters Key=name,Values="orders-server/dev/" \
  --query 'SecretList[].Name'
```

남아 있으면 두 선택지다: (1) 값을 살리려면 시크릿을 그대로 두고 템플릿에서 이 리소스를 빼 파라미터로 ARN을 받는다, (2) 정리하려면 시크릿을 삭제하고 재생성 후 값을 다시 주입한다.

한 가지 더: **CloudFormation이 시크릿을 삭제할 때의 기본 동작은 복구 대기 기간 없는 즉시 삭제다.** 콘솔·CLI로 삭제하면 기본 7~30일의 복구 기간이 생기지만 CloudFormation 경로에는 그 안전망이 없다. 실수로 `Retain`을 떼고 스택을 지우면 되돌릴 수 없다.

### 토큰을 사람이 재발급할 때

운영 지침에 실측 기반 항목이 하나 있다. 토큰을 사람이 다시 받을 때는 인증 URL에 `prompt=login`과 `login_hint=svc-mailbox@example.com`을 명시한다. 일반 브라우저 창은 기존 로그인 세션을 재사용하면서 추가 인증(OTP)을 요구한 사례가 있었기 때문이다.

**이 종류의 지식은 문서에 없고 실측에서만 나온다.** 인프라 문서에 "이렇게 하면 됩니다"가 아니라 "이렇게 안 하면 이런 일이 있었습니다"가 적혀 있으면, 그건 누군가 그 함정에 빠진 기록이다.

---

## 필수 지식 (HOW)

### 시크릿 접근에 필요한 권한 정리

| 언제 | 어느 롤 | 필요 권한 | 없으면 |
|---|---|---|---|
| 컨테이너 시작 시 주입 | **실행 롤** | `secretsmanager:GetSecretValue` | 태스크가 `ResourceInitializationError`로 기동 실패 |
| 런타임 재조회 | **태스크 롤** | `secretsmanager:GetSecretValue` | 앱이 최신 값을 못 읽음 |
| 회전 값 되쓰기 | **태스크 롤** | `secretsmanager:PutSecretValue` | 재기동 후 옛 토큰으로 시작해 기능 정지 |
| 고객 관리 KMS 키 사용 시 | 해당 롤 | `kms:Decrypt` | 복호화 실패 |

이 템플릿은 KMS 기본 키를 쓰므로 `kms:Decrypt`가 없다. **고객 관리 키(CMK)로 암호화한 시크릿을 참조하면 이 권한이 추가로 필요하고, 없을 때의 증상이 위와 같아서 혼동된다.**

### 증상별 진단

| 증상 | 원인 | 확인 |
|---|---|---|
| 태스크 `STOPPED`, `unable to pull secrets or registry auth` | 실행 롤에 `GetSecretValue` 없음 / 시크릿 ARN 오타 / 시크릿에 버전 없음 | 실행 롤 인라인 정책, 시크릿 값 존재 여부 |
| 값이 `PLACEHOLDER_SET_VIA_PUT_SECRET_VALUE`로 보임 | 주입 안 함, 또는 시크릿 블록 수정으로 표식이 재적용됨 | `get-secret-value`로 현재 값 확인 |
| 값을 갱신했는데 앱이 옛 값을 씀 | 주입은 컨테이너 시작 시 1회 | `--force-new-deployment` |
| 재기동 후에만 인증이 깨짐 | 앱이 회전된 토큰을 되쓰지 않음 | 태스크 롤의 `PutSecretValue`, 앱의 저장 로직 |
| 스택 재생성이 초반에 실패 | `Retain`된 시크릿과 이름 충돌 | `list-secrets`로 잔존 확인 |

---

### ⚠️ 암기 필수

- [ ] **`Secrets` 주입은 컨테이너 시작 시점에 한 번만 해석된다.** 값을 갱신하면 `--force-new-deployment`로 태스크를 새로 띄워야 반영된다. (이유: 이걸 모르면 "값을 바꿨는데 왜 안 바뀌지"에서 오래 머문다)
- [ ] **버전(값) 없는 빈 시크릿을 참조하면 태스크가 기동하지 못한다.** 그래서 빈 값 대신 표식 문자열을 둔다. (이유: 운영 중 서비스에 이 상태로 업데이트하면 장애가 된다)
- [ ] **값이 주입된 시크릿 리소스는 CloudFormation에서 어떤 속성도 수정하지 않는다.** `UpdateSecret`에 `SecretString`이 함께 실려 실제 값이 표식으로 되돌아갈 수 있다. (이유: 재발급에 사람의 재로그인이 필요한 값이면 복구가 비싸다)
- [ ] **`Environment`는 값이 태스크 정의에 남고, `Secrets`는 ARN만 남는다.** 컨테이너 안에서는 둘 다 똑같은 환경변수로 보인다. (이유: `describe-task-definition` 권한만으로 값이 보이는지가 갈린다)
- [ ] **회전이 필요한 값은 환경변수로 표현할 수 없다.** 프로세스가 자기 환경변수를 다음 기동에 반영되게 바꿀 수 없기 때문이다. (이유: Secrets Manager를 쓸지 가르는 첫 기준)
- [ ] **Secrets Manager는 시크릿당 월 $0.40 + API 호출 1만 건당 $0.05다.** 회전·생성·공유가 필요 없으면 SSM Parameter Store가 싸다. (이유: "모든 값을 Secrets Manager에" 판단을 재검토하게 하는 수치)
- [ ] **시크릿 값을 CLI 인자로 넘기지 않는다.** 셸 히스토리와 `ps` 출력에 남는다. `file://` 경유로 넘기고 삭제한다. (이유: 값 자체는 잘 관리했는데 주입 과정에서 새는 흔한 구멍)
- [ ] **CloudFormation의 시크릿 삭제 기본 동작은 복구 기간 없는 즉시 삭제다.** (이유: 콘솔 삭제와 달리 되돌릴 수 없다)

---

## 우리 프로젝트와의 연결

- 민감한 값 둘을 **의도적으로 다르게** 취급 — 회전 필요성과 유출 시 피해 범위가 다르므로
  - `ACCOUNT_DB_PASSWORD`: CloudFormation 파라미터(`NoEcho`) → 환경변수 평문. 노출면은 태스크 정의 한 곳
  - `GRAPH_REFRESH_TOKEN`: Secrets Manager → `Secrets` 참조. 회전과 IAM 통제가 필요
- Secrets Manager를 쓰는 값은 현재 **하나뿐** — 쓰지 않는 시크릿을 미리 만들지 않는다는 규칙
- 플레이스홀더 `PLACEHOLDER_SET_VIA_PUT_SECRET_VALUE` — 빈 값이면 태스크가 기동 못 하고, 표식이면 미주입 상태가 드러난다
- 값 주입은 `file://` 경유 + `umask 077` + `rm -P` — 셸 히스토리·프로세스 목록·파일 잔존을 모두 막음
- 주입 후 시크릿 리소스 블록 **수정 금지** 규칙을 주석으로 명문화
- `GRAPH_REFRESH_TOKEN_SECRET_ID`로 쓰기 대상 ARN을 주입 — 코드에 시크릿 이름을 박지 않기 위해
- 태스크 롤에 `PutSecretValue` — 회전된 토큰을 되쓰지 않으면 다음 재기동에 기능이 멈춘다
- `DeletionPolicy: Retain` + `UpdateReplacePolicy: Retain`, 그 대가로 재생성 시 이름 충돌 확인 절차

---

## 자가 진단

1. `Environment`와 `Secrets`로 넣은 값은 컨테이너 안에서 어떻게 다른가?
2. 시크릿 값을 갱신했는데 앱이 옛 값을 쓴다. 왜이고 어떻게 해결하는가?
3. 왜 시크릿 초기값을 빈 문자열이 아니라 표식 문자열로 두는가? 두 가지 이유를 말하라.
4. 값을 주입한 뒤 시크릿의 `Description`만 고쳐 배포하면 무슨 일이 일어날 수 있는가?
5. DB 비밀번호를 Secrets Manager로 옮기지 않은 근거는? 그 판단이 뒤집히는 조건은?
6. 앱이 `PutSecretValue` 권한을 갖는 것이 왜 필요한가? 없으면 언제 어떻게 깨지는가?
7. `GRAPH_REFRESH_TOKEN_SECRET_ID`를 `Environment` 평문으로 두는 것이 왜 괜찮은가?

## 공식 문서

- [ECS 컨테이너에 민감한 데이터 전달](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html) — `secrets` 필드와 값 변경 시 새 배포 필요
- [Secrets Manager / Systems Manager 권한](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html#task-execution-secrets) — 실행 롤에 추가해야 하는 권한
- [Secrets Manager 요금](https://aws.amazon.com/secrets-manager/pricing/) — 시크릿당 $0.40/월, API 1만 건당 $0.05
- [AWS::SecretsManager::Secret (CloudFormation)](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-secretsmanager-secret.html) — `SecretString`과 업데이트 동작
- [put-secret-value CLI](https://docs.aws.amazon.com/cli/latest/reference/secretsmanager/put-secret-value.html) — `file://` 입력 방식

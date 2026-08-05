# 07. 관측과 알람 — 침묵을 정상으로 볼 것인가, 이상으로 볼 것인가

## 학습 목표

이 문서를 다 읽으면 (1) 로그 그룹의 보존 기간을 왜 반드시 지정해야 하는지 설명할 수 있고, (2) **`TreatMissingData` 네 옵션의 차이와 지표 성격에 따른 선택**을 판정할 수 있고, (3) 이 템플릿의 세 알람이 각각 무엇을 잡고 왜 설정이 다른지 말할 수 있다.

## 선수 지식

[03](03-alb-and-target-group.md)의 healthy 타겟 개념, [04](04-ecs-fargate.md)의 Container Insights와 `DesiredCount`, [01](01-iac-and-cloudformation.md)의 `Fn::If`와 `AWS::NoValue`.

---

## 핵심 원리 (WHY)

### 관측이 없으면 배포는 도박이다

[04](04-ecs-fargate.md)까지 오면 서비스는 돌아간다. 그런데 다음 질문에 답할 수 없다.

- 지금 태스크가 몇 개 돌고 있는가?
- 방금 배포가 성공했는가, 실패한 상태로 멈춰 있는가?
- 30분 전에 500 에러가 났는가?
- 태스크가 죽었다가 다시 살아났는가?

**답하지 못하면 장애를 사용자가 먼저 알게 된다.** 관측(observability)은 이 질문들에 답할 수 있게 만드는 층이고, 세 종류의 데이터로 이뤄진다.

| 종류 | 무엇인가 | 답하는 질문 | 이 템플릿에서 |
|---|---|---|---|
| **로그** | 애플리케이션이 쓴 텍스트 | "그때 무슨 일이 있었나" | CloudWatch Logs |
| **지표** | 시간에 따른 숫자 | "지금 어떤 상태인가" | ALB·ECS 지표 |
| **알람** | 지표가 선을 넘으면 알림 | "언제 사람이 개입해야 하나" | 알람 3종 |

세 층은 서로를 대체하지 못한다. 지표는 "500이 5분간 12건"을 말하지만 어느 요청이 왜 실패했는지는 모른다. 로그는 그걸 알지만 사람이 볼 때만 알려준다. **알람이 로그를 볼 시점을 알려주고, 지표가 어디를 볼지 좁힌다.**

### 로그 — 보존 기간을 지정하지 않으면 영구히 쌓인다

```yaml
  LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub /ecs/orders-server-${Env}
      RetentionInDays: !Ref LogRetentionDays    # 기본 7
```

CloudWatch Logs의 구조는 두 층이다.

```
[로그 그룹]  /ecs/orders-server-dev        ← 보존 기간·권한·암호화 설정 단위
   ├─ [로그 스트림] ecs/orders-server/abc123...   ← 태스크 하나
   ├─ [로그 스트림] ecs/orders-server/def456...   ← 다른 태스크
   └─ ...
```

로그 스트림은 태스크마다 하나씩 자동으로 생긴다. [04](04-ecs-fargate.md)의 `awslogs-stream-prefix: ecs`가 스트림 이름 앞부분을 정하고, 뒤에 컨테이너 이름과 태스크 ID가 붙는다. **배포할 때마다 스트림이 새로 생기므로, 스트림 목록이 곧 배포 이력에 가깝다.**

**`RetentionInDays`를 지정하지 않으면 기본값이 "만료 없음"이다.** 로그가 영구히 쌓이고 저장 요금이 계속 늘어난다. DEV 환경에서 몇 년 전 로그를 볼 일은 없는데 요금은 매달 나간다.

이 템플릿은 7일로 잡았다. 값이 `AllowedValues`로 제한돼 있는데, 이건 취향이 아니라 **CloudWatch가 정해진 값만 받기 때문이다.**

```yaml
  LogRetentionDays:
    Type: Number
    Default: 7
    AllowedValues: [1, 3, 5, 7, 14, 30, 60, 90, 180, 365]
```

임의 숫자(예: 10)를 넣으면 AWS API가 거부한다. `AllowedValues`가 그 실패를 CloudFormation 검증 단계로 앞당긴다 — [01](01-iac-and-cloudformation.md)에서 본 "실패를 앞으로 당기기"의 예다.

7일이 적절한가. 환경에 따라 다르다.

| 환경 | 적정 | 근거 |
|---|---|---|
| DEV | 7일 | 어제 배포의 문제를 오늘 조사한다. 그 이상은 안 본다 |
| STAGE | 30일 | 부하 시험 결과를 비교한다 |
| PROD | 90일 이상 | 사고 조사, 감사 요구, 분기 단위 추이 |

**"길수록 좋다"가 아니라 "실제로 볼 기간"이 기준이다.** 90일을 넘겨 보관해야 한다면 S3로 내보내는 것이 저장 단가가 훨씬 싸다.

### 지표 — 네 요소로 하나의 시계열이 특정된다

CloudWatch 지표 하나를 지목하려면 네 가지가 필요하다.

```yaml
      Namespace: AWS/ApplicationELB        # ① 어느 서비스의 지표인가
      MetricName: HealthyHostCount         # ② 어떤 지표인가
      Dimensions:                          # ③ 어느 리소스의 것인가
        - Name: TargetGroup
          Value: !GetAtt TargetGroup.TargetGroupFullName
        - Name: LoadBalancer
          Value: !GetAtt Alb.LoadBalancerFullName
      Statistic: Minimum                   # ④ 기간 안의 여러 값을 어떻게 줄이는가
      Period: 60
```

**③ 디멘션이 가장 자주 실수가 나는 곳이다.** 디멘션은 지표의 "좌표"이며, **정확히 일치해야** 데이터가 나온다. ALB의 `HealthyHostCount`는 `TargetGroup`과 `LoadBalancer` 두 디멘션을 요구하고, 하나만 적으면 그 조합의 지표가 존재하지 않아 **데이터가 영원히 오지 않는다.**

그리고 디멘션 값이 ARN이 아니라 특정 형식의 문자열이다.

```
TargetGroupFullName    → targetgroup/orders-server-dev-tg/1234567890abcdef
LoadBalancerFullName   → app/orders-server-dev-Alb-XYZ/abcdef1234567890
```

ARN을 문자열로 잘라내는 대신 [01](01-iac-and-cloudformation.md)에서 본 `!GetAtt`의 전용 속성을 쓴다. **오타 난 디멘션은 오류를 내지 않고 조용히 데이터 없음이 된다** — 알람이 영원히 `INSUFFICIENT_DATA`에 머물고, 감시한다고 믿는 것이 감시되지 않는다.

**④ 통계**의 선택도 의미를 바꾼다. 60초 동안 값이 여러 개 들어오면 그걸 하나로 줄여야 한다.

| 통계 | 의미 | 언제 |
|---|---|---|
| `Minimum` | 기간 중 최솟값 | "한 번이라도 0으로 떨어졌나" |
| `Maximum` | 기간 중 최댓값 | "한 번이라도 치솟았나" |
| `Average` | 평균 | 추세 |
| `Sum` | 합계 | 카운트성 지표(에러 건수) |

`HealthyHostCount`에 `Minimum`을 쓴 것은 **"1분 중 한 순간이라도 healthy가 0이었나"를 묻는 것이다.** `Average`를 쓰면 30초는 0이고 30초는 1이었을 때 0.5가 되어 임계값 1 미만을 넘지만, 실제로 몇 초간 완전히 죽었던 사실이 평균에 묻힌다. **가용성 지표에는 최악을 보는 통계가 맞다.**

### 알람의 세 가지 상태

```
OK                 지표가 임계값 안에 있다
ALARM              임계값을 넘었다
INSUFFICIENT_DATA  판단할 데이터가 부족하다
```

**세 번째 상태의 존재가 이 문서의 핵심 주제로 이어진다.** 데이터가 없을 때 알람은 무엇을 해야 하는가?

알람이 상태를 판정하는 데 쓰는 값은 넷이다.

```yaml
      Threshold: 1
      ComparisonOperator: LessThanThreshold
      Period: 60
      EvaluationPeriods: 2
      DatapointsToAlarm: 2
```

- `Threshold` + `ComparisonOperator` — "값 < 1이면 위반"
- `Period` — 데이터 포인트 하나의 길이 (60초)
- `EvaluationPeriods` — 최근 몇 개를 볼 것인가 (N)
- `DatapointsToAlarm` — 그중 몇 개가 위반이면 ALARM인가 (M)

**이걸 "M out of N"이라 부른다.** `DatapointsToAlarm`을 생략하면 M = N이 된다(전부 위반해야 ALARM).

이 두 값의 조합이 민감도를 정한다.

| M / N | 성격 | 위험 |
|---|---|---|
| 1 / 1 | 즉시 반응 | 일시적 튐에 오탐 |
| 2 / 2 | 연속 2회 위반 필요 | 균형 (이 템플릿의 첫 알람) |
| 3 / 5 | 5개 중 3개 위반 | 간헐적 문제도 잡지만 반응이 늦다 |

**알람이 늦으면 장애가 길어지고, 민감하면 사람이 알람을 무시하게 된다.** 두 번째가 더 위험하다 — 오탐이 반복되면 진짜 알람도 함께 무시된다.

### ⭐ TreatMissingData — 이 문서에서 가장 중요한 개념

데이터 포인트가 안 들어올 수 있다. 지표를 보내는 리소스가 사라졌거나, 그 지표가 원래 이벤트가 있을 때만 발생하는 종류이거나, 수집 경로에 문제가 있는 경우다.

네 옵션이 있고, **기본값은 `missing`이다.**

| 옵션 | 결손 데이터를 무엇으로 취급 | 결과 |
|---|---|---|
| `notBreaching` | 정상 (임계값 안) | 데이터 없으면 `OK` |
| `breaching` | 위반 | 데이터 없으면 `ALARM` |
| `ignore` | 판단하지 않음 | **현재 상태 유지** |
| `missing` (기본) | 결손 그대로 | 전부 결손이면 `INSUFFICIENT_DATA` |

**기본값 `missing`이 위험한 이유:** `INSUFFICIENT_DATA`는 `ALARM`이 아니다. `AlarmActions`가 발동하지 않는다. 즉 **"지표가 아예 안 오는 상황"에서 알림이 오지 않는다.**

그런데 지표가 안 오는 상황은 종종 최악의 상황이다. 태스크가 전부 죽었거나, 로드밸런서가 사라졌거나, 클러스터가 없어졌을 때 지표는 멈춘다. **가장 심각한 장애가 알림을 만들지 않는 것이다.**

이 함정을 피하려면 **지표의 성격에 따라 옵션을 골라야 한다.**

```
이 지표는 정상일 때 항상 데이터가 오는가?
  ├─ 예 (연속 지표: healthy 호스트 수, CPU 사용률, 실행 중 태스크 수)
  │     → breaching   ("데이터가 없다 = 무언가 잘못됐다")
  └─ 아니오 (이벤트 지표: 5xx 건수, 스로틀 건수)
        → notBreaching ("데이터가 없다 = 에러가 없었다 = 정상")
```

**이 한 갈래가 알람 설계에서 가장 자주 틀리는 판단이다.** 그리고 이 템플릿의 세 알람이 정확히 이 갈래를 보여준다.

### CloudWatch가 결손을 실제로 다루는 방식

기억할 값어치가 있는 세부가 하나 있다. CloudWatch는 `EvaluationPeriods`보다 **더 많은 데이터 포인트를 가져온다.** 이 넓은 범위를 **평가 범위(evaluation range)**라 한다.

동작 규칙:

1. 결손이 없으면 → 최근 N개로 판정. 여분은 버린다
2. 결손이 있지만 **실제 데이터가 N개 이상 모이면** → 그것으로 판정. **`TreatMissingData` 설정은 쓰이지 않는다**
3. 실제 데이터가 N개보다 적으면 → 부족한 만큼만 `TreatMissingData`로 채워 판정

**2번이 중요하다.** `TreatMissingData: breaching`이라고 무조건 알람이 울리는 게 아니다. 실제 데이터가 충분히 있으면 그것이 우선한다. 즉 `breaching`은 "결손을 나쁘게 본다"보다 **"판단할 실제 데이터가 정말 없을 때 나쁘게 본다"**에 가깝다.

이 설계가 오탐을 줄인다. 지표가 간헐적으로 빠지는 흔한 상황에서 알람이 튀지 않는다.

---

## 필수 지식 (HOW)

### 알람 1 — healthy 호스트가 0인가

```yaml
  AlarmHealthyHostZero:
    Properties:
      Namespace: AWS/ApplicationELB
      MetricName: HealthyHostCount
      Statistic: Minimum
      Period: 60
      EvaluationPeriods: 2
      DatapointsToAlarm: 2
      Threshold: 1
      ComparisonOperator: LessThanThreshold
      TreatMissingData: breaching          # ← 침묵을 이상으로 본다
```

**무엇을 잡는가:** ALB 뒤에 건강한 타겟이 하나도 없는 상태. 이건 [03](03-alb-and-target-group.md)에서 본 503의 직접 원인이다. **사용자에게 서비스가 완전히 안 보이는 상황**이며, 이 템플릿의 알람 중 가장 심각하다.

**왜 `breaching`인가:** `HealthyHostCount`는 타겟그룹이 존재하는 동안 계속 보고되는 연속 지표다. 데이터가 안 온다는 것은 **타겟그룹 자체에 문제가 있거나 ALB가 사라졌다는 뜻**이다. 그걸 `INSUFFICIENT_DATA`로 두면 최악의 상황에서 알림이 없다.

**왜 2/2인가:** 배포 중에는 healthy 수가 순간적으로 흔들릴 수 있다. 1/1이면 정상 배포마다 알람이 울려 사람이 무시하기 시작한다. 2분 연속 0이면 배포 중 흔들림이 아니다.

### 알람 2 — 원하는 개수보다 적게 돌고 있는가

이 알람이 구조적으로 가장 복잡하다. **하나의 지표로는 표현할 수 없는 것을 묻기 때문이다.**

```yaml
  AlarmRunningBelowDesired:
    Properties:
      Metrics:
        - Id: desired
          MetricStat:
            Metric:
              Namespace: ECS/ContainerInsights
              MetricName: DesiredTaskCount
              Dimensions: [ClusterName, ServiceName]
            Period: 60
            Stat: Maximum
          ReturnData: false          # ← 재료. 판정에 직접 쓰지 않는다
        - Id: running
          MetricStat:
            Metric:
              MetricName: RunningTaskCount
              ...
            Stat: Minimum
          ReturnData: false          # ← 재료
        - Id: deficit
          Expression: desired - running    # ← 계산
          Label: Desired minus running tasks
          ReturnData: true           # ← 이것으로 판정한다
      Threshold: 1
      ComparisonOperator: GreaterThanOrEqualToThreshold
      EvaluationPeriods: 5
      DatapointsToAlarm: 3
      TreatMissingData: breaching
```

**왜 수식이 필요한가.** "태스크가 부족하다"는 절대 개수로 표현할 수 없다. `RunningTaskCount < 1`로 잡으면 `DesiredCount`를 2로 올렸을 때 1개만 돌아도 정상으로 본다. **부족은 원하는 개수와의 차이이므로 두 지표를 함께 봐야 한다.**

**메트릭 수식(metric math)**이 이걸 가능하게 한다. 여러 지표를 `Id`로 이름 붙여 가져오고, `Expression`으로 계산하고, `ReturnData: true`인 것 하나로 알람을 판정한다.

**`ReturnData`의 규칙: 정확히 하나만 `true`여야 한다.** 재료 지표는 `false`로 둔다. 여러 개를 `true`로 두면 알람이 무엇을 기준으로 판정할지 알 수 없어 배포가 실패한다.

**두 지표의 통계 방향이 다른 것**이 눈여겨볼 부분이다.

```
desired → Maximum   (원하는 개수는 최대로 본다)
running → Minimum   (도는 개수는 최소로 본다)
                    → 차이가 가장 크게 나오는 조합
```

**보수적으로 잡기 위한 의도적 선택이다.** 1분 안에 desired가 1→2로 바뀌고 running이 2→1로 흔들렸다면, 이 조합은 부족을 `2 - 1 = 1`로 잡아낸다. 둘 다 `Average`였다면 차이가 0에 가까워져 놓친다. **가용성 알람은 놓치는 쪽이 오탐보다 비싸므로 최악을 보는 방향으로 통계를 고른다.**

**왜 3/5인가:** 알람 1(2/2)보다 관대하다. 배포 중에는 running이 desired보다 잠깐 적은 것이 **정상**이다 — 옛 태스크를 내리고 새 태스크가 healthy가 되기 전 구간이 있다. 2/2로 잡으면 정상 배포마다 알람이 울린다. 5분 중 3분간 부족하면 배포 지연이 아니라 문제다.

**이 알람은 Container Insights에 의존한다.** [04](04-ecs-fargate.md)에서 켠 그 설정이 `ECS/ContainerInsights` 네임스페이스의 지표를 만든다. 끄면 이 알람이 영원히 데이터를 받지 못하고, `TreatMissingData: breaching`이라 **영원히 ALARM에 머문다.** 설정 하나가 알람 하나를 망가뜨리는 의존이며, 이런 연결은 문서에 남기지 않으면 잊힌다.

### 알람 3 — 5xx 에러가 발생했는가

```yaml
  AlarmTarget5xxErrors:
    Properties:
      MetricName: HTTPCode_Target_5XX_Count
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: GreaterThanOrEqualToThreshold
      TreatMissingData: notBreaching        # ← 침묵을 정상으로 본다
```

**무엇을 잡는가:** 타겟(컨테이너)이 반환한 5xx 응답. `HTTPCode_Target_5XX_Count`는 **타겟이 낸 에러**만 센다. ALB 자체가 낸 5xx(healthy 타겟 없음으로 인한 503 등)는 `HTTPCode_ELB_5XX_Count`라는 별도 지표다. **둘을 구분하지 못하면 "애플리케이션 에러"와 "인프라 문제"를 섞어 본다.**

**⭐ 왜 `notBreaching`인가 — 알람 1·2와 정반대인 이유:**

`HTTPCode_Target_5XX_Count`는 **에러가 발생했을 때만 데이터 포인트가 생기는 이벤트 지표**다. 에러가 하나도 없으면 데이터가 아예 없다. 즉 **결손이 정상 상태의 표현이다.**

여기에 `breaching`을 붙이면 무슨 일이 일어나는가. **에러가 없는 평온한 시간에 알람이 계속 울린다.** 서비스가 완벽하게 동작할 때 ALARM 상태가 되는 것이다. 몇 번 겪으면 사람이 이 알람을 끄고, 진짜 에러가 났을 때도 아무도 모른다.

**같은 템플릿 안에서 `breaching`과 `notBreaching`이 함께 쓰인 것이 헷갈린다면, 판단 기준을 다시 확인한다: "정상일 때 데이터가 오는가?"** healthy 호스트 수는 온다(그래서 침묵은 이상). 5xx 건수는 안 온다(그래서 침묵은 정상).

**왜 임계값 1인가:** 5분에 5xx 한 건이라도 알림을 보낸다. DEV 환경에서는 정당하다 — 접근하는 사람이 개발자 몇 명뿐이라 에러 한 건이 실제로 문제다. **운영 환경에서 그대로 쓰면 오탐이 쏟아진다.** 트래픽이 많으면 크롤러·스캐너·클라이언트 오류로 5xx가 상시 발생한다. 운영에서는 절대 건수 대신 **비율**(5xx / 전체 요청)을 메트릭 수식으로 잡거나, 임계값을 트래픽에 맞게 올린다.

**왜 `Period: 300`인가:** 5분 단위로 합계를 낸다. 60초로 잡으면 같은 에러 폭발이 여러 데이터 포인트로 쪼개져 알람이 여러 번 상태 전이를 하고 알림이 반복된다. 카운트성 지표는 기간을 넓게 잡는 편이 알림이 조용하다.

### 세 알람 비교 — 설정이 다른 이유를 한 표로

| | 알람 1 (healthy 0) | 알람 2 (태스크 부족) | 알람 3 (5xx) |
|---|---|---|---|
| 지표 성격 | 연속 | 연속 (수식) | **이벤트** |
| 통계 | `Minimum` | `Maximum` − `Minimum` | `Sum` |
| 기간 | 60초 | 60초 | **300초** |
| M / N | 2 / 2 | **3 / 5** | 1 / 1 |
| 결손 처리 | `breaching` | `breaching` | **`notBreaching`** |
| 왜 그 민감도인가 | 배포 중 흔들림 무시, 2분이면 진짜 | 배포 중 부족은 정상, 5분 중 3분이면 문제 | 에러 한 건도 놓치지 않음(DEV) |

**세 알람이 서로 다른 값을 쓰는 것이 일관성 부족이 아니라, 지표 성격에 맞춘 결과다.** 반대로 세 알람에 같은 설정을 복사하면 하나는 오탐하고 하나는 놓친다.

### 알림 발송 — 조건부로 붙이기

```yaml
      AlarmActions:
        Fn::If:
          - HasAlarmSns
          - - Ref: AlarmSnsTopicArn
          - Ref: AWS::NoValue
      OKActions:
        Fn::If:
          - HasAlarmSns
          - - Ref: AlarmSnsTopicArn
          - Ref: AWS::NoValue
```

`AlarmActions`는 ALARM으로 전이할 때, `OKActions`는 OK로 돌아올 때 실행할 것을 지정한다. 대상은 **SNS 토픽**이며, 토픽에 이메일·Slack·Lambda를 붙여 알림을 뿌린다.

**`OKActions`를 함께 넣는 것이 중요하다.** ALARM 알림만 보내면 "복구됐는지"를 사람이 콘솔에서 확인해야 한다. 복구 알림이 오면 스스로 나은 문제인지 개입이 필요한 문제인지 구분된다.

`AlarmSnsTopicArn` 파라미터가 비어 있으면 [01](01-iac-and-cloudformation.md)에서 본 `AWS::NoValue`로 속성 자체가 사라진다. **알람은 만들어지고 상태 전이도 하지만 아무 데도 알리지 않는다.**

지금 DEV에서 이 파라미터는 비어 있다. 즉 **알람이 울려도 아무도 모른다.** 콘솔에서 봐야 한다. 이건 "알람을 미리 정의해 두고 알림 채널은 나중에 붙인다"는 단계적 접근이고, 정당하지만 **위험을 알고 있어야 한다** — 알람이 있다는 사실이 감시되고 있다는 착각을 만들 수 있다. 알람을 정의하는 것과 알림을 받는 것은 다른 일이다.

**알람은 상태가 바뀔 때만 액션을 실행한다.** ALARM에 머무는 동안 계속 알리지 않는다. 이 성질 때문에 알림을 놓치면 다시 오지 않으므로, 실제 운영에서는 SNS 구독자를 여러 채널로 두는 편이 안전하다.

### 알람 이름은 고정돼 있다

```yaml
      AlarmName: !Sub orders-server-${Env}-healthy-host-zero
```

[01](01-iac-and-cloudformation.md)에서 "고정 이름을 피하라"고 했는데 알람에는 이름을 줬다. 알람은 교체를 유발하는 속성이 거의 없고(대부분 중단 없이 갱신된다), **알림을 받는 사람이 알람 이름으로 상황을 판단하기 때문**이다. `orders-server-dev-Alarm-XYZ123`이라는 이름으로 알림이 오면 무슨 알람인지 알 수 없다.

**이름의 문법이 정보를 담게 짜여 있다.** `{서비스}-{환경}-{증상}` 형태이므로, 알림 제목만 보고 어느 서비스의 무슨 문제인지 안다.

---

### ⚠️ 암기 필수

- [ ] **`TreatMissingData` 기본값은 `missing`이며, 결과는 `INSUFFICIENT_DATA`라서 알림이 발동하지 않는다.** (이유: 태스크 전멸처럼 가장 심각한 상황이 지표를 멈추게 하는데, 기본값이면 그때 조용하다)
- [ ] **정상일 때 항상 데이터가 오는 연속 지표는 `breaching`, 에러가 있을 때만 오는 이벤트 지표는 `notBreaching`.** (이유: 반대로 하면 하나는 평온할 때 계속 울리고 하나는 최악에 침묵한다)
- [ ] **`HTTPCode_Target_5XX_Count`는 타겟이 낸 5xx, `HTTPCode_ELB_5XX_Count`는 ALB가 낸 5xx다.** (이유: 애플리케이션 에러와 인프라 문제를 섞어 보면 진단이 엉킨다)
- [ ] **로그 그룹에 `RetentionInDays`를 지정하지 않으면 만료 없이 영구 보존된다.** 값은 정해진 목록(1·3·5·7·14·30·60·90·180·365…)만 받는다. (이유: 지정을 잊으면 요금이 계속 늘고, 임의 숫자는 API가 거부한다)
- [ ] **메트릭 수식에서 `ReturnData: true`는 정확히 하나여야 한다.** (이유: 여러 개면 판정 기준이 모호해 배포가 실패한다)
- [ ] **알람은 상태가 전이할 때만 액션을 실행하며, ALARM에 머무는 동안 반복 알림하지 않는다.** (이유: 알림 하나를 놓치면 다시 오지 않는다)
- [ ] **알람 디멘션이 틀리면 오류 없이 데이터 없음이 되고, 알람이 `INSUFFICIENT_DATA`에 영원히 머문다.** (이유: 감시한다고 믿는 것이 감시되지 않는 조용한 실패)
- [ ] **CloudWatch는 실제 데이터가 `EvaluationPeriods`만큼 모이면 `TreatMissingData` 설정을 쓰지 않는다.** 결손 처리는 데이터가 부족할 때만 적용된다. (이유: `breaching`이 무조건 알람을 울린다는 오해를 막는다)

---

## 우리 프로젝트와의 연결

- 로그 그룹 `/ecs/orders-server-dev`, 보존 7일 — DEV에서 볼 기간에 맞춤
- 알람 3종이 서로 다른 층을 감시: **사용자 가시성**(healthy 0) / **용량**(태스크 부족) / **애플리케이션 품질**(5xx)
- 알람 1은 `Minimum` + `breaching` — 1분 중 한 순간이라도 0이면 잡고, 지표 침묵도 이상으로 본다
- 알람 2는 메트릭 수식 `desired - running` — 절대 개수로 표현할 수 없는 "부족"을 계산. `Maximum` − `Minimum` 조합으로 보수적 판정
- 알람 2는 Container Insights 의존 — 그 설정을 끄면 영원히 ALARM에 머문다
- 알람 3만 `notBreaching` — 이벤트 지표이므로 침묵이 정상
- 알람 3의 임계값 1은 DEV 기준. 운영에서는 5xx **비율**로 바꿔야 한다
- `AlarmSnsTopicArn`이 비어 있어 **현재 알림 채널이 없다** — 알람은 정의됐지만 콘솔에서만 보인다
- `OKActions`도 함께 지정 — 복구 알림으로 개입 필요 여부를 구분

---

## 자가 진단

1. `TreatMissingData` 기본값은 무엇이고, 그 결과 태스크가 전부 죽으면 알림이 오는가?
2. 5xx 건수 알람에 `breaching`을 쓰면 무슨 일이 일어나는가?
3. `HealthyHostCount`에 `Average`를 쓰면 왜 `Minimum`보다 나쁜가?
4. "태스크가 부족하다"를 `RunningTaskCount < 1`로 잡으면 어떤 경우를 놓치는가?
5. 알람 2에서 `ReturnData`가 두 개 `true`면?
6. 알람 1은 2/2인데 알람 2는 3/5다. 왜 다른가?
7. 알람 디멘션에서 `LoadBalancer`를 빼면 어떤 증상이 나오는가?
8. `AlarmSnsTopicArn`이 비어 있으면 알람은 어떻게 동작하는가?

## 실습

**과제 7-1 — CloudWatch 알람 평가기** (`src/7-1-alarm-eval.ts`)

데이터 포인트 시퀀스(정상·위반·결손)와 알람 설정을 받아 최종 상태를 판정한다. M out of N, 네 가지 결손 처리, "실제 데이터가 충분하면 결손 설정을 쓰지 않는다"는 규칙까지 구현한다.

무엇을 만들지는 `tests/7-1-alarm-eval.test.ts`가 정의한다. **먼저 읽고** `src/7-1-alarm-eval.ts`의 `🎯 TODO`를 채운다.

```bash
cd packages/ecs-fargate-iac
pnpm test 7-1
```

## 공식 문서

- [알람의 결손 데이터 처리](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarms-and-missing-data.html) — 네 옵션, 기본값 `missing`, 평가 범위 규칙과 예시 표
- [CloudWatch 알람 사용](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html) — 상태 3종과 액션 실행 조건
- [메트릭 수식 사용](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html) — `Expression`과 `ReturnData`
- [ALB CloudWatch 지표](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html) — `HealthyHostCount`, Target 5XX와 ELB 5XX의 차이
- [Container Insights 지표](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-metrics-ECS.html) — `DesiredTaskCount`·`RunningTaskCount`
- [CloudWatch Logs 보존 기간](https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_PutRetentionPolicy.html) — 허용되는 일수 목록

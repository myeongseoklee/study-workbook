# 검증한 1차 출처 색인

마지막 확인: **2026-11-05**. 아래는 실제로 열어 확인한 표준·공식 문서·저자 원문이다. 제품 설정은 이후 바뀔 수 있다. 핵심 설명은 교재 본문에 있으며, 출처는 검증과 심화 탐색을 위한 것이다.

계산 예제는 교재에 적은 가정에서 계산했으며 외부 벤치마크를 인용하지 않았다. 실제 요금·용량 한도는 자료에 넣지 않았다. 운영 구성에 관한 미확인 사실을 교재에서 확정하지 않았다.

## 주소·DNS·HTTP·연결 보호 — 02~05장

| 출처 | 확인한 내용 |
|---|---|
| [MDN: How the web works](https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/How_the_web_works) | 이름 해석과 요청의 입문 흐름 |
| [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034) | DNS 개념·분산 구조·캐시 |
| [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293) | TCP의 연결과 바이트 스트림 보장 |
| [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446) | TLS 1.3의 상대 검증과 암호화 |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) | HTTP 요청·응답·502·504 의미 |
| [RFC 9114](https://www.rfc-editor.org/rfc/rfc9114) | HTTP/3가 QUIC에 매핑된다는 예외 |
| [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918) | 인터넷에서 직접 라우팅하지 않는 사설 주소 |

## 네트워크 경계 — 05장

| 출처 | 확인한 내용 |
|---|---|
| [VPC 서브넷 CIDR](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html) | 비트 수와 주소 범위·플랫폼 예약 주소 |
| [VPC 서브넷 라우팅](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-route-tables.html) | 목적지와 다음 전달 대상·기본 경로 |
| [인터넷 게이트웨이](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html) | 퍼블릭 서브넷·공인 주소·경로의 조건 |
| [보안 그룹](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html) | 상태 추적과 연결의 반환 트래픽 |
| [네트워크 ACL](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html) | 서브넷 정책과 상태 비추적 |
| [NAT gateway](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) | 연결 방향·public NAT와 private NAT 구분 |

## 실행 환경 — 01·06·07장

| 출처 | 확인한 내용 |
|---|---|
| [Linux socket(7)](https://man7.org/linux/man-pages/man7/socket.7.html) | 소켓과 프로세스·수신 인터페이스 |
| [Linux pthreads(7)](https://man7.org/linux/man-pages/man7/pthreads.7.html) | 프로세스 안의 스레드와 공유 자원 |
| [Linux signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html) | 시그널 처리·SIGTERM·SIGKILL |
| [Linux namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html) | 자원의 관찰 범위 격리 |
| [Linux cgroups(7)](https://man7.org/linux/man-pages/man7/cgroups.7.html) | 자원 사용 관리와 제한 |
| [Node.js 이벤트 루프](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop) | 긴 동기 작업과 다른 요청의 지연 |
| [Docker 컨테이너 개념](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/) | 컨테이너와 가상머신의 차이 |
| [Docker 포트 게시](https://docs.docker.com/get-started/docker-concepts/running-containers/publishing-ports/) | 호스트·컨테이너 포트와 EXPOSE |
| [Docker 볼륨](https://docs.docker.com/engine/storage/volumes/) | 컨테이너와 별도인 데이터 수명 |
| [Docker 이미지 다이제스트](https://docs.docker.com/dhi/explore/security-concepts/digests/) | 태그와 불변 식별·다중 플랫폼 매니페스트 |

## 데이터 — 08·09장

| 출처 | 확인한 내용 |
|---|---|
| [PostgreSQL 트랜잭션](https://www.postgresql.org/docs/current/tutorial-transactions.html) | 작업 단위와 원자성 |
| [PostgreSQL 격리](https://www.postgresql.org/docs/current/transaction-iso.html) | 동시 실행과 격리·충돌 처리 |
| [PostgreSQL 인덱스](https://www.postgresql.org/docs/current/indexes-intro.html) | 읽기 이점과 유지 비용 |
| [PostgreSQL 제약 조건](https://www.postgresql.org/docs/current/ddl-constraints.html) | 유일성·업무 제약과 동시 요청 |
| [PostgreSQL 백업과 복구](https://www.postgresql.org/docs/current/backup.html) | 백업 방식과 복원 전제 |
| [복구 목표 RTO·RPO](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/disaster-recovery-dr-objectives.html) | 허용 복구 지연과 데이터 손실 범위 |
| [S3 개념](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html) | 객체와 키를 통한 저장 |
| [EBS 개념](https://docs.aws.amazon.com/ebs/latest/userguide/what-is-ebs.html) | 블록 저장소의 역할 |

## 여러 앱의 협력 — 10~12장

| 출처 | 확인한 내용 |
|---|---|
| [Amazon: 타임아웃·재시도·백오프](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) | 시도 증폭·기다림·백오프와 지터 |
| [Amazon: 멱등 API](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) | 호출자 의도 식별자·원자적 기록·다른 본문 |
| [Amazon: 캐시의 과제](https://aws.amazon.com/builders-library/caching-challenges-and-strategies/) | 오래된 값·원본 부하·캐시 장애 |
| [SQS의 재전달](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html) | 중복 전달과 소비자 멱등성 |

## 배포와 관측 — 13~15장

| 출처 | 확인한 내용 |
|---|---|
| [ECS 정상 종료](https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/) | 등록 해제·시그널 전달·진행 중 작업 |
| [ECS 롤링 배포](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html) | 점진 교체와 실행 수 제약 |
| [ALB 헬스 체크](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html) | 헬스 판정과 전체 비정상 시 fail-open |
| [CloudFormation 변경 세트](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets.html) | 변경·교체 영향 검토 |
| [Parallel Change 원문](https://martinfowler.com/bliki/ParallelChange.html) | 확장·이행·축소 패턴. 공식 제품 명세가 아닌 저자 원문 |
| [Google SRE 모니터링](https://sre.google/sre-book/monitoring-distributed-systems/) | 네 신호·증상과 원인·분포 |
| [Google SRE 서비스 수준 목표](https://sre.google/sre-book/service-level-objectives/) | SLI·SLO와 측정 정의 |
| [Prometheus 이름·라벨](https://prometheus.io/docs/practices/naming/) | 고유 라벨 조합과 카디널리티 |
| [MIT 큐잉 관계](https://www.mit.edu/course/other/urban_or_book/www/book/chapter4/4.4.html) | 리틀의 법칙·경계·장기 평균의 전제 |

## 권한과 AWS 역할 — 16·17장

| 출처 | 확인한 내용 |
|---|---|
| [Route 53 개념](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html) | DNS 관리 역할 |
| [EC2 개념](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html) | 가상 서버 실행 |
| [ALB 개념](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html) | 리스너·타깃·애플리케이션 계층 라우팅 |
| [Fargate 구성](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html) | 관리 책임과 태스크 실행 |
| [RDS 개념](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html) | 관리형 관계형 DB와 고객 책임 |
| [CloudWatch 개념](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html) | 로그·메트릭·경보 역할 |
| [IAM 역할](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) | 역할·신뢰·임시 자격증명 |
| [ECS 태스크 역할](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html) | 앱이 AWS API를 호출하는 주체 |
| [ECS 태스크 실행 역할](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html) | 실행 기반의 이미지·로그·시크릿 작업 |
| [AWS 리전과 AZ](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html) | 지리적 영역과 가용 영역 |

## 실습 명령과 예시 이름

| 출처 | 확인한 내용 |
|---|---|
| [curl 매뉴얼](https://curl.se/docs/manpage.html) | write-out 누적 시간·프록시·접속 제한 옵션 |
| [RFC 2606](https://www.rfc-editor.org/rfc/rfc2606) | example.com과 invalid 예약 이름 |



## 입문 설명에 추가한 근거 — 01·03·16장

| 출처 | 확인한 내용 |
|---|---|
| [CS50 입문](https://cs50.harvard.edu/x/2026/notes/0/) | 비트·바이트와 데이터 표현의 입문 설명 |
| [CS50 메모리](https://cs50.harvard.edu/x/2026/notes/4/) | 메모리와 저장된 데이터·파일 |
| [Linux fork](https://man7.org/linux/man-pages/man2/fork.2.html) | 서로 다른 프로세스의 메모리 공간 |
| [MDN HTTP 메시지](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Messages) | 상태 줄·헤더·본문 |
| [IAM의 작동](https://docs.aws.amazon.com/IAM/latest/UserGuide/intro-structure.html) | 주체·자격증명·인증·인가 흐름 |

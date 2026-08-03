/**
 * 3~4주차 — 멀티 에이전트 협업 (docs/04-multi-agent-patterns.md)
 *
 * 축 B(전문가 협업)의 앱 레이어 버전.
 * "이번주 광고 어떻게 세팅?" 을 분석가 → 광고 전략가 → 개발자 3전문가가 협업해 푼다.
 *
 * 핵심: 여기서 "오케스트레이터"는 아래 main() 함수 = 그냥 내 코드다.
 *       앞 전문가의 결과를 뒤 전문가에게 넘기는 이 순서 배선이 "협업"의 전부.
 *
 * 실행: npm run week3
 */
import { ask } from "../shared/llm";

// 가짜 도구(스텁) — 실제로는 광고 성과 DB를 조회할 자리
const stubPerformanceData =
  "지난주: 노출 120만, 클릭 2.5만(CTR 2.1%), 전환 320건. A타겟 ROAS 4.2로 최고, C타겟 ROAS 1.1로 최저.";

// 각 전문가 = (역할 프롬프트) + (도구). 여기선 역할 프롬프트로만 구성.
const ROLES = {
  analyst:
    "너는 데이터 분석가다. 주어진 광고 성과 데이터에서 이번주 의사결정에 필요한 핵심 인사이트만 3줄 이내로 뽑아라. 추측하지 말고 데이터에 근거해라.",
  adExpert:
    "너는 10년차 시니어 퍼포먼스 마케터다. 분석 결과를 바탕으로 이번주 캠페인 전략(예산 배분·타겟·크리에이티브 방향)을 구체적으로 제안해라.",
  developer:
    "너는 백엔드 개발자다. 주어진 광고 전략을 캠페인 세팅 의사코드로 옮겨라. 실제 실행은 하지 말고 어떤 API에 어떤 값을 넣을지만 제시해라.",
};

async function main() {
  console.log("\n📥 요청: 이번주 광고 어떻게 세팅하지?\n");

  // ① 분석가
  const analysis = await ask(
    ROLES.analyst,
    `성과 데이터: ${stubPerformanceData}\n이번주 세팅 판단에 필요한 인사이트는?`
  );
  console.log("① 분석가 ──────────────\n" + analysis + "\n");

  // ② 광고 전략가 (①의 결과를 넘긴다 = 핸드오프)
  const strategy = await ask(
    ROLES.adExpert,
    `분석 결과:\n${analysis}\n\n이번주 캠페인 전략은?`
  );
  console.log("② 광고 전략가 ──────────\n" + strategy + "\n");

  // ③ 개발자 (②의 전략을 넘긴다)
  const impl = await ask(
    ROLES.developer,
    `광고 전략:\n${strategy}\n\n캠페인 API 세팅 의사코드는?`
  );
  console.log("③ 개발자 ──────────────\n" + impl + "\n");

  console.log("✅ 3전문가 협업 완료 (오케스트레이터 = 이 main 함수)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/*
 * 🛠 직접 해볼 것 (docs/04 참고):
 * 1. 핸드오프 실험: ②에 ①의 결과를 안 넘기고 원래 질문만 줘서 출력 품질이 얼마나 나빠지는지 비교
 * 2. 오케스트레이터 승격: 위 하드코딩 순서 대신, LLM이 "다음은 누구?"를 정하게 하는 라우터로 바꿔보기
 *    (툴 목록에 call_analyst/call_adExpert/call_developer 를 주고 LLM이 tool_use로 고르게 → docs/04)
 * 3. 단일 작성자: 최종 답을 확정하는 지점을 딱 하나(이 main의 마지막)로 두는 구조 확인
 * 4. LangGraph supervisor 로 다시 구현 (docs/04)
 */

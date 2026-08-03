/**
 * 3~4주차 — 멀티 에이전트 협업 (docs/04-multi-agent-patterns.md)  [연습문제]
 *
 * "이번주 광고 어떻게 세팅?" 을 분석가 → 광고 전략가 → 개발자 3전문가가 협업해 푼다.
 * 역할 프롬프트·스텁 데이터는 채워져 있다. 오케스트레이션(순서 호출 + 핸드오프)을 구현하라.
 * 막히면 정답: solutions/week3-multiagent/index.ts
 *
 * 실행: npm run week3
 */
import { ask } from "../shared/llm";

// 가짜 도구(스텁) — 실제로는 광고 성과 DB를 조회할 자리
const stubPerformanceData =
  "지난주: 노출 120만, 클릭 2.5만(CTR 2.1%), 전환 320건. A타겟 ROAS 4.2로 최고, C타겟 ROAS 1.1로 최저.";

// 각 전문가 = (역할 프롬프트) + (도구). 여기선 역할 프롬프트로 구성 (scaffolding)
const ROLES = {
  analyst:
    "너는 데이터 분석가다. 주어진 광고 성과 데이터에서 이번주 의사결정에 필요한 핵심 인사이트만 3줄 이내로 뽑아라. 추측하지 말고 데이터에 근거해라.",
  adExpert:
    "너는 10년차 시니어 퍼포먼스 마케터다. 분석 결과를 바탕으로 이번주 캠페인 전략(예산 배분·타겟·크리에이티브 방향)을 구체적으로 제안해라.",
  developer:
    "너는 백엔드 개발자다. 주어진 광고 전략을 캠페인 세팅 의사코드로 옮겨라. 실제 실행은 하지 말고 어떤 API에 어떤 값을 넣을지만 제시해라.",
};

// ask(system, user) 헬퍼는 shared/llm 에 있다 → 최종 텍스트를 돌려준다
async function main() {
  console.log("\n📥 요청: 이번주 광고 어떻게 세팅하지?\n");

  // 🎯 TODO 1: 분석가 호출 — ask(ROLES.analyst, `성과 데이터: ${stubPerformanceData} ...`) → analysis
  // 🎯 TODO 2: 광고 전략가 호출 — analysis 를 넘겨서(=핸드오프) ask(ROLES.adExpert, ...) → strategy
  // 🎯 TODO 3: 개발자 호출 — strategy 를 넘겨서 ask(ROLES.developer, ...) → impl
  // 🎯 TODO 4: 각 단계 결과를 console.log 로 출력
  //   ※ 여기서 "오케스트레이터"는 바로 이 main 함수다 — 순서를 정하고 결과를 넘기는 이 코드.
  throw new Error(
    "TODO: 3전문가 협업(순서 호출 + 핸드오프)을 구현하세요. 막히면 solutions/week3-multiagent/index.ts 참고"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/*
 * 🛠 더 해볼 것 (docs/04):
 * - 핸드오프 실험: ②에 ①의 결과를 안 넘기고 원래 질문만 줘서 품질이 얼마나 나빠지는지 비교
 * - 오케스트레이터 승격: LLM이 "다음은 누구?"를 tool_use 로 고르게 하는 라우터로 (call_analyst 등)
 * - 단일 작성자: 최종 답 확정 지점을 딱 하나로 두기 / LangGraph supervisor 로 재구현
 */

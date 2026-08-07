/**
 * 3~4주차 — 멀티 에이전트 협업 (docs/04-multi-agent-patterns.md)
 *
 * "이번주 광고 어떻게 세팅?" 을 분석가 → 광고 전략가 → 개발자 3전문가가 협업해 푼다.
 * 역할 프롬프트·스텁 데이터는 채워져 있다. 오케스트레이션(순서 호출 + 핸드오프)을 구현하라.
 *
 * 명세: tests/04-01-multiagent-handoff/index.test.ts (먼저 읽어라)
 * 막히면 정답: solutions/04-01-multiagent-handoff/index.ts
 */
import { ask } from "../../shared/llm";

// 가짜 도구(스텁) — 실제로는 광고 성과 DB를 조회할 자리
export const stubPerformanceData =
  "지난주: 노출 120만, 클릭 2.5만(CTR 2.1%), 전환 320건. A타겟 ROAS 4.2로 최고, C타겟 ROAS 1.1로 최저.";

// 각 전문가 = (역할 프롬프트) + (도구). 여기선 역할 프롬프트로 구성 (scaffolding)
export const ROLES = {
  analyst:
    "너는 데이터 분석가다. 주어진 광고 성과 데이터에서 이번주 의사결정에 필요한 핵심 인사이트만 3줄 이내로 뽑아라. 추측하지 말고 데이터에 근거해라.",
  adExpert:
    "너는 10년차 시니어 퍼포먼스 마케터다. 분석 결과를 바탕으로 이번주 캠페인 전략(예산 배분·타겟·크리에이티브 방향)을 구체적으로 제안해라.",
  developer:
    "너는 백엔드 개발자다. 주어진 광고 전략을 캠페인 세팅 의사코드로 옮겨라. 실제 실행은 하지 말고 어떤 API에 어떤 값을 넣을지만 제시해라.",
};

/** ask(system, user) 시그니처 — 실제 구현은 shared/llm의 ask, 테스트에서는 스텁으로 갈아끼운다. */
export type Ask = (system: string, user: string) => Promise<string>;

export interface CollaborationResult {
  analysis: string;
  strategy: string;
  impl: string;
}

/**
 * 분석가 → 광고 전략가 → 개발자 순서로 호출하며, 앞 단계의 결과를 다음 단계 입력에 넘긴다(핸드오프).
 * 각 단계 결과를 전부 반환한다 — main()이 그걸로 진행 상황을 출력한다.
 */
export async function runCollaboration(askFn: Ask, performanceData: string): Promise<CollaborationResult> {
  // 🎯 TODO: 세 전문가(ROLES + ask)를 순서대로 호출해 협업시켜라.
  //   1) 분석가에게 성과 데이터(performanceData)로 인사이트를 뽑게 한다.
  //   2) 그 인사이트를 광고 전략가에게 넘겨(=핸드오프) 전략을 받는다.
  //   3) 그 전략을 개발자에게 넘겨 캠페인 세팅으로 옮긴다.
  //   핵심: 앞 전문가의 결과를 다음 전문가 입력에 넘기는 것 — 이 배선이 "협업"이자 "오케스트레이션"이다.
  //   막히면 solutions/04-01-multiagent-handoff/index.ts.
  throw new Error("TODO: 3전문가 협업(순서 호출 + 핸드오프)을 구현하세요. 막히면 solutions 참고");
}

async function main() {
  console.log("\n📥 요청: 이번주 광고 어떻게 세팅하지?\n");

  const { analysis, strategy, impl } = await runCollaboration(ask, stubPerformanceData);
  console.log("① 분석가 ──────────────\n" + analysis + "\n");
  console.log("② 광고 전략가 ──────────\n" + strategy + "\n");
  console.log("③ 개발자 ──────────────\n" + impl + "\n");
  console.log("✅ 3전문가 협업 완료 (오케스트레이터 = runCollaboration)");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

/*
 * 🛠 더 해볼 것
 *
 * 선택 문제(테스트 있음) — extra-1-agent-router.ts
 *   LLM이 tool_use 로 다음 차례를 고르게 하는 오케스트레이터의 판단부.
 *   지어낸 이름·병렬 위임·깨진 인자를 코드가 어떻게 감당하는지가 과제다.
 *
 * 관찰 과제(테스트 없음):
 * - 핸드오프 실험: ②에 ①의 결과를 안 넘기고 원래 질문만 줘서 품질이 얼마나 나빠지는지 비교
 * - 단일 작성자: 최종 답 확정 지점을 딱 하나로 두기 / LangGraph supervisor 로 재구현
 */

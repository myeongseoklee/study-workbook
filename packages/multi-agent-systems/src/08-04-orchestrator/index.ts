/**
 * 08장 — 오케스트레이터 (docs/08-agent-platform-infra.md)
 *
 * week3의 오케스트레이터(함수를 순서대로 호출)와 "구조가 같다".
 * 유일한 차이: 함수 호출 → HTTP 호출. 조정은 사라지지 않고 위치만 바뀐다.
 *
 * 명세: tests/08-04-orchestrator/index.test.ts (먼저 읽어라)
 * 막히면 정답: solutions/08-04-orchestrator/index.ts
 *
 * 먼저 두 에이전트 서버를 각각 띄운다:
 *   터미널 1) npm run infra:analyst
 *   터미널 2) npm run infra:ad-expert
 *   터미널 3) npm run infra:orchestrator   ← 이 파일
 */
export const AGENT_URLS = ["http://localhost:8001", "http://localhost:8002"];

export interface AgentCard {
  name: string;
  url: string;
  capabilities: string[];
}

/** fetch가 실제로 쓰는 부분만 담은 최소 인터페이스 — 테스트에서 스텁으로 갈아끼운다. */
export type FetchFn = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ json(): Promise<any> }>;

// 레지스트리: 각 서버의 Agent Card를 읽어 "누가 뭘 할 수 있나" 파악 (서비스 디스커버리)
export async function discover(fetchFn: FetchFn, urls: string[]): Promise<Record<string, AgentCard>> {
  // 🎯 TODO: 각 에이전트 서버의 Agent Card(/.well-known/agent.json)를 읽어 "이름 → 카드" 맵으로 모아 반환하라.
  //   이게 레지스트리 = 서비스 디스커버리. 막히면 solutions.
  throw new Error("TODO: discover 구현. 막히면 solutions/08-04-orchestrator/index.ts 참고");
}

// 실제 실행 = 다른 에이전트 서버로의 HTTP POST (당신 코드가 건다)
export async function invoke(fetchFn: FetchFn, base: string, query: string): Promise<string> {
  // 🎯 TODO: 대상 서버의 /invoke 로 query 를 POST 하고, 응답에서 결과 텍스트를 꺼내 반환하라. 막히면 solutions.
  throw new Error("TODO: invoke 구현. 막히면 solutions/08-04-orchestrator/index.ts 참고");
}

/** discover로 에이전트들을 파악한 뒤, 분석가 → 광고 전략가 순으로 호출하며 앞 결과를 넘긴다(핸드오프). */
export async function runOrchestration(
  fetchFn: FetchFn,
  urls: string[],
  performanceData: string
): Promise<{ analysis: string; strategy: string }> {
  // 🎯 TODO: discover 로 에이전트들을 파악한 뒤, 분석가 → 광고 전략가 순으로 호출하고(앞 결과를 넘기며) 결과를 반환하라.
  //   week3(앱 레이어)와 구조가 똑같다 — 함수 호출이 HTTP 호출(invoke)로 바뀐 것뿐. 막히면 solutions.
  throw new Error("TODO: 오케스트레이션 흐름 구현. 막히면 solutions/08-04-orchestrator/index.ts 참고");
}

async function main() {
  console.log("\n오케스트레이터 시작 — 두 에이전트 서버가 떠 있어야 합니다.\n");
  console.log("\n📥 요청: 이번주 광고 어떻게 세팅하지?\n");
  const perf = "지난주: CTR 2.1%, 전환 320건, A타겟 ROAS 4.2로 최고.";

  const { analysis, strategy } = await runOrchestration(fetch as FetchFn, AGENT_URLS, perf);
  console.log("① analyst ──────\n" + analysis + "\n");
  console.log("② ad-expert ────\n" + strategy + "\n");
  console.log("✅ 인프라 레이어 협업 완료 (함수 호출 → HTTP 호출로만 바뀌었다)");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("에이전트 서버(:8001, :8002)가 떠 있는지 확인하세요.\n", e);
    process.exit(1);
  });
}

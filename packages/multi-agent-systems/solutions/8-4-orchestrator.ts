/**
 * 08장 — 오케스트레이터 (docs/08-agent-platform-infra.md)
 *
 * week3의 오케스트레이터(함수를 순서대로 호출)와 "구조가 같다".
 * 유일한 차이: 함수 호출 → HTTP 호출. 조정(오케스트레이션)은 사라지지 않고 위치만 바뀐다.
 *
 * 📍 되짚기: docs/08-agent-platform-infra.md / docs/90-must-memorize.md § 불변 트레이드오프
 *
 * 먼저 두 에이전트 서버를 각각 띄워야 한다:
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

export type FetchFn = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ json(): Promise<any> }>;

// 레지스트리: 각 서버의 Agent Card를 읽어 "누가 뭘 할 수 있나" 파악 (서비스 디스커버리)
export async function discover(fetchFn: FetchFn, urls: string[]): Promise<Record<string, AgentCard>> {
  const cards: Record<string, AgentCard> = {};
  for (const base of urls) {
    const card = (await (await fetchFn(`${base}/.well-known/agent.json`)).json()) as AgentCard;
    cards[card.name] = card;
    console.log(`🔎 발견: ${card.name} — ${card.capabilities.join(", ")}`);
  }
  return cards;
}

// 실제 실행 = 다른 에이전트 서버로의 HTTP POST (당신 코드가 건다)
export async function invoke(fetchFn: FetchFn, base: string, query: string): Promise<string> {
  const res = await fetchFn(`${base}/invoke`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const { result } = (await res.json()) as { result: string };
  return result;
}

/** discover로 에이전트들을 파악한 뒤, 분석가 → 광고 전략가 순으로 호출하며 앞 결과를 넘긴다(핸드오프). */
export async function runOrchestration(
  fetchFn: FetchFn,
  urls: string[],
  performanceData: string
): Promise<{ analysis: string; strategy: string }> {
  const cards = await discover(fetchFn, urls);

  // ① 분석 에이전트 호출 (HTTP)
  const analysis = await invoke(fetchFn, cards["analyst"].url, `${performanceData}\n이번주 세팅 인사이트는?`);

  // ② 광고 전략가 호출 (①의 결과를 넘김 = 핸드오프, HTTP)
  const strategy = await invoke(fetchFn, cards["ad-expert"].url, `분석 결과:\n${analysis}\n이번주 전략은?`);

  return { analysis, strategy };
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

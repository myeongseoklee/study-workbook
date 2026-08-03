/**
 * 08장 — 오케스트레이터 (docs/08)  [연습문제]
 *
 * week3의 오케스트레이터(함수를 순서대로 호출)와 "구조가 같다".
 * 유일한 차이: 함수 호출 → HTTP 호출. 조정은 사라지지 않고 위치만 바뀐다.
 * 막히면 정답: solutions/infra/orchestrator.ts
 *
 * 먼저 두 에이전트 서버를 각각 띄운다:
 *   터미널 1) npm run infra:analyst
 *   터미널 2) npm run infra:ad-expert
 *   터미널 3) npm run infra:orchestrator   ← 이 파일
 */
const AGENT_URLS = ["http://localhost:8001", "http://localhost:8002"];

// 레지스트리: 각 서버의 Agent Card를 읽어 "누가 뭘 할 수 있나" 파악 (서비스 디스커버리)
async function discover(): Promise<Record<string, any>> {
  // 🎯 TODO: AGENT_URLS 각각에 fetch(`${base}/.well-known/agent.json`) → JSON 파싱
  //   → { [card.name]: card } 형태로 모아서 반환 (발견한 에이전트를 console.log)
  throw new Error("TODO: discover 구현. 막히면 solutions/infra/orchestrator.ts 참고");
}

// 실제 실행 = 다른 에이전트 서버로의 HTTP POST (당신 코드가 건다)
async function invoke(base: string, query: string): Promise<string> {
  // 🎯 TODO: fetch(`${base}/invoke`, { method:"POST", headers, body: JSON.stringify({ query }) })
  //   → { result } 를 파싱해 result 반환
  throw new Error("TODO: invoke 구현. 막히면 solutions/infra/orchestrator.ts 참고");
}

async function main() {
  console.log("\n오케스트레이터 시작 — 두 에이전트 서버가 떠 있어야 합니다.\n");

  // 🎯 TODO:
  //   1) discover() 로 Agent Card 들을 읽는다
  //   2) analyst.url 에 invoke → analysis  (성과 데이터 + "인사이트?")
  //   3) ad-expert.url 에 invoke → strategy  (analysis 를 넘김 = 핸드오프)
  //   4) 결과들을 출력
  throw new Error("TODO: 오케스트레이션 흐름 구현. 막히면 solutions/infra/orchestrator.ts 참고");
}

main().catch((e) => {
  console.error("에이전트 서버(:8001, :8002)가 떠 있는지 확인하세요.\n", e);
  process.exit(1);
});

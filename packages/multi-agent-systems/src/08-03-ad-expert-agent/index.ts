/**
 * 08장 — 광고 전략가를 "독립 서비스"로 (docs/08-agent-platform-infra.md)
 *
 * 분석 에이전트와 완전히 별개의 서버(:8002). 팀에서 다른 사람이 맡아도 된다 —
 * Agent Card(계약)만 지키면 서로 독립 개발·배포 가능(Conway의 법칙).
 * Agent Card·서버·라우트는 채워져 있다. handleInvoke() 본체를 구현하라.
 *
 * 명세: tests/08-03-ad-expert-agent/index.test.ts (먼저 읽어라)
 * 막히면 정답: solutions/08-03-ad-expert-agent/index.ts
 * 실행: npm run infra:ad-expert
 */
import Fastify from "fastify";
import { ask } from "../../shared/llm";

export const PORT = 8002;

export const AGENT_CARD = {
  name: "ad-expert",
  description: "광고 전략 수립 전문가 에이전트",
  url: `http://localhost:${PORT}`,
  capabilities: ["캠페인 예산 배분", "타겟 추천", "크리에이티브 전략"],
  input_schema: { query: "string" },
};

/** ask(system, user) 시그니처 — 실제 구현은 shared/llm의 ask, 테스트에서는 스텁으로 갈아끼운다. */
export type Ask = (system: string, user: string) => Promise<string>;

/** /invoke 핸들러 본체. query를 받아 이 에이전트의 역할(광고 전략가)로 응답을 만든다. */
export async function handleInvoke(askFn: Ask, query: string): Promise<{ result: string }> {
  // 🎯 TODO: query 를 받아 이 에이전트의 역할(광고 전략가)로 응답을 만들어 { result } 형태로 반환하라.
  //   역할 프롬프트 + query 를 모델(askFn)에 넘기면 된다. 막히면 solutions.
  throw new Error("TODO: handleInvoke 구현. 막히면 solutions/08-03-ad-expert-agent/index.ts 참고");
}

function startServer() {
  const app = Fastify();
  app.get("/.well-known/agent.json", async () => AGENT_CARD);
  app.post("/invoke", async (req) => {
    const { query } = req.body as { query: string };
    return handleInvoke(ask, query);
  });
  return app.listen({ port: PORT }).then(() => {
    console.log(`📈 ad-expert 에이전트 실행 중 → http://localhost:${PORT}`);
    console.log(`   Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

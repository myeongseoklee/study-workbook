/**
 * 08장 — 광고 전략가를 "독립 서비스"로 (docs/08-agent-platform-infra.md)
 *
 * 분석 에이전트와 완전히 별개의 서버(:8002). 팀에서 다른 사람이 맡아도 된다 —
 * Agent Card(계약)만 지키면 서로 독립적으로 개발·배포 가능(Conway의 법칙).
 *
 * 📍 되짚기: docs/08-agent-platform-infra.md
 * 실행: npm run infra:ad-expert
 */
import Fastify from "fastify";
import { ask } from "../shared/llm";

export const PORT = 8002;

export const AGENT_CARD = {
  name: "ad-expert",
  description: "광고 전략 수립 전문가 에이전트",
  url: `http://localhost:${PORT}`,
  capabilities: ["캠페인 예산 배분", "타겟 추천", "크리에이티브 전략"],
  input_schema: { query: "string" },
};

export type Ask = (system: string, user: string) => Promise<string>;

/** /invoke 핸들러 본체. query를 받아 이 에이전트의 역할(광고 전략가)로 응답을 만든다. */
export async function handleInvoke(askFn: Ask, query: string): Promise<{ result: string }> {
  const result = await askFn(
    "너는 10년차 시니어 퍼포먼스 마케터다. 주어진 분석을 바탕으로 이번주 캠페인 전략(예산·타겟·크리에이티브)을 구체적으로 제안하라.",
    query
  );
  return { result };
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

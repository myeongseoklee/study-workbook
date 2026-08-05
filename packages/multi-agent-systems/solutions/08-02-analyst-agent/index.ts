/**
 * 08장 — 분석 에이전트를 "독립 서비스"로 (docs/08-agent-platform-infra.md)
 *
 * week3에서 함수였던 분석가가, 여기선 :8001에 뜨는 HTTP 서비스가 된다.
 *  - GET  /.well-known/agent.json  → Agent Card(능력 명세 = 계약)
 *  - POST /invoke                  → 실제 작업 수행
 *
 * 📍 되짚기: docs/08-agent-platform-infra.md
 * 실행: npm run infra:analyst
 */
import Fastify from "fastify";
import { ask } from "../../shared/llm";

export const PORT = 8001;

// Agent Card — "나는 누구고 뭘 할 수 있다" (백엔드의 OpenAPI 명세에 대응)
export const AGENT_CARD = {
  name: "analyst",
  description: "광고 성과 데이터 분석가 에이전트",
  url: `http://localhost:${PORT}`,
  capabilities: ["성과 요약", "인사이트 추출"],
  input_schema: { query: "string" },
};

export type Ask = (system: string, user: string) => Promise<string>;

/** /invoke 핸들러 본체. query를 받아 이 에이전트의 역할(데이터 분석가)로 응답을 만든다. */
export async function handleInvoke(askFn: Ask, query: string): Promise<{ result: string }> {
  const result = await askFn("너는 데이터 분석가다. 주어진 내용에서 핵심 인사이트만 3줄 이내로 뽑아라.", query);
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
    console.log(`🧮 analyst 에이전트 실행 중 → http://localhost:${PORT}`);
    console.log(`   Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

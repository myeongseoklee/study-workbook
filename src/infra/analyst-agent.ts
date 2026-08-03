/**
 * 08장 — 에이전트 플랫폼 인프라: 분석 에이전트를 "독립 서비스"로 (docs/08)
 *
 * week3에서 함수였던 분석가가, 여기선 :8001에 뜨는 HTTP 서비스가 된다.
 *  - GET  /.well-known/agent.json  → Agent Card(능력 명세 = 계약)
 *  - POST /invoke                  → 실제 작업 수행
 *
 * 실행: npm run infra:analyst
 */
import Fastify from "fastify";
import { ask } from "../shared/llm";

const PORT = 8001;
const app = Fastify();

// Agent Card — "나는 누구고 뭘 할 수 있다" (백엔드의 OpenAPI 명세에 대응)
const AGENT_CARD = {
  name: "analyst",
  description: "광고 성과 데이터 분석가 에이전트",
  url: `http://localhost:${PORT}`,
  capabilities: ["성과 요약", "인사이트 추출"],
  input_schema: { query: "string" },
};

app.get("/.well-known/agent.json", async () => AGENT_CARD);

app.post("/invoke", async (req) => {
  const { query } = req.body as { query: string };
  const result = await ask(
    "너는 데이터 분석가다. 주어진 내용에서 핵심 인사이트만 3줄 이내로 뽑아라.",
    query
  );
  return { result };
});

app.listen({ port: PORT }).then(() => {
  console.log(`🧮 analyst 에이전트 실행 중 → http://localhost:${PORT}`);
  console.log(`   Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
});

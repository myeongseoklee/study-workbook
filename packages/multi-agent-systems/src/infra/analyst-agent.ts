/**
 * 08장 — 분석 에이전트를 "독립 서비스"로 (docs/08)  [연습문제]
 *
 * week3에서 함수였던 분석가가, 여기선 :8001에 뜨는 HTTP 서비스가 된다.
 * Agent Card·서버·라우트는 채워져 있다. /invoke 핸들러 본체를 구현하라.
 * 막히면 정답: solutions/infra/analyst-agent.ts
 *
 * 실행: npm run infra:analyst
 */
import Fastify from "fastify";
import { ask } from "../shared/llm";

const PORT = 8001;
const app = Fastify();

// Agent Card — "나는 누구고 뭘 할 수 있다" (백엔드의 OpenAPI 명세 = 계약). scaffolding
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
  // 🎯 query 를 받아 이 에이전트의 역할(데이터 분석가)로 응답을 만들어 { result } 형태로 반환하라.
  //   역할 프롬프트 + query 를 모델(ask)에 넘기면 된다. 막히면 solutions.
  throw new Error("TODO: /invoke 구현. 막히면 solutions/infra/analyst-agent.ts 참고");
});

app.listen({ port: PORT }).then(() => {
  console.log(`🧮 analyst 에이전트 실행 중 → http://localhost:${PORT}`);
  console.log(`   Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
});

/**
 * 08장 — 분석 에이전트를 "독립 서비스"로 (docs/08-agent-platform-infra.md)
 *
 * week3에서 함수였던 분석가가, 여기선 :8001에 뜨는 HTTP 서비스가 된다.
 * Agent Card·서버·라우트는 채워져 있다. handleInvoke() 본체를 구현하라.
 *
 * 명세: tests/08-02-analyst-agent/index.test.ts (먼저 읽어라)
 * 막히면 정답: solutions/08-02-analyst-agent/index.ts
 * 실행: npm run infra:analyst
 */
import Fastify from "fastify";
import { ask } from "../../shared/llm";

export const PORT = 8001;

// Agent Card — "나는 누구고 뭘 할 수 있다" (백엔드의 OpenAPI 명세 = 계약). scaffolding
export const AGENT_CARD = {
  name: "analyst",
  description: "광고 성과 데이터 분석가 에이전트",
  url: `http://localhost:${PORT}`,
  capabilities: ["성과 요약", "인사이트 추출"],
  input_schema: { query: "string" },
};

/** ask(system, user) 시그니처 — 실제 구현은 shared/llm의 ask, 테스트에서는 스텁으로 갈아끼운다. */
export type Ask = (system: string, user: string) => Promise<string>;

/** /invoke 핸들러 본체. query를 받아 이 에이전트의 역할(데이터 분석가)로 응답을 만든다. */
export async function handleInvoke(askFn: Ask, query: string): Promise<{ result: string }> {
  // 🎯 TODO: query 를 받아 이 에이전트의 역할(데이터 분석가)로 응답을 만들어 { result } 형태로 반환하라.
  //   역할 프롬프트 + query 를 모델(askFn)에 넘기면 된다. 막히면 solutions.
  throw new Error("TODO: handleInvoke 구현. 막히면 solutions/08-02-analyst-agent/index.ts 참고");
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

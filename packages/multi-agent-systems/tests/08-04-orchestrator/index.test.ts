// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../src/08-04-orchestrator/index.ts를 고쳐라.
import { describe, expect, it } from "vitest";
import { scripted } from "@study/testkit";
import { discover, invoke, runOrchestration } from "../../src/08-04-orchestrator";

/** fetch(url, init)이 돌려줄 Response 흉내 — .json()만 있으면 된다. */
function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) });
}

function stubFetch(responses: unknown[]) {
  return scripted<[string, any?], Promise<{ json(): Promise<any> }>>(responses.map(jsonResponse));
}

describe("discover", () => {
  it("각 URL의 agent.json을 읽어 이름 → 카드 맵으로 모은다", async () => {
    const fetchFn = stubFetch([
      { name: "analyst", url: "http://localhost:8001", capabilities: ["a"] },
      { name: "ad-expert", url: "http://localhost:8002", capabilities: ["b"] },
    ]);

    const cards = await discover(fetchFn, ["http://localhost:8001", "http://localhost:8002"]);

    expect(cards).toEqual({
      analyst: { name: "analyst", url: "http://localhost:8001", capabilities: ["a"] },
      "ad-expert": { name: "ad-expert", url: "http://localhost:8002", capabilities: ["b"] },
    });
    expect(fetchFn.calls[0][0]).toBe("http://localhost:8001/.well-known/agent.json");
    expect(fetchFn.calls[1][0]).toBe("http://localhost:8002/.well-known/agent.json");
  });
});

describe("invoke", () => {
  it("/invoke로 POST하고 응답의 result를 꺼내 반환한다", async () => {
    const fetchFn = stubFetch([{ result: "답변" }]);

    const out = await invoke(fetchFn, "http://localhost:8001", "질문");

    expect(out).toBe("답변");
    expect(fetchFn.calls[0][0]).toBe("http://localhost:8001/invoke");
    const init = fetchFn.calls[0][1] as { method: string; body: string };
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ query: "질문" });
  });
});

describe("runOrchestration", () => {
  it("discover 후 analyst → ad-expert 순으로 호출하며 앞 결과를 넘긴다 (핸드오프)", async () => {
    const fetchFn = stubFetch([
      { name: "analyst", url: "http://localhost:8001", capabilities: [] },
      { name: "ad-expert", url: "http://localhost:8002", capabilities: [] },
      { result: "인사이트 X" },
      { result: "전략 Y" },
    ]);

    const out = await runOrchestration(
      fetchFn,
      ["http://localhost:8001", "http://localhost:8002"],
      "성과 데이터"
    );

    expect(out).toEqual({ analysis: "인사이트 X", strategy: "전략 Y" });
    expect(fetchFn.calls[2][0]).toBe("http://localhost:8001/invoke");
    expect(JSON.parse((fetchFn.calls[2][1] as any).body).query).toContain("성과 데이터");
    expect(fetchFn.calls[3][0]).toBe("http://localhost:8002/invoke");
    expect(JSON.parse((fetchFn.calls[3][1] as any).body).query).toContain("인사이트 X");
  });
});

// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../src/8-3-ad-expert-agent.ts를 고쳐라.
import { describe, expect, it } from "vitest";
import { scripted } from "@study/testkit";
import { handleInvoke } from "../src/8-3-ad-expert-agent";

describe("handleInvoke", () => {
  it("askFn의 응답을 { result } 형태로 감싸 반환한다", async () => {
    const ask = scripted<[string, string], Promise<string>>([Promise.resolve("예산 배분 전략")]);

    const out = await handleInvoke(ask, "분석 결과: ...");

    expect(out).toEqual({ result: "예산 배분 전략" });
  });

  it("query를 user 메시지로 그대로 넘긴다", async () => {
    const ask = scripted<[string, string], Promise<string>>([Promise.resolve("...")]);

    await handleInvoke(ask, "분석 결과: A타겟 ROAS 최고");

    expect(ask.calls[0][1]).toBe("분석 결과: A타겟 ROAS 최고");
  });

  it("광고 전략가 역할의 system 프롬프트를 쓴다", async () => {
    const ask = scripted<[string, string], Promise<string>>([Promise.resolve("...")]);

    await handleInvoke(ask, "질문");

    expect(ask.calls[0][0]).toContain("마케터");
  });
});

/**
 * 5~6주차 — 평가와 관측성 (docs/05-eval-and-observability.md)
 *
 * 에이전트는 비결정적이라 "한 번 돌려보니 됨"은 증명이 아니다.
 * 손으로 만든 평가셋으로 통과율을 재고, 프롬프트를 바꾼 뒤 회귀를 잡는다.
 *
 * 📍 되짚기: docs/05-eval-and-observability.md / docs/90-must-memorize.md § 진단 신호
 */
import { ask } from "../../shared/llm";

export interface EvalCase {
  name: string;
  input: string;
  check: (out: string) => boolean;
}

export interface EvalCaseResult {
  name: string;
  pass: boolean;
  out: string;
}

export type Ask = (system: string, user: string) => Promise<string>;

export const SYSTEM = "너는 간결한 어시스턴트다. 사용자의 질문에 한국어로 짧게 답하라.";

// 손으로 만든 평가셋 (docs/05: 30~50개를 직접 만들라. 여기선 시드 5개)
// check(output) 가 true면 통과. 정확 일치가 어려우니 "핵심 조건 충족"으로 완화 판정.
export const EVAL_SET: EvalCase[] = [
  { name: "덧셈", input: "2 더하기 3은?", check: (o) => o.includes("5") },
  { name: "수도", input: "대한민국의 수도는?", check: (o) => o.includes("서울") },
  { name: "영어질문-한국어답", input: "What is 10 minus 4?", check: (o) => o.includes("6") },
  { name: "빈값거절", input: "", check: (o) => o.trim().length > 0 },
  // TODO: 여기에 당신 도메인의 까다로운 엣지 케이스를 25개 이상 추가하라.
  { name: "엣지-모호질문", input: "그거 어떻게 해?", check: (o) => o.length > 0 },
];

/** 평가셋을 순서대로 돌려 케이스별 통과/실패를 판정한다. */
export async function runEvalSet(askFn: Ask, system: string, cases: EvalCase[]): Promise<EvalCaseResult[]> {
  const results: EvalCaseResult[] = [];
  for (const c of cases) {
    const out = await askFn(system, c.input || "(빈 입력)");
    results.push({ name: c.name, pass: c.check(out), out });
  }
  return results;
}

async function main() {
  console.log(`\n평가셋 ${EVAL_SET.length}개 실행...\n`);
  const results = await runEvalSet(ask, SYSTEM, EVAL_SET);
  for (const r of results) {
    console.log(`${r.pass ? "✅" : "❌"} ${r.name}  → ${r.out.slice(0, 40)}`);
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n통과율: ${passed}/${results.length} (${Math.round((passed / results.length) * 100)}%)`);
  console.log("\n👉 SYSTEM 프롬프트를 바꾼 뒤 다시 돌려 회귀가 잡히는지 관찰하라.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

/*
 * 🛠 직접 해볼 것 (docs/05 참고):
 * 1. 평가셋을 30개 이상으로 늘리기 (1/3은 엣지 케이스)
 * 2. 실패 케이스를 4가지 유형(툴 호출/라우팅/무한 루프/컨텍스트 오염)으로 분류
 * 3. LangSmith 또는 OpenTelemetry 로 트레이싱을 붙여 어느 단계에서 깨지는지 보기
 * 4. LLM-as-judge: check 함수 대신 다른 LLM 호출로 채점해 보고, 심판도 비결정적임을 관찰
 */

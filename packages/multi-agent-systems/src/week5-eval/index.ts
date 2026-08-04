/**
 * 5~6주차 — 평가와 관측성 (docs/05-eval-and-observability.md)  [연습문제]
 *
 * 에이전트는 비결정적이라 "한 번 돌려보니 됨"은 증명이 아니다.
 * 평가셋은 채워져 있다(직접 30개로 늘려라). 실행·판정·통과율 집계를 구현하라.
 * 막히면 정답: solutions/week5-eval/index.ts
 *
 * 실행: npm run week5
 */
import { ask } from "../shared/llm";

type EvalCase = { name: string; input: string; check: (out: string) => boolean };

const SYSTEM = "너는 간결한 어시스턴트다. 사용자의 질문에 한국어로 짧게 답하라.";

// 손으로 만든 평가셋 (scaffolding — 직접 25개 이상 추가하라, 1/3은 엣지 케이스)
const EVAL_SET: EvalCase[] = [
  { name: "덧셈", input: "2 더하기 3은?", check: (o) => o.includes("5") },
  { name: "수도", input: "대한민국의 수도는?", check: (o) => o.includes("서울") },
  { name: "영어질문-한국어답", input: "What is 10 minus 4?", check: (o) => o.includes("6") },
  { name: "빈값거절", input: "", check: (o) => o.trim().length > 0 },
  { name: "엣지-모호질문", input: "그거 어떻게 해?", check: (o) => o.length > 0 },
];

async function main() {
  console.log(`\n평가셋 ${EVAL_SET.length}개 실행...\n`);

  // 🎯 평가셋을 돌려 통과율을 재라.
  //   각 케이스마다: SYSTEM 으로 모델에 input 을 물어(ask) 응답을 받고, 그 케이스의 check 로 통과/실패를 판정.
  //   케이스별 ✅/❌ 를 출력하고, 마지막에 전체 통과율(%)을 집계해 출력.
  //   목적: SYSTEM 을 바꾼 뒤 다시 돌려 '회귀'(전엔 통과하던 게 깨짐)가 잡히는지 보는 것.
  //   막히면 solutions/week5-eval/index.ts.
  throw new Error(
    "TODO: 평가 루프(실행·판정·통과율)를 구현하세요. 막히면 solutions 참고"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/*
 * 🛠 더 해볼 것 (docs/05):
 * - 평가셋 30개 이상으로 확장 (1/3은 엣지 케이스)
 * - 실패를 4유형(툴 호출/라우팅/무한 루프/컨텍스트 오염)으로 분류
 * - LangSmith/OpenTelemetry 트레이싱 붙이기 / LLM-as-judge 로 채점(심판도 비결정적임 관찰)
 */

/**
 * 선택 문제 — 실패를 네 유형으로 분류한다 (docs/05-eval-and-observability.md)
 *
 * "정확도 62%"는 무엇을 고쳐야 할지 알려주지 않는다. "실패 12건 중 7건이
 * 라우팅"은 알려준다. 평가 하네스가 점수만 내고 끝나면 다음 수를 못 정한다.
 *
 * 명세: tests/05-01-eval-harness/extra-1-failure-triage.test.ts (먼저 읽어라)
 * 판정: pnpm test extra-1-failure-triage
 * 막히면: docs/05-eval-and-observability.md
 */

export type FailureKind = "tool-call" | "routing" | "infinite-loop" | "context-pollution" | "unknown";

export interface TraceStep {
  agent: string;
  tool?: { name: string; ok: boolean };
}

export interface Trace {
  /** 이 질문을 맡았어야 하는 에이전트 */
  expectedAgent: string;
  /** 루프 상한 — 여기에 닿았다는 건 스스로 끝내지 못했다는 뜻이다 */
  maxSteps: number;
  steps: TraceStep[];
  answer: string;
  /** 다른 대화의 내용이 새어 들어온 흔적 (있으면 그 출처) */
  leakedFrom?: string;
}

/**
 * 트레이스 하나를 한 유형으로 분류한다.
 *
 * 힌트: 신호는 겹친다. 무한 루프 안에서 툴은 얼마든지 실패하고, 잘못 라우팅된
 *       에이전트도 툴을 실패시킨다. 그래서 **어떤 순서로 보는가**가 이 과제의
 *       전부다 — 순서는 "무엇이 상위 원인인가"로 정한다.
 *       그리고 신호가 없으면 unknown이다. 억지로 붙이면 통계가 거짓이 된다.
 */
export function classifyFailure(trace: Trace): FailureKind {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: classifyFailure");
}

/**
 * 여러 트레이스를 유형별로 세어 많은 순으로 돌려준다.
 *
 * 힌트: 건수가 같을 때의 순서도 정해야 한다 — 실행마다 흔들리면 지난 주와
 *       비교할 수 없다.
 */
export function summarize(traces: Trace[]): Array<{ kind: FailureKind; count: number }> {
  // 🎯 TODO: 구현하라
  throw new Error("TODO: summarize");
}

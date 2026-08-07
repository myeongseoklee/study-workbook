/**
 * 선택 문제의 참고 구현 — 실패 분류기.
 *
 * 판정은 tests/05-01-eval-harness/extra-1-failure-triage.test.ts가 한다.
 *
 * 📍 되짚기: docs/05-eval-and-observability.md
 */

export type FailureKind = "tool-call" | "routing" | "infinite-loop" | "context-pollution" | "unknown";

export interface TraceStep {
  agent: string;
  tool?: { name: string; ok: boolean };
}

export interface Trace {
  expectedAgent: string;
  maxSteps: number;
  steps: TraceStep[];
  answer: string;
  leakedFrom?: string;
}

/**
 * 순서가 곧 "무엇이 상위 원인인가"에 대한 답이다.
 *
 *   ① infinite-loop — 끝내지 못한 것이 가장 위다. 루프를 도는 동안 툴은
 *      얼마든지 실패하므로, 툴을 먼저 보면 진짜 원인이 통계에서 사라지고
 *      계속 툴만 고치게 된다.
 *   ② routing — 갈 곳이 틀렸으면 그 뒤의 툴 실패는 결과지 원인이 아니다.
 *   ③ tool-call — 옳은 에이전트가 정상 스텝 안에서 툴에 실패한 경우.
 *   ④ context-pollution — 오염은 눈에 보이는 증상이라 위 셋이 아닐 때만 원인이다.
 *
 * 아무 신호도 없으면 unknown이다. 억지로 유형을 붙이면 통계가 거짓이 되고,
 * 반대로 unknown이 쌓이면 "트레이스에 담는 정보가 부족하다"는 신호를 얻는다.
 */
export function classifyFailure(trace: Trace): FailureKind {
  if (trace.steps.length === 0) return "unknown";
  if (trace.steps.length >= trace.maxSteps) return "infinite-loop";
  if (trace.steps.some((s) => s.agent !== trace.expectedAgent)) return "routing";
  if (trace.steps.some((s) => s.tool && !s.tool.ok)) return "tool-call";
  if (trace.leakedFrom) return "context-pollution";
  return "unknown";
}

/**
 * 많은 순으로 세되, 같은 건수는 **유형 이름 순**으로 고정한다. 정렬이 실행마다
 * 흔들리면 지난 주 결과와 나란히 놓고 볼 수 없다 — 평가의 목적이 비교인데
 * 비교가 안 되면 숫자를 낸 의미가 없다.
 */
export function summarize(traces: Trace[]): Array<{ kind: FailureKind; count: number }> {
  const counts = new Map<FailureKind, number>();
  for (const t of traces) {
    const kind = classifyFailure(t);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || (a.kind < b.kind ? -1 : 1));
}

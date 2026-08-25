/**
 * 과제 06-01 — 역할 파이프라인의 불변식
 *
 * 명세는 `tests/06-01-role-pipeline/index.test.ts`다. 배경은
 * docs/06-delegation-and-role-separation.md의 "역할별로 무엇을 주고 무엇을 감추는가".
 *
 * 06장의 두 불변식을 코드가 강제하게 만든다.
 *
 *   ① 편집자는 마지막에만 온다. 그리고 그 앞에 검증(비평가·감사)이 끝나 있어야 한다
 *   ② 비평가에게는 결론을 감춘다
 *
 * ②가 이 과제의 어려운 쪽이다. **호출을 나눈다고 격리가 되지 않는다** —
 * 서브에이전트를 따로 띄워도 프롬프트에 결론을 실어 보내면 그만이다.
 * 격리는 컨텍스트를 조립하는 시점에 무엇을 빼는가로 결정된다.
 *
 * 실행: pnpm --filter ai-work-delegation test 06-01
 */

/** 네 역할. 배열에 적힌 순서가 실행 순서다. */
export type Role = 'researcher' | 'skeptic' | 'auditor' | 'reporter';

/** 파이프라인을 통과하며 채워지는 작업물. */
export interface Draft {
	/** 무엇을 묻고 있는가 */
	question: string;
	/** 모인 근거 */
	evidence: string[];
	/** 도달한 결론. 검증 전에는 없을 수 있다 */
	conclusion?: string;
	/** 최종 산출물. 편집자만 만든다 */
	report?: string;
}

/** 역할에게 실제로 넘기는 것. `Draft`의 부분집합이며 `report`는 절대 넘기지 않는다. */
export type RoleContext = Partial<Pick<Draft, 'question' | 'evidence' | 'conclusion'>>;

/** 역할 하나를 호출하는 함수. 실제로는 모델 호출이 들어간다. */
export type RoleCall = (role: Role, context: RoleContext) => Partial<Draft>;

/**
 * 역할에게 넘길 컨텍스트를 조립한다.
 *
 * | 역할 | 넘기는 것 | 감추는 것 |
 * |---|---|---|
 * | `researcher` | `question` | 근거·결론 (기존 근거가 앵커가 되면 처음부터 찾지 못한다) |
 * | `skeptic` | `question` · `evidence` | **`conclusion`** (알면 반론의 강도를 거기 맞춘다) |
 * | `auditor` | `evidence` | 질문·결론 (맥락을 주면 "말이 되니까 맞겠지"가 섞인다) |
 * | `reporter` | `question` · `evidence` · `conclusion` | 없음 (검증이 끝난 뒤다) |
 *
 * **감추는 것은 키 자체를 넣지 않는다.** `undefined`를 담아 두면 직렬화 경로에
 * 따라 되살아나고, `'conclusion' in context`로 확인하는 쪽에서 있는 것으로 읽힌다.
 *
 * `draft`에 원래 값이 없는 항목(`conclusion`이 아직 없는 경우)도 키를 넣지 않는다.
 *
 * 돌려주는 컨텍스트는 `draft`와 **상태를 공유하지 않는다.** 컨텍스트의
 * `evidence`를 건드려도 원본이 바뀌지 않아야 한다.
 */
export function contextFor(role: Role, draft: Draft): RoleContext {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: contextFor');
}

/**
 * 역할들을 순서대로 실행하고 각 반환을 작업물에 누적한다.
 *
 * 실행 전에 불변식을 검사하고, 어기면 **아무 역할도 호출하지 않고** `RangeError`를
 * 던진다. 절반쯤 돌다 멈추면 부분적으로 채워진 작업물이 남아, 그것이 완결된
 * 것처럼 다음 단계로 흘러간다.
 *
 * 불변식 셋:
 *
 * 1. `roles`가 비어 있으면 안 된다
 * 2. `reporter`는 **마지막 자리에만** 올 수 있다
 * 3. `reporter`가 있으면 그 앞에 `skeptic`과 `auditor`가 **둘 다** 있어야 한다
 *
 * `reporter`가 아예 없는 파이프라인은 허용된다 — 검증만 하고 끝내는 실행이다.
 *
 * 각 역할은 **그 시점까지 누적된 작업물**로 만든 컨텍스트를 받는다. 원본
 * `draft`는 훼손하지 않고 새 객체를 돌려준다.
 */
export function runPipeline(roles: Role[], draft: Draft, call: RoleCall): Draft {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: runPipeline');
}

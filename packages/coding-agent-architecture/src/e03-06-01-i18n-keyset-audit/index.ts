/**
 * 과제 e03-07-01 — i18n 리소스 키셋 감사
 *
 * 강의의 스킬이 요구하는 **검사 스크립트를 직접 만드는 과제**다. 스킬에 규칙을 적어
 * 두는 것은 지시이고, 이 검사가 판정이다 — 그 차이가 07·10장의 요점이다.
 *
 * 스킬 원문(`i18n-resource-map`)이 정한 것:
 *   · "Every language file carries the identical key set. A key present in one file
 *      and missing from another is a **violation, not a to-do**."
 *   · "Flat, not nested. The key **is** the dotted path. Nesting hides the namespace
 *      and makes a key impossible to grep."
 *   · 필수 8개 언어. `en`은 폴백, `ar`은 RTL을 가정하지 못하게 만드는 load-bearing 항목
 *
 * 명세:  tests/e03-06-01-i18n-keyset-audit/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test e03-07-01
 * 막히면: docs/ep03-admin-implementation/06-skill-enforced-structure.md
 */

/** 스킬이 정한 최소 언어 집합. */
export const REQUIRED_LANGS: readonly string[] = [
	// 🎯 TODO: 8개를 채우라 (10장의 표)
];

/** 언어 코드 → 플랫 키맵. 값이 객체·배열이면 그 자체가 위반이다. */
export type ResourceBundle = Record<string, Record<string, unknown>>;

export type Violation =
	| { kind: 'missing_language'; lang: string }
	| { kind: 'missing_key'; lang: string; key: string }
	| { kind: 'nested_key'; lang: string; key: string }
	| { kind: 'empty_value'; lang: string; key: string };

/**
 * 리소스 번들을 감사해 위반 목록을 준다. 위반이 없으면 빈 배열.
 *
 * 힌트 넷:
 *   ① 키셋 비교의 **기준을 무엇으로 잡는가**가 이 과제의 핵심이다. `en`을 기준으로
 *      삼으면 `en`에 없는 키는 검사에서 빠지는데, 그게 정확히 잡아야 할 위반이다
 *   ② 중첩(객체·배열)과 빈 값은 **다른 위반**이다 — 처방이 다르므로 구별한다
 *   ③ 첫 위반에서 멈추지 않는다. 한 번 돌려 고칠 것을 다 알려 준다
 *   ④ 출력은 정렬한다. 순서가 실행마다 바뀌면 CI 로그를 diff로 비교할 수 없다
 */
export function auditResources(bundle: ResourceBundle): Violation[] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: auditResources');
}

/**
 * 참고 구현 — i18n 리소스 키셋 감사.
 *
 * 판정은 tests/e03-06-01-i18n-keyset-audit/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/ep03-admin-implementation/06-skill-enforced-structure.md
 */

/**
 * 여덟 개가 고정인 이유는 시장이 아니라 **강제**다.
 *   en — 해석 안 된 키의 폴백
 *   ar — RTL을 "가정하지 못하게" 만드는 load-bearing 항목. 빼면 레이아웃이 조용히
 *        한 방향으로 굳고, 그 부채는 시간이 갈수록 커진다
 */
export const REQUIRED_LANGS: readonly string[] = ['en', 'ko', 'zh', 'es', 'hi', 'ar', 'fr', 'pt'];

export type ResourceBundle = Record<string, Record<string, unknown>>;

export type Violation =
	| { kind: 'missing_language'; lang: string }
	| { kind: 'missing_key'; lang: string; key: string }
	| { kind: 'nested_key'; lang: string; key: string }
	| { kind: 'empty_value'; lang: string; key: string };

const KIND_ORDER: Violation['kind'][] = ['missing_language', 'missing_key', 'nested_key', 'empty_value'];

/**
 * 감사의 설계는 세 가지 결정으로 압축된다.
 *
 * **① 기준은 합집합이다.** `en`을 기준으로 삼는 구현이 자연스러워 보이지만 틀렸다 —
 * 어떤 키가 `ko`에만 추가되면 `en`에는 없으므로 검사 대상에서 빠지고, 정확히 그
 * 상황이 잡아야 할 위반이다. 모든 파일의 키를 합쳐 기준으로 써야 **어느 파일에
 * 추가됐든** 나머지에서 빠진 것이 드러난다.
 *
 * **② 중첩과 빈 값을 가른다.** 둘 다 "제대로 안 된 것"이지만 처방이 다르다 —
 * 중첩은 구조를 고쳐야 하고(키를 점 경로로 펴기), 빈 값은 번역을 채워야 한다.
 * 한 종류로 합치면 보고를 받은 사람이 무엇을 해야 할지 모른다.
 *
 * **③ 정렬한다.** 검사 출력이 실행마다 순서가 바뀌면 CI 로그를 diff로 비교할 수
 * 없고, "고쳐졌나"를 눈으로 확인하게 된다. 검사 스크립트는 결과가 안정적이어야
 * 판정 도구로 쓰인다.
 */
export function auditResources(bundle: ResourceBundle): Violation[] {
	const out: Violation[] = [];

	// 언어 누락 — 이것부터 본다. 없는 파일의 키를 셀 수는 없다.
	const present = Object.keys(bundle);
	for (const lang of REQUIRED_LANGS) {
		if (!present.includes(lang)) out.push({ kind: 'missing_language', lang });
	}

	// 키셋 기준 = 존재하는 모든 파일의 합집합
	const union = new Set<string>();
	for (const keys of Object.values(bundle)) {
		for (const k of Object.keys(keys)) union.add(k);
	}

	for (const lang of present) {
		const keys = bundle[lang]!;
		for (const key of union) {
			if (!(key in keys)) {
				out.push({ kind: 'missing_key', lang, key });
				continue;
			}
			const value = keys[key];
			if (typeof value === 'object' && value !== null) {
				// 배열도 객체다 — 둘 다 점 경로 키를 숨긴다
				out.push({ kind: 'nested_key', lang, key });
			} else if (typeof value === 'string' && value.trim() === '') {
				out.push({ kind: 'empty_value', lang, key });
			}
		}
	}

	return out.sort(
		(a, b) =>
			KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
			a.lang.localeCompare(b.lang) ||
			('key' in a ? a.key : '').localeCompare('key' in b ? b.key : ''),
	);
}

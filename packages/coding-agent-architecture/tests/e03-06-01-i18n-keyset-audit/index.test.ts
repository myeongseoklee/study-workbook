// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/e03-06-01-i18n-keyset-audit/index.ts를 고쳐라.
//
// 이 과제는 강의의 스킬이 요구하는 **검사 스크립트를 직접 만드는 것**이다. 스킬에 규칙을
// 적어 두는 것은 지시이고, 이 검사가 판정이다 — 그 둘의 차이가 07·10장의 요점이다.
//
// 스킬 원문이 요구하는 것:
//   "Every language file carries the identical key set. A key present in one file and
//    missing from another is a violation, not a to-do."
//   "Flat, not nested. The key is the dotted path. Nesting hides the namespace and
//    makes a key impossible to grep."
//   "en — fallback for every unresolved key" / "ar is load-bearing"
import { describe, expect, it } from 'vitest';
import { retrace } from '@study/testkit';
import {
	REQUIRED_LANGS,
	auditResources,
	type ResourceBundle,
} from '../../src/e03-06-01-i18n-keyset-audit';

const full = (over: Partial<Record<string, unknown>> = {}): ResourceBundle => {
	const base: ResourceBundle = {};
	for (const lang of REQUIRED_LANGS) {
		base[lang] = { 'app.shell.menu.open.button': `${lang}-open`, 'app.login.title': `${lang}-title` };
	}
	return { ...base, ...(over as ResourceBundle) };
};

describe('REQUIRED_LANGS — 최소 8개 언어', () => {
	it('스킬이 요구하는 8개가 전부 있다', () => {
		expect([...REQUIRED_LANGS].sort()).toEqual(['ar', 'en', 'es', 'fr', 'hi', 'ko', 'pt', 'zh']);
	});

	it('en과 ar이 포함된다 — 둘은 성격이 다른 이유로 필수다', () => {
		retrace(
			'en은 해석 안 된 키의 폴백이고, ar은 RTL을 "가정하지 못하게" 만드는 load-bearing 항목이다. ' +
				'ar을 빼면 레이아웃이 한 방향으로 조용히 굳는다.',
			() => {
				expect(REQUIRED_LANGS).toContain('en');
				expect(REQUIRED_LANGS).toContain('ar');
			},
		);
	});
});

describe('auditResources — 온전한 번들', () => {
	it('위반이 없으면 빈 배열이다', () => {
		expect(auditResources(full())).toEqual([]);
	});

	it('필수 언어보다 많은 언어가 있어도 통과한다', () => {
		retrace('스킬은 "Add more languages freely. Never ship fewer than the required set"이라고 정한다', () => {
			const bundle = full();
			bundle.ja = { 'app.shell.menu.open.button': 'ja-open', 'app.login.title': 'ja-title' };
			expect(auditResources(bundle)).toEqual([]);
		});
	});
});

describe('auditResources — 언어 누락', () => {
	it('필수 언어가 빠지면 missing_language 위반', () => {
		const bundle = full();
		delete bundle.ar;
		const v = auditResources(bundle);
		expect(v).toHaveLength(1);
		expect(v[0]).toEqual({ kind: 'missing_language', lang: 'ar' });
	});

	it('여러 언어가 빠지면 각각 보고한다', () => {
		const bundle = full();
		delete bundle.hi;
		delete bundle.pt;
		expect(auditResources(bundle).map((x) => x.lang).sort()).toEqual(['hi', 'pt']);
	});
});

describe('auditResources — 키셋 불일치가 핵심이다', () => {
	it('한 파일에만 있는 키는 나머지 전부에서 missing_key 위반이다', () => {
		retrace(
			'"A key present in one file and missing from another is a violation, not a to-do." ' +
				'그리고 틀린/없는 키는 에러가 아니라 조용한 빈칸으로 나타난다 — 그래서 검사가 필요하다.',
			() => {
				const bundle = full();
				bundle.ko = { ...(bundle.ko as object), 'app.only.in.korean': '한국어만' };
				const v = auditResources(bundle);
				// ko를 뺀 7개 언어에서 그 키가 빠졌다
				expect(v).toHaveLength(7);
				expect(v.every((x) => x.kind === 'missing_key')).toBe(true);
				expect(
					v.every((x) => x.kind === 'missing_key' && x.key === 'app.only.in.korean'),
				).toBe(true);
				expect(v.map((x) => x.lang).sort()).toEqual(['ar', 'en', 'es', 'fr', 'hi', 'pt', 'zh']);
			},
		);
	});

	it('기준은 en이 아니라 **전체 키의 합집합**이다', () => {
		retrace(
			'en을 기준으로 삼으면 en에 없는 키는 검사에서 빠진다 — 정확히 그 키가 다른 언어에만 ' +
				'추가된 위반인데도. 합집합을 기준으로 해야 어느 파일에 추가됐든 잡힌다.',
			() => {
				const bundle = full();
				bundle.zh = { ...(bundle.zh as object), 'app.only.in.chinese': '中文' };
				const v = auditResources(bundle);
				expect(
					v.some((x) => x.kind === 'missing_key' && x.lang === 'en' && x.key === 'app.only.in.chinese'),
				).toBe(true);
			},
		);
	});

	it('키가 모든 파일에 있으면 위반이 아니다', () => {
		const bundle = full();
		for (const lang of REQUIRED_LANGS) {
			bundle[lang] = { ...(bundle[lang] as object), 'app.new.key': `${lang}-new` };
		}
		expect(auditResources(bundle)).toEqual([]);
	});
});

describe('auditResources — 플랫 구조 강제', () => {
	it('값이 객체면 nested_key 위반이다', () => {
		retrace(
			'"Nesting hides the namespace and makes a key impossible to grep." 중첩을 허용하면 ' +
				'코드에서 키를 찾을 수 없고, 그러면 이 검사 자체가 성립하지 않는다.',
			() => {
				const bundle = full();
				bundle.en = { 'app.login.title': 'Login', app: { shell: { menu: 'x' } } } as never;
				const v = auditResources(bundle);
				expect(v.some((x) => x.kind === 'nested_key' && x.lang === 'en' && x.key === 'app')).toBe(true);
			},
		);
	});

	it('배열도 중첩으로 본다', () => {
		const bundle = full();
		bundle.ko = { ...(bundle.ko as object), 'app.items': ['a', 'b'] } as never;
		expect(auditResources(bundle).some((x) => x.kind === 'nested_key')).toBe(true);
	});

	it('빈 문자열은 중첩이 아니라 empty_value 위반이다', () => {
		retrace('번역이 안 된 것과 구조가 틀린 것은 다른 위반이다 — 처방이 다르므로 구별한다', () => {
			const bundle = full();
			bundle.fr = { ...(bundle.fr as object), 'app.login.title': '   ' };
			const v = auditResources(bundle);
			expect(v).toHaveLength(1);
			expect(v[0]).toEqual({ kind: 'empty_value', lang: 'fr', key: 'app.login.title' });
		});
	});
});

describe('auditResources — 보고 형식', () => {
	it('위반이 여럿이면 전부 보고한다 (첫 건에서 멈추지 않는다)', () => {
		const bundle = full();
		delete bundle.pt;
		bundle.ko = { ...(bundle.ko as object), 'app.extra': 'x' };
		bundle.en = { ...(bundle.en as object), 'app.login.title': '' };
		const kinds = new Set(auditResources(bundle).map((x) => x.kind));
		expect(kinds).toEqual(new Set(['missing_language', 'missing_key', 'empty_value']));
	});

	it('결과가 정렬되어 있다 — 종류 → 언어 → 키 순', () => {
		retrace(
			'검사 스크립트의 출력이 실행마다 순서가 바뀌면 CI 로그를 비교할 수 없고, ' +
				'"고쳐졌나"를 diff로 확인하지 못한다.',
			() => {
				const bundle = full();
				bundle.zh = { ...(bundle.zh as object), 'b.key': 'x', 'a.key': 'y' };
				// `filter`의 predicate는 타입을 좁히지 않으므로 flatMap 안에서 걸러 낸다
				// (missing_language 변형에는 `key`가 없다)
				const keys = auditResources(bundle).flatMap((x) =>
					x.kind === 'missing_key' && x.lang === 'en' ? [x.key] : [],
				);
				expect(keys).toEqual(['a.key', 'b.key']);
			},
		);
	});

	it('빈 번들은 8개 언어 누락으로 보고된다 — 던지지 않는다', () => {
		const v = auditResources({});
		expect(v).toHaveLength(8);
		expect(v.every((x) => x.kind === 'missing_language')).toBe(true);
	});
});

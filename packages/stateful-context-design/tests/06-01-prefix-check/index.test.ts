/**
 * 과제 3-3의 명세 — 프롬프트 캐시 프리픽스 안정성 검사기
 *
 * 이 파일이 과제의 정의다. `src/06-01-prefix-check/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다.
 *
 * 캐시 미적중은 예외를 던지지 않는다. 조용히 비용만 낸다. 그래서 이런
 * 검사기가 필요하고, 검사기 자체가 틀리면 아무도 모른다 — 아래 검사들이
 * 검사기를 검사한다.
 *
 * 실행: pnpm test 06-01
 */
import { retrace, scripted } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { compare, renderPrefix, type Request } from '../../src/06-01-prefix-check';

const TOOLS = [{ name: 'search' }, { name: 'fetch' }];
const SYSTEM = '너는 도움이 되는 조수다';
const MESSAGES = [{ role: 'user', content: '안녕' }];

const req = (over: Partial<Request> = {}): Request => ({
	tools: TOOLS,
	system: SYSTEM,
	messages: MESSAGES,
	...over,
});

describe('renderPrefix — 렌더 순서', () => {
	it('tools → system → messages 순서로 놓는다', () => {
		retrace(
			'순서가 곧 무효화 범위다. 앞의 것이 바뀌면 뒤 전체가 무효가 되므로, ' +
				'가장 안 바뀌는 tools가 맨 앞이어야 캐시가 오래 산다.',
			() => {
				const out = renderPrefix(['도구자리'], '시스템자리', ['메시지자리']);
				const t = out.indexOf('도구자리');
				const s = out.indexOf('시스템자리');
				const m = out.indexOf('메시지자리');
				expect(t).toBeGreaterThanOrEqual(0);
				expect(t).toBeLessThan(s);
				expect(s).toBeLessThan(m);
			},
		);
	});

	it('같은 입력이면 같은 문자열이 나온다 (결정적)', () => {
		expect(renderPrefix(TOOLS, SYSTEM, MESSAGES)).toBe(renderPrefix(TOOLS, SYSTEM, MESSAGES));
	});

	it('세 구획이 서로 섞이지 않는다 — 한 곳만 바뀌면 다른 곳은 그대로다', () => {
		const base = renderPrefix(TOOLS, SYSTEM, MESSAGES);
		const changed = renderPrefix(TOOLS, SYSTEM, [{ role: 'user', content: '다른 말' }]);
		const common = [...base].findIndex((ch, i) => ch !== changed[i]);
		expect(common).toBeGreaterThan(0);
		expect(base.slice(0, common)).toBe(changed.slice(0, common));
	});
});

describe('compare — 같음 판정', () => {
	it('동일한 요청이면 same=true다', () => {
		expect(compare(req(), req()).same).toBe(true);
	});

	it('다르면 same=false다', () => {
		expect(compare(req(), req({ system: '다른 시스템' })).same).toBe(false);
	});

	it('다를 때 처음 갈라지는 오프셋을 정수로 보고한다', () => {
		const result = compare(req(), req({ system: '다른 시스템' }));
		expect(Number.isInteger(result.offset)).toBe(true);
	});

	it('그 오프셋이 실제로 갈라지는 지점을 가리킨다', () => {
		retrace(
			'offset 이전은 두 프리픽스가 완전히 같아야 하고, offset 위치에서 처음 달라져야 한다. ' +
				'0을 반환하거나 길이를 반환하는 구현이 여기서 걸린다.',
			() => {
				const a = req();
				const b = req({ system: '다른 시스템' });
				const { offset } = compare(a, b);
				const sa = renderPrefix(a.tools, a.system, a.messages);
				const sb = renderPrefix(b.tools, b.system, b.messages);

				expect(sa.slice(0, offset)).toBe(sb.slice(0, offset));
				expect(sa[offset!]).not.toBe(sb[offset!]);
			},
		);
	});
});

describe('compare — 실제로 캐시를 깨뜨리는 변화를 잡는가', () => {
	it('시스템 프롬프트에 현재 시각이 들어가면 불안정으로 판정한다', () => {
		// 시계를 대본으로 고정한다. 진짜 Date.now()는 두 번 호출해도 같은 값이
		// 나올 수 있어서, 실패해야 할 테스트가 우연히 통과해 버린다.
		const clock = scripted<[], number>([1_700_000_000_000, 1_700_000_000_001], 'clock');
		const build = (): Request => req({ system: `${SYSTEM} (지금은 ${clock()})` });

		retrace(
			'타임스탬프를 시스템 프롬프트에 넣는 것이 프롬프트 캐시를 깨뜨리는 가장 흔한 실수다. ' +
				'system은 messages보다 앞에 렌더되므로, 매 요청 무효화되는 범위가 대화 전체가 된다.',
			() => {
				expect(compare(build(), build()).same).toBe(false);
			},
		);
	});

	it('도구 목록의 순서만 바꿔도 불안정으로 판정한다', () => {
		retrace(
			'직렬화하면서 키나 배열을 정렬해 "정규화"하면 이 검사에서 걸린다. 검사기는 ' +
				'실제 요청 코드와 **같은** 직렬화를 봐야 한다 — API는 정렬해 주지 않는다.',
			() => {
				expect(compare(req(), req({ tools: [...TOOLS].reverse() })).same).toBe(false);
			},
		);
	});

	it('내용이 같으면 객체 정체성이 달라도 안정으로 판정한다', () => {
		retrace(
			'참조 비교(===)로 구현하면 여기서 걸린다. 캐시는 바이트를 보지 객체를 보지 않는다.',
			() => {
				expect(compare(req({ tools: [{ name: 'search' }, { name: 'fetch' }] }), req()).same).toBe(
					true,
				);
			},
		);
	});
});

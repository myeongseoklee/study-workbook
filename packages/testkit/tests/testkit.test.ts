import { describe, expect, it } from 'vitest';
import { captureStdout, retrace, scripted } from '../src/index.js';

describe('retrace', () => {
	it('성공하면 반환값을 그대로 돌려준다', () => {
		expect(retrace('안 쓰임', () => 42)).toBe(42);
	});

	it('실패하면 원래 메시지를 남기고 힌트를 덧붙인다', () => {
		expect(() =>
			retrace('K와 V 둘 다 셌는지 확인', () => {
				throw new Error('expected 163840 to be 327680');
			}),
		).toThrow(/expected 163840 to be 327680[\s\S]*K와 V 둘 다 셌는지 확인/);
	});

	it('비동기 실패에도 힌트를 붙인다', async () => {
		await expect(
			retrace('비동기 경로', async () => {
				throw new Error('boom');
			}),
		).rejects.toThrow(/boom[\s\S]*비동기 경로/);
	});
});

describe('captureStdout', () => {
	it('console.log와 process.stdout.write를 모두 잡는다', () => {
		const lines = captureStdout(() => {
			console.log('첫 줄');
			process.stdout.write('둘째 줄\n');
		});
		expect(lines).toEqual(['첫 줄', '둘째 줄']);
	});

	it('캡처가 끝나면 원래 출력으로 되돌린다', () => {
		const before = console.log;
		captureStdout(() => console.log('무시됨'));
		expect(console.log).toBe(before);
	});

	it('콜백이 던져도 되돌린다', () => {
		const before = console.log;
		expect(() =>
			captureStdout(() => {
				throw new Error('중단');
			}),
		).toThrow('중단');
		expect(console.log).toBe(before);
	});
});

describe('scripted', () => {
	it('대본 순서대로 돌려주고 인자를 기록한다', () => {
		const fn = scripted<[number], string>(['하나', '둘']);
		expect(fn(1)).toBe('하나');
		expect(fn(2)).toBe('둘');
		expect(fn.calls).toEqual([[1], [2]]);
		expect(fn.remaining).toBe(0);
	});

	it('대본을 다 쓰고 또 불리면 원인을 지목하며 던진다', () => {
		const fn = scripted<[], string>(['한 번뿐'], 'model');
		fn();
		expect(() => fn()).toThrow(/model: 대본은 1개인데 2번째 호출/);
	});
});

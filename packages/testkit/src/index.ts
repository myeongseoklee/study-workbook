/**
 * @study/testkit — 과제 테스트를 쓸 때 반복되는 세 가지 도구.
 *
 * 학습 레포의 테스트는 통과/실패만 알려주면 부족하다. **왜 틀렸는지**를
 * 알려줘야 다음 시도가 추측이 되지 않는다. 여기 있는 것들은 전부 그 목적이다.
 */

/**
 * 실패한 assertion에 도메인 힌트를 덧붙인다.
 *
 * Vitest의 기본 실패 메시지는 `expected 327680 to be 163840` 까지만 알려준다.
 * 그 숫자가 왜 반이 되었는지(= K와 V 중 하나를 빠뜨렸는지)는 과제를 만든
 * 사람만 안다. 그 지식을 메시지에 실어 보내는 게 이 함수의 전부다.
 *
 * ```ts
 * retrace('× 2 (K와 V) 또는 × layers를 빠뜨렸는지 확인', () => {
 *   expect(bytesPerToken(80, 8, 128)).toBe(327_680);
 * });
 * ```
 *
 * 동기·비동기 콜백 모두 받는다.
 */
export function retrace<T>(hint: string, fn: () => T): T {
	const attach = (error: unknown): unknown => {
		if (error instanceof Error) {
			error.message = `${error.message}\n\n  ↳ 힌트: ${hint}`;
		}
		return error;
	};

	try {
		const result = fn();
		if (result instanceof Promise) {
			return result.catch((error: unknown) => {
				throw attach(error);
			}) as T;
		}
		return result;
	} catch (error) {
		throw attach(error);
	}
}

/**
 * 콜백이 표준출력에 쓴 것을 줄 배열로 돌려준다.
 *
 * 화면에 무언가를 그리는 과제(마스크 렌더링, 트레이스 출력 등)는 반환값이
 * 없어서 그냥은 검사할 수 없다. `console.log`와 `process.stdout.write`를
 * 모두 가로채므로 어느 쪽으로 써도 잡힌다.
 *
 * 마지막 개행으로 생기는 빈 줄은 제거한다 — 출력 방식에 따라 있을 수도
 * 없을 수도 있어서, 테스트가 그것에 걸려 넘어지면 안 된다.
 */
export function captureStdout(fn: () => void): string[] {
	const chunks: string[] = [];
	const originalLog = console.log;
	const originalWrite = process.stdout.write.bind(process.stdout);

	console.log = (...args: unknown[]): void => {
		chunks.push(`${args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ')}\n`);
	};
	process.stdout.write = ((chunk: unknown): boolean => {
		chunks.push(String(chunk));
		return true;
	}) as typeof process.stdout.write;

	try {
		fn();
	} finally {
		console.log = originalLog;
		process.stdout.write = originalWrite;
	}

	const lines = chunks.join('').split('\n');
	if (lines.at(-1) === '') lines.pop();
	return lines;
}

/** {@link scripted}가 돌려주는 함수. 원래 함수처럼 부르면서 호출 기록을 함께 본다. */
export type ScriptedFn<Args extends unknown[], Result> = ((...args: Args) => Result) & {
	/** 지금까지 받은 인자들. 호출 순서대로. */
	readonly calls: Args[];
	/** 대본에서 아직 쓰이지 않은 항목 수. */
	readonly remaining: number;
};

/**
 * 정해진 순서대로 값을 돌려주는 가짜 함수를 만든다. 호출 인자를 전부 기록한다.
 *
 * 의존성(모델 응답, 외부 API, 시계)을 대본으로 고정하면 테스트가 결정적이 된다.
 * 무엇을 돌려줄지뿐 아니라 **무엇을 받았는지**도 검사 대상이라, 인자 기록이 함께 붙는다.
 *
 * ```ts
 * const model = scripted<[Ctx], Step>([
 *   { type: 'tool', tool: 'inc', input: '3' },
 *   { type: 'done', answer: '4' },
 * ], 'model');
 *
 * runTurn({ model, ... });
 * expect(model.calls).toHaveLength(2);
 * expect(model.calls[1][0].observations).toEqual(['4']);
 * ```
 *
 * 대본을 다 쓰고도 또 불리면 던진다. 종료 조건을 빠뜨린 루프는 이 지점에서
 * 무한히 도는 대신 곧바로 실패하고, 메시지가 원인을 지목한다.
 */
export function scripted<Args extends unknown[], Result>(
	steps: readonly Result[],
	label = 'scripted',
): ScriptedFn<Args, Result> {
	const calls: Args[] = [];
	let cursor = 0;

	const fn = (...args: Args): Result => {
		calls.push(args);
		if (cursor >= steps.length) {
			throw new Error(
				`${label}: 대본은 ${steps.length}개인데 ${cursor + 1}번째 호출이 들어왔습니다. ` +
					`종료 조건에 도달하지 못하고 계속 도는 중인지 확인하세요.`,
			);
		}
		return steps[cursor++]!;
	};

	Object.defineProperties(fn, {
		calls: { get: () => calls },
		remaining: { get: () => steps.length - cursor },
	});

	return fn as ScriptedFn<Args, Result>;
}

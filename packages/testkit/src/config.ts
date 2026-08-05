/**
 * 과제 패키지가 공유하는 Vitest 설정.
 *
 * 각 패키지의 `vitest.config.ts`는 이 한 줄이면 된다:
 *
 * ```ts
 * import { defineStudyConfig } from '@study/testkit/config';
 * export default defineStudyConfig(import.meta.url);
 * ```
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * 테스트가 `../src/...`를 import하면 평소에는 `src/`(당신의 구현)를 본다.
 * `STUDY_TARGET=solutions`이면 같은 테스트가 `solutions/`(정답 구현)를 본다.
 *
 * 하나의 테스트 파일로 양방향 검증이 되는 게 핵심이다. 과제를 만들 때
 * 정답으로 돌려 테스트가 실제로 통과하는지, 스켈레톤으로 돌려 실제로
 * 실패하는지를 확인하면, **아무것도 검사하지 않는 테스트**가 걸러진다.
 */
export function defineStudyConfig(packageUrl: string) {
	const packageRoot = dirname(fileURLToPath(packageUrl));
	const useSolutions = process.env.STUDY_TARGET === 'solutions';
	const implDir = resolve(packageRoot, useSolutions ? 'solutions' : 'src');

	return defineConfig({
		test: {
			root: packageRoot,
			include: ['tests/**/*.test.ts'],
			alias: [
				// 테스트 파일에는 평범한 상대 경로(`../src/3-1-kv-calc`)만 보인다.
				// 치환은 여기서만 일어나므로 학습자가 새로 배울 문법이 없다.
				{ find: /^\.\.\/src\//, replacement: `${implDir}/` },
			],
		},
	});
}

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
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * 테스트가 `../src/...`를 import하면 평소에는 `src/`(당신의 구현)를 본다.
 * `STUDY_TARGET`에 다른 디렉토리 이름을 주면 같은 테스트가 그쪽을 본다.
 *
 * | STUDY_TARGET | 보는 곳 | 쓰임 |
 * |---|---|---|
 * | (없음) | `src/` | 학습자의 풀이 판정 |
 * | `solutions` | `solutions/` | 명세가 통과 가능한지 증명 |
 * | 그 외 이름 | 그 디렉토리 | 오답을 넣어 명세의 변별력을 확인 |
 *
 * 하나의 테스트 파일로 양방향 검증이 되는 게 핵심이다. 정답으로 돌려 실제로
 * 통과하는지, 스켈레톤으로 돌려 실제로 실패하는지를 확인하면 **아무것도
 * 검사하지 않는 테스트**가 걸러진다.
 *
 * 세 번째 줄이 있는 이유는 검증관이 오답을 주입할 자리가 필요하기 때문이다.
 * 추적 중인 파일을 덮었다 되돌리는 방식은 중간에 죽으면 작업 트리가 오염된다.
 */
export function defineStudyConfig(packageUrl: string) {
	const packageRoot = dirname(fileURLToPath(packageUrl));
	const target = process.env.STUDY_TARGET?.trim() || 'src';

	if (target.includes('/') || target.includes('\\') || target.startsWith('.')) {
		throw new Error(`STUDY_TARGET은 패키지 안의 디렉토리 이름 하나여야 한다 (받은 값: "${target}")`);
	}

	const implDir = resolve(packageRoot, target);
	if (!existsSync(implDir)) {
		throw new Error(`STUDY_TARGET="${target}" 디렉토리가 ${packageRoot} 아래에 없다`);
	}

	return defineConfig({
		test: {
			root: packageRoot,
			include: ['tests/**/*.test.ts'],
			alias: [
				// 테스트 파일에는 평범한 상대 경로(`../../src/03-01-kv-calc`)만 보인다.
				// 치환은 여기서만 일어나므로 학습자가 새로 배울 문법이 없다.
				//
				// `../`의 개수를 고정하지 않는 이유: 과제가 폴더가 되면서 테스트가
				// `tests/{과제}/index.test.ts`로 한 단계 내려갔고, 경로가 `../../src/`가
				// 됐다. 개수를 박아두면 깊이가 바뀔 때 alias가 조용히 빗나가고 —
				// 치환이 안 되면 늘 `src/`를 보므로 **`STUDY_TARGET=solutions`가
				// 무력화된 것을 아무도 모른 채 양방향 검증이 통과한다.**
				{ find: /^(?:\.\.\/)+src\//, replacement: `${implDir}/` },
			],
		},
	});
}

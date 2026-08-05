import { defineConfig } from 'vitest/config';

// testkit은 과제 패키지가 아니라 도구 패키지라 solutions/ 치환이 없다.
// defineStudyConfig를 쓰지 않고 평범한 설정을 둔다.
export default defineConfig({
	test: { include: ['tests/**/*.test.ts'] },
});

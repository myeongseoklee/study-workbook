/**
 * 환경변수 주입 지점 — 워크북에서 여기 한 곳뿐이다.
 *
 * `.env` 는 `import "dotenv/config"` 를 실행한 **프로세스**에만 로드된다.
 * 그래서 dotenv 를 import 하지 않은 파일에서 process.env 를 직접 읽으면 undefined 다
 * (예: `npm run week1` 이 키를 못 찾던 원인).
 *
 * 규칙: process.env 는 이 파일에서만 읽고, 나머지는 아래 export 를 import 해서 쓴다.
 *   - 주차 실습(week0·3·5·7)·환경점검 → shared/llm 을 통해 client·MODEL 을 받는다
 *   - week1(네이티브 Gemini provider) → shared/llm 에서 API_KEY·MODEL
 *   - 8-1-llm-provider(08장) → provider 전환이 연습 대상이라 이 파일을 직접 import
 *
 * shared/는 src/도 solutions/도 아닌 패키지 루트에 있다 — 둘 다 ../shared로 같은 파일을
 * 본다. src/ 안에 두면 solutions/*.ts가 ../src/를 참조하게 돼 독립성이 깨진다.
 */
import "dotenv/config";

/** Gemini 의 OpenAI 호환 엔드포인트 (week0·3·5·7 이 이 경로로 호출) */
export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";

/** OpenAI 호환 호출에 쓰는 키. Gemini 키가 없으면 OpenAI 본토 키로 폴백 */
export const API_KEY = process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY;

/** baseURL 을 비우면 OpenAI 본토, 그대로면 Gemini 호환 엔드포인트 */
export const BASE_URL = process.env.LLM_BASE_URL ?? GEMINI_BASE;

/** 사용할 모델. .env 의 GEMINI_MODEL(또는 OPENAI_MODEL)로 덮어쓴다 */
export const MODEL = process.env.GEMINI_MODEL ?? process.env.OPENAI_MODEL ?? "gemini-3.1-flash-lite";

// --- 08장 provider 추상화 연습문제에서 쓰는 값 ---

/** 어느 어댑터를 쓸지 (gemini | anthropic) */
export const LLM_PROVIDER = process.env.LLM_PROVIDER ?? "gemini";

/** Claude 모델. SDK 는 ANTHROPIC_API_KEY 를 스스로 읽으므로 키는 여기서 안 다룬다 */
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

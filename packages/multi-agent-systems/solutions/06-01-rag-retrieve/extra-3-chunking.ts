/**
 * 선택 문제 C의 참고 구현 — 청킹.
 *
 * 📍 되짚기: docs/06-rag-when-needed.md § 1. 청킹 — 문서를 조각으로
 */

/**
 * 겹침이 크기 이상이면 시작 위치가 전진하지 못해 무한 루프가 된다. 조용히
 * 보정하지 않고 거부하는 편이 낫다 — 설정 실수를 장애로 바꾸지 않으려면
 * 실수인 채로 드러나야 한다.
 */
export function chunk(text: string, size: number, overlap = 0): string[] {
  if (!Number.isFinite(size) || size < 1) {
    throw new Error(`청크 크기는 1 이상이어야 합니다: ${size}`);
  }
  if (overlap < 0) {
    throw new Error(`겹침은 음수일 수 없습니다: ${overlap}`);
  }
  if (overlap >= size) {
    throw new Error(`겹침(${overlap})이 크기(${size}) 이상이면 조각이 전진하지 못합니다`);
  }

  const step = size - overlap;
  const out: string[] = [];
  for (let i = 0; i < text.length; i += step) {
    out.push(text.slice(i, i + size));
  }
  return out;
}

/**
 * 문단을 지키면 문장이 경계에 걸려 반쪽 나는 사고가 줄어든다. 다만 문단
 * 하나가 한도를 넘으면 어쩔 수 없이 고정 크기로 잘라야 하므로, 그 자리에서만
 * chunk 로 떨어진다.
 */
export function chunkByParagraph(text: string, maxSize: number): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: string[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer) out.push(buffer);
    buffer = "";
  };

  for (const p of paragraphs) {
    if (p.length > maxSize) {
      flush();
      out.push(...chunk(p, maxSize));
      continue;
    }
    const merged = buffer ? `${buffer}\n\n${p}` : p;
    if (merged.length > maxSize) {
      flush();
      buffer = p;
    } else {
      buffer = merged;
    }
  }
  flush();

  return out;
}

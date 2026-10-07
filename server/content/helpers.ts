import type { CheckQuestion, ContentBlock } from '../../shared/types';

let n = 0;
const bid = (p: string) => `${p}-${(++n).toString(36)}`;

export const h = (text: string, level: 2 | 3 = 2): ContentBlock => ({ id: bid('b'), type: 'heading', text, level });
export const p = (text: string): ContentBlock => ({ id: bid('b'), type: 'paragraph', text });
export const t = (text: string, tone: 'info' | 'tip' = 'info'): ContentBlock => ({ id: bid('b'), type: 'text', text, tone });
export const quote = (text: string, attribution = ''): ContentBlock => ({ id: bid('b'), type: 'quote', text, attribution });
export const list = (items: string[], ordered = false): ContentBlock => ({ id: bid('b'), type: 'list', items, ordered });
export const link = (label: string, url: string): ContentBlock => ({ id: bid('b'), type: 'link', label, url });
export const paras = (text: string): ContentBlock[] =>
  text
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const lines = s.split('\n');
      if (lines.length > 1 && lines.every((l) => /^(\d+\.|[-•])\s/.test(l.trim())))
        return list(lines.map((l) => l.trim().replace(/^(\d+\.|[-•])\s*/, '')), /^\d/.test(lines[0].trim()));
      return p(s.replace(/\n/g, ' '));
    });

/** q(id, question, [options], correctIndex, rationale) */
export const q = (id: string, question: string, options: string[], correctIndex: number, rationale: string): CheckQuestion => ({
  id,
  question,
  options,
  correctIndex,
  rationale,
});

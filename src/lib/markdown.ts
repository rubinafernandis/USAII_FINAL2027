import type { ContentBlock, Course, Lesson } from '../../shared/types';
import { activityInstructionText } from '../../shared/transcript';

const tidy = (s?: string) => (s ?? '').replace(/\r/g, '').trim();

/** One lesson as Markdown (without its title): the same text the PDF and the viewer show. */
export function lessonMarkdown(l: Lesson): string {
  const out: string[] = [];
  if (l.summary) out.push(`*${tidy(l.summary)}*`, '');
  (l.blocks as ContentBlock[]).forEach((b) => {
    const t = tidy(b.text);
    switch (b.type) {
      case 'heading':
        if (t) out.push(`${b.level === 3 ? '#####' : '####'} ${t}`, '');
        break;
      case 'paragraph':
        if (t) out.push(t, '');
        break;
      case 'text':
        if (t) out.push(`> **${tidy(b.label) || (b.tone === 'tip' ? 'Tip' : 'Note')}:** ${t.replace(/\n/g, '\n> ')}`, '');
        break;
      case 'quote':
        if (t) out.push(`> “${t}”${b.attribution ? ` — ${tidy(b.attribution)}` : ''}`, '');
        break;
      case 'list': {
        const items = (b.items ?? []).map(tidy).filter(Boolean);
        if (items.length) out.push(...items.map((i, n) => `${b.ordered ? `${n + 1}.` : '-'} ${i}`), '');
        break;
      }
      case 'link':
        if (b.url) out.push(`[${tidy(b.label) || b.url}](${b.url})`, '');
        break;
      case 'video':
      case 'audio':
        out.push(`**${b.type === 'video' ? 'Video' : 'Audio'}:** ${tidy(b.label) || 'Media'}${b.url ? ` (${b.url})` : ''}`, '');
        if (b.transcript) out.push(`<details><summary>Transcript</summary>\n\n${tidy(b.transcript)}\n\n</details>`, '');
        break;
      case 'image':
        if (b.url && /^https?:/.test(b.url)) out.push(`![${tidy(b.label) || tidy(b.text) || 'Image'}](${b.url})`, '');
        break;
      default:
        break;
    }
  });
  if (l.activity) {
    out.push(`#### Your activity: ${l.activity.title}`, '');
    const text = activityInstructionText(l.activity);
    if (text) out.push(text, '');
    if (l.activity.rubricPdf?.url) out.push(`*Evaluated against the rubric “${tidy(l.activity.rubricPdf.name)}” (out of ${l.activity.rubricPdf.maxPoints} points).*`, '');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}


/**
 * The study guide as Markdown, built from the same lesson blocks as the lessons,
 * the reader and the PDF. Opens cleanly in Notion, Obsidian, Word, or any text editor.
 */
export function studyGuideMarkdown(course: Course, lessonIds?: Set<string>): string {
  const out: string[] = [];
  const keep = (id: string) => !lessonIds || lessonIds.has(id);
  out.push(`# ${course.title}`, '');
  if (course.subtitle) out.push(`*${tidy(course.subtitle)}*`, '');
  if (course.description) out.push(tidy(course.description), '');
  out.push(`**Study guide** · ${course.credentialName || 'USAII Micro-Credential'}`, '', '---', '');
  course.modules.forEach((m, mi) => {
    const lessons = m.lessons.filter((l) => keep(l.id));
    if (!lessons.length) return;
    out.push(`## Module ${mi + 1}: ${m.title}`, '');
    if (m.summary) out.push(`> ${tidy(m.summary)}`, '');
    lessons.forEach((l) => {
      out.push(`### ${l.title}`, '', lessonMarkdown(l), '');
    });
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

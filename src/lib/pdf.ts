import { jsPDF } from 'jspdf';
import { flattenLessons } from '../../shared/analytics';
import type { ContentBlock, Course, Enrollment } from '../../shared/types';

const MARGIN = 54;
const WIDTH = 595.28; // A4 portrait, points
const HEIGHT = 841.89;
const TEXT_WIDTH = WIDTH - MARGIN * 2;

const clean = (s?: string) => (s ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

/**
 * Builds the course study guide as a real PDF file the learner can keep,
 * print or email. Text only, so it opens on any device and stays small.
 */
export function downloadStudyGuidePdf(course: Course) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = MARGIN;

  const room = (needed: number) => {
    if (y + needed > HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const write = (text: string, size: number, style: 'normal' | 'bold' | 'italic', color: [number, number, number], gapAfter = 8, indent = 0) => {
    const body = clean(text);
    if (!body) return;
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(body, TEXT_WIDTH - indent) as string[];
    const lineHeight = size * 1.42;
    lines.forEach((line) => {
      room(lineHeight);
      doc.text(line, MARGIN + indent, y);
      y += lineHeight;
    });
    y += gapAfter;
  };

  const rule = (color: [number, number, number]) => {
    room(14);
    doc.setDrawColor(...color);
    doc.setLineWidth(2);
    doc.line(MARGIN, y, WIDTH - MARGIN, y);
    y += 14;
  };

  // Cover
  write(course.title, 24, 'bold', [20, 20, 43], 6);
  rule([139, 61, 255]);
  write(course.subtitle ?? '', 12, 'italic', [70, 70, 100], 10);
  write(course.description ?? '', 11, 'normal', [43, 43, 69], 14);
  write(`Study guide · ${course.credentialName ?? 'USAII Micro-Credential'}`, 10, 'bold', [31, 107, 255], 18);

  course.modules.forEach((module, mi) => {
    room(70);
    write(`Module ${mi + 1}: ${module.title}`, 16, 'bold', [31, 107, 255], 4);
    rule([225, 228, 240]);

    module.lessons.forEach((lesson) => {
      room(60);
      write(lesson.title, 13, 'bold', [20, 20, 43], 4);
      if (lesson.summary) write(lesson.summary, 10.5, 'italic', [70, 70, 100], 8);

      (lesson.blocks as ContentBlock[]).forEach((b) => {
        switch (b.type) {
          case 'heading':
            write(clean(b.text), 11.5, 'bold', [43, 43, 69], 5);
            break;
          case 'paragraph':
            write(clean(b.text), 10.5, 'normal', [43, 43, 69], 7);
            break;
          case 'text':
            write(`${b.label ? `${clean(b.label)}: ` : ''}${clean(b.text)}`, 10.5, 'italic', [31, 107, 255], 7);
            break;
          case 'quote':
            write(`“${clean(b.text)}”${b.attribution ? ` — ${clean(b.attribution)}` : ''}`, 10.5, 'italic', [139, 61, 255], 7, 16);
            break;
          case 'list':
            (b.items ?? []).filter((i) => clean(i)).forEach((i, n) => write(`${b.ordered ? `${n + 1}.` : '•'} ${clean(i)}`, 10.5, 'normal', [43, 43, 69], 3, 14));
            y += 5;
            break;
          case 'link':
            write(`Link: ${clean(b.label) || b.url} (${b.url})`, 9.5, 'normal', [31, 107, 255], 6);
            break;
          case 'video':
          case 'audio':
            write(`${b.type === 'video' ? 'Video' : 'Audio'}: ${clean(b.label)}`, 10, 'bold', [70, 70, 100], 4);
            if (b.transcript) write(clean(b.transcript), 10, 'normal', [43, 43, 69], 7);
            break;
          default:
            break;
        }
      });
      y += 6;
    });
  });

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 145);
    doc.text(`${course.title} · Page ${i} of ${pages}`, MARGIN, HEIGHT - 28);
  }

  doc.save(`${(course.title || 'course').replace(/\W+/g, '-')}-study-guide.pdf`);
}

/** Everything the learner wrote in this course's activities, in course order, as a PDF they keep. */
const safeFileName = (s: string) => (s || 'course').replace(/\W+/g, '-').replace(/^-|-$/g, '');

export function downloadMyWorkPdf(course: Course, enrollment: Enrollment, learnerName: string) {
  const title = `My work: ${course.title}`;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = MARGIN;
  const room = (needed: number) => {
    if (y + needed > HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const write = (text: string, size: number, style: 'normal' | 'bold' | 'italic', color: [number, number, number], gapAfter = 8, keepLines = false) => {
    const body = keepLines ? (text ?? '').replace(/\*\*/g, '').trim() : clean(text);
    if (!body) return;
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(body, TEXT_WIDTH) as string[];
    const lh = size * 1.42;
    lines.forEach((line) => {
      room(lh);
      doc.text(line, MARGIN, y);
      y += lh;
    });
    y += gapAfter;
  };
  write(title, 24, 'bold', [20, 20, 43], 4);
  write(learnerName, 12, 'normal', [70, 70, 100], 4);
  write(`Downloaded ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 10, 'italic', [110, 110, 140], 10);
  room(14);
  doc.setDrawColor(139, 61, 255);
  doc.setLineWidth(2);
  doc.line(MARGIN, y, WIDTH - MARGIN, y);
  y += 22;
  const flat = flattenLessons(course);
  let pieces = 0;
  flat.forEach((f, i) => {
    const act = f.lesson.activity;
    const sub = enrollment.lessons[f.lesson.id]?.activity;
    if (!act || !sub) return;
    pieces += 1;
    room(60);
    write(`${i + 1}. ${act.title}`, 15, 'bold', [31, 107, 255], 2);
    write(f.lesson.title, 10, 'italic', [110, 110, 140], 8);
    act.fields.forEach((field) => {
      const v = sub.fields[field.id];
      if (!v?.trim()) return;
      write(field.label, 11, 'bold', [20, 20, 43], 2);
      write(v, 11, 'normal', [43, 43, 69], 8, true);
    });
    if (sub.fileName) write(`Attached file: ${sub.fileName}`, 10, 'italic', [110, 110, 140], 6);
    y += 8;
  });
  if (!pieces) write('No activities submitted yet.', 12, 'italic', [110, 110, 140]);
  doc.save(`${safeFileName(course.title)}-my-work.pdf`);
}

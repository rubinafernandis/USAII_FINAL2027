/**
 * Video transcripts.
 *
 * An instructor can paste (or upload) a transcript in any of these shapes; all of them work:
 *   - WebVTT or SRT captions  ("00:00:04.200 --> 00:00:07.000" lines)
 *   - Timestamped lines       ("[00:42] Dana opens the contract…" or "1:02:10 Then…")
 *   - Plain text              (paragraphs separated by blank lines)
 * Timed cues let the learner's transcript panel follow the video and jump to a moment.
 */
import type { ContentBlock, LessonActivity } from './types';

export interface TranscriptCue {
  /** Seconds from the start of the video, when known. */
  start?: number;
  text: string;
}

const VTT_TIME = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?\s*-->/;
const LINE_TIME = /^\s*[[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})(?:[.,]\d{1,3})?[\])]?\s*(?:[-–—:]\s*)?/;

function toSeconds(stamp: string): number {
  const parts = stamp.split(':').map((n) => Number(n));
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function parseTranscript(raw: string | undefined | null): TranscriptCue[] {
  const text = (raw ?? '').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').trim();
  if (!text) return [];
  const lines = text.split('\n');

  // WebVTT / SRT: a time-range line followed by caption text.
  if (lines.some((l) => VTT_TIME.test(l.trim()))) {
    const cues: TranscriptCue[] = [];
    let cur: TranscriptCue | null = null;
    for (const lineRaw of lines) {
      const line = lineRaw.trim();
      const m = VTT_TIME.exec(line);
      if (m) {
        if (cur?.text) cues.push(cur);
        const stamp = `${m[1] ? `${m[1]}:` : ''}${m[2]}:${m[3]}`;
        cur = { start: toSeconds(stamp), text: '' };
        continue;
      }
      if (!line || /^WEBVTT/i.test(line) || /^NOTE\b/.test(line) || /^\d+$/.test(line)) continue;
      if (cur) cur.text = cur.text ? `${cur.text} ${stripTags(line)}` : stripTags(line);
    }
    if (cur?.text) cues.push(cur);
    return mergeShortCues(cues);
  }

  // Timestamped lines.
  const timed = lines.filter((l) => LINE_TIME.test(l) && l.replace(LINE_TIME, '').trim());
  if (timed.length >= Math.max(1, Math.floor(lines.filter((l) => l.trim()).length / 2))) {
    const cues: TranscriptCue[] = [];
    for (const l of lines) {
      const m = LINE_TIME.exec(l);
      const body = m ? l.replace(LINE_TIME, '').trim() : l.trim();
      if (!body) continue;
      if (m) cues.push({ start: toSeconds(m[1]), text: body });
      else if (cues.length) cues[cues.length - 1].text += ` ${body}`;
      else cues.push({ text: body });
    }
    return cues;
  }

  // Plain paragraphs.
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((t) => ({ text: t }));
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim();

/** Captions are often split mid-sentence every two seconds; join them into readable lines. */
function mergeShortCues(cues: TranscriptCue[]): TranscriptCue[] {
  const out: TranscriptCue[] = [];
  for (const c of cues) {
    const last = out[out.length - 1];
    if (last && last.text.length < 80 && !/[.!?…]["”']?$/.test(last.text)) last.text = `${last.text} ${c.text}`;
    else out.push({ ...c });
  }
  return out;
}

export function formatCueTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Cues back to text with "[m:ss]" prefixes. Used to send a transcript for translation without losing timing. */
export function cuesToText(cues: TranscriptCue[]): string {
  return cues.map((c) => (c.start !== undefined ? `[${formatCueTime(c.start)}] ${c.text}` : c.text)).join('\n\n');
}

/** Small, fast, deterministic hash (FNV-1a, 32-bit) for cache keys. Not for security. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** The cue being spoken at `time` (the last cue that has started). */
export function activeCueIndex(cues: TranscriptCue[], time: number): number {
  let idx = -1;
  for (let i = 0; i < cues.length; i++) {
    const s = cues[i].start;
    if (s === undefined) continue;
    if (s <= time + 0.25) idx = i;
    else break;
  }
  return idx;
}

/* ---------------- Activity instructions ---------------- */

/**
 * The instructions to show for an activity, as content blocks. Rich instructions win; older
 * plain-text steps become ordinary paragraphs, so learners never see an auto-numbered list.
 */
export function activityInstructionBlocks(act: Pick<LessonActivity, 'instructions' | 'instructionBlocks'>): ContentBlock[] {
  const rich = (act.instructionBlocks ?? []).filter(
    (b) => (b.type === 'image' || b.type === 'link' ? !!b.url : b.type === 'list' ? (b.items ?? []).some((i) => i.trim()) : !!b.text?.trim()),
  );
  if (rich.length) return rich;
  return (act.instructions ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `ins-${i}`, type: 'paragraph' as const, text }));
}

/** Plain text of the instructions (for the study guide, AI evaluation, and exports). */
export function activityInstructionText(act: Pick<LessonActivity, 'instructions' | 'instructionBlocks'>): string {
  return activityInstructionBlocks(act)
    .map((b) => {
      if (b.type === 'list') return (b.items ?? []).filter((i) => i.trim()).map((i) => `- ${i.trim()}`).join('\n');
      if (b.type === 'image') return b.text ? `[Image: ${b.text}]` : b.label ? `[Image: ${b.label}]` : '[Image]';
      if (b.type === 'link') return `${b.label || b.url}${b.url ? ` (${b.url})` : ''}`;
      return (b.label ? `${b.label}: ` : '') + (b.text ?? '').trim();
    })
    .filter(Boolean)
    .join('\n\n');
}

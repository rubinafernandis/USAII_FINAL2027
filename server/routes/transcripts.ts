/**
 * Video transcripts in the learner's own language.
 *
 * The server translates a transcript that is already part of a course (never arbitrary text sent by a
 * browser, so this cannot be used as a free translation service) and caches the result, so each
 * transcript is translated into each language at most once and every learner then gets it instantly.
 */
import { Router } from 'express';
import type { ContentBlock } from '../../shared/types';
import { languageByCode, SOURCE_LANGUAGE } from '../../shared/languages';
import { cuesToText, hashText, parseTranscript } from '../../shared/transcript';
import { flattenLessons } from '../../shared/analytics';
import { requireAuth } from '../auth';
import { db, nowIso, save } from '../db';
import { aiEngine, canTranscribeMedia, translateTranscript } from '../ai';
import { fail, getCourse, isStaff } from '../services';
import { canAccessCourse } from './community';
import { me, wrap } from './util';

export const transcriptRouter = Router();
transcriptRouter.use(requireAuth);

const MAX_CACHE_ENTRIES = 3000;
const NEW_TRANSLATIONS_PER_HOUR = 30;
const recent = new Map<string, number[]>();
const inFlight = new Map<string, Promise<{ text: string; engine: 'anthropic' | 'gemini' } | null>>();

function allowNewTranslation(userId: string): boolean {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (list.length >= NEW_TRANSLATIONS_PER_HOUR) {
    recent.set(userId, list);
    return false;
  }
  list.push(now);
  recent.set(userId, list);
  return true;
}

function findMediaBlock(courseId: string, lessonId: string, blockId: string): ContentBlock {
  const course = getCourse(courseId);
  const lesson = flattenLessons(course).find((f) => f.lesson.id === lessonId)?.lesson ?? fail(404, 'Lesson not found.');
  const block = lesson.blocks.find((b) => b.id === blockId && (b.type === 'video' || b.type === 'audio'));
  return block ?? fail(404, 'This video is not saved in the course yet. Save the lesson, then try again.');
}

/** What this server can do, so the panel only offers what works. */
transcriptRouter.get(
  '/status',
  wrap(() => ({ translate: !!aiEngine(), transcribe: canTranscribeMedia() })),
);

transcriptRouter.post(
  '/translate',
  wrap(async (req) => {
    const u = me(req);
    const courseId = String(req.body?.courseId ?? '');
    const lessonId = String(req.body?.lessonId ?? '');
    const blockId = String(req.body?.blockId ?? '');
    const lang = languageByCode(String(req.body?.lang ?? ''));
    if (!lang) fail(400, 'Choose a language from the list.');
    if (!canAccessCourse(u.id, isStaff(u.role), courseId)) fail(403, 'You do not have access to this course.');
    const block = findMediaBlock(courseId, lessonId, blockId);
    const cues = parseTranscript(block.transcript);
    if (!cues.length) fail(404, 'This video has no transcript yet.');
    const source = cuesToText(cues);
    if (lang!.code === SOURCE_LANGUAGE) return { lang: lang!.code, text: source, cached: true, engine: 'original' };

    const d = db();
    d.transcriptTranslations ??= {};
    const key = `${blockId}:${lang!.code}:${hashText(source)}`;
    const hit = d.transcriptTranslations[key];
    if (hit) return { lang: lang!.code, text: hit.text, cached: true, engine: hit.engine };

    if (!aiEngine()) fail(503, 'Translation is not switched on for this LMS yet. Ask your administrator to add an AI key, or use “Open in Google Translate”.');

    let job = inFlight.get(key);
    if (!job) {
      if (!allowNewTranslation(u.id)) fail(429, 'You have translated many transcripts in the last hour. Please try again a little later.');
      job = translateTranscript(source, lang!).finally(() => inFlight.delete(key));
      inFlight.set(key, job);
    }
    const r = await job;
    if (!r) fail(502, 'The translation service did not respond. Please try again in a minute.');

    const cache = (db().transcriptTranslations ??= {});
    cache[key] = { text: r!.text, lang: lang!.code, at: nowIso(), engine: r!.engine };
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      keys.sort((a, b) => cache[a].at.localeCompare(cache[b].at));
      for (const k of keys.slice(0, keys.length - MAX_CACHE_ENTRIES)) delete cache[k];
    }
    save();
    return { lang: lang!.code, text: r!.text, cached: false, engine: r!.engine };
  }),
);

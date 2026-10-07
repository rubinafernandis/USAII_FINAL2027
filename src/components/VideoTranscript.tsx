/**
 * A lesson video with its transcript beside it.
 *
 * - The transcript panel opens on the right as soon as the learner presses play (stacked under the
 *   video on narrow screens). It can be closed, and it stays closed for that video once closed.
 * - The learner picks any of 130+ languages from a searchable list; their browser's own language is
 *   suggested first.
 * - Translations come from the LMS server (cached, so each language is translated once for everyone).
 *   If the server has no AI key, the browser's built-in on-device translator is tried (recent Chrome),
 *   and otherwise the learner gets a one-click "Open in Google Translate".
 * - With a timed transcript the current line is highlighted and any line can be clicked to jump there,
 *   for uploaded videos, YouTube, and Vimeo.
 */
import { Check, ChevronDown, Copy, Download, ExternalLink, Languages, Loader2, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContentBlock } from '../../shared/types';
import { LANGUAGES, languageByCode, searchLanguages, SOURCE_LANGUAGE, suggestedLanguages, type TranscriptLanguage } from '../../shared/languages';
import { activeCueIndex, formatCueTime, parseTranscript, type TranscriptCue } from '../../shared/transcript';
import { api, ApiError } from '../lib/api';
import { youtubeEmbed } from '../lib/format';
import { cx } from './ui';

export interface MediaContext {
  courseId: string;
  lessonId: string;
}

const LANG_KEY = 'usaii.transcript.lang';
const readLang = () => {
  try {
    return localStorage.getItem(LANG_KEY) || SOURCE_LANGUAGE;
  } catch {
    return SOURCE_LANGUAGE;
  }
};
const saveLang = (code: string) => {
  try {
    localStorage.setItem(LANG_KEY, code);
  } catch {
    /* private mode: remember for this page only */
  }
};

/** Translations already loaded on this page, so closing and reopening the panel never asks again. */
const pageCache = new Map<string, { cues: TranscriptCue[]; note: string }>();

let statusPromise: Promise<{ translate: boolean; transcribe: boolean }> | null = null;
const serverStatus = () => (statusPromise ??= api<{ translate: boolean; transcribe: boolean }>('/transcripts/status').catch(() => ({ translate: false, transcribe: false })));

/** Google Translate uses a few codes of its own. */
const GOOGLE_CODE: Record<string, string> = { 'pt-BR': 'pt', 'es-419': 'es', 'fr-CA': 'fr', fil: 'tl', mni: 'mni-Mtei', he: 'iw', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW' };
const googleTranslateUrl = (code: string, text: string) =>
  `https://translate.google.com/?sl=en&tl=${encodeURIComponent(GOOGLE_CODE[code] ?? code)}&op=translate&text=${encodeURIComponent(text.slice(0, 4500))}`;

/* ---------------- Browser on-device translation (Chrome 138+) ---------------- */

type BrowserTranslator = { translate: (t: string) => Promise<string> };
async function browserTranslate(cues: TranscriptCue[], target: string): Promise<TranscriptCue[] | null> {
  const T = (globalThis as unknown as { Translator?: { availability: (o: object) => Promise<string>; create: (o: object) => Promise<BrowserTranslator> } }).Translator;
  if (!T) return null;
  try {
    const opts = { sourceLanguage: 'en', targetLanguage: target.split('-')[0] };
    const avail = await T.availability(opts);
    if (avail === 'unavailable') return null;
    const tr = await T.create(opts);
    const out: TranscriptCue[] = [];
    for (const c of cues) out.push({ start: c.start, text: await tr.translate(c.text) });
    return out;
  } catch {
    return null;
  }
}

/* ---------------- Player adapters: one interface for <video>, YouTube, and Vimeo ---------------- */

type Player = { kind: 'file' | 'youtube' | 'vimeo' | 'none'; src: string };

function playerFor(url: string): Player {
  const embed = youtubeEmbed(url);
  if (!embed) return { kind: 'file', src: url };
  const u = new URL(embed);
  if (u.hostname.includes('youtube')) {
    u.searchParams.set('enablejsapi', '1');
    u.searchParams.set('origin', window.location.origin);
    return { kind: 'youtube', src: u.toString() };
  }
  if (u.hostname.includes('vimeo')) {
    u.searchParams.set('api', '1');
    return { kind: 'vimeo', src: u.toString() };
  }
  return { kind: 'none', src: embed };
}

/* ---------------- Language picker ---------------- */

function LanguagePicker({ value, onPick }: { value: string; onPick: (l: TranscriptLanguage) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = languageByCode(value) ?? languageByCode(SOURCE_LANGUAGE)!;
  const suggested = useMemo(() => suggestedLanguages(typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []), []);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setTimeout(() => inputRef.current?.focus(), 0);
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const results = searchLanguages(q);
  const pick = (l: TranscriptLanguage) => {
    onPick(l);
    setOpen(false);
  };
  const section = (title: string, list: TranscriptLanguage[]) =>
    list.length > 0 && (
      <div key={title}>
        <div className="sticky top-0 z-10 bg-white/95 px-3 pb-1 pt-2 text-[11px] font-bold text-ink-faint backdrop-blur">{title}</div>
        {list.map((l) => (
          <button
            key={`${title}-${l.code}`}
            type="button"
            role="option"
            aria-selected={l.code === current.code}
            onClick={() => pick(l)}
            className={cx('flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm hover:bg-nblue-soft', l.code === current.code && 'bg-nblue-soft/70')}
          >
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold text-ink">{l.name}</span>
              {l.native !== l.name && (
                <span className="ml-1.5 text-ink-soft" lang={l.code} dir={l.rtl ? 'rtl' : undefined}>
                  {l.native}
                </span>
              )}
            </span>
            {l.code === current.code && <Check className="h-4 w-4 shrink-0 text-nblue" />}
          </button>
        ))}
      </div>
    );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-left text-sm transition hover:border-nblue/50"
      >
        <Languages className="h-4 w-4 shrink-0 text-nblue" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold">{current.name}</span>
          {current.native !== current.name && <span className="ml-1.5 text-ink-soft">{current.native}</span>}
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-ink-faint transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' && results[0]) pick(results[0]);
              }}
              placeholder="Search your language, e.g. Hindi or हिन्दी"
              aria-label="Search languages"
              className="h-10 w-full rounded-xl border border-line bg-mist/50 pl-9 pr-3 text-sm outline-none focus:border-nblue focus:bg-white"
            />
          </div>
          <div role="listbox" aria-label="Transcript language" className="max-h-72 overflow-y-auto scroll-thin">
            {q.trim() ? (
              results.length ? (
                section(`${results.length} ${results.length === 1 ? 'match' : 'matches'}`, results)
              ) : (
                <p className="px-3 py-4 text-center text-sm text-ink-soft">No language matches “{q}”.</p>
              )
            ) : (
              <>
                {section('Suggested for you', [languageByCode(SOURCE_LANGUAGE)!, ...suggested])}
                {section('Languages of India', LANGUAGES.filter((l) => l.group === 'India'))}
                {section('World languages', LANGUAGES.filter((l) => l.group === 'World'))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- The transcript panel ---------------- */

function TranscriptPanel({
  block,
  ctx,
  time,
  canSeek,
  onSeek,
  onClose,
}: {
  block: ContentBlock;
  ctx?: MediaContext;
  time: number;
  canSeek: boolean;
  onSeek: (t: number) => void;
  onClose: () => void;
}) {
  const original = useMemo(() => parseTranscript(block.transcript), [block.transcript]);
  const [lang, setLang] = useState(readLang);
  const [cache, setCacheState] = useState<Record<string, { cues: TranscriptCue[]; note: string }>>(() => {
    const out: Record<string, { cues: TranscriptCue[]; note: string }> = {};
    for (const [k, v] of pageCache) if (k.startsWith(`${block.id}:${block.transcript?.length ?? 0}:`)) out[k.split(':').pop()!] = v;
    return out;
  });
  const setCache = (fn: (c: typeof cache) => typeof cache) =>
    setCacheState((c) => {
      const next = fn(c);
      for (const [lang, v] of Object.entries(next)) pageCache.set(`${block.id}:${block.transcript?.length ?? 0}:${lang}`, v);
      return next;
    });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ text: string; fallback: boolean } | null>(null);
  const [follow, setFollow] = useState(true);
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const language = languageByCode(lang) ?? languageByCode(SOURCE_LANGUAGE)!;
  const isOriginal = language.code === SOURCE_LANGUAGE;

  const load = useCallback(
    async (code: string) => {
      setError(null);
      if (code === SOURCE_LANGUAGE || cache[code]) return;
      setLoading(true);
      try {
        if (!ctx) throw new ApiError(404, 'Save the lesson to translate its transcript.');
        const r = await api<{ text: string; engine: string }>('/transcripts/translate', { body: { ...ctx, blockId: block.id, lang: code } });
        setCache((c) => ({ ...c, [code]: { cues: parseTranscript(r.text), note: 'Translated automatically. It may contain mistakes.' } }));
      } catch (e) {
        const status = (e as ApiError).status;
        // No AI key on the server: try the browser's own on-device translator before giving up.
        if (status === 503) {
          const local = await browserTranslate(original, code);
          if (local) {
            setCache((c) => ({ ...c, [code]: { cues: local, note: 'Translated on this device by your browser. It may contain mistakes.' } }));
            return;
          }
        }
        setError({ text: (e as Error).message, fallback: status === 503 || status === 502 || status === 429 });
      } finally {
        setLoading(false);
      }
    },
    [block.id, cache, ctx, original],
  );

  useEffect(() => {
    void load(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const shown = isOriginal ? original : cache[language.code]?.cues ?? [];
  const active = activeCueIndex(shown, time);

  // Keep the spoken line in view inside the panel (never scrolls the page itself).
  useEffect(() => {
    if (!follow || active < 0 || !listRef.current) return;
    const el = listRef.current.children[active] as HTMLElement | undefined;
    if (!el) return;
    const box = listRef.current;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTo({ top: Math.max(0, top - 24), behavior: 'smooth' });
  }, [active, follow]);

  const plain = shown.map((c) => (c.start !== undefined ? `[${formatCueTime(c.start)}] ${c.text}` : c.text)).join('\n\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([plain], { type: 'text/plain;charset=utf-8' }));
    a.download = `${(block.label || 'Video transcript').replace(/[^\w\- ]+/g, '').trim() || 'transcript'} (${language.name}).txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <aside aria-label="Video transcript" className="flex h-full min-h-0 flex-col rounded-3xl border border-line bg-white shadow-sm">
      <div className="flex items-center gap-1 px-4 pb-1 pt-3">
        <div className="min-w-0 flex-1 font-display text-[15px] font-bold">Transcript</div>
        <button type="button" onClick={copy} disabled={!shown.length} aria-label={copied ? 'Copied' : 'Copy transcript'} title={copied ? 'Copied' : 'Copy'} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-mist hover:text-nblue disabled:opacity-40">
          {copied ? <Check className="h-4 w-4 text-ngreen-ink" /> : <Copy className="h-4 w-4" />}
        </button>
        <button type="button" onClick={download} disabled={!shown.length} aria-label="Download transcript" title="Download" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-mist hover:text-nblue disabled:opacity-40">
          <Download className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close transcript" title="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-mist hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5 px-4">
        <LanguagePicker
          value={language.code}
          onPick={(l) => {
            setLang(l.code);
            saveLang(l.code);
          }}
        />
        {!isOriginal && cache[language.code] && <p className="text-[11.5px] text-ink-faint">{cache[language.code].note}</p>}
      </div>

      <div className="relative mt-2 min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-ink-soft">
            <Loader2 className="h-6 w-6 animate-spin text-nblue" />
            Translating into {language.name}…<span className="text-xs text-ink-faint">The first time takes a few seconds. After that it opens instantly for everyone.</span>
          </div>
        ) : error ? (
          <div className="m-4 rounded-2xl bg-mist/70 p-4 text-sm">
            <p className="text-ink">{error.text}</p>
            {error.fallback && (
              <a href={googleTranslateUrl(language.code, original.map((c) => c.text).join('\n\n'))} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-semibold text-nblue hover:underline">
                <ExternalLink className="h-4 w-4" /> Open in Google Translate
              </a>
            )}
            <button type="button" onClick={() => void load(language.code)} className="mt-2 block text-[13px] font-semibold text-ink-soft hover:text-ink">
              Try again
            </button>
          </div>
        ) : (
          <ol ref={listRef} className="absolute inset-0 space-y-1 overflow-y-auto px-3 pb-3 scroll-thin" lang={language.code} dir={language.rtl ? 'rtl' : undefined}>
            {shown.map((c, i) => {
              const on = i === active;
              const seekable = canSeek && c.start !== undefined;
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={!seekable}
                    onClick={() => seekable && onSeek(c.start!)}
                    className={cx(
                      'flex w-full gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] leading-relaxed transition',
                      on ? 'bg-nblue-soft text-ink' : 'text-ink-soft',
                      seekable ? 'cursor-pointer hover:bg-mist hover:text-ink' : 'cursor-text select-text',
                    )}
                    aria-current={on ? 'true' : undefined}
                  >
                    {c.start !== undefined && <span className={cx('mt-0.5 shrink-0 text-[11.5px] font-semibold tabular-nums', on ? 'text-nblue' : 'text-ink-faint')} dir="ltr">{formatCueTime(c.start)}</span>}
                    <span>{c.text}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {original.some((c) => c.start !== undefined) && (
        <label className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-[12.5px] text-ink-soft">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="h-3.5 w-3.5 accent-[#1F6BFF]" /> Follow the video
        </label>
      )}
    </aside>
  );
}

/* ---------------- Video + panel ---------------- */

export function VideoWithTranscript({ block, ctx }: { block: ContentBlock; ctx?: MediaContext }) {
  const player = useMemo(() => playerFor(block.url ?? ''), [block.url]);
  const hasTranscript = parseTranscript(block.transcript).length > 0;
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [time, setTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    void serverStatus();
  }, []);

  const onPlay = useCallback(() => {
    if (hasTranscript && !dismissed) setOpen(true);
  }, [dismissed, hasTranscript]);

  // YouTube and Vimeo report play and time through postMessage.
  useEffect(() => {
    if (player.kind !== 'youtube' && player.kind !== 'vimeo') return;
    const frame = frameRef.current;
    const handler = (e: MessageEvent) => {
      if (!frame || e.source !== frame.contentWindow) return;
      let data: any = e.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (player.kind === 'youtube') {
        if (data?.event === 'onStateChange' && data.info === 1) onPlay();
        if (data?.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') setTime(data.info.currentTime);
          if (data.info.playerState === 1) onPlay();
        }
      } else {
        if (data?.event === 'ready') ['play', 'playProgress'].forEach((ev) => frame.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value: ev }), '*'));
        if (data?.event === 'play') onPlay();
        if (data?.event === 'playProgress' && typeof data.data?.seconds === 'number') setTime(data.data.seconds);
      }
    };
    window.addEventListener('message', handler);
    const hello = () => {
      if (player.kind === 'youtube') frame?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: block.id, channel: 'widget' }), 'https://www.youtube.com');
    };
    frame?.addEventListener('load', hello);
    return () => {
      window.removeEventListener('message', handler);
      frame?.removeEventListener('load', hello);
    };
  }, [block.id, onPlay, player.kind]);

  const seek = (t: number) => {
    if (player.kind === 'file' && videoRef.current) {
      videoRef.current.currentTime = t;
      void videoRef.current.play().catch(() => undefined);
    } else if (player.kind === 'youtube') {
      const w = frameRef.current?.contentWindow;
      w?.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [t, true] }), 'https://www.youtube.com');
      w?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 'https://www.youtube.com');
    } else if (player.kind === 'vimeo') {
      frameRef.current?.contentWindow?.postMessage(JSON.stringify({ method: 'setCurrentTime', value: t }), 'https://player.vimeo.com');
      frameRef.current?.contentWindow?.postMessage(JSON.stringify({ method: 'play' }), 'https://player.vimeo.com');
    }
    setTime(t);
  };

  if (!block.url) return null;
  return (
    <figure className="my-6">
      {block.label && <div className="mb-2 font-display font-semibold">{block.label}</div>}
      <div className={cx('grid gap-4', open && 'lg:grid-cols-[minmax(0,1fr)_320px]')}>
        <div className="min-w-0">
          <div className="overflow-hidden rounded-3xl border border-line bg-ink shadow-xl shadow-nblue/10">
            {player.kind === 'file' ? (
              <video ref={videoRef} src={player.src} controls preload="metadata" className="aspect-video w-full bg-ink" onPlay={onPlay} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} />
            ) : (
              <div className="relative aspect-video">
                <iframe
                  ref={frameRef}
                  src={player.src}
                  title={block.label || 'Lesson video'}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {block.text ? <figcaption className="text-sm text-ink-soft">{block.text}</figcaption> : <span />}
            {hasTranscript && (
              <button
                type="button"
                onClick={() => {
                  setOpen((o) => !o);
                  setDismissed(open);
                }}
                aria-expanded={open}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition',
                  open ? 'border-transparent bg-nblue text-white' : 'border-line bg-white text-nblue hover:border-nblue/50',
                )}
              >
                <Languages className="h-4 w-4" /> {open ? 'Hide transcript' : 'Transcript and translation'}
              </button>
            )}
          </div>
        </div>
        {open && (
          // On wide screens the panel matches the video's height and scrolls inside.
          <div className="relative h-[440px] lg:h-auto lg:min-h-[400px]">
            <div className="h-full lg:absolute lg:inset-0">
              <TranscriptPanel
                block={block}
                ctx={ctx}
                time={time}
                canSeek={player.kind !== 'none'}
                onSeek={seek}
                onClose={() => {
                  setOpen(false);
                  setDismissed(true);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}

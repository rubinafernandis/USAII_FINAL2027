import { ExternalLink, FileText, Headphones, Info, Lightbulb, Quote } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import type { ContentBlock } from '../../shared/types';
import { cx } from './ui';
import { VideoWithTranscript, type MediaContext } from './VideoTranscript';

function Transcript({ text }: { text?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-nblue hover:underline">
        <FileText className="h-3.5 w-3.5" /> {open ? 'Hide transcript' : 'Read transcript'}
      </button>
      {open && <p className="mt-2 whitespace-pre-line rounded-2xl bg-mist p-4 text-sm leading-relaxed text-ink-soft">{text}</p>}
    </div>
  );
}

/** Very small, safe inline formatter: **bold** and line breaks. No HTML injection. */
function Rich({ text }: { text?: string }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="font-semibold text-ink">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function BlockView({ block, ctx }: { block: ContentBlock; ctx?: MediaContext }) {
  // Skip blocks an author left empty so learners never see blank boxes.
  if (['heading', 'paragraph', 'text', 'quote'].includes(block.type) && !block.text?.trim()) return null;
  if (block.type === 'list' && !(block.items ?? []).some((i) => i.trim())) return null;
  switch (block.type) {
    case 'heading':
      return block.level === 3 ? (
        <h3 className="mb-2 mt-7 text-lg font-bold">{block.text}</h3>
      ) : (
        <h2 className="mb-3 mt-9 text-[22px] font-bold first:mt-0">
          <span className="mr-2 inline-block h-5 w-1.5 translate-y-0.5 rounded-full bg-gradient-to-b from-nblue to-npurple" />
          {block.text}
        </h2>
      );
    case 'paragraph':
      return (
        <p className="mb-4 whitespace-pre-line text-[1.05rem] leading-[1.8] text-body">
          <Rich text={block.text} />
        </p>
      );
    case 'text': {
      const tip = block.tone === 'tip';
      const Icon = tip ? Lightbulb : Info;
      return (
        <div className={cx('my-5 flex gap-3 rounded-2xl border p-4 text-[15px] leading-relaxed', tip ? 'border-ngreen/30 bg-ngreen-soft/70' : 'border-nblue/20 bg-nblue-soft/60')}>
          <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', tip ? 'text-ngreen-ink' : 'text-nblue')} />
          <div className="whitespace-pre-line text-ink">
            {block.label && <div className="mb-0.5 font-semibold">{block.label}</div>}
            <Rich text={block.text} />
          </div>
        </div>
      );
    }
    case 'quote':
      return (
        <figure className="relative my-7 overflow-hidden rounded-3xl bg-gradient-to-br from-npurple-soft via-white to-npink-soft p-6 pl-14">
          <Quote className="absolute left-5 top-6 h-6 w-6 text-npurple" />
          <blockquote className="font-display text-[18px] font-medium leading-relaxed text-ink">{block.text}</blockquote>
          {block.attribution && <figcaption className="mt-3 text-sm font-semibold text-npurple">— {block.attribution}</figcaption>}
        </figure>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className="my-4 space-y-2.5">
          {(block.items ?? []).filter((it) => it.trim()).map((it, i) => (
            <li key={i} className="flex gap-3 text-[1.02rem] leading-relaxed text-body">
              {block.ordered ? (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-nblue to-npurple text-xs font-bold text-white">{i + 1}</span>
              ) : (
                <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-npink to-npurple" />
              )}
              <span>
                <Rich text={it} />
              </span>
            </li>
          ))}
        </Tag>
      );
    }
    case 'link':
      if (!block.url) return null;
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group my-3 flex items-center gap-3 rounded-2xl border border-line p-4 transition hover:border-nblue/40 hover:bg-nblue-soft/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-nblue-soft text-nblue">
            <ExternalLink className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink group-hover:text-nblue">{block.label || block.url}</span>
            {block.text && <span className="block text-sm text-ink-soft">{block.text}</span>}
            <span className="block truncate text-xs text-ink-faint">{block.url}</span>
          </span>
        </a>
      );
    case 'image':
      if (!block.url) return null;
      return (
        <figure className="my-6">
          <img src={block.url} alt={block.label || block.text || 'Lesson image'} loading="lazy" className="w-full rounded-3xl border border-line object-cover" />
          {block.text && <figcaption className="mt-2 text-center text-sm text-ink-soft">{block.text}</figcaption>}
        </figure>
      );
    case 'video':
      return <VideoWithTranscript block={block} ctx={ctx} />;
    case 'audio':
      if (!block.url) return null;
      return (
        <figure className="my-6 rounded-3xl border border-line bg-gradient-to-r from-nblue-soft/50 to-npurple-soft/50 p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-npurple shadow-sm">
              <Headphones className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold">{block.label || 'Listen'}</div>
              {block.text && <div className="text-sm text-ink-soft">{block.text}</div>}
            </div>
          </div>
          <audio src={block.url} controls preload="metadata" className="w-full" />
          <Transcript text={block.transcript} />
        </figure>
      );
    default:
      return null;
  }
}

/** @param ctx The course and lesson these blocks belong to (lets video transcripts be translated). */
export function Blocks({ blocks, afterFirstVideo, ctx }: { blocks: ContentBlock[]; afterFirstVideo?: ReactNode; ctx?: MediaContext }) {
  // Knowledge Cards land immediately after the first video clip, while it is still fresh.
  const firstVideo = blocks.findIndex((b) => b.type === 'video' && b.url);
  return (
    <div>
      {blocks.map((b, i) => (
        <Fragment key={b.id}>
          <BlockView block={b} ctx={ctx} />
          {afterFirstVideo && i === firstVideo && afterFirstVideo}
        </Fragment>
      ))}
      {afterFirstVideo && firstVideo === -1 && afterFirstVideo}
    </div>
  );
}

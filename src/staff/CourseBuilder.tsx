import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  GripVertical,
  ChevronRight,
  Eye,
  FileCheck2,
  FileText,
  Sparkles,
  Film,
  Heading,
  Image as ImageIcon,
  Info,
  Link2,
  List,
  Music,
  Pencil,
  Plus,
  Quote,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { BlockType, CheckQuestion, ContentBlock, Course, CourseModule, Lesson } from '../../shared/types';
import { assessmentDesign, QUESTION_KIND_LABEL, questionKind } from '../../shared/metrics';
import { parseTranscript } from '../../shared/transcript';
import { api, uploadFile } from '../lib/api';
import { useSession } from '../lib/session';
import { ACCENT, fmtSize } from '../lib/format';
import { Blocks } from '../components/Blocks';
import { Button, Card, cx, Empty, ErrorBox, IconButton, Input, Label, Loading, navigate, Segmented, Select, Tabs, Textarea, useConfirm, useToast } from '../components/ui';

const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;

const BLOCKS: { type: BlockType; label: string; icon: typeof Heading }[] = [
  { type: 'heading', label: 'Heading', icon: Heading },
  { type: 'paragraph', label: 'Paragraph', icon: AlignLeft },
  { type: 'text', label: 'Note', icon: Info },
  { type: 'list', label: 'List', icon: List },
  { type: 'quote', label: 'Quote', icon: Quote },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'video', label: 'Video', icon: Film },
  { type: 'audio', label: 'Audio', icon: Music },
  { type: 'link', label: 'Link', icon: Link2 },
];

function newBlock(type: BlockType): ContentBlock {
  const b: ContentBlock = { id: rid('b'), type };
  if (type === 'heading') Object.assign(b, { text: '', level: 2 });
  if (type === 'paragraph' || type === 'quote') b.text = '';
  if (type === 'text') Object.assign(b, { text: '', tone: 'info' });
  if (type === 'list') Object.assign(b, { items: [''], ordered: false });
  if (['image', 'video', 'audio', 'link'].includes(type)) Object.assign(b, { url: '', label: '' });
  return b;
}
const newQuestion = (): CheckQuestion => ({ id: rid('q'), question: '', options: ['', ''], correctIndex: 0, rationale: '', kind: 'knowledge' });
const newLesson = (n: number): Lesson => ({
  id: rid('l'),
  title: `Lesson ${n}`,
  topic: '',
  estimatedMinutes: 15,
  summary: '',
  blocks: [newBlock('paragraph')],
  check: [],
  checkSettings: { mode: 'practice', timeLimitMin: 0, attemptsAllowed: 0 },
});
const newModule = (n: number): CourseModule => ({ id: rid('m'), title: `Module ${n}`, summary: '', lessons: [newLesson(1)] });

function blankCourse(): Course {
  const now = new Date().toISOString();
  return {
    id: '',
    title: '',
    subtitle: '',
    description: '',
    credentialName: '',
    durationLabel: '',
    level: 'Everyone',
    price: 0,
    priceSet: false,
    access: 'open',
    status: 'draft',
    accent: 'blue',
    passMark: 70,
    grading: { checks: 30, activities: 10, finalExam: 60 },
    modules: [newModule(1)],
    finalExam: undefined,
    createdBy: '',
    createdAt: now,
    updatedAt: now,
  };
}

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const a = [...arr];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}

/** Pull one item out and drop it back in at another position. */
function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const a = [...arr];
  const [item] = a.splice(from, 1);
  a.splice(to, 0, item);
  return a;
}

function RowTools({ onUp, onDown, onDelete, first, last, label }: { onUp: () => void; onDown: () => void; onDelete: () => void; first: boolean; last: boolean; label: string }) {
  return (
    <div className="flex shrink-0 items-center">
      <IconButton label={`Move ${label} up`} disabled={first} onClick={onUp} className="!h-8 !w-8">
        <ArrowUp className="h-4 w-4" />
      </IconButton>
      <IconButton label={`Move ${label} down`} disabled={last} onClick={onDown} className="!h-8 !w-8">
        <ArrowDown className="h-4 w-4" />
      </IconButton>
      <IconButton label={`Delete ${label}`} onClick={onDelete} className="!h-8 !w-8 hover:!text-npink">
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

/* ---------------- Media URL + upload ---------------- */

function MediaInput({ value, onChange, accept, kind }: { value: string; onChange: (url: string, name?: string) => void; accept: string; kind: string }) {
  const toast = useToast();
  const [pct, setPct] = useState<number | null>(null);
  const pick = async (f?: File) => {
    if (!f) return;
    setPct(0);
    try {
      const r = await uploadFile(f, setPct);
      onChange(r.url, r.name);
      toast('success', `Uploaded ${r.name} (${fmtSize(r.size)}).`);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setPct(null);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={kind === 'video' ? 'Paste a YouTube, Vimeo, or video file link, or upload' : `Paste a link or upload a ${kind} file`} className="min-w-[220px] flex-1" />
        <label className={cx('inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-dashed border-nblue/50 px-4 text-sm font-semibold text-nblue hover:bg-nblue-soft', pct !== null && 'pointer-events-none opacity-60')}>
          <Upload className="h-4 w-4" /> {pct !== null ? `${pct}%` : 'Upload'}
          <input type="file" accept={accept} className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
      </div>
      {pct !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist">
          <div className="h-full bg-gradient-to-r from-nblue to-npurple transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/* ---------------- Transcript (video and audio) ---------------- */

let transcribeAvailable: Promise<boolean> | null = null;
const canAutoTranscribe = () => (transcribeAvailable ??= api<{ transcribe: boolean }>('/transcripts/status').then((r) => r.transcribe).catch(() => false));

/**
 * The transcript learners read beside the video and translate into their own language.
 * Paste it, load a caption file (.vtt, .srt, .txt), or generate it from an uploaded video.
 * Timestamps like [1:05] (or a caption file) let the learner's panel follow the video.
 */
function TranscriptEditor({ b, onChange }: { b: ContentBlock; onChange: (t: string) => void }) {
  const toast = useToast();
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void canAutoTranscribe().then(setAuto);
  }, []);
  const cues = parseTranscript(b.transcript);
  const timed = cues.filter((c) => c.start !== undefined).length;
  const loadFile = async (f?: File) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast('error', 'Caption files must be 2 MB or smaller.');
    const text = await f.text();
    if (!parseTranscript(text).length) return toast('error', 'No text was found in that file.');
    onChange(text.trim());
    toast('success', `Loaded ${f.name}.`);
  };
  const generate = async () => {
    setBusy(true);
    try {
      const r = await api<{ transcript: string }>('/staff/transcribe', { body: { url: b.url } });
      onChange(r.transcript);
      toast('success', 'Transcript generated. Read it through and correct any names or terms.');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const uploaded = !!b.url?.startsWith('/uploads/');
  return (
    <div className="rounded-2xl bg-mist/50 p-3">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-ink-soft">Transcript · learners can read it beside the video in 130+ languages</div>
        <div className="flex flex-wrap gap-1.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-[12.5px] font-semibold text-ink-soft hover:text-nblue">
            <Upload className="h-3.5 w-3.5" /> Load captions (.vtt, .srt, .txt)
            <input type="file" accept=".vtt,.srt,.txt,text/vtt,text/plain" className="sr-only" onChange={(e) => void loadFile(e.target.files?.[0])} />
          </label>
          {auto && uploaded && (
            <Button size="sm" variant="secondary" loading={busy} icon={<Sparkles className="h-3.5 w-3.5" />} onClick={generate}>
              Generate from {b.type}
            </Button>
          )}
        </div>
      </div>
      <Textarea
        value={b.transcript ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'Paste the transcript. Add times so the panel follows the video, e.g.\n[0:00] Dana has four tasks in front of her.\n[0:12] The first is a delay notice…'}
        className="!min-h-[96px] bg-white"
      />
      <p className="mt-1 text-[12px] text-ink-faint">
        {!cues.length
          ? 'No transcript yet. Without one, learners cannot read along or translate this video.'
          : timed
            ? `${timed} timed ${timed === 1 ? 'line' : 'lines'}: the learner’s transcript highlights the line being spoken, and they can click a line to jump there.`
            : `${cues.length} ${cues.length === 1 ? 'paragraph' : 'paragraphs'} without times: learners can read and translate it. Add [m:ss] times to make it follow the video.`}
        {busy && ' Generating can take a few minutes for a long video.'}
      </p>
    </div>
  );
}

/* ---------------- Block editor ---------------- */

function BlockEditor({ b, onChange }: { b: ContentBlock; onChange: (b: ContentBlock) => void }) {
  const set = (p: Partial<ContentBlock>) => onChange({ ...b, ...p });
  switch (b.type) {
    case 'heading':
      return (
        <div className="flex gap-2">
          <Select value={b.level ?? 2} onChange={(e) => set({ level: Number(e.target.value) as 2 | 3 })} className="!w-32">
            <option value={2}>Large</option>
            <option value={3}>Small</option>
          </Select>
          <Input value={b.text ?? ''} onChange={(e) => set({ text: e.target.value })} placeholder="Heading text" className="font-display font-bold" />
        </div>
      );
    case 'paragraph':
      return <Textarea value={b.text ?? ''} onChange={(e) => set({ text: e.target.value })} placeholder="Write a paragraph. Use **double asterisks** for bold." />;
    case 'text':
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Segmented
              value={b.tone ?? 'info'}
              onChange={(tone) => set({ tone })}
              options={[
                { value: 'info', label: 'Info' },
                { value: 'tip', label: 'Tip' },
              ]}
            />
            <Input value={b.label ?? ''} onChange={(e) => set({ label: e.target.value })} placeholder="Optional title" className="!w-auto flex-1" />
          </div>
          <Textarea value={b.text ?? ''} onChange={(e) => set({ text: e.target.value })} placeholder="Highlighted text" className="!min-h-[72px]" />
        </div>
      );
    case 'quote':
      return (
        <div className="space-y-2">
          <Textarea value={b.text ?? ''} onChange={(e) => set({ text: e.target.value })} placeholder="Quote" className="!min-h-[64px]" />
          <Input value={b.attribution ?? ''} onChange={(e) => set({ attribution: e.target.value })} placeholder="Who said it (optional)" />
        </div>
      );
    case 'list': {
      const items = b.items ?? [];
      return (
        <div className="space-y-2">
          <Segmented
            value={b.ordered ? 'num' : 'bul'}
            onChange={(v) => set({ ordered: v === 'num' })}
            options={[
              { value: 'bul', label: 'Bullets' },
              { value: 'num', label: 'Numbered' },
            ]}
          />
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-right text-xs text-ink-faint">{b.ordered ? `${i + 1}.` : '•'}</span>
              <Input
                value={it}
                onChange={(e) => set({ items: items.map((x, j) => (j === i ? e.target.value : x)) })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const n = [...items];
                    n.splice(i + 1, 0, '');
                    set({ items: n });
                  }
                }}
                placeholder="List item"
              />
              <IconButton label="Remove item" onClick={() => set({ items: items.filter((_, j) => j !== i) })} disabled={items.length <= 1}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => set({ items: [...items, ''] })}>
            Add item
          </Button>
        </div>
      );
    }
    case 'image':
      return (
        <div className="space-y-2">
          <MediaInput value={b.url ?? ''} accept="image/png,image/jpeg,image/gif,image/webp,image/avif" kind="image" onChange={(url) => set({ url })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={b.label ?? ''} onChange={(e) => set({ label: e.target.value })} placeholder="Alt text (describe the image)" />
            <Input value={b.text ?? ''} onChange={(e) => set({ text: e.target.value })} placeholder="Caption (optional)" />
          </div>
          {b.url && <img src={b.url} alt="" className="max-h-48 rounded-2xl border border-line object-contain" />}
        </div>
      );
    case 'video':
    case 'audio':
      return (
        <div className="space-y-2">
          <MediaInput value={b.url ?? ''} accept={b.type === 'video' ? 'video/*' : 'audio/*'} kind={b.type} onChange={(url, name) => set({ url, label: b.label || name?.replace(/\.[^.]+$/, '') })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={b.label ?? ''} onChange={(e) => set({ label: e.target.value })} placeholder="Title" />
            <Input value={b.text ?? ''} onChange={(e) => set({ text: e.target.value })} placeholder="Short description (optional)" />
          </div>
          <TranscriptEditor b={b} onChange={(transcript) => set({ transcript })} />
        </div>
      );
    case 'link':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={b.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" className="sm:col-span-2" />
          <Input value={b.label ?? ''} onChange={(e) => set({ label: e.target.value })} placeholder="Link title" />
          <Input value={b.text ?? ''} onChange={(e) => set({ text: e.target.value })} placeholder="Why it is useful (optional)" />
        </div>
      );
    default:
      return null;
  }
}

/* ---------------- Questions editor ---------------- */

/**
 * @param objectives Final assessment only: the lessons a question can assess. When given, each
 * question gets a "Learning objective" picker; lesson questions always assess their own lesson.
 */
function QuestionsEditor({ questions, onChange, objectives }: { questions: CheckQuestion[]; onChange: (q: CheckQuestion[]) => void; objectives?: { id: string; label: string }[] }) {
  const setQ = (i: number, p: Partial<CheckQuestion>) => onChange(questions.map((q, j) => (j === i ? { ...q, ...p } : q)));
  return (
    <div className="space-y-4">
      {questions.length === 0 && <p className="text-sm text-ink-soft">No questions yet.</p>}
      {questions.map((q, i) => (
        <Card key={q.id} className="!p-4">
          <div className="flex items-start gap-2">
            <span className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist text-sm font-bold">{i + 1}</span>
            <Textarea value={q.question} onChange={(e) => setQ(i, { question: e.target.value })} placeholder="Question" className="!min-h-[56px]" />
            <RowTools label="question" first={i === 0} last={i === questions.length - 1} onUp={() => onChange(move(questions, i, -1))} onDown={() => onChange(move(questions, i, 1))} onDelete={() => onChange(questions.filter((_, j) => j !== i))} />
          </div>
          <div className="mt-3 space-y-2 pl-9">
            {q.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input type="radio" name={`c-${q.id}`} checked={q.correctIndex === oi} onChange={() => setQ(i, { correctIndex: oi })} className="h-4 w-4 accent-[#00C77F]" aria-label={`Mark option ${oi + 1} correct`} />
                <Input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === oi ? e.target.value : x)) })} placeholder={`Option ${oi + 1}`} className={cx(q.correctIndex === oi && '!border-ngreen')} />
                <IconButton
                  label="Remove option"
                  disabled={q.options.length <= 2}
                  onClick={() => {
                    const options = q.options.filter((_, j) => j !== oi);
                    setQ(i, { options, correctIndex: q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
            <div className="flex items-center justify-between">
              {q.options.length < 6 ? (
                <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setQ(i, { options: [...q.options, ''] })}>
                  Add option
                </Button>
              ) : (
                <span />
              )}
              <span className="text-xs text-ngreen-ink">The selected circle marks the correct answer</span>
            </div>
            <Textarea value={q.rationale} onChange={(e) => setQ(i, { rationale: e.target.value })} placeholder="Explanation shown after answering" className="!min-h-[56px]" />
            <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-mist/60 p-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-ink-soft">This question measures</div>
                <Segmented
                  value={questionKind(q)}
                  onChange={(kind) => setQ(i, { kind })}
                  options={[
                    { value: 'knowledge', label: QUESTION_KIND_LABEL.knowledge },
                    { value: 'scenario', label: QUESTION_KIND_LABEL.scenario },
                  ]}
                />
              </div>
              {objectives && (
                <div className="min-w-[220px] flex-1">
                  <div className="mb-1 text-xs font-semibold text-ink-soft">Learning objective it assesses</div>
                  <Select value={q.objectiveId && objectives.some((o) => o.id === q.objectiveId) ? q.objectiveId : ''} onChange={(e) => setQ(i, { objectiveId: e.target.value || undefined })} aria-label="Learning objective">
                    <option value="">Whole course</option>
                    {objectives.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <p className="w-full text-[12px] text-ink-faint">
                {questionKind(q) === 'scenario'
                  ? objectives
                    ? 'Scenario judgment on the final counts toward Mastery (final scenario-based assessment).'
                    : 'Scenario judgment counts toward Comprehension (scenario-based judgment questions).'
                  : objectives
                    ? 'Knowledge on the final counts toward Comprehension (final assessment, knowledge items).'
                    : 'Knowledge counts toward Comprehension (end-of-lesson knowledge checks).'}
              </p>
            </div>
          </div>
        </Card>
      ))}
      <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...questions, newQuestion()])}>
        Add question
      </Button>
    </div>
  );
}

/* ---------------- Rubric (PDF) ---------------- */

/**
 * The rubric is a PDF the instructor uploads, with the total points it awards. Every submission
 * is evaluated against it in Assessments; learners can open it before they submit.
 */
function RubricPdfEditor({ act, onChange }: { act: NonNullable<Lesson['activity']>; onChange: (a: NonNullable<Lesson['activity']>) => void }) {
  const pdf = act.rubricPdf;
  const legacy = (act.rubric ?? []).filter((c) => c.label.trim());
  return (
    <div className="rounded-2xl border border-line p-4">
      <Label hint="(PDF)">Rubric for evaluation</Label>
      <p className="mb-3 text-[12px] text-ink-faint">
        Upload the rubric your reviewers use. You evaluate each submission against this PDF and record the points awarded; the score counts toward the learner’s Mastery. Learners can open the rubric before they submit.
      </p>
      <MediaInput
        value={pdf?.url ?? ''}
        accept="application/pdf,.pdf"
        kind="PDF rubric"
        onChange={(url, name) => onChange({ ...act, rubricPdf: url ? { url, name: name ?? pdf?.name ?? 'Rubric.pdf', maxPoints: pdf?.maxPoints ?? 100 } : undefined })}
      />
      {pdf?.url && (
        <div className="mt-3 flex flex-wrap items-end gap-4 rounded-2xl bg-mist/60 p-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-ink-soft">Rubric file</div>
            <a href={pdf.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 truncate text-sm font-semibold text-nblue hover:underline">
              <FileText className="h-4 w-4 shrink-0" /> {pdf.name}
            </a>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-ink-soft">Total points in this rubric</div>
            <Input type="number" min={1} max={1000} step={0.5} value={pdf.maxPoints} onChange={(e) => onChange({ ...act, rubricPdf: { ...pdf, maxPoints: Math.max(1, Math.min(1000, Number(e.target.value) || 1)) } })} className="!w-28" aria-label="Total rubric points" />
          </div>
          <Button size="sm" variant="ghost" onClick={() => onChange({ ...act, rubricPdf: undefined })}>
            Remove rubric
          </Button>
        </div>
      )}
      {!pdf?.url && <p className="mt-2 text-[12px] text-ink-faint">No rubric yet. Without one, this activity counts toward progress only, not Mastery.</p>}
      {legacy.length > 0 && (
        <div className="mt-3 rounded-2xl border border-dashed border-[#F5A300]/50 bg-[#fff8e8] p-3 text-[12.5px] text-[#7a4a00]">
          This activity still has {legacy.length} rubric {legacy.length === 1 ? 'criterion' : 'criteria'} typed in an earlier version ({legacy.map((c) => c.label).join('; ')}).
          {pdf?.url ? ' The rubric PDF is used from now on; earlier scores are kept.' : ' They are used until you upload a rubric PDF.'}{' '}
          <button type="button" className="font-semibold underline" onClick={() => onChange({ ...act, rubric: undefined })}>
            Remove typed criteria
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Activity instructions ---------------- */

const INSTRUCTION_TOOLS: { type: BlockType; label: string; icon: typeof Heading }[] = [
  { type: 'paragraph', label: 'Paragraph', icon: AlignLeft },
  { type: 'heading', label: 'Heading', icon: Heading },
  { type: 'list', label: 'List', icon: List },
  { type: 'text', label: 'Note', icon: Info },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'link', label: 'Link', icon: Link2 },
];

/** What the editor shows: the rich blocks as stored (empty ones too), or older plain steps as paragraphs with stable ids. */
const editableInstructions = (act: NonNullable<Lesson['activity']>): ContentBlock[] =>
  act.instructionBlocks ?? act.instructions.filter((t) => t.trim()).map((text, i) => ({ id: `ins-${i}`, type: 'paragraph' as const, text }));

/** Instructions written like a short page: text, bullet points, notes, links, and pictures. Never auto-numbered. */
function InstructionsEditor({ blocks, onChange }: { blocks: ContentBlock[]; onChange: (b: ContentBlock[]) => void }) {
  const [preview, setPreview] = useState(false);
  const add = (t: BlockType) => {
    const b = newBlock(t);
    if (t === 'list') b.ordered = false;
    onChange([...blocks, b]);
  };
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Label hint="(shown to learners exactly as written)">Instructions</Label>
        <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setPreview((v) => !v)}>
          {preview ? 'Back to editing' : 'Preview as learner'}
        </Button>
      </div>
      {preview ? (
        <div className="activity-instructions rounded-2xl bg-ngreen-soft/30 p-5">{blocks.length ? <Blocks blocks={blocks} /> : <p className="text-sm text-ink-faint">No instructions yet.</p>}</div>
      ) : (
        <div className="space-y-2.5">
          {blocks.length === 0 && <p className="text-sm text-ink-faint">No instructions yet. Add a paragraph, a list, or an image below.</p>}
          {blocks.map((b, i) => {
            const meta = INSTRUCTION_TOOLS.find((x) => x.type === b.type) ?? INSTRUCTION_TOOLS[0];
            return (
              <div key={b.id} className="rounded-2xl border border-line/80 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ngreen-soft px-2.5 py-0.5 text-xs font-bold text-ngreen-ink">
                    <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                  </span>
                  <RowTools label="instruction" first={i === 0} last={i === blocks.length - 1} onUp={() => onChange(move(blocks, i, -1))} onDown={() => onChange(move(blocks, i, 1))} onDelete={() => onChange(blocks.filter((_, j) => j !== i))} />
                </div>
                <BlockEditor b={b} onChange={(nb) => onChange(blocks.map((x, j) => (j === i ? nb : x)))} />
              </div>
            );
          })}
        </div>
      )}
      {!preview && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {INSTRUCTION_TOOLS.map((t) => (
            <button key={t.type} type="button" onClick={() => add(t.type)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition hover:border-ngreen/50 hover:text-ngreen-ink">
              <Plus className="h-3.5 w-3.5" /> <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** What the course's assessments give Comprehension and Mastery, with anything missing called out. */
function MeasurementReadiness({ c }: { c: Course }) {
  const d = assessmentDesign(c);
  if (!c.modules.some((m) => m.lessons.length)) return null;
  return (
    <Card className="!p-4">
      <div className="font-semibold">Comprehension and Mastery readiness</div>
      <p className="mt-0.5 text-[13px] text-ink-soft">
        Lesson questions: {d.lessonKnowledge} knowledge, {d.lessonScenario} scenario judgment · Final: {d.finalKnowledge} knowledge, {d.finalScenario} scenario judgment · Activities with a rubric: {d.activitiesWithRubric} of {d.activities}
      </p>
      {d.issues.length === 0 ? (
        <p className="mt-2 text-[13px] font-semibold text-ngreen-ink">Every kind of evidence is in place.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-[13px]">
          {d.issues.map((x) => (
            <li key={x.text} className={cx(x.severity === 'warn' ? 'text-[#9a5b00]' : 'text-ink-soft')}>
              {x.severity === 'warn' ? '⚠ ' : 'ℹ '}
              {x.text}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Panels ---------------- */

function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

/* ---------------- Content toolbar ---------------- */

function ContentToolbar({ onAdd }: { onAdd: (t: BlockType) => void }) {
  const [media, setMedia] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!media) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMedia(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [media]);
  const tile = 'group flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-white px-3 py-3 text-[12.5px] font-semibold text-ink-soft transition hover:-translate-y-0.5 hover:border-nblue/40 hover:text-nblue hover:shadow-md';
  const main: { type: BlockType; label: string; icon: typeof Heading }[] = [
    { type: 'heading', label: 'Heading', icon: Heading },
    { type: 'paragraph', label: 'Paragraph', icon: AlignLeft },
    { type: 'list', label: 'List', icon: List },
    { type: 'quote', label: 'Quote', icon: Quote },
    { type: 'link', label: 'Link', icon: Link2 },
    { type: 'text', label: 'Note', icon: Info },
  ];
  return (
    <div className="sticky top-[128px] z-20 rounded-3xl border border-nblue/20 bg-gradient-to-r from-nblue-soft/90 via-white/95 to-npurple-soft/90 p-3 shadow-lg shadow-nblue/5 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-ink">
        <Plus className="h-4 w-4 text-npurple" /> Add to this lesson
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {main.map((t) => (
          <button key={t.type} type="button" className={tile} onClick={() => onAdd(t.type)}>
            <t.icon className="h-5 w-5 transition group-hover:scale-110" />
            {t.label}
          </button>
        ))}
        <div className="relative" ref={ref}>
          <button type="button" className={cx(tile, 'w-full', media && 'border-npurple text-npurple')} onClick={() => setMedia((m) => !m)} aria-expanded={media}>
            <Film className="h-5 w-5 transition group-hover:scale-110" />
            Multimedia
          </button>
          {media && (
            <div className="absolute right-0 top-full z-30 mt-2 w-44 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
              {[
                { type: 'video' as const, label: 'Video', icon: Film },
                { type: 'audio' as const, label: 'Audio', icon: Music },
                { type: 'image' as const, label: 'Image', icon: ImageIcon },
              ].map((m) => (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => {
                    onAdd(m.type);
                    setMedia(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-npurple-soft hover:text-npurple"
                >
                  <m.icon className="h-4 w-4" /> {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Details ---------------- */

function DetailsPanel({ c, set, onNext }: { c: Course; set: (p: Partial<Course>) => void; onNext: () => void }) {
  const [advanced, setAdvanced] = useState(false);
  const g = c.grading;
  const total = g.checks + g.activities + g.finalExam;
  return (
    <Card className="mx-auto max-w-2xl !p-7">
      <div className="space-y-5">
        <Field label="Course name">
          <Input autoFocus={!c.id} value={c.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. AI for Customer Service Teams" className="!py-3 font-display text-xl font-bold" />
        </Field>
        <Field label="One-line description">
          <Input value={c.subtitle} onChange={(e) => set({ subtitle: e.target.value })} placeholder="What learners will be able to do" />
        </Field>
        <Field label="About this course" hint="(optional)">
          <Textarea value={c.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label="Certificate name" hint="(optional)">
          <Input value={c.credentialName} onChange={(e) => set({ credentialName: e.target.value })} placeholder={`${c.title || 'Course'} Certificate`} />
        </Field>
        <Field label="Study plan (PDF)" hint="(optional)">
          <MediaInput
            value={c.studyPlan?.url ?? ''}
            accept="application/pdf,.pdf"
            kind="PDF study plan"
            onChange={(url, name) => set({ studyPlan: url ? { url, name: name ?? c.studyPlan?.name ?? 'Study plan.pdf' } : undefined })}
          />
          <p className="mt-1.5 text-[12px] text-ink-faint">
            {c.studyPlan?.url ? `Learners can download “${c.studyPlan.name}” from the course Resources.` : 'Upload the plan for this course. Learners can download and read it from Resources.'}
          </p>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Who can join">
            <Segmented
              value={c.access}
              onChange={(access) => set({ access })}
              options={[
                { value: 'open', label: 'Anyone' },
                { value: 'invite', label: 'Only people I add' },
              ]}
            />
          </Field>
          <Field label="Set course price (USD)" hint="(needed to publish)">
            <div className="flex items-center gap-2">
              <span className="text-ink-soft">$</span>
              <Input
                type="number"
                min={0}
                max={49.99}
                step={0.01}
                inputMode="decimal"
                value={c.priceSet ? c.price : ''}
                onChange={(e) => (e.target.value === '' ? set({ price: 0, priceSet: false }) : set({ price: Math.max(0, Number(e.target.value) || 0), priceSet: true }))}
                placeholder="e.g. 25"
                className="!w-28"
              />
            </div>
            <p className="mt-1.5 text-[12px] text-ink-faint">
              {c.priceSet ? (c.price === 0 ? 'Learners can start this course for free.' : `Learners pay $${c.price} once.`) : 'Enter 0 for a free course, or a price under $50. A course cannot be published until its price is set.'}
            </p>
          </Field>
          <Field label="Pass mark">
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={100} value={c.passMark} onChange={(e) => set({ passMark: Number(e.target.value) || 0 })} className="!w-24" />
              <span className="text-ink-soft">%</span>
            </div>
          </Field>
          <Field label="Color">
            <div className="flex gap-2">
              {(Object.keys(ACCENT) as Course['accent'][]).map((a) => (
                <button key={a} type="button" aria-label={a} onClick={() => set({ accent: a })} className={cx('h-9 w-9 rounded-full transition', c.accent === a ? 'scale-110 ring-4 ring-offset-2' : 'hover:scale-105')} style={{ background: ACCENT[a].hex, ['--tw-ring-color' as string]: `${ACCENT[a].hex}55` }} />
              ))}
            </div>
          </Field>
        </div>
        <div className="rounded-2xl border border-line">
          <button type="button" onClick={() => setAdvanced((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink-soft" aria-expanded={advanced}>
            How the grade is made up
            <span className={cx('text-xs', total !== 100 && 'font-bold text-npink')}>{total === 100 ? `${g.checks}% quizzes · ${g.activities}% activities · ${g.finalExam}% final` : `Adds up to ${total}%, must be 100%`}</span>
          </button>
          {advanced && (
            <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-3">
              <Field label="Quizzes %">
                <Input type="number" min={0} max={100} value={g.checks} onChange={(e) => set({ grading: { ...g, checks: Number(e.target.value) || 0 } })} />
              </Field>
              <Field label="Activities %">
                <Input type="number" min={0} max={100} value={g.activities} onChange={(e) => set({ grading: { ...g, activities: Number(e.target.value) || 0 } })} />
              </Field>
              <Field label="Final test %">
                <Input type="number" min={0} max={100} value={g.finalExam} onChange={(e) => set({ grading: { ...g, finalExam: Number(e.target.value) || 0 } })} />
              </Field>
            </div>
          )}
        </div>
      </div>
      <div className="mt-7 flex justify-end">
        <Button size="lg" onClick={onNext} disabled={!c.title.trim()}>
          Next: add lessons <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

/* ---------------- Lesson editor ---------------- */

function LessonEditor({ lesson, set, where, onBack, courseId }: { lesson: Lesson; set: (l: Lesson) => void; where: string; onBack: () => void; courseId?: string }) {
  const [tab, setTab] = useState<'content' | 'questions' | 'activity'>('content');
  const [preview, setPreview] = useState(false);
  // Drag and drop state for reordering the lesson's blocks.
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const confirm = useConfirm();
  const p = (x: Partial<Lesson>) => set({ ...lesson, ...x });
  const blocks = lesson.blocks;
  const act = lesson.activity;
  const add = (t: BlockType) => {
    p({ blocks: [...blocks, newBlock(t)] });
    setPreview(false);
    setTimeout(() => document.getElementById('main-scroll')?.scrollTo({ top: document.getElementById('main-scroll')!.scrollHeight, behavior: 'smooth' }), 50);
  };
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-nblue">
        <ArrowLeft className="h-4 w-4" /> All lessons
      </button>
      <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
        <Field label={where}>
          <Input value={lesson.title} onChange={(e) => p({ title: e.target.value })} placeholder="Lesson name" className="!py-3 font-display text-xl font-bold" />
        </Field>
        <Field label="Minutes">
          <Input type="number" min={1} max={600} value={lesson.estimatedMinutes} onChange={(e) => p({ estimatedMinutes: Number(e.target.value) || 1 })} className="!py-3" />
        </Field>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'content', label: 'Content', count: blocks.length },
          { value: 'questions', label: 'Quiz questions', count: lesson.check.length },
          { value: 'activity', label: 'Activity', count: act ? 1 : 0 },
        ]}
      />

      {tab === 'content' && (
        <div className="space-y-3">
          <ContentToolbar onAdd={add} />
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setPreview((v) => !v)}>
              {preview ? 'Back to editing' : 'Preview as learner'}
            </Button>
          </div>
          {preview ? (
            <Card className="!p-8">{blocks.length ? <Blocks blocks={blocks} ctx={courseId ? { courseId, lessonId: lesson.id } : undefined} /> : <p className="text-ink-faint">Nothing to preview yet.</p>}</Card>
          ) : blocks.length === 0 ? (
            <Empty title="This lesson is empty" text="Use the buttons above to add a heading, text, video and more." />
          ) : (
            blocks.map((b, i) => {
              const meta = BLOCKS.find((x) => x.type === b.type)!;
              const dragging = dragFrom === i;
              const dropHere = dragOver === i && dragFrom !== null && dragFrom !== i;
              return (
                <div
                  key={b.id}
                  onDragOver={(e) => {
                    if (dragFrom === null) return;
                    e.preventDefault();
                    if (dragOver !== i) setDragOver(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragFrom !== null) p({ blocks: reorder(blocks, dragFrom, i) });
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  className={cx('transition', dropHere && 'pt-6')}
                >
                  {dropHere && <div className="mb-2 h-1 rounded-full bg-gradient-to-r from-nblue to-npurple" />}
                  <Card className={cx('!p-4 transition', dragging && 'opacity-50 ring-2 ring-npurple')}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          draggable
                          onDragStart={() => {
                            setDragFrom(i);
                            setDragOver(i);
                          }}
                          onDragEnd={() => {
                            setDragFrom(null);
                            setDragOver(null);
                          }}
                          title="Drag to move this anywhere in the lesson"
                          aria-label="Drag to reorder"
                          className="cursor-grab rounded-lg p-1 text-ink-faint transition hover:bg-mist hover:text-npurple active:cursor-grabbing"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-npurple-soft px-2.5 py-0.5 text-xs font-bold text-npurple">
                          <meta.icon className="h-3.5 w-3.5" /> {b.type === 'text' ? 'Note' : meta.label}
                        </span>
                      </div>
                      <RowTools
                        label="item"
                        first={i === 0}
                        last={i === blocks.length - 1}
                        onUp={() => p({ blocks: move(blocks, i, -1) })}
                        onDown={() => p({ blocks: move(blocks, i, 1) })}
                        onDelete={() => p({ blocks: blocks.filter((_, j) => j !== i) })}
                      />
                    </div>
                    <BlockEditor b={b} onChange={(nb) => p({ blocks: blocks.map((x, j) => (j === i ? nb : x)) })} />
                  </Card>
                </div>
              );
            })
          )}
          {blocks.length > 1 && !preview && (
            <p className="text-center text-[12px] text-ink-soft">
              Drag the handle to move any item — a video, image or note can sit between any two paragraphs. The arrows do the same thing one step at a time.
            </p>
          )}
        </div>
      )}

      {tab === 'questions' && (
        <div className="space-y-4">
          <Card className="!p-4">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Quiz type">
                <Segmented
                  value={lesson.checkSettings.mode}
                  onChange={(mode) => p({ checkSettings: mode === 'quiz' ? { mode, timeLimitMin: lesson.checkSettings.timeLimitMin || 15, attemptsAllowed: lesson.checkSettings.attemptsAllowed || 1 } : { mode, timeLimitMin: 0, attemptsAllowed: 0 } })}
                  options={[
                    { value: 'practice', label: 'Practice (retake anytime)' },
                    { value: 'quiz', label: 'Timed quiz' },
                  ]}
                />
              </Field>
              {lesson.checkSettings.mode === 'quiz' && (
                <>
                  <Field label="Minutes" hint="(0 = no limit)">
                    <Input type="number" min={0} max={240} value={lesson.checkSettings.timeLimitMin} onChange={(e) => p({ checkSettings: { ...lesson.checkSettings, timeLimitMin: Number(e.target.value) || 0 } })} className="!w-28" />
                  </Field>
                  <Field label="Attempts" hint="(0 = unlimited)">
                    <Input type="number" min={0} max={10} value={lesson.checkSettings.attemptsAllowed} onChange={(e) => p({ checkSettings: { ...lesson.checkSettings, attemptsAllowed: Number(e.target.value) || 0 } })} className="!w-28" />
                  </Field>
                </>
              )}
            </div>
          </Card>
          <QuestionsEditor questions={lesson.check} onChange={(check) => p({ check })} />
        </div>
      )}

      {tab === 'activity' &&
        (!act ? (
          <Empty
            icon={<FileCheck2 className="h-6 w-6" />}
            title="No activity yet"
            text="An activity asks learners to use the idea on something real."
            action={
              <Button onClick={() => p({ activity: { title: 'Apply it', instructions: [], instructionBlocks: [{ id: rid('b'), type: 'paragraph', text: 'Pick a real task from your week and use what you learned on it. Then describe what you did and what happened.' }], fields: [{ id: rid('f'), label: 'What did you do and what happened?', multiline: true }], allowFile: true } })}>
                Add activity
              </Button>
            }
          />
        ) : (
          <Card className="space-y-4">
            <Field label="Activity name">
              <Input value={act.title} onChange={(e) => p({ activity: { ...act, title: e.target.value } })} />
            </Field>
            <InstructionsEditor blocks={editableInstructions(act)} onChange={(instructionBlocks) => p({ activity: { ...act, instructionBlocks, instructions: [] } })} />
            <div>
              <Label>Questions learners answer</Label>
              <div className="space-y-2">
                {act.fields.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <Input value={f.label} onChange={(e) => p({ activity: { ...act, fields: act.fields.map((x, j) => (j === i ? { ...x, label: e.target.value, multiline: true } : x)) } })} placeholder="Question" />
                    <IconButton label="Remove question" disabled={act.fields.length <= 1} onClick={() => p({ activity: { ...act, fields: act.fields.filter((_, j) => j !== i) } })}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                ))}
                <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => p({ activity: { ...act, fields: [...act.fields, { id: rid('f'), label: '', multiline: true }] } })}>
                  Add question
                </Button>
              </div>
            </div>
            <RubricPdfEditor act={act} onChange={(a) => p({ activity: a })} />
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={act.allowFile} onChange={(e) => p({ activity: { ...act, allowFile: e.target.checked } })} className="h-4 w-4 accent-[#1F6BFF]" />
              Learners can attach a file
            </label>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (await confirm({ title: 'Remove this activity?', confirm: 'Remove', danger: true })) p({ activity: undefined });
              }}
            >
              Remove activity
            </Button>
          </Card>
        ))}
    </div>
  );
}

/* ---------------- Lessons outline ---------------- */

function Outline({ c, setModules, onEdit }: { c: Course; setModules: (m: CourseModule[]) => void; onEdit: (m: number, l: number) => void }) {
  const confirm = useConfirm();
  const mods = c.modules;
  const setMod = (i: number, m: CourseModule) => setModules(mods.map((x, j) => (j === i ? m : x)));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {mods.map((m, mi) => (
        <Card key={m.id} className="!p-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line bg-mist/50 px-4 py-3">
            <span className="shrink-0 text-xs font-bold text-npurple">Module {mi + 1}</span>
            <input value={m.title} onChange={(e) => setMod(mi, { ...m, title: e.target.value })} className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-display font-bold outline-none focus:bg-white focus:ring-2 focus:ring-nblue/20" aria-label="Module name" />
            <RowTools
              label="module"
              first={mi === 0}
              last={mi === mods.length - 1}
              onUp={() => setModules(move(mods, mi, -1))}
              onDown={() => setModules(move(mods, mi, 1))}
              onDelete={async () => {
                if (await confirm({ title: `Delete ${m.title}?`, text: `Its ${m.lessons.length} lesson(s) will be removed when you save.`, confirm: 'Delete module', danger: true })) setModules(mods.filter((_, j) => j !== mi));
              }}
            />
          </div>
          <ul>
            {m.lessons.map((l, li) => (
              <li key={l.id} className="group flex items-center gap-3 border-b border-line/70 px-4 py-3 last:border-0 hover:bg-nblue-soft/30">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-nblue to-npurple text-xs font-bold text-white">{li + 1}</span>
                <button className="min-w-0 flex-1 truncate text-left font-semibold hover:text-nblue" onClick={() => onEdit(mi, li)}>
                  {l.title || 'Untitled lesson'}
                </button>
                <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEdit(mi, li)}>
                  Edit
                </Button>
                <RowTools
                  label="lesson"
                  first={li === 0}
                  last={li === m.lessons.length - 1}
                  onUp={() => setMod(mi, { ...m, lessons: move(m.lessons, li, -1) })}
                  onDown={() => setMod(mi, { ...m, lessons: move(m.lessons, li, 1) })}
                  onDelete={async () => {
                    if (await confirm({ title: `Delete ${l.title}?`, confirm: 'Delete lesson', danger: true })) setMod(mi, { ...m, lessons: m.lessons.filter((_, j) => j !== li) });
                  }}
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setMod(mi, { ...m, lessons: [...m.lessons, newLesson(m.lessons.length + 1)] });
              onEdit(mi, m.lessons.length);
            }}
            className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-line py-3 text-sm font-semibold text-nblue hover:bg-nblue-soft/40"
          >
            <Plus className="h-4 w-4" /> Add lesson
          </button>
        </Card>
      ))}
      <Button variant="secondary" className="w-full" icon={<Plus className="h-4 w-4" />} onClick={() => setModules([...mods, newModule(mods.length + 1)])}>
        Add module
      </Button>
    </div>
  );
}

/* ---------------- Page ---------------- */

type Step = 'details' | 'lessons' | 'final';

export default function CourseBuilder({ courseId }: { courseId?: string }) {
  const { user } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const [course, setCourse] = useState<Course | null>(courseId ? null : blankCourse());
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('details');
  const [editing, setEditing] = useState<{ m: number; l: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    api<{ course: Course }>(`/staff/courses/${courseId}`)
      .then((r) => {
        setCourse(r.course);
        setDirty(false);
      })
      .catch((e) => setError((e as Error).message));
  }, [courseId]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0 });
  }, [step, editing]);

  if (error) return <ErrorBox message={error} onRetry={() => navigate('courses')} />;
  if (!course) return <Loading />;

  const update = (fn: (c: Course) => Course) => {
    setCourse((c) => (c ? fn(c) : c));
    setDirty(true);
  };

  const save = async (): Promise<Course | null> => {
    if (!course.title.trim()) {
      toast('error', 'Give the course a name first.');
      setStep('details');
      return null;
    }
    const g = course.grading;
    if (g.checks + g.activities + g.finalExam !== 100) {
      toast('error', 'The grade parts must add up to 100%.');
      setStep('details');
      return null;
    }
    const cleaned: Course = {
      ...course,
      modules: course.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => ({
          ...l,
          topic: l.topic || l.title,
          activity: l.activity
            ? { ...l.activity, instructions: l.activity.instructions.filter((s) => s.trim()), rubric: (l.activity.rubric ?? []).filter((r) => r.label.trim()), instructionBlocks: l.activity.instructionBlocks }
            : undefined,
        })),
      })),
    };
    setSaving(true);
    try {
      const r = course.id ? await api<{ course: Course }>(`/staff/courses/${course.id}`, { method: 'PUT', body: cleaned }) : await api<{ course: Course }>('/staff/courses', { body: cleaned });
      setCourse(r.course);
      setDirty(false);
      toast('success', 'Saved.');
      if (!course.id) window.history.replaceState(null, '', `#/courses/edit/${r.course.id}`);
      return r.course;
    } catch (e) {
      toast('error', (e as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (course.status !== 'published' && !course.priceSet) {
      setStep('details');
      setEditing(null);
      toast('error', 'Set the course price in Course details before publishing.');
      return;
    }
    const c = dirty || !course.id ? await save() : course;
    if (!c) return;
    const status = c.status === 'published' ? 'draft' : 'published';
    try {
      const r = await api<{ course: Course }>(`/staff/courses/${c.id}/status`, { body: { status } });
      setCourse(r.course);
      setDirty(false);
      toast('success', status === 'published' ? 'Published. Learners can see it now.' : 'Moved back to draft.');
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  const leave = async () => {
    if (dirty && !(await confirm({ title: 'Leave without saving?', text: 'Your changes will be lost.', confirm: 'Leave', danger: true }))) return;
    setDirty(false);
    navigate('courses');
  };

  const cur = editing ? course.modules[editing.m]?.lessons[editing.l] : undefined;
  const steps: { id: Step; label: string }[] = [
    { id: 'details', label: 'Course details' },
    { id: 'lessons', label: 'Lessons' },
    { id: 'final', label: 'Final test' },
  ];
  const published = course.status === 'published';

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 -mt-6 mb-6 border-b border-line bg-white/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:-mt-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <IconButton label="Back to courses" onClick={() => void leave()}>
              <ArrowLeft className="h-5 w-5" />
            </IconButton>
            <div className="min-w-0">
              <div className="truncate font-display text-lg font-bold">{course.title || 'New course'}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className={cx('inline-flex items-center gap-1 font-semibold', published ? 'text-ngreen-ink' : 'text-ink-faint')}>
                  <span className={cx('h-2 w-2 rounded-full', published ? 'bg-ngreen' : 'bg-ink-faint')} />
                  {published ? 'Published' : 'Draft'}
                </span>
                {dirty && <span className="font-semibold text-npurple">Unsaved changes</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void togglePublish()} disabled={saving}>
              {published ? 'Unpublish' : 'Publish'}
            </Button>
            <Button loading={saving} onClick={() => void save()} icon={<Save className="h-4 w-4" />}>
              Save
            </Button>
          </div>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto">
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                setStep(s.id);
                setEditing(null);
              }}
              className={cx('flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition', step === s.id ? 'bg-gradient-to-r from-nblue to-npurple text-white shadow' : 'text-ink-soft hover:bg-mist')}
            >
              <span className={cx('flex h-5 w-5 items-center justify-center rounded-full text-[11px]', step === s.id ? 'bg-white/25' : 'bg-mist')}>{i + 1}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {step === 'details' && <DetailsPanel c={course} set={(p) => update((c) => ({ ...c, ...p }))} onNext={() => setStep('lessons')} />}

      {step === 'lessons' &&
        (cur && editing ? (
          <div className="mx-auto max-w-4xl">
            <LessonEditor courseId={course.id || undefined}
              key={cur.id}
              lesson={cur}
              where={`${course.modules[editing.m].title} · Lesson ${editing.l + 1}`}
              onBack={() => setEditing(null)}
              set={(l) =>
                update((c) => ({
                  ...c,
                  modules: c.modules.map((m, mi) => (mi !== editing.m ? m : { ...m, lessons: m.lessons.map((x, li) => (li === editing.l ? l : x)) })),
                }))
              }
            />
          </div>
        ) : (
          <div className="space-y-5">
            <Outline c={course} setModules={(modules) => update((c) => ({ ...c, modules }))} onEdit={(m, l) => setEditing({ m, l })} />
            <MeasurementReadiness c={course} />
          </div>
        ))}

      {step === 'final' && (
        <div className="mx-auto max-w-3xl space-y-5">
          <MeasurementReadiness c={course} />
          {!course.finalExam ? (
            <Empty
              icon={<FileCheck2 className="h-6 w-6" />}
              title="No final test"
              text="Optional. It opens after all lessons are done, and passing it is needed for the certificate."
              action={<Button onClick={() => update((c) => ({ ...c, finalExam: { questions: [newQuestion()], timeLimitMin: 30, attemptsAllowed: 2 } }))}>Add final test</Button>}
            />
          ) : (
            <>
              <Card className="flex flex-wrap items-end gap-4 !p-4">
                <Field label="Minutes" hint="(0 = no limit)">
                  <Input type="number" min={0} max={480} value={course.finalExam.timeLimitMin} onChange={(e) => update((c) => ({ ...c, finalExam: { ...c.finalExam!, timeLimitMin: Number(e.target.value) || 0 } }))} className="!w-28" />
                </Field>
                <Field label="Attempts" hint="(0 = unlimited)">
                  <Input type="number" min={0} max={10} value={course.finalExam.attemptsAllowed} onChange={(e) => update((c) => ({ ...c, finalExam: { ...c.finalExam!, attemptsAllowed: Number(e.target.value) || 0 } }))} className="!w-28" />
                </Field>
                <Button
                  variant="danger"
                  size="sm"
                  className="ml-auto"
                  onClick={async () => {
                    if (await confirm({ title: 'Remove the final test?', confirm: 'Remove', danger: true })) update((c) => ({ ...c, finalExam: undefined }));
                  }}
                >
                  Remove final test
                </Button>
              </Card>
              <QuestionsEditor
                questions={course.finalExam.questions}
                objectives={course.modules.flatMap((m, mi) => m.lessons.map((l, li) => ({ id: l.id, label: `${mi + 1}.${li + 1} ${l.topic || l.title}` })))}
                onChange={(questions) => update((c) => ({ ...c, finalExam: { ...c.finalExam!, questions } }))}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

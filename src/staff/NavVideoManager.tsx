import { AlertTriangle, CheckCircle2, Clapperboard, HelpCircle, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { fmtDate, fmtSize } from '../lib/format';
import { checkNavVideoFile, getNavVideo, NAV_VIDEO_ACCEPT, previewSrc, probeVideo, removeNavVideo, uploadNavVideo, type NavVideoState } from '../lib/navVideo';
import { Button, cx, Modal, Spinner, useToast } from '../components/ui';

const FALLBACK_MAX = 1024 * 1024 * 1024;

type Staged = { file: File; url: string; seconds: number | null };

const fmtLength = (s: number | null) => {
  if (s === null) return '';
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * The instructor's "Navigation video" button (top right of every instructor page) and its window.
 * Add, preview, replace, or remove the "How to Navigate the USAII® LMS?" video. Learners get
 * the change the next time they open the ? window, and the new video opens once for them.
 */
export default function NavVideoManager() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<NavVideoState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [checking, setChecking] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const uploading = pct !== null;

  const refresh = useCallback(async () => {
    try {
      setLoadError(null);
      setInfo(await getNavVideo());
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  // Load once for the button's reminder dot, and again whenever the window opens.
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  // A staged preview holds a local copy of the file; release it when it is no longer shown.
  useEffect(() => {
    if (!staged) return;
    return () => URL.revokeObjectURL(staged.url);
  }, [staged]);

  // Leaving the page mid-upload would lose it, so the browser asks first.
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

  // Cancel an upload still running if the instructor signs out.
  useEffect(() => () => abort.current?.abort(), []);

  const maxBytes = info?.maxBytes ?? FALLBACK_MAX;

  const pick = async (f?: File | null) => {
    if (!f || uploading || checking) return;
    setError(null);
    setConfirmRemove(false);
    const problem = checkNavVideoFile(f, maxBytes);
    if (problem) return setError(problem);
    setChecking(true);
    const probe = await probeVideo(f);
    setChecking(false);
    if (!probe.ok) return setError(probe.reason);
    setStaged({ file: f, url: URL.createObjectURL(f), seconds: probe.seconds });
  };

  const publish = async () => {
    if (!staged || uploading) return;
    const replacing = !!info?.video;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setError(null);
    setPct(0);
    try {
      const next = await uploadNavVideo(staged.file, setPct, ctrl.signal);
      setInfo(next);
      setStaged(null);
      toast('success', replacing ? 'Video replaced. Learners now see the new video behind the ? button.' : 'Video added. Learners now see it behind the ? button.');
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') toast('info', 'Upload cancelled. Nothing was changed.');
      else setError(err.message);
    } finally {
      abort.current = null;
      setPct(null);
    }
  };

  const remove = async () => {
    setRemoving(true);
    setError(null);
    try {
      setInfo(await removeNavVideo());
      setConfirmRemove(false);
      toast('success', 'Video removed. Learners see "The navigation video is on its way" until you add a new one.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemoving(false);
    }
  };

  const close = () => {
    setOpen(false);
    // An upload keeps going in the background; anything not yet published is discarded.
    if (!uploading) setStaged(null);
    setConfirmRemove(false);
    setError(null);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void pick(e.dataTransfer.files?.[0]);
  };

  const current = info?.video ?? null;
  const needsVideo = !!info && (!current || info.fileMissing);
  const busy = uploading || checking || removing;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Add or change the How to Navigate the USAII® LMS? video that learners see behind the ? button"
        className="relative inline-flex h-9 items-center gap-2 rounded-full bg-gradient-to-r from-nblue via-npurple to-npink p-[1.5px] text-[13px] font-semibold shadow-sm shadow-npurple/20 transition hover:shadow-npurple/40"
      >
        <span className="inline-flex h-full items-center gap-2 rounded-full bg-white px-3 text-ink">
          <Clapperboard className="h-4 w-4 text-npurple" />
          <span className="hidden sm:inline">{uploading ? `Uploading ${pct}%` : 'Navigation video'}</span>
          <span className="sr-only sm:hidden">{uploading ? `Uploading navigation video, ${pct}%` : 'Navigation video'}</span>
        </span>
        {needsVideo && !uploading && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-npink" aria-label="No navigation video yet" />}
      </button>

      <Modal
        open={open}
        onClose={close}
        wide
        title={
          <span className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-npurple" /> How to Navigate the USAII® LMS? video
          </span>
        }
        footer={
          staged && !uploading ? (
            <>
              <Button variant="secondary" onClick={() => setStaged(null)}>
                Choose a different video
              </Button>
              <Button icon={<Upload className="h-4 w-4" />} onClick={() => void publish()}>
                {current ? 'Replace and publish to learners' : 'Publish to learners'}
              </Button>
            </>
          ) : uploading ? (
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => abort.current?.abort()}>
              Cancel upload
            </Button>
          ) : (
            <>
              {current && !confirmRemove && (
                <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmRemove(true)} disabled={busy} className="mr-auto">
                  Remove video
                </Button>
              )}
              <Button variant="secondary" onClick={close}>
                Close
              </Button>
              {!confirmRemove && (
                <Button icon={<Upload className="h-4 w-4" />} onClick={() => input.current?.click()} loading={checking} disabled={busy || !info}>
                  {current ? 'Replace video' : 'Add video'}
                </Button>
              )}
            </>
          )
        }
      >
        <div
          onDragOver={(e) => {
            if (busy || staged) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(e) => (busy || staged ? e.preventDefault() : onDrop(e))}
          className="space-y-4"
        >
          <p className="flex gap-2 text-sm text-ink-soft">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-nblue" />
            <span>
              Learners watch this video when they select the <b className="text-ink">?</b> button at the top right of any page. When you add or replace it here, every learner gets the new video straight away, and it opens once for them automatically on their next visit.
            </span>
          </p>

          <input
            ref={input}
            type="file"
            accept={NAV_VIDEO_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = ''; // choosing the same file again still works
            }}
          />

          {!info && !loadError && (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          )}

          {loadError && !info && (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-mist/60 px-5 py-8 text-center text-sm text-ink-soft">
              {loadError}
              <Button size="sm" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void refresh()}>
                Try again
              </Button>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-2xl border border-npink/30 bg-npink-soft px-4 py-3 text-sm text-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-npink" /> {error}
            </div>
          )}

          {info?.fileMissing && !staged && (
            <div className="flex items-start gap-2 rounded-2xl border border-npink/30 bg-npink-soft px-4 py-3 text-sm text-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-npink" />
              The saved video file is no longer on the server (this happens on hosts without a persistent disk). Learners see “on its way” for now. Add the video again to fix it.
            </div>
          )}

          {checking && (
            <div className="flex items-center gap-3 rounded-2xl bg-mist/60 px-4 py-3 text-sm text-ink-soft">
              <Spinner className="h-4 w-4" /> Checking that the video plays in a browser…
            </div>
          )}

          {staged && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-npurple">
                <span className="rounded-full bg-npurple-soft px-2.5 py-0.5 text-xs">Preview</span> Not published yet. Watch it here, then publish.
              </div>
              <video key={staged.url} src={staged.url} controls playsInline preload="metadata" className="block aspect-video w-full rounded-2xl bg-black" />
              <div className="text-xs text-ink-faint">
                {staged.file.name} · {fmtSize(staged.file.size)}
                {staged.seconds !== null && ` · ${fmtLength(staged.seconds)}`}
              </div>
              {uploading && (
                <div className="pt-2">
                  <div className="mb-1 flex justify-between text-xs font-semibold text-ink-soft">
                    <span>{pct === 100 ? 'Saving on the server…' : 'Uploading…'}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0}>
                    <div className="h-full bg-gradient-to-r from-nblue via-npurple to-npink transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">You can close this window and keep working; the upload continues. Please keep this tab open until it finishes.</p>
                </div>
              )}
            </div>
          )}

          {info && !staged && !checking && current && !info.fileMissing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-ngreen">
                <CheckCircle2 className="h-4 w-4" /> Live for learners
              </div>
              <video key={current.url} src={previewSrc(current.url)} controls playsInline preload="metadata" className="block aspect-video w-full rounded-2xl bg-black" />
              <div className="text-xs text-ink-faint">
                {current.name} · {fmtSize(current.size)} · Updated {fmtDate(current.updatedAt)} by {current.updatedByName}
              </div>
            </div>
          )}

          {info && !staged && !checking && (!current || info.fileMissing) && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className={cx(
                'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
                dragging ? 'border-npurple bg-npurple-soft/60' : 'border-line hover:border-nblue/50 hover:bg-nblue-soft/40',
              )}
            >
              <Upload className="h-8 w-8 text-npurple" />
              <span className="font-semibold">Drop the video here, or choose a file</span>
              <span className="text-xs text-ink-faint">MP4 (H.264) is best for every browser and phone. WebM and Ogg also work. Up to 1 GB.</span>
            </button>
          )}

          {current && !staged && !checking && !info?.fileMissing && dragging && (
            <div className="rounded-2xl border-2 border-dashed border-npurple bg-npurple-soft/60 px-4 py-3 text-center text-sm font-semibold text-npurple">Drop to preview the new video</div>
          )}

          {confirmRemove && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-npink/30 bg-npink-soft px-4 py-3 text-sm">
              <span className="text-ink">Remove this video? Learners will see “The navigation video is on its way” until you add a new one.</span>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirmRemove(false)} disabled={removing}>
                  Keep it
                </Button>
                <Button size="sm" variant="danger" loading={removing} onClick={() => void remove()}>
                  Remove
                </Button>
              </span>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

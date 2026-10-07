import { PlayCircle, RefreshCw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getNavVideo, previewSrc, type NavVideo } from '../lib/navVideo';

// Remembers which video (by its URL) this learner has already been shown on this device.
// A new or replaced video gets a new URL, so it opens once automatically again.
const SEEN_KEY = 'usaii.lms.navvideo.seen';

function seenUrl(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}
function markSeen(url: string) {
  try {
    localStorage.setItem(SEEN_KEY, url);
  } catch {
    /* private browsing: nothing to remember */
  }
}

/**
 * Opens the navigation video once, on a learner's first visit after an instructor adds (or
 * replaces) it. Never for instructors previewing a learner, and never when no video is set.
 */
export function useFirstVisitNavVideo(enabled: boolean, open: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    getNavVideo(ctrl.signal)
      .then((r) => {
        if (r.video && seenUrl() !== r.video.url) open();
      })
      .catch(() => undefined); // not being able to check is never worth an error on screen
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

type Load = { state: 'loading' } | { state: 'ready'; video: NavVideo | null } | { state: 'error' };

/**
 * "How to Navigate the USAII® LMS?": the video an instructor uploaded, opened from the ? button
 * at the top right. It is fetched every time the window opens, so an instructor's change shows
 * up for learners straight away. It never plays on its own; the learner presses play.
 */
export default function NavigationVideo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [playError, setPlayError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setLoad({ state: 'loading' });
    setPlayError(false);
    getNavVideo(ctrl.signal)
      .then((r) => setLoad({ state: 'ready', video: r.video }))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setLoad({ state: 'error' });
      });
    return () => ctrl.abort();
  }, [open, attempt]);

  const shown = load.state === 'ready' ? load.video : null;

  const close = () => {
    video.current?.pause();
    // Only a video the learner actually had in front of them counts as seen.
    if (shown) markSeen(shown.url);
    onClose();
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => closeBtn.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      back?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-[3px]" onClick={close} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nav-video-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-[1040px] overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="h-1 bg-gradient-to-r from-nblue via-npurple to-npink" aria-hidden />
            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4 sm:px-6">
              <div>
                <h2 id="nav-video-title" className="font-display text-xl font-extrabold leading-tight sm:text-2xl">
                  How to Navigate the USAII® LMS?
                </h2>
                <p className="mt-0.5 text-[13px] text-ink-soft">A short video tour of every page and button.</p>
              </div>
              <button
                ref={closeBtn}
                type="button"
                onClick={close}
                aria-label="Close video (Esc)"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-mist hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {load.state === 'loading' && (
              <div className="flex aspect-video max-h-[75vh] w-full items-center justify-center bg-black" aria-busy="true">
                <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white" aria-label="Loading the video" />
              </div>
            )}

            {load.state === 'error' && (
              <div className="flex flex-col items-center justify-center gap-3 bg-mist/60 px-6 py-14 text-center">
                <p className="text-sm text-ink-soft">The video could not be loaded. Check your connection and try again.</p>
                <button type="button" onClick={() => setAttempt((a) => a + 1)} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-nblue/40 hover:text-nblue">
                  <RefreshCw className="h-4 w-4" /> Try again
                </button>
              </div>
            )}

            {load.state === 'ready' && !shown && (
              <div className="flex flex-col items-center justify-center gap-2 bg-mist/60 px-6 py-14 text-center">
                <PlayCircle className="h-10 w-10 text-npurple/60" aria-hidden />
                <p className="font-semibold">The navigation video is on its way.</p>
                <p className="max-w-md text-sm text-ink-soft">Your instructor has not added it yet. Please check back soon; it will appear right here.</p>
              </div>
            )}

            {shown && (
              <div className="bg-black">
                <video
                  key={shown.url}
                  ref={video}
                  className="block aspect-video max-h-[75vh] w-full bg-black"
                  src={previewSrc(shown.url)}
                  controls
                  playsInline
                  preload="metadata"
                  controlsList="nodownload"
                  onError={() => setPlayError(true)}
                >
                  Your browser cannot play this video.
                </video>
              </div>
            )}
            {shown && playError && <p className="bg-npink-soft px-5 py-2 text-center text-xs text-npink sm:px-6">This video could not be played on this device. Please try another browser, or let your instructor know.</p>}

            {shown && <p className="px-5 py-3 text-center text-xs text-ink-faint sm:px-6">You can watch it again anytime from the ? button at the top right.</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

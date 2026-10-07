import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Download, ExternalLink, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Our guiding principle for documents: show them first, right here, then offer the download.
 * Many learners are on a phone and will never download a file, so every document opens in this
 * panel with "Download PDF" at the top. Esc or the X closes it and returns focus to where it was.
 */
export default function DocPanel({
  open,
  onClose,
  title,
  subtitle,
  icon,
  onDownload,
  downloadHref,
  downloadName,
  openHref,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  /** Builds and saves the PDF. */
  onDownload?: () => void;
  /** Or: a file that already exists. */
  downloadHref?: string;
  downloadName?: string;
  /** Optional: open the document in a new browser tab. */
  openHref?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panelRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      back?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const btn = 'inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm font-semibold transition hover:border-nblue hover:text-nblue';
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={subtitle ? `${title}: ${subtitle}` : title}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={reduce ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden bg-white shadow-2xl outline-none sm:w-[min(900px,94vw)] sm:rounded-l-3xl"
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-nblue to-npurple text-white">{icon}</span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[17px] font-bold leading-tight">{title}</div>
                {subtitle && <div className="truncate text-[12.5px] text-ink-soft">{subtitle}</div>}
              </div>
              {openHref && (
                <a href={openHref} target="_blank" rel="noopener noreferrer" className={btn} aria-label="Open in a new tab">
                  <ExternalLink className="h-4 w-4" /> <span className="hidden sm:inline">New tab</span>
                </a>
              )}
              {onDownload && (
                <button type="button" onClick={onDownload} className={btn}>
                  <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span> PDF
                </button>
              )}
              {!onDownload && downloadHref && (
                <a href={downloadHref} download={downloadName ?? true} className={btn}>
                  <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span> PDF
                </a>
              )}
              <button type="button" onClick={onClose} aria-label="Close (Esc)" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition hover:bg-mist hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

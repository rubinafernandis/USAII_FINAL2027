import type { NavVideo } from '../../shared/types';
import { api, uploadTo } from './api';

export type { NavVideo };

export interface NavVideoState {
  /** The current video, or null when none is set. */
  video: NavVideo | null;
  /** Instructors only: a video is saved but its file is gone from the server (upload it again). */
  fileMissing: boolean;
  maxBytes: number;
}

/** Always asks the server, so learners see an instructor's change the next time they open the ? window. */
export const getNavVideo = (signal?: AbortSignal) => api<NavVideoState>('/nav-video', { signal });

export const removeNavVideo = () => api<NavVideoState>('/nav-video', { method: 'DELETE' });

/** The type the server expects for each accepted extension (some systems send none, or video/x-m4v). */
function typeFor(name: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'ogv' || ext === 'ogg') return 'video/ogg';
  return null;
}

export function uploadNavVideo(file: File, onProgress: (pct: number) => void, signal?: AbortSignal) {
  const type = typeFor(file.name);
  const body = type && file.type !== type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
  return uploadTo<NavVideoState>('/nav-video', body, onProgress, (d) => !!(d as NavVideoState | null)?.video?.url, signal);
}

/** File types the server accepts. Kept in step with server/routes/navVideo.ts. */
export const NAV_VIDEO_ACCEPT = 'video/mp4,video/webm,video/ogg,.mp4,.m4v,.webm,.ogv';

/** A reason the file cannot be used, or null when it looks fine. */
export function checkNavVideoFile(f: File, maxBytes: number): string | null {
  if (!typeFor(f.name)) return 'Use an MP4 (H.264), WebM, or Ogg video. These play on every browser and phone.';
  if (f.size === 0) return 'That file is empty. Choose the video again.';
  if (f.size > maxBytes) return 'The video is larger than 1 GB. Export it at 1080p or lower and try again.';
  return null;
}

/**
 * Open the chosen file in this browser before uploading it, so a file that cannot play
 * (for example a renamed .mov, or audio only) is caught before learners ever see it.
 * Resolves with the length in seconds, or null if the browser could not tell in time.
 */
export function probeVideo(f: File): Promise<{ ok: true; seconds: number | null } | { ok: false; reason: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(f);
    const v = document.createElement('video');
    let settled = false;
    const finish = (r: { ok: true; seconds: number | null } | { ok: false; reason: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(url);
      resolve(r);
    };
    // Some very large files take a while to open; don't block the upload if the browser is slow.
    const timer = setTimeout(() => finish({ ok: true, seconds: null }), 15000);
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => {
      if (!v.videoWidth || !v.videoHeight) finish({ ok: false, reason: 'This file has sound but no picture. Choose the video file itself.' });
      else finish({ ok: true, seconds: Number.isFinite(v.duration) ? v.duration : null });
    };
    v.onerror = () => finish({ ok: false, reason: 'This browser cannot play that file, so learners could not either. Export it as MP4 (H.264 video, AAC audio) and try again.' });
    v.src = url;
  });
}

/**
 * Many phones (iOS Safari) show a blank frame until play is pressed. Asking for the frame at
 * 0.1 s makes them draw a real picture as the preview, with no separate poster image needed.
 */
export const previewSrc = (url: string) => `${url}#t=0.1`;

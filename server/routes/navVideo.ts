// "How to Navigate the USAII® LMS?" video.
// Instructors upload, replace, or remove it; every signed-in user can read which video is current.
// The file itself lives in the uploads folder and is streamed (with Range support) from /uploads/.
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import type { NavVideo } from '../../shared/types';
import { requireAuth, requireRole } from '../auth';
import { db, nowIso, save, UPLOAD_DIR } from '../db';
import { audit } from '../services';
import { me, wrap } from './util';

/** Formats every modern browser (desktop and phone) can play in a <video> element. */
const PLAYABLE: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
};
const EXT_OK = new Set(['.mp4', '.m4v', '.webm', '.ogv', '.ogg']);
export const NAV_VIDEO_MAX_BYTES = 1024 * 1024 * 1024; // 1 GB, the same ceiling as course videos
const FILE_PREFIX = 'nav-video-';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  // The extension comes from the checked type, never from the uploaded name.
  filename: (_req, file, cb) => cb(null, `${FILE_PREFIX}${Date.now()}-${crypto.randomBytes(8).toString('hex')}${PLAYABLE[file.mimetype] ?? '.mp4'}`),
});

const upload = multer({
  storage,
  limits: { fileSize: NAV_VIDEO_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (PLAYABLE[file.mimetype] && EXT_OK.has(ext)) cb(null, true);
    else cb(new Error('Use an MP4 (H.264), WebM, or Ogg video. These play on every browser and phone.'));
  },
});

/** Absolute path of an uploaded file, or null if the URL does not point inside the uploads folder. */
function localPath(url: string): string | null {
  if (!url.startsWith('/uploads/')) return null;
  const name = path.basename(url);
  if (!name || name !== url.slice('/uploads/'.length)) return null;
  const full = path.join(UPLOAD_DIR, name);
  return full.startsWith(UPLOAD_DIR + path.sep) ? full : null;
}

function fileExists(v: NavVideo): boolean {
  const p = localPath(v.url);
  return !!p && fs.existsSync(p);
}

/** Delete a replaced or removed navigation video, unless a course also links to that same file. */
function discard(v: NavVideo | null | undefined) {
  if (!v) return;
  const p = localPath(v.url);
  if (!p || !path.basename(p).startsWith(FILE_PREFIX)) return;
  if (JSON.stringify(db().courses).includes(v.url)) return;
  fs.unlink(p, () => undefined);
}

const current = (): NavVideo | null => db().settings?.navVideo ?? null;

function setCurrent(v: NavVideo | null) {
  const d = db();
  d.settings = { ...(d.settings ?? {}), navVideo: v };
  save();
}

export const navVideoRouter = Router();

/**
 * The current video for everyone signed in. Learners get `video: null` when none is set
 * (or its file is gone), so the ? window shows a friendly note instead of a broken player.
 * Instructors also learn when the saved file is missing, so they can upload it again.
 */
navVideoRouter.get(
  '/',
  requireAuth,
  wrap((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const v = current();
    const missing = !!v && !fileExists(v);
    const staff = me(req).role === 'instructor';
    return { video: v && !missing ? v : null, fileMissing: staff ? missing : false, maxBytes: NAV_VIDEO_MAX_BYTES };
  }),
);

/** Upload a new video, or replace the current one. */
navVideoRouter.post('/', requireAuth, requireRole('instructor'), (req, res) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof multer.MulterError ? (err.code === 'LIMIT_FILE_SIZE' ? 'The video is larger than 1 GB. Export it at 1080p or lower and try again.' : 'Upload one video file at a time.') : (err as Error).message;
      return res.status(400).json({ error: msg });
    }
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'Choose a video file to upload.' });
    if (f.size === 0) {
      fs.unlink(f.path, () => undefined);
      return res.status(400).json({ error: 'That file is empty. Choose the video again.' });
    }
    const actor = me(req);
    const previous = current();
    const next: NavVideo = {
      url: `/uploads/${f.filename}`,
      name: f.originalname.slice(0, 200),
      size: f.size,
      mime: f.mimetype,
      updatedAt: nowIso(),
      updatedById: actor.id,
      updatedByName: actor.name,
    };
    setCurrent(next);
    discard(previous);
    audit(actor, previous ? 'REPLACE_NAV_VIDEO' : 'ADD_NAV_VIDEO', `Navigation video ${previous ? 'replaced with' : 'set to'} "${next.name}"`);
    res.json({ video: next, fileMissing: false, maxBytes: NAV_VIDEO_MAX_BYTES });
  });
});

/** Remove the video. Learners then see "No video yet" behind the ? button. */
navVideoRouter.delete(
  '/',
  requireAuth,
  requireRole('instructor'),
  wrap((req) => {
    const previous = current();
    if (!previous) return { video: null, fileMissing: false, maxBytes: NAV_VIDEO_MAX_BYTES };
    setCurrent(null);
    discard(previous);
    audit(me(req), 'REMOVE_NAV_VIDEO', `Navigation video "${previous.name}" removed`);
    return { video: null, fileMissing: false, maxBytes: NAV_VIDEO_MAX_BYTES };
  }),
);

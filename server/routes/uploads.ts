import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { requireAuth } from '../auth';
import { UPLOAD_DIR } from '../db';

const ALLOWED = /^(video|audio|image)\/|^application\/(pdf|msword|vnd\.openxmlformats-officedocument\.|vnd\.ms-|zip|x-zip-compressed|octet-stream)|^text\/(plain|csv|markdown|vtt)/;

/**
 * Only these extensions are stored. The extension decides how the file is served later, so it must never
 * be something a browser would run as a page or script (.html, .svg, .js, .xml...). SVG is excluded on purpose:
 * it can carry script and would run on the LMS's own origin.
 */
export const SAFE_EXTENSIONS = new Set([
  '.mp4', '.m4v', '.mov', '.webm', '.ogv',
  '.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.txt', '.md', '.vtt', '.srt', '.zip',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB for course videos
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED.test(file.mimetype) && file.mimetype !== 'image/svg+xml' && SAFE_EXTENSIONS.has(ext)) cb(null, true);
    else cb(new Error('This file type is not supported. Use video, audio, images (PNG, JPG, GIF, WebP), PDF, Office documents, or text.'));
  },
});

/** Absolute path of a file in the uploads folder for a "/uploads/<name>" URL, or null (blocks path traversal). */
export function uploadedFilePath(url: string): string | null {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  const name = url.slice('/uploads/'.length);
  if (!name || name !== path.basename(name) || name.startsWith('.')) return null;
  const full = path.join(UPLOAD_DIR, name);
  return full.startsWith(UPLOAD_DIR + path.sep) ? full : null;
}

export const uploadRouter = Router();

uploadRouter.post('/', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 1 GB.' : (err as Error).message;
      return res.status(400).json({ error: msg });
    }
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'Choose a file to upload.' });
    // Learners may attach files up to 50 MB to activities.
    if (req.user!.role === 'learner' && f.size > 50 * 1024 * 1024) {
      fs.unlink(f.path, () => undefined);
      return res.status(400).json({ error: 'Activity attachments must be 50 MB or smaller.' });
    }
    res.json({ url: `/uploads/${f.filename}`, name: f.originalname, size: f.size, mime: f.mimetype });
  });
});

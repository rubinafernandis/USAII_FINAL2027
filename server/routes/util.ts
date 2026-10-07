import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../services';

export const wrap =
  (fn: (req: Request, res: Response) => unknown): RequestHandler =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
      else next(e);
    }
  };

export const me = (req: Request) => req.user!;

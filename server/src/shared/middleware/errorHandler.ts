import type { ErrorRequestHandler } from 'express';

/** Ошибки разбора тела (битый JSON, превышен лимит) приходят с кодом 4xx в поле status */
const statusOf = (err: unknown): number =>
  typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
    ? err.status
    : 500;

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) return next(err);

  const status = statusOf(err);
  if (status >= 500) console.error(err);

  const message =
    status === 413
      ? 'Слишком большой запрос'
      : status < 500
        ? 'Некорректный запрос'
        : 'Внутренняя ошибка сервера';
  res.status(status).json({ message });
};

import { z } from 'zod';

/** bcrypt учитывает только первые 72 байта UTF-8, а не 72 символа. */
export const passwordInput = z
  .string()
  .min(1)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'Пароль не должен превышать 72 байта UTF-8',
  });

export const passwordField = passwordInput.refine((value) => value.length >= 8, {
  message: 'Пароль должен быть не короче 8 символов',
});

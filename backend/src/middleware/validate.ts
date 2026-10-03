import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

/** Validates and replaces req.body with the parsed (typed, defaulted) value. */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };
}

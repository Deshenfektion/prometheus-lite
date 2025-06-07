import type { Request } from 'express';
import type { ZodTypeAny, output } from 'zod';
import { ValidationError } from './errors.js';

function parse<S extends ZodTypeAny>(schema: S, input: unknown, source: string): output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(`Invalid request ${source}`, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data as output<S>;
}

export function parseBody<S extends ZodTypeAny>(schema: S, req: Request): output<S> {
  return parse(schema, req.body, 'body');
}

export function parseQuery<S extends ZodTypeAny>(schema: S, req: Request): output<S> {
  return parse(schema, req.query, 'query');
}

export function parseParams<S extends ZodTypeAny>(schema: S, req: Request): output<S> {
  return parse(schema, req.params, 'parameters');
}

export function parseValue<S extends ZodTypeAny>(schema: S, input: unknown, label: string): output<S> {
  return parse(schema, input, label);
}

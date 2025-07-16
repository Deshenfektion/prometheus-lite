import type { Request } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';
import { ValidationError } from './errors.js';

type Schema<Output, Input> = ZodType<Output, ZodTypeDef, Input>;

function parse<Output, Input>(
  schema: Schema<Output, Input>,
  input: unknown,
  source: string,
): Output {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(`Invalid request ${source}`, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

export function parseBody<Output, Input>(schema: Schema<Output, Input>, req: Request): Output {
  return parse(schema, req.body, 'body');
}

export function parseQuery<Output, Input>(schema: Schema<Output, Input>, req: Request): Output {
  return parse(schema, req.query, 'query');
}

export function parseParams<Output, Input>(schema: Schema<Output, Input>, req: Request): Output {
  return parse(schema, req.params, 'parameters');
}

export function parseValue<Output, Input>(
  schema: Schema<Output, Input>,
  input: unknown,
  label: string,
): Output {
  return parse(schema, input, label);
}

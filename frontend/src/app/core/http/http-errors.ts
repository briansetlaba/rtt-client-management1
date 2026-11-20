import { HttpErrorResponse } from '@angular/common/http';

const unreachableServiceStatuses = [0, 502, 503, 504];

export function isServiceUnreachable(error: unknown): boolean {
  return error instanceof HttpErrorResponse && unreachableServiceStatuses.includes(error.status);
}

export function hasHttpStatus(error: unknown, status: number): boolean {
  return error instanceof HttpErrorResponse && error.status === status;
}

export function readValidationProblem<TField extends string>(
  body: unknown,
  fields: readonly TField[]
): { fieldErrors: Partial<Record<TField, string>>; otherMessages: string[] } {
  const fieldErrors: Partial<Record<TField, string>> = {};
  const otherMessages: string[] = [];
  const errors = typeof body === 'object' && body !== null && 'errors' in body ? body.errors : null;

  if (typeof errors !== 'object' || errors === null) {
    return { fieldErrors, otherMessages };
  }

  for (const [key, messages] of Object.entries(errors)) {
    const message = Array.isArray(messages) ? messages.filter(item => typeof item === 'string').join(' ') : '';
    const field = fields.find(candidate => candidate.toLowerCase() === key.toLowerCase());

    if (!message) {
      continue;
    }

    if (field) {
      fieldErrors[field] = message;
    } else {
      otherMessages.push(message);
    }
  }

  return { fieldErrors, otherMessages };
}

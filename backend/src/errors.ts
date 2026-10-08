import type { HttpErrorDetail } from '@hwsd/shared';

export class ApplicationError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: readonly HttpErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

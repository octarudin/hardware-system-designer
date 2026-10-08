export interface HttpErrorDetail {
  readonly code: string;
  readonly path?: string;
  readonly message: string;
}

export interface HttpErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
    readonly details: readonly HttpErrorDetail[];
  };
}

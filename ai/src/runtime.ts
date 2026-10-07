import { API_VERSION, type ServiceStatus } from '@hwsd/shared';

export interface WorkerRuntime {
  readonly status: ServiceStatus;
  start(): void;
  stop(): void;
}

export interface WorkerRuntimeOptions {
  readonly heartbeatIntervalMs?: number;
  readonly onStart?: (status: ServiceStatus) => void;
  readonly onStop?: () => void;
}

export function createWorkerRuntime(options: WorkerRuntimeOptions = {}): WorkerRuntime {
  const status: ServiceStatus = {
    service: 'datasheet-worker',
    status: 'ready',
    version: API_VERSION,
  };
  let heartbeat: NodeJS.Timeout | undefined;

  return {
    status,
    start(): void {
      if (heartbeat) return;
      options.onStart?.(status);
      heartbeat = setInterval(() => undefined, options.heartbeatIntervalMs ?? 60_000);
    },
    stop(): void {
      if (!heartbeat) return;
      clearInterval(heartbeat);
      heartbeat = undefined;
      options.onStop?.();
    },
  };
}

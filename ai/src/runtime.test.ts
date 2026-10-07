import { describe, expect, it, vi } from 'vitest';

import { createWorkerRuntime } from './runtime.js';

describe('datasheet worker skeleton', () => {
  it('starts and stops without claiming an import job', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const worker = createWorkerRuntime({ onStart, onStop });

    worker.start();
    worker.stop();

    expect(onStart).toHaveBeenCalledWith({
      service: 'datasheet-worker',
      status: 'ready',
      version: 'v1',
    });
    expect(onStop).toHaveBeenCalledOnce();
  });
});

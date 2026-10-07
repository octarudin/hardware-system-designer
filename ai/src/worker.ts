import { createWorkerRuntime } from './runtime.js';

const worker = createWorkerRuntime({
  onStart: (status) => {
    console.info(JSON.stringify({ level: 'info', event: 'worker.started', ...status }));
  },
  onStop: () => {
    console.info(JSON.stringify({ level: 'info', event: 'worker.stopped' }));
  },
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    console.info(JSON.stringify({ level: 'info', event: 'worker.shutdown', signal }));
    worker.stop();
  });
}

worker.start();

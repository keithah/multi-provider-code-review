import PQueue from 'p-queue';

export function createQueue(concurrency: number): PQueue {
  return new PQueue({ concurrency, autoStart: true });
}

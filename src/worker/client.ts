/**
 * Typed client that wraps the simulation Web Worker for the React UI.
 */

import type { WorkerCommand, WorkerEvent } from './protocol';

export class SimulationClient {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      new URL('./simulation.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }

  on(handler: (event: WorkerEvent) => void): () => void {
    const listener = (ev: MessageEvent<WorkerEvent>) => handler(ev.data);
    this.worker.addEventListener('message', listener);
    return () => this.worker.removeEventListener('message', listener);
  }

  send(cmd: WorkerCommand): void {
    this.worker.postMessage(cmd);
  }

  terminate(): void {
    this.worker.terminate();
  }
}

/// <reference lib="webworker" />
/**
 * Simulation Web Worker.
 *
 * Owns a fixed-step loop decoupled from the UI render. On each frame it
 * advances the runner by stepsPerFrame fixed steps and posts a decimated
 * snapshot. The browser throttles timers in inactive tabs; with a fixed step
 * the result does not depend on frame rate or tab focus.
 */

import {
  type Runner,
  advanceFrame,
  createMode1Runner,
  createMode2Runner,
  isTerminal,
  snapshotOf,
} from './runner';
import type { RunParams, WorkerCommand, WorkerEvent } from './protocol';

let runner: Runner | null = null;
let params: RunParams | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let paused = false;

const post = (event: WorkerEvent): void => {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(event);
};

const stopLoop = (): void => {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
};

const tickFrame = (): void => {
  if (!runner || !params || paused) return;
  try {
    advanceFrame(runner, params);
    const snapshot = snapshotOf(runner);
    if (isTerminal(runner)) {
      stopLoop();
      post({
        type: runner.kind === 'mode2' && snapshot.phase === 'FAULT' ? 'fault' : 'done',
        snapshot,
      });
    } else {
      post({ type: 'snapshot', snapshot });
    }
  } catch (err) {
    stopLoop();
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};

const startLoop = (): void => {
  stopLoop();
  paused = false;
  if (!params) return;
  const intervalMs = 1000 / params.snapshotHz;
  timer = setInterval(tickFrame, intervalMs);
};

self.onmessage = (ev: MessageEvent<WorkerCommand>): void => {
  const cmd = ev.data;
  try {
    switch (cmd.type) {
      case 'start-mode1':
        params = cmd.params;
        runner = createMode1Runner(cmd.config);
        startLoop();
        break;
      case 'start-mode2':
        params = cmd.params;
        runner = createMode2Runner(cmd.config);
        startLoop();
        break;
      case 'pause':
        paused = true;
        break;
      case 'resume':
        paused = false;
        break;
      case 'reset':
      case 'stop':
        stopLoop();
        runner = null;
        break;
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};

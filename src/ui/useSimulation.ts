import { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationClient } from '../worker/client';
import type { RunParams, Snapshot, WorkerCommand } from '../worker/protocol';

export type RunStatus = 'idle' | 'running' | 'paused' | 'done' | 'fault' | 'error';

export interface UseSimulationResult {
  snapshot: Snapshot | null;
  history: Snapshot[];
  status: RunStatus;
  errorMessage: string | null;
  send: (cmd: WorkerCommand) => void;
  reset: () => void;
}

/**
 * Manages a SimulationClient (Web Worker) and exposes the latest snapshot plus
 * a bounded history for charts. The history is capped to keep memory bounded.
 */
export const useSimulation = (historyCap = 2000): UseSimulationResult => {
  const clientRef = useRef<SimulationClient | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = new SimulationClient();
    clientRef.current = client;
    const off = client.on((event) => {
      switch (event.type) {
        case 'snapshot':
          setSnapshot(event.snapshot);
          setStatus('running');
          setHistory((h) => {
            const next = [...h, event.snapshot];
            return next.length > historyCap ? next.slice(-historyCap) : next;
          });
          break;
        case 'done':
          setSnapshot(event.snapshot);
          setStatus('done');
          setHistory((h) => [...h, event.snapshot].slice(-historyCap));
          break;
        case 'fault':
          setSnapshot(event.snapshot);
          setStatus('fault');
          break;
        case 'error':
          setErrorMessage(event.message);
          setStatus('error');
          break;
      }
    });
    return () => {
      off();
      client.terminate();
      clientRef.current = null;
    };
  }, [historyCap]);

  const send = useCallback((cmd: WorkerCommand) => {
    if (cmd.type === 'start-mode1' || cmd.type === 'start-mode2') {
      setHistory([]);
      setErrorMessage(null);
      setStatus('running');
    } else if (cmd.type === 'pause') {
      setStatus('paused');
    } else if (cmd.type === 'resume') {
      setStatus('running');
    }
    clientRef.current?.send(cmd);
  }, []);

  const reset = useCallback(() => {
    clientRef.current?.send({ type: 'reset' });
    setSnapshot(null);
    setHistory([]);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return { snapshot, history, status, errorMessage, send, reset };
};

export const DEFAULT_RUN_PARAMS: Omit<RunParams, 'pumpCode'> = {
  dtS: 0.005,
  snapshotHz: 25,
  speed: 1,
};

import type { Snapshot } from '../../worker/protocol';
import type { RunStatus } from '../useSimulation';

export type VisualState =
  | 'ready'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'done'
  | 'fault'
  | 'out-of-range'
  | 'power-insufficient';

const LABELS: Record<VisualState, string> = {
  ready: 'Pronto',
  running: 'Executando',
  paused: 'Pausado',
  stopping: 'Parando',
  done: 'Concluído',
  fault: 'Falha',
  'out-of-range': 'Fora de faixa',
  'power-insufficient': 'Potência insuficiente',
};

/** Resolve the visual state from the run status and the latest snapshot. */
export const resolveVisualState = (
  status: RunStatus,
  snapshot: Snapshot | null,
  errorMessage: string | null,
): VisualState => {
  if (status === 'error') {
    if (errorMessage && errorMessage.includes('range')) return 'out-of-range';
    return 'fault';
  }
  if (status === 'fault') return 'fault';
  if (snapshot?.powerInsufficient) return 'power-insufficient';
  if (status === 'paused') return 'paused';
  if (status === 'done') return 'done';
  if (status === 'running') {
    if (snapshot?.phase === 'STOPPING') return 'stopping';
    return 'running';
  }
  return 'ready';
};

export const StatusBadge = ({ state }: { state: VisualState }) => (
  <span className={`status-badge status-${state}`} data-state={state}>
    {LABELS[state]}
  </span>
);

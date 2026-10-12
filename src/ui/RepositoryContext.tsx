import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DexieSimulationRepository } from '../infra/dexie-repository';
import type { SimulationRepository } from '../infra/repository';

const RepositoryContext = createContext<SimulationRepository | null>(null);

/** Exposed for tests to inject a mock repository. Prefer RepositoryProvider in app code. */
export { RepositoryContext };

export const RepositoryProvider = ({ children }: { children: ReactNode }) => {
  const repo = useMemo<SimulationRepository>(
    () => new DexieSimulationRepository(),
    [],
  );
  return (
    <RepositoryContext.Provider value={repo}>
      {children}
    </RepositoryContext.Provider>
  );
};

export const useRepository = (): SimulationRepository => {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error('useRepository must be used within RepositoryProvider');
  return repo;
};

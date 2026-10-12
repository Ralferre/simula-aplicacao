import { useState } from 'react';
import { BrandFooter, BrandHeader, RsoftLogo } from './components/Brand';
import { Mode1Page } from './pages/Mode1Page';
import { Mode2Page } from './pages/Mode2Page';
import { SeriesPage } from './pages/SeriesPage';
import { RepositoryProvider } from './RepositoryContext';

type Route = 'mode1' | 'mode2' | 'series';

const NAV: { id: Route; label: string }[] = [
  { id: 'mode1', label: 'Modo 1 — Ciclo por tempo' },
  { id: 'mode2', label: 'Modo 2 — Dosagem PLC' },
  { id: 'series', label: 'Séries / Registros' },
];

const Splash = ({ onEnter }: { onEnter: () => void }) => (
  <div className="splash">
    <RsoftLogo size={96} />
    <p className="splash-brand">RSOFT</p>
    <h1 className="splash-product">Simulador de Dosagem</h1>
    <p className="splash-product-note">Um produto RSoft</p>
    <p className="splash-tagline">Mais que código. Soluções para o seu futuro.</p>
    <button type="button" onClick={onEnter}>Entrar</button>
  </div>
);

export const App = () => {
  const [entered, setEntered] = useState(false);
  const [route, setRoute] = useState<Route>('mode1');

  if (!entered) return <Splash onEnter={() => setEntered(true)} />;

  return (
    <RepositoryProvider>
      <div className="app">
        <BrandHeader title="Simulador de Dosagem" />
        <div className="app-body">
          <nav className="side-nav">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                className={route === n.id ? 'active' : ''}
                onClick={() => setRoute(n.id)}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <main className="app-main">
            {route === 'mode1' && <Mode1Page />}
            {route === 'mode2' && <Mode2Page />}
            {route === 'series' && <SeriesPage />}
          </main>
        </div>
        <BrandFooter />
      </div>
    </RepositoryProvider>
  );
};

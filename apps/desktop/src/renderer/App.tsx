import { useEffect, useState } from 'react';
import { AppHeader, type AppScreen } from './components/AppHeader';
import { SuccessBanner } from './components/SuccessBanner';
import { CatalogPage } from './pages/catalog/CatalogPage';
import { SelectionsPage } from './pages/selections/SelectionsPage';

export function App() {
  const [screen, setScreen] = useState<AppScreen>('catalog');
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!success) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setSuccess(null), 60_000);
    return () => window.clearTimeout(timeout);
  }, [success]);

  return (
    <div className="app-shell">
      <AppHeader screen={screen} onScreenChange={setScreen} />
      <main>
        {success ? (
          <SuccessBanner message={success} onClose={() => setSuccess(null)} />
        ) : null}
        {screen === 'catalog' ? (
          <CatalogPage onSuccess={setSuccess} />
        ) : (
          <SelectionsPage onBackToCatalog={() => setScreen('catalog')} />
        )}
      </main>
    </div>
  );
}

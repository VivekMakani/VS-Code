import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StorageProvider } from './store/StorageContext';
import RootLayout from './layouts/RootLayout';
import RulebookPage from './pages/RulebookPage';
import RawImportPage from './pages/RawImportPage';
import LedgerPage from './pages/LedgerPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <HashRouter>
      <StorageProvider>
        <Routes>
          <Route path="/" element={<RootLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="rulebook" element={<RulebookPage />} />
            <Route path="import" element={<RawImportPage />} />
            <Route path="ledger" element={<LedgerPage />} />
          </Route>
        </Routes>
      </StorageProvider>
    </HashRouter>
  );
}

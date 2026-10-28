import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './i18n/LanguageContext';
import './index.css';
import { initPwaUpdates } from './services/pwaUpdate';
import { startDriveAutoBackup } from './services/driveBackup';

initPwaUpdates();
startDriveAutoBackup();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);

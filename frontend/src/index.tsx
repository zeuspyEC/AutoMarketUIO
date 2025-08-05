import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Service Worker para PWA
import { registerSW } from 'virtual:pwa-register';

// Configuración de internacionalización
import './i18n';

// MSW para mocking en desarrollo
if (process.env.NODE_ENV === 'development') {
  import('./mocks/browser').then(({ worker }) => {
    worker.start({
      onUnhandledRequest: 'bypass',
    });
  });
}

// Registrar Service Worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nueva versión disponible. ¿Actualizar?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('Aplicación lista para funcionar offline');
  },
});

// Render de la aplicación
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Reportar métricas de rendimiento
if (process.env.NODE_ENV === 'production') {
  import('./utils/reportWebVitals').then(({ reportWebVitals }) => {
    reportWebVitals(console.log);
  });
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL;
  const swUrl = `${base}sw.js`;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(swUrl, {scope: base})
      .then(() => console.log('SW registered'))
      .catch((err) => console.log('SW registration failed', err));
  });
}

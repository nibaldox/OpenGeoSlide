import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BenchPage } from './ui/BenchPage';

// /?bench=1 es la página de benchmark (bench/chrome/run.mjs); el resto, la aplicación.
const isBench = new URLSearchParams(window.location.search).get('bench') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isBench ? <BenchPage /> : <App />}</StrictMode>,
);

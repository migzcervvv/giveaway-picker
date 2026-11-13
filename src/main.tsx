import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/ui/App';
import '@/ui/theme.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing app root');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

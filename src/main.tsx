import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installLeaveGuard } from '@/store/leaveGuard';
import { App } from '@/ui/App';
import '@/ui/theme.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing app root');
}

const removeLeaveGuard = installLeaveGuard();
import.meta.hot?.dispose(removeLeaveGuard);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ensure DOM is ready
const root = document.getElementById('root');
if (!root) {
  document.body.innerHTML = '<div style="color: white; text-align: center; margin-top: 50px;">ERROR: Root element not found</div>';
} else {
  try {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    console.error('Failed to render app:', error);
    root.innerHTML = '<div style="color: red; text-align: center; margin-top: 50px; font-family: monospace;">Failed to initialize application<br/>' + (error instanceof Error ? error.message : String(error)) + '</div>';
  }
}

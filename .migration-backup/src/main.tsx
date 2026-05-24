import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log("🚀 Starting app initialization...");

// Ensure DOM is ready
const root = document.getElementById('root');
console.log("Root element found:", !!root);

if (!root) {
  console.error("Root element not found!");
  document.body.innerHTML = '<div style="color: white; text-align: center; margin-top: 50px; font-family: monospace;">ERROR: Root element not found</div>';
} else {
  try {
    console.log("Creating React root...");
    const reactRoot = createRoot(root);
    console.log("Rendering App component...");
    
    reactRoot.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    
    console.log("✅ App rendered successfully");
  } catch (error) {
    console.error('❌ Failed to render app:', error);
    root.innerHTML = '<div style="color: red; text-align: center; margin-top: 50px; font-family: monospace; padding: 20px;">Failed to initialize application<br/><br/>' + 
      (error instanceof Error ? error.message : String(error)) + 
      '<br/><br/><small>Check browser console for details</small></div>';
  }
}

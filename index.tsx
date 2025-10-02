import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './contexts/LanguageContext.tsx';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { ColorThemeProvider } from './contexts/ColorThemeContext.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <ColorThemeProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ColorThemeProvider>
    </ThemeProvider>
  </React.StrictMode>
);
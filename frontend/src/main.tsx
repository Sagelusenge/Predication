import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AudioPlayerProvider } from './context/AudioPlayerContext';
import { ToastProvider } from './context/ToastContext';
import './styles.css';

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider><AudioPlayerProvider><App /></AudioPlayerProvider></ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import MobileApp from './mobile/MobileApp';
import './index.css';

// Lightweight path routing — no router dependency for just two surfaces:
//   /          → in-car cockpit (desktop / embedded form)
//   /m         → mobile mini-app (consumer / beta surface)
const isMobileRoute = window.location.pathname.replace(/\/+$/, '') === '/m';
const Root = isMobileRoute ? MobileApp : App;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
    <Analytics />
  </React.StrictMode>
);

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registry } from './core/data/registry';

// Инициализация базы данных перед рендером
const init = async () => {
  try {
    // В реальном проекте здесь будет загрузка JSON/CSV
    // registry.init('./data'); 
    console.log('🚀 Health Engine Core initialized');
  } catch (e) {
    console.error('❌ Init failed:', e);
  }
};

init().then(() => {
  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
});
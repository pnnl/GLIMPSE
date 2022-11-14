import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import {App, About} from './App';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/About" element={<About />} />
    </Routes>
  </BrowserRouter>
);
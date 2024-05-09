import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
// import { HashRouter, Routes, Route } from 'react-router-dom';
import './styles/index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
   <App />
);


// root.render(
//    <HashRouter>
//       <Routes>
//          <Route path="/" element={<Home />} />
//          <Route path="/About" element={<About open={true}/>} />
//       </Routes>
//    </HashRouter>
// );
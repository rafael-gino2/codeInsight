import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/login/login'
import Register from './pages/register/Register'
import RedefinirSenha from './pages/resetPassword/ResetPassword'
import Dashboard from './pages/dashboard/Dashboard'
import Produtos from "./pages/produtos/product-stock";
import MateriaPrima from "./pages/materiaPrima/material-stock";
import Navbar from './components/navbar'; // ajuste o caminho conforme sua estrutura

// Layout com navbar para as páginas que precisam dela
function LayoutWithNavbar({ children }) {
  return (
    <div style={{ display: 'flex' }}>
      <Navbar />
      <div style={{ flex: 1, padding: '20px' }}>
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login"/>} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/resetPassword" element={<RedefinirSenha />} />

      {/* Rotas com navbar */}
      <Route path="/dashboard" element={
        <LayoutWithNavbar>
          <Dashboard />
        </LayoutWithNavbar>
      } />
      <Route path="/produtos" element={
        <LayoutWithNavbar>
          <Produtos />
        </LayoutWithNavbar>
      } />
      <Route path="/materia-prima" element={
        <LayoutWithNavbar>
          <MateriaPrima />
        </LayoutWithNavbar>
      } />
    </Routes>
  )
}

export default App
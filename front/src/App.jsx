// src/App.jsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/login/login'
import Register from './pages/register/Register'
import RedefinirSenha from './pages/resetPassword/ResetPassword'
import Dashboard from './pages/dashboard/Dashboard'
import Produtos from "./pages/produtos/product-stock";
import MateriaPrima from "./pages/materiaPrima/material-stock";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login"/>} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/resetPassword" element={<RedefinirSenha />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/produtos" element={<Produtos />} />
      <Route path="/materia-prima" element={<MateriaPrima />} />
    </Routes>
  )
}

export default App

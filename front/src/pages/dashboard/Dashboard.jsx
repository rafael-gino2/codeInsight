import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => navigate('/login'));
  }, [navigate]);

  const logout = async () => {
    await api.post('/auth/logout');
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <h2>Olá, {user.name}!</h2>
      <p>{user.email}</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}
    
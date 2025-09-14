import { useState } from 'react';
import { api } from '../../api';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react'; // 👈 importamos o iconify
import '../../App.css';
import cadeado from '../../img/imgCadeado.png';
import logo from '../../img/logo.png';
import video from '../../img/Spherical3.mp4';
import Footer from '../../components/Footer';
import Loading from '../../components/Loading';

export default function Login() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false); // 👈 estado do loading
  const navigate = useNavigate();

  const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setLoading(true); // 👈 mostra o loading
    try {
      await api.post('/auth/login', form);

      // dispara o fade-out
      setLoading(false);

      // navega só depois do fade-out (500ms = duration definida)
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);

    } catch (err) {
      setMsg(err.response?.data?.message || 'Erro');
      setLoading(false); // 👈 esconde se deu erro
    }
  };
  return (
    <>
      <Loading active={loading} />
      <div className="login-container">
        {/* Lado esquerdo */}
        <div className="login-left">
          <video src={video} autoPlay loop muted />
          <div className="overlay"></div>
          <div className="content">
            <img src={logo} alt="Logo" className="logo" />
            <img src={cadeado} alt="Cadeado" className="cadeado" />
            <h1>Bem-Vindo ao <span>Codesight!</span></h1>
            <p>
              Soluções inteligentes para otimizar o que move o seu negócio.
              <br/>
              Eficiência, precisão e controle — tudo em um só lugar.
              
            </p>
          </div>
        </div>

        {/* Lado direito com login */}
        <div className="login-right">
          <div className="login-box">
            <h2>Entrar</h2>
            <p>
              Não possui uma conta?{" "}
              <a href="/register">
                Crie uma agora!
              </a>
            </p>

            <form onSubmit={onSubmit}>
              <div>
                <label>Nome</label>
                <input
                  name="name"
                  placeholder="Insira seu nome"
                  value={form.name}
                  onChange={onChange}
                  required
                />
              </div>
              <div>
                <label>E-mail</label>
                <input
                  name="email"
                  type="email"
                  placeholder="Insira seu e-mail"
                  value={form.email}
                  onChange={onChange}
                  required
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Senha</label>
                  <a href="/ResetPassword">Esqueceu a senha?</a>
                </div>
                <input
                  name="password"
                  type="password"
                  placeholder="Insira sua senha"
                  value={form.password}
                  onChange={onChange}
                  required
                />
              </div>
              <button type="submit">Entrar</button>
            </form>

            {msg && <p style={{ color: '#dc2626', marginTop: '10px' }}>{msg}</p>}

            <Footer />
          </div>
        </div>
      </div>
    </>
  );
}

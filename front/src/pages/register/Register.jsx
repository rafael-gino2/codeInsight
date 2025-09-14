import { useState, useEffect } from 'react';
import { api } from '../../api';
import '../../App.css';
import { Icon } from '@iconify/react';
import Footer from '../../components/Footer';
import Loading from '../../components/Loading';

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    cargo: "",
    matricula: ""
  });

  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500); // tempo de exibição inicial do loading
    return () => clearTimeout(timer);
  }, []);

  const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setMsgType('');
    setLoading(true); // ativa loading no envio

    try {
      await api.post('/auth/register', form);
      setTimeout(() => {
        setMsg('Registrado! Agora faça login.');
        setMsgType('success');
        setLoading(false);
      }, 800);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Erro');
      setMsgType('error');
      setLoading(false);
    }
  };

  return (
    <>
    <Loading active={loading} />
    <div className="register-container">
      <h2 className="register-title">Criar conta</h2>
      <p className="register-subtitle">Cadastre-se para acessar nosso sistema</p>

      <form className="register-form" onSubmit={onSubmit}>
        <label>
          Nome
          <input
            name="name"
            placeholder="Insira seu nome"
            value={form.name}
            onChange={onChange}
            required
          />
        </label>

        <label>
          E-Mail
          <input
            name="email"
            type="email"
            placeholder="Insira seu e-mail"
            value={form.email}
            onChange={onChange}
            required
          />
        </label>

        <div className="input-row">
          <label>
            Cargo
            <input
              name="cargo"
              placeholder="Insira seu cargo"
              value={form.cargo}
              onChange={onChange}
              required
            />
          </label>

          <label>
            Matrícula
            <input
              name="matricula"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Insira sua matrícula"
              value={form.matricula}
              onChange={onChange}
              required
            />
          </label>
        </div>

        <label>
          Senha
          <input
            name="password"
            type="password"
            placeholder="Insira sua senha"
            value={form.password}
            onChange={onChange}
            required
          />
        </label>

        <button type="submit">Enviar</button>
      </form>

      {msg && (
        <p className={msgType === 'success' ? 'msg-success' : 'msg-error'}>
          {msg}
        </p>
      )}

      <a href="/login" className="back-login">
        <Icon
          icon="ic:round-chevron-left"
          width="20"
          height="20"
          style={{ marginRight: '6px' }}
        />
        Voltar para o Login
      </a>

      <Footer />
    </div>
    </>
  );
}

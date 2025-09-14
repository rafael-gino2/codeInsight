import { useState, useEffect } from 'react';
import { api } from '../../api';
import '../../App.css';
import { Icon } from '@iconify/react';
import Footer from '../../components/Footer';
import Loading from '../../components/Loading'; // 👈 importa o componente

export default function RedefinirSenha() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');
  const [loading, setLoading] = useState(true);

  // 👇 Loading inicial ao entrar na tela
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setMsgType('');
    setLoading(true); // ativa loading durante o envio

    try {
      await api.post('/auth/forgot-password', { email });
      setTimeout(() => {
        setMsg('E-mail enviado! Verifique sua caixa de entrada.');
        setMsgType('success');
        setLoading(false);
      }, 800);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Erro ao enviar e-mail.');
      setMsgType('error');
      setLoading(false);
    }
  };

  return (
    <>
      <Loading active={loading} />
      <div className="reset-container">
        <h2 className="reset-title">Redefina sua senha</h2>
        <p className="reset-subtitle">
          Vamos enviar um e-mail para a troca da senha
        </p>

        <form className="reset-form" onSubmit={onSubmit}>
          <label>
            <input
              name="email"
              type="email"
              placeholder="Insira seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

import logomenor from '../img/logo_menor.png';
import '../App.css';

export default function Footer() {
  return (
    <footer className="app-footer">
      <span>Powered <span className="by-red">by</span></span>
      <img src={logomenor} alt="Logo" className="footer-logo" />
    </footer>
  );
}

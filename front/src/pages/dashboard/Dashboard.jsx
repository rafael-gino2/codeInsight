import { useState, useEffect } from "react";
import headerLogo from '../../img/logo-header.svg';
import Navbar from "../../components/navbar";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const API_URL = "http://localhost:3000";

export default function Dashboard() {
  const [chartData, setChartData] = useState(null);
  const [recentBatches, setRecentBatches] = useState([]);
  const [selectedMat, setSelectedMat] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [percentChartData, setPercentChartData] = useState(null);

  // === Relógio de tempo real ===
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // === 1. Gráfico de Linha ===
  const fetchChart = async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard/unit-cost-evolution`);
      const data = await res.json();

      const materials = [...new Set(data.map(d => d.material))];
      const dates = [...new Set(data.map(d => d.date))];

      const datasets = materials.map((mat, i) => ({
        label: mat,
        data: dates.map(date => {
          const item = data.find(d => d.date === date && d.material === mat);
          return item ? item.avgUnitCost : null;
        }),
        borderColor: `hsl(${i * 40}, 70%, 50%)`,
        backgroundColor: `hsl(${i * 40}, 70%, 50%)`,
        tension: 0.3
      }));

      setChartData({ labels: dates, datasets });
    } catch (err) {
      console.error("Erro gráfico:", err);
    }
  };

  // === 2. Histórico de Lotes ===
  const fetchRecentBatches = async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard/recent-batches`);
      const data = await res.json();
      setRecentBatches(data);
      if (data.length > 0 && !selectedMat) {
        setSelectedMat(data[0].name);
      }
    } catch (err) {
      console.error("Erro recent-batches:", err);
    }
  };

  // === 3. Gráfico de Percentual ===
  const fetchPercentualChart = async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard/percentual-chart`);
      const data = await res.json();
      const chartData = {
        labels: data.map(d => d.Componente),
        datasets: [{
          label: "Percentual (%)",
          data: data.map(d => d["Percentual (%)"]),
          backgroundColor: data.map((_, i) => `hsl(${i * 50}, 70%, 60%)`)
        }]
      };
      setPercentChartData(chartData);
    } catch (err) {
      console.error("Erro percentual-chart:", err);
    }
  };

  // === Atualização automática ===
  useEffect(() => {
    fetchChart();
    fetchRecentBatches();
    fetchPercentualChart();
    const interval = setInterval(() => {
      fetchChart();
      fetchRecentBatches();
      fetchPercentualChart();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: { position: "right", labels: { boxWidth: 12, font: { size: 10 } } },
      title: { display: true, text: "Evolução do Custo Unitário (R$/Dia)", font: { size: 20 } }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: { display: true, text: "Custo Unitário Médio (R$)" }
      },
      x: {
        title: { display: true, text: "Data" }
      }
    }
  };

  const loteSelecionado = recentBatches.find(b => b.name === selectedMat);


return (
  <div>
    {/* === Cabeçalho === */}
    <div className="dashboard-header">
      <a href="/produtos"><img src={headerLogo} alt="Logo" /></a>
    </div>

    {/* === Texto introdutório === */}
    <section className="dashboard-section-intro">
      <div className="dashboard-text-box">
        <h1>Dashboard</h1>
        <p>Bem-vindo à tela principal.</p>
        <p><b>{currentTime.toLocaleDateString("pt-BR")} {currentTime.toLocaleTimeString("pt-BR")}</b></p>
      </div>
    </section>

    {/* === Linha 1 === */}
    <div className="dashboard-row grid-2">
      {/* Esquerda: Select + Histórico */}
      <div className="dashboard-column">
        <select
          value={selectedMat}
          onChange={e => setSelectedMat(e.target.value)}
          className="dashboard-select"
        >
          {recentBatches.map((b) => (
            <option key={b.name} value={b.name}>{b.name}</option>
          ))}
        </select>

        <div className="dashboard-box">
          <h2>Histórico de Lotes</h2>
          {loteSelecionado ? (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Data</th><th>Quantidade</th><th>Custo Unitário</th><th>Custo Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{new Date(loteSelecionado.date).toLocaleDateString("pt-BR")}</td>
                  <td>{loteSelecionado.qty}</td>
                  <td>R$ {loteSelecionado.unitCost.toFixed(2)}</td>
                  <td>R$ {(loteSelecionado.qty * loteSelecionado.unitCost).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          ) : <p>Selecione um material...</p>}
        </div>
      </div>

      {/* Direita: Gráfico Evolução */}
      <div className="dashboard-box chart">
        {chartData ? (
          <Line data={chartData} options={{ ...lineOptions, maintainAspectRatio: false }} />
        ) : (
          <p>Carregando gráfico...</p>
        )}
      </div>
    </div>

    {/* === Linha 2 === */}
    <div className="dashboard-row grid-2">
      {/* Esquerda: Gráfico Percentual */}
     <div className="dashboard-box chart">
        <h2>Percentual de Custo por Componente</h2>
        {percentChartData ? (
          <Bar
            data={percentChartData}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        ) : (
          <p>Carregando gráfico...</p>
        )}
      </div>


      {/* Direita: Tabela Percentual */}
      <div className="dashboard-box">
        <h2>Tabela de Preços e Percentuais</h2>
        {percentChartData ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Componente</th><th>Preço Médio (R$)</th><th>Percentual (%)</th>
              </tr>
            </thead>
            <tbody>
              {percentChartData.labels.map((label, i) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>R$ {percentChartData.datasets[0].data[i].toFixed(2)}</td>
                  <td>{percentChartData.datasets[0].data[i].toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>Carregando tabela...</p>}
      </div>
    </div>



    <Navbar />
  </div>
);

}

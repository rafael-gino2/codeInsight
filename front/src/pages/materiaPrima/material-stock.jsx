import { useEffect, useState } from "react";
import headerLogo from "../../assets/logo-header.svg";
import Navbar from "../../components/navbar";
import { Icon } from "@iconify/react";
import loadIcon from "../../assets/logo-header.svg";
import { jsPDF } from "jspdf";
import "../../index.css";
import axios from "axios";

const API_URL = "http://localhost:3000"; // ajuste se seu back usar outra porta


export default function MateriasPrimas() {
  // ---------------- ESTADOS ----------------
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const itensPorPagina = 8;
  const [filtros, setFiltros] = useState({ status: "", tipo: "" });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isVariacaoModalOpen, setIsVariacaoModalOpen] = useState(false);
  const [variacoesSelecionadas, setVariacoesSelecionadas] = useState([]);
  const [isEditVariacaoModalOpen, setIsEditVariacaoModalOpen] = useState(false);
  const [arquivosCarregados, setArquivosCarregados] = useState([]);
  const [variacoesPorMateria, setVariacoesPorMateria] = useState({});


  // ---------------- LISTA INICIAL ----------------
  const [materiais, setMateriais] = useState([]);

  useEffect(() => {
    carregarMateriais();
  }, []);

  // ---------------- FUNÇÕES DE PESQUISA ----------------
  const materiaisFiltrados = materiais
    .filter((materia) =>
      materia.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materia.ncm.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materia.preco.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materia.unidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materia.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materia.variacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materia.possuiNF.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materia.adicionado.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((materia) =>
      filtros.tipo ? materia.tipo === filtros.tipo : true
    )
    .filter((materia) =>
      filtros.possuiNF ? materia.possuiNF === filtros.possuiNF : true
    );

  const indiceInicial = (paginaAtual - 1) * itensPorPagina;
  const indiceFinal = indiceInicial + itensPorPagina;
  const materiaisPagina = materiaisFiltrados.slice(indiceInicial, indiceFinal);
  const totalPaginas = Math.ceil(materiaisFiltrados.length / itensPorPagina);

  // ----- Funções de modal de filtro -----
  const openFilterModal = () => setIsFilterModalOpen(true);
  const closeFilterModal = () => setIsFilterModalOpen(false);

  // ----- Função de aplicar filtros -----
  const aplicarFiltro = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
    setPaginaAtual(1); // volta pra primeira página ao filtrar
  };

  // ---------------- FUNÇÕES MODAIS ----------------
  const openModal = (materiaPrima) => {
    setSelectedMaterial(materiaPrima);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedMaterial(null);
    setIsModalOpen(false);
  };

  const abrirModalVariacao = (materiaNome) => {
    const principal = materiais.find(m => m.nome === materiaNome);
    setSelectedMaterial(principal); // 👈 agora o modal sabe quem é o principal
    setVariacoesSelecionadas(variacoesPorMateria[materiaNome] || []);
    setIsVariacaoModalOpen(true);
  };


  const fecharModalVariacao = () => {
    setIsVariacaoModalOpen(false);
    setVariacoesSelecionadas([]);
  };

  const abrirModalEditarVariacao = () => {
    setIsEditVariacaoModalOpen(true);
  };

  const fecharModalEditarVariacao = () => {
    setIsEditVariacaoModalOpen(false);
  };

  // ---------------- FUNÇÕES AUXILIARES ----------------
  const handleInputChange = (e) => {
    setSelectedMaterial({ ...selectedMaterial, [e.target.name]: e.target.value });
  };


  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const novoArquivo = { nome: file.name, progresso: 0 };
    setArquivosCarregados(prev => [...prev, novoArquivo]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      await axios.post(`${API_URL}/upload/invoice-xml`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setArquivosCarregados(prev =>
            prev.map(f => f.nome === file.name ? { ...f, progresso: percent } : f)
          );
        }
      });

      // depois que enviar, carrega os materiais reais
      await carregarMateriais();

    } catch (err) {
      console.error("Erro no upload:", err);
      alert("Erro ao enviar XML.");
    }
  };


  // ---------------- ORDENAR ----------------
  const ordenar = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";

    const materiaisOrdenados = [...materiais].sort((a, b) => {
      if (key === "preco") {
        const numA = parseFloat(a[key].replace("R$", "").replace(".", "").replace(",", "."));
        const numB = parseFloat(b[key].replace("R$", "").replace(".", "").replace(",", "."));
        return direction === "asc" ? numA - numB : numB - numA;
      }
      if (key === "adicionado") {
        const dataA = new Date(a[key].split("/").reverse().join("-"));
        const dataB = new Date(b[key].split("/").reverse().join("-"));
        return direction === "asc" ? dataA - dataB : dataB - dataA;
      }
      if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
      return 0;
    });

    setMateriais(materiaisOrdenados);
    setSortConfig({ key, direction });
  };

  // ---------------- COLUNAS ----------------
  const colunas = [
    { chave: "nome", titulo: "Nome da matéria-prima" },
    { chave: "ncm", titulo: "NCM" },
    { chave: "preco", titulo: "Preço" },
    { chave: "unidade", titulo: "Unidade de medida" },
    { chave: "tipo", titulo: "Tipo" },
    { chave: "variacao", titulo: "Variação" },
    { chave: "possuiNF", titulo: "Possui NF?" },
    { chave: "adicionado", titulo: "Adicionado" }
  ];

  // Estado para o modal de exportação
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Abrir/fechar modal
  const openExportModal = () => setIsExportModalOpen(true);
  const closeExportModal = () => setIsExportModalOpen(false);

  // Exportar XML
  const exportXML = () => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<materias>\n';
    materiaisFiltrados.forEach((m) => {
      xml += `  <materia>\n`;
      Object.entries(m).forEach(([key, value]) => {
        xml += `    <${key}>${value}</${key}>\n`;
      });
      xml += `  </materia>\n`;
    });
    xml += '</materias>';

    const blob = new Blob([xml], { type: "application/xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "materias.xml";
    link.click();
    closeExportModal();
  };

  // Exportar PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text("Tabela de Matérias-Primas", 14, 20);

    let y = 30;
    materiaisFiltrados.forEach((m, index) => {
      doc.text(
        `${index + 1}. ${m.nome} - ${m.ncm} - ${m.preco} - ${m.unidade} - ${m.tipo} - ${m.variacao} - ${m.possuiNF} - ${m.adicionado}`,
        14,
        y
      );
      y += 10;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save("materias.pdf");
    closeExportModal();
  };

  const carregarMateriais = async () => {
    try {
      const res = await axios.get(`${API_URL}/materials`);
      const lista = res.data; // já vem agrupado: [{ principal, variacoes }]

      const principais = [];
      const variacoesTemp = {};

      lista.forEach(grupo => {
        if (grupo.principal) {
          const principal = grupo.principal;

          principais.push({
            _id: principal._id,
            nome: principal.name,
            ncm: principal.ncm,
            preco: `R$ ${principal.lastUnitCost.toFixed(2)}`,
            unidade: principal.unit,
            tipo: "Padrão",
            variacao: "Ver variações",
            possuiNF: "Sim",
            adicionado: new Date().toLocaleDateString("pt-BR")
          });

          if (grupo.variacoes && grupo.variacoes.length > 0) {
            variacoesTemp[principal.name] = grupo.variacoes.map(v => ({
              _id: v._id,
              nome: v.name,
              preco: `R$ ${v.lastUnitCost.toFixed(2)}`
            }));
          }
        }
      });

      setMateriais(principais);
      setVariacoesPorMateria(variacoesTemp);

    } catch (err) {
      console.error("Erro ao carregar materiais:", err);
    }
  };

  return (
    <div>
      <div className="header-main">
        <a href="/materia-prima"><img src={headerLogo} alt="Logo" /></a>
      </div>

      <section className="section-stock-main">
        <div className="section-stock-text">
          <h1>Estoque - Matéria-prima</h1>
          <p>Bem-vindo à tela de Estoque de matérias-primas! Aqui você pode visualizar, gerenciar e atualizar os insumos da sua produção de forma rápida e organizada.</p>
        </div>

        {/* Ações */}
        <div className="section-stock-actions">

          <div className="section-actions-search">
            <svg className="section-search-icon" aria-hidden="true" viewBox="0 0 24 24">
              <g><path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z"></path></g>
            </svg>
            <input
              placeholder="Pesquisar"
              type="search"
              className="section-search-input"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPaginaAtual(1); // reset da paginação ao pesquisar
              }}
            />
          </div>

          <div className="section-actions-buttons">

            {/* Filtrar */}
            <button className="section-actions-filter" onClick={openFilterModal}>
              <svg viewBox="0 0 512 512" height="16px">
                <path d="M0 416c0 17.7 14.3 32 32 32l54.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 448c17.7 0 32-14.3 32-32s-14.3-32-32-32l-246.7 0c-12.3-28.3-40.5-48-73.3-48s-61 19.7-73.3 48L32 384c-17.7 0-32 14.3-32 32zm128 0a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM320 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm32-80c-32.8 0-61 19.7-73.3 48L32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l246.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48l54.7 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-54.7 0c-12.3-28.3-40.5-48-73.3-48zM192 128a32 32 0 1 1 0-64 32 32 0 1 1 0 64zm73.3-64C253 35.7 224.8 16 192 16s-61 19.7-73.3 48L32 64C14.3 64 0 78.3 0 96s14.3 32 32 32l86.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 128c17.7 0 32-14.3 32-32s-14.3-32-32-32L265.3 64z"></path>
              </svg>
              <span className="filter-text">Filtrar</span>
            </button>

            {isFilterModalOpen && (
              <div className="filter-modal-overlay" onClick={closeFilterModal}>
                <div className="filter-modal-content" onClick={(e) => e.stopPropagation()}>
                  <h2>Filtros</h2>
                  <form>
                    <div className="filter-field">
                      <label>Possui NF?</label>
                      <select
                        name="possuiNF"
                        value={filtros.possuiNF}
                        onChange={(e) => aplicarFiltro("possuiNF", e.target.value)}
                      >
                        <option value="">Todos</option>
                        <option value="Sim">Sim</option>
                        <option value="Não">Não</option>
                      </select>
                    </div>

                    <div className="filter-field">
                      <label>Tipo</label>
                      <select
                        name="tipo"
                        value={filtros.tipo} // <-- controla o select pelo estado
                        onChange={(e) => aplicarFiltro("tipo", e.target.value)}
                      >
                        <option value="">Todos</option>
                        <option value="Bobina">Bobina</option>
                        <option value="Plástico">Plástico</option>
                        <option value="Vidro">Vidro</option>
                        <option value="Papel">Papel</option>
                        <option value="Químico">Químico</option>
                        <option value="Metal">Metal</option>
                        <option value="Tecido">Tecido</option>
                        <option value="Aço Inoxidável">Aço Inoxidável</option>
                        <option value="Borracha">Borracha</option>
                      </select>
                    </div>

                    <div className="stock-modal-actions">
                      <button type="button" className="stock-modal-cancel" onClick={closeFilterModal}>
                        Cancelar
                      </button>
                      <button type="button" className="stock-modal-save" onClick={closeFilterModal}>
                        Aplicar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Exportar */}
            <button className="section-actions-export" onClick={openExportModal}>
              <Icon icon="solar:export-bold" height="25" />
              <span className="export-text">Exportar</span>
            </button>

            {isExportModalOpen && (
              <div className="export-modal-overlay">
                <div className="export-modal-content">
                  <button
                    className="export-modal-close"
                    type="button"
                    onClick={() => setIsExportModalOpen(false)}
                  >
                    <Icon icon="mdi:close" height="24" />
                  </button>
                  <h2>Escolha o formato de exportação</h2>
                  <div className="export-modal-buttons">
                    <button onClick={() => exportPDF()}>PDF</button>
                    <button onClick={() => exportXML()}>XML</button>
                  </div>
                </div>
              </div>
            )}

            {/* Adicionar nota fiscal */}
            <button
              className="stock-add-button"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Icon icon="ion:add" height="30" />
              <p>Adicionar nota fiscal</p>
            </button>

            {/* Modal de upload de nota fiscal */}
            {isAddModalOpen && (
              <div className="stock-modal-overlay">
                <div className="stock-modal-content">
                  <h2>Carregar Nota Fiscal</h2>

                  <div className="stock-modal-field">
                    <input
                      id="fileInput"
                      type="file"
                      accept=".xml"
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />

                    <button
                      type="button"
                      onClick={() => document.getElementById("fileInput").click()}
                      className="stock-modal-load"
                    >
                      <img src={loadIcon} alt="Load Icon" />
                      <p><span>Clique para carregar</span> ou arraste e solte</p>
                      <p>seu arquivo <span>XML</span></p>
                    </button>

                    {/* Lista de arquivos carregados */}
                    <div className="stock-modal-uploaded-files">
                      <h3 style={{ marginTop: "20px" }}>Arquivos carregados</h3>
                      {arquivosCarregados.map((arquivo, i) => (
                        <div key={i} className="uploaded-file-item">
                          <span>{arquivo.nome}</span>
                          <div className="modal-progress-bar">
                            <div
                              className="modal-progress-fill"
                              style={{ width: `${arquivo.progresso}%` }}
                            ></div>
                          </div>
                          <span>{arquivo.progresso}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="stock-modal-actions" style={{ marginTop: "40px" }}>
                    <button
                      className="stock-modal-cancel"
                      onClick={() => setIsAddModalOpen(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="stock-modal-save"
                      disabled={false}
                    >
                      Carregar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className="section-stock-table">
          <table className="stock-table-main">
            <thead>
              <tr>
                {colunas.map((col) => (
                  <th key={col.chave} style={{ cursor: "pointer" }}>
                    {col.titulo}
                    <Icon
                      icon={sortConfig.key === col.chave ? (sortConfig.direction === "asc" ? "mdi:arrow-up" : "mdi:arrow-down") : "mdi:arrow-up-down"}
                      height="16"
                      color="#404040"
                      style={{ marginLeft: "6px", marginTop: "-2px", verticalAlign: "middle" }}
                      onClick={() => ordenar(col.chave)}
                    />
                  </th>
                ))}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {materiaisPagina.map((materiaPrima, index) => (
                <tr key={index}>
                  <td>{materiaPrima.nome}</td>
                  <td>{materiaPrima.ncm}</td>
                  <td>{materiaPrima.preco}</td>
                  <td>{materiaPrima.unidade}</td>
                  <td>{materiaPrima.tipo}</td>
                  <td
                    style={{ fontWeight: "600", cursor: "pointer", color: "#222222" }}
                    onClick={() => abrirModalVariacao(materiaPrima.nome)}
                  >
                    {materiaPrima.variacao}
                  </td>
                  <td>
                    <span style={{
                      backgroundColor: materiaPrima.possuiNF === "Sim" ? "#4CB340" : "#FD373C",
                      color: "#fff",
                      padding: "0.2rem 1rem",
                      borderRadius: "4px",
                      display: "inline-block",
                      width: "120px"
                    }}>
                      {materiaPrima.possuiNF}
                    </span>
                  </td>
                  <td className="stock-adicionado-td">
                    {materiaPrima.adicionado}
                    <span className="stock-tooltip">
                      Editado por último em: {materiaPrima.ultimaEdicao || materiaPrima.adicionado}
                    </span>
                  </td>
                  <td>
                    <Icon
                      icon="uiw:setting"
                      height="25"
                      color="#676565"
                      style={{ cursor: "pointer" }}
                      onClick={() => openModal(materiaPrima)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={colunas.length + 1}>
                  <div className="stock-pagination">
                    {Array.from({ length: totalPaginas }, (_, i) => (
                      <button key={i} className={paginaAtual === i + 1 ? "active" : ""} onClick={() => setPaginaAtual(i + 1)}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Modal de variações */}
          {isVariacaoModalOpen && (
            <div className="stock-modal-overlay" onClick={fecharModalVariacao}>
              <div className="stock-modal-content" style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                <h2>Variações</h2>
                <ul className="variacoes-list">
                  {variacoesSelecionadas.map((varia, i) => (
                    <li key={i} className="variacao-item">
                      <span>{varia.nome} — {varia.preco}</span>
                      <div className="variacao-actions">
                        <button
                          className="variacao-select"
                          onClick={async () => {
                            try {
                              await axios.put(`${API_URL}/materials/${varia._id}/set-official`);
                              await carregarMateriais(); // recarrega lista já atualizada
                              setIsVariacaoModalOpen(false);
                            } catch (err) {
                              console.error("Erro ao atualizar oficialidade:", err);
                              alert("Erro ao atualizar oficialidade");
                            }
                          }}
                        >
                          Selecionar
                        </button>


                        <button
                          className="variacao-edit"
                          onClick={() => abrirModalEditarVariacao(i)}
                        >
                          <Icon icon="mdi:pencil" height="18" />
                        </button>
                        <button
                          className="variacao-delete"
                          onClick={async () => {
                            try {
                              await axios.delete(`${API_URL}/materials/${varia._id}`); // 👈 deleta no banco
                              await carregarMateriais(); // recarrega lista do back atualizada
                            } catch (err) {
                              console.error("Erro ao deletar variação:", err);
                              alert("Erro ao deletar variação");
                            }
                          }}
                        >
                          <Icon icon="mdi:delete" height="18" />
                        </button>

                      </div>
                    </li>
                  ))}
                </ul>

                <button className="variacao-modal-close" onClick={fecharModalVariacao}>
                  <Icon icon="mdi:close" height="24" />
                </button>

                {/* Modal interno para edição de variação */}
                {isEditVariacaoModalOpen && (
                  <div className="stock-modal-overlay" onClick={fecharModalEditarVariacao}>
                    <div className="stock-modal-content" onClick={(e) => e.stopPropagation()}>
                      <h2>Editar Variação</h2>
                      <form>
                        {["nome", "ncm", "preco", "unidade", "tipo", "variacao", "possuiNF", "adicionado"].map((campo) => (
                          <div key={campo} className="stock-modal-field">
                            <label>{campo === "nome" ? "Nome da matéria-prima" :
                              campo === "ncm" ? "NCM" :
                                campo === "preco" ? "Preço" :
                                  campo === "unidade" ? "Unidade de medida" :
                                    campo === "tipo" ? "Tipo" :
                                      campo === "variacao" ? "Variação" :
                                        campo === "possuiNF" ? "Possui NF?" :
                                          campo === "adicionado" ? "Adicionado" : campo}</label>

                            {campo === "possuiNF" ? (
                              <select name={campo}>
                                <option value="">Selecione</option>
                                <option value="Sim">Sim</option>
                                <option value="Não">Não</option>
                              </select>
                            ) : (
                              <input type="text" name={campo} value="" />
                            )}
                          </div>
                        ))}

                        <div className="stock-modal-actions">
                          <button
                            className="stock-modal-cancel"
                            type="button"
                            onClick={fecharModalEditarVariacao}
                          >
                            Cancelar
                          </button>
                          <button className="stock-modal-save" type="button">
                            Salvar
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {isModalOpen && selectedMaterial && (
        <div className="stock-modal-overlay">
          <div className="stock-modal-content">
            <h2>Editar matéria-prima</h2>
            <form>
              {Object.keys(selectedMaterial).map((campo) => {
                // Ignora o campo "variacao"
                if (campo === "variacao") return null;

                const coluna = colunas.find(c => c.chave === campo);

                // Se for o campo "status" ou "possuiNF", renderiza um select
                if (campo === "status" || campo === "possuiNF") {
                  return (
                    <div key={campo} className="stock-modal-field">
                      <label>{coluna ? coluna.titulo : campo}</label>
                      <select
                        name={campo}
                        value={selectedMaterial[campo]}
                        onChange={handleInputChange}
                      >
                        {campo === "status" && (
                          <>
                            <option value="Em estoque">Em estoque</option>
                            <option value="Fora de estoque">Fora de estoque</option>
                            <option value="Pendente">Pendente</option>
                          </>
                        )}
                        {campo === "possuiNF" && (
                          <>
                            <option value="Sim">Sim</option>
                            <option value="Não">Não</option>
                          </>
                        )}
                      </select>
                    </div>
                  );
                }

                // Para os outros campos, mantém o input normal
                return (
                  <div key={campo} className="stock-modal-field">
                    <label>{coluna ? coluna.titulo : campo}</label>
                    <input
                      type="text"
                      name={campo}
                      value={selectedMaterial[campo]}
                      onChange={handleInputChange}
                    />
                  </div>
                );
              })}

              <div className="stock-modal-actions">
                <button
                  className="stock-modal-cancel"
                  type="button"
                  onClick={closeModal}
                >
                  Cancelar
                </button>
                <button className="stock-modal-save" type="submit">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Navbar />
    </div>
  );
}
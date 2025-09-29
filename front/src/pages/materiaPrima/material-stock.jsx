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
  const [arquivosCarregados, setArquivosCarregados] = useState([]);

  // ---------------- LISTA INICIAL ----------------
  const [materiais, setMateriais] = useState([]);

  useEffect(() => {
    carregarMateriais();
  }, []);

  // ---------------- FUNÇÕES DE PESQUISA ----------------
  const materiaisFiltrados = materiais
    .filter((materia) =>
      (materia.nome?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (materia.ncm?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (materia.preco?.toString() || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (materia.unidade?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (materia.tipo?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (materia.possuiNF?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (materia.adicionado?.toLowerCase() || "").includes(searchTerm.toLowerCase())
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

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [novoMaterial, setNovoMaterial] = useState({
    nome: "",
    ncm: "",
    preco: "",
    unidade: "",
    tipo: ""
  });


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

      const name = file.name.toLowerCase();
      let uploadUrl = '';

      if (name.endsWith('.xml')) {
        uploadUrl = `${API_URL}/upload/invoice-xml`;
      } else if (name.endsWith('.pdf')) {
        uploadUrl = `${API_URL}/upload/invoice-pdf`;
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        uploadUrl = `${API_URL}/upload/initial-excel`;   // 👈 rota do backend para Excel
      } else {
        alert('Tipo de arquivo não suportado. Use XML, PDF ou Excel.');
        return;
      }

      await axios.post(uploadUrl, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setArquivosCarregados(prev =>
            prev.map(f => f.nome === file.name ? { ...f, progresso: percent } : f)
          );
        }
      });

      await carregarMateriais();   // recarrega a lista

    } catch (err) {
      console.error("Erro no upload:", err);
      alert("Erro ao enviar arquivo.");
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
        `${index + 1}. ${m.nome} - ${m.ncm} - ${m.preco} - ${m.unidade} - ${m.possuiNF} - ${m.adicionado}`,
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
      const lista = res.data;

      console.log('Dados recebidos do backend:', lista); // 👈 PARA DEBUG

      // 👇 AGORA O BACKEND RETORNA UM ARRAY SIMPLES, NÃO PRECISA PROCESSAR AGRUPAMENTO
      const todosMateriais = lista.map(material => ({
        _id: material._id,
        nome: material.name || material.nomeExcel,
        ncm: material.ncm || material.ncmExcel,
        preco: parseFloat(material.lastUnitCost || material.unitCostExcel || 0),
        unidade: material.unit || material.unidadeExcel || "",
        tipo: material.tipo || material.tipoExcel || "",
        possuiNF: (material.possuiNF || material.possuiNFExcel) ? "Sim" : "Não",
        adicionado: material.createdAt ? new Date(material.createdAt).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR")
      }));



      console.log('Materiais processados:', todosMateriais); // 👈 PARA DEBUG
      setMateriais(todosMateriais);
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

            <button
              className="stock-add-button"
              onClick={() => setIsManualModalOpen(true)}
            >
              <Icon icon="mdi:plus-box" height="30" />
              <p>Adicionar manualmente</p>
            </button>


            {/* Modal de upload de nota fiscal */}
            {isAddModalOpen && (
              <div className="stock-modal-overlay">
                <div className="stock-modal-content">
                  <h2>Carregar Nota Fiscal</h2>

                  <div className="stock-modal-field">
                    {/* Upload único PDF ou XML */}
                    <input
                      id="fileInput"
                      type="file"
                      accept=".xml, .pdf, .xlsx, .xls"   // 👈 agora aceita Excel também
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
                      <p>seu arquivo <span>XML</span> ou <span>PDF</span></p>
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

        {isManualModalOpen && (
          <div className="stock-modal-overlay" onClick={() => setIsManualModalOpen(false)}>
            <div className="stock-modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Cadastrar Matéria-prima Manualmente</h2>
              <form>
                <div className="stock-modal-field">
                  <label>Nome</label>
                  <input
                    type="text"
                    value={novoMaterial.nome}
                    onChange={(e) => setNovoMaterial({ ...novoMaterial, nome: e.target.value })}
                  />
                </div>
                <div className="stock-modal-field">
                  <label>NCM</label>
                  <input
                    type="text"
                    value={novoMaterial.ncm}
                    onChange={(e) => setNovoMaterial({ ...novoMaterial, ncm: e.target.value })}
                  />
                </div>
                <div className="stock-modal-field">
                  <label>Preço unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoMaterial.preco}
                    onChange={(e) => setNovoMaterial({ ...novoMaterial, preco: e.target.value })}
                  />
                </div>
                <div className="stock-modal-field">
                  <label>Unidade</label>
                  <input
                    type="text"
                    value={novoMaterial.unidade}
                    onChange={(e) => setNovoMaterial({ ...novoMaterial, unidade: e.target.value })}
                  />
                </div>

                <div className="stock-modal-actions">

                  <button type="button" className="stock-modal-cancel" onClick={() => setIsManualModalOpen(false)}>Cancelar</button>
                  <button
                    type="button"
                    className="stock-modal-save"
                    onClick={async () => {
                      try {
                        await axios.post(`${API_URL}/materials/manual`, {
                          name: novoMaterial.nome,
                          ncm: novoMaterial.ncm,
                          unit: novoMaterial.unidade,
                          unitCost: parseFloat(novoMaterial.preco),
                        });
                        await carregarMateriais(); // recarrega lista
                        setIsManualModalOpen(false);
                      } catch (err) {
                        console.error("Erro ao cadastrar manual:", err);
                        alert("Erro ao cadastrar manualmente");
                      }
                    }}
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


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
                  <td>{`R$ ${materiaPrima.preco.toFixed(2).replace(".", ",")}`}</td>
                  <td>{materiaPrima.unidade}</td>
                  <td>
                    <span
                      style={{
                        backgroundColor: materiaPrima.possuiNF === "Sim" ? "#4CB340" : "#FD373C",
                        color: "#fff",
                        padding: "0.2rem 1rem",
                        borderRadius: "4px",
                        display: "inline-block",
                        width: "120px"
                      }}
                    >
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
        </div>
      </section>

      {isModalOpen && selectedMaterial && (
        <div className="stock-modal-overlay">
          <div className="stock-modal-content">
            <h2>Editar matéria-prima</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await axios.put(`${API_URL}/materials/${selectedMaterial._id}`, {
                    name: selectedMaterial.nome,
                    ncm: selectedMaterial.ncm,
                    unit: selectedMaterial.unidade,
                    lastUnitCost: selectedMaterial.preco,
                    // Remove tipo e possuiNF do envio se não quiser atualizá-los
                  });

                  await carregarMateriais();
                  closeModal();
                } catch (err) {
                  console.error("Erro ao atualizar material:", err);
                  alert("Erro ao salvar alterações.");
                }
              }}
            >
              {/* Campos que você QUER mostrar */}
              <div className="stock-modal-field">
                <label>Nome da matéria-prima</label>
                <input
                  type="text"
                  name="nome"
                  value={selectedMaterial.nome}
                  onChange={handleInputChange}
                />
              </div>

              <div className="stock-modal-field">
                <label>NCM</label>
                <input
                  type="text"
                  name="ncm"
                  value={selectedMaterial.ncm}
                  onChange={handleInputChange}
                />
              </div>

              <div className="stock-modal-field">
                <label>Preço</label>
                <input
                  type="number"
                  step="0.01"
                  name="preco"
                  value={selectedMaterial.preco}
                  onChange={(e) =>
                    setSelectedMaterial({
                      ...selectedMaterial,
                      preco: parseFloat(e.target.value) || 0
                    })
                  }
                />
              </div>

              <div className="stock-modal-field">
                <label>Unidade de medida</label>
                <input
                  type="text"
                  name="unidade"
                  value={selectedMaterial.unidade}
                  onChange={handleInputChange}
                />
              </div>

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
import { useState, useEffect } from "react";
import headerLogo from "../../assets/logo-header.svg";
import Navbar from "../../components/navbar";
import { Icon } from "@iconify/react";
import { jsPDF } from "jspdf";
import "../../index.css";

export default function Produtos() {


  // ----- Estados principais -----
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtros, setFiltros] = useState({ status: "", tipo: "" });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [materiasSelecionadas, setMateriasSelecionadas] = useState([]);
  const [novoProduto, setNovoProduto] = useState({ nomeProduto: "", unidadeMedida: "" });
  const [produtos, setProdutos] = useState([]);
  const [materiais, setMateriais] = useState([]);

  // ----- Funções de modal -----
  const openModal = (produto) => {
    setSelectedProduct(produto);
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setSelectedProduct(null);
    setIsModalOpen(false);
  };

  const handleInputChange = (e) => {
    setSelectedProduct({ ...selectedProduct, [e.target.name]: e.target.value });
  };

  // ----- Função de cores de status -----
  const getStatusColor = (status) => {
    switch (status) {
      case "Pendente": return "#f0ad4e";
      case "Em estoque": return "#4CB340";
      case "Fora de estoque": return "#FD373C";
      default: return "#ccc";
    }
  };

  // ----- Função de ordenação -----
  const ordenar = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";

    const produtosOrdenados = [...produtos].sort((a, b) => {
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

    setProdutos(produtosOrdenados);
    setSortConfig({ key, direction });
  };

  // ----- Colunas da tabela -----
  const colunas = [
    { chave: "nome", titulo: "Nome do produto" },
    { chave: "ncm", titulo: "NCM" },
    { chave: "preco", titulo: "Preço" },
    { chave: "unidade", titulo: "Unidade de medida" },
    { chave: "tipo", titulo: "Tipo" },
    { chave: "status", titulo: "Status" },
    { chave: "adicionado", titulo: "Adicionado" },
  ];

  // ----- Função de aplicar filtros -----
  const aplicarFiltro = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
    setPaginaAtual(1); // volta pra primeira página ao filtrar
  };

  // ----- Novo produto -----
  const handleNovoProdutoChange = (e) => {
    const { name, value } = e.target;
    setNovoProduto(prev => ({ ...prev, [name]: value }));
  };

  const isSalvarHabilitado = () => {
    return novoProduto.nomeProduto.trim() !== "" &&
      materiasSelecionadas.length > 0;
  };

  // ----- Funções de modal de filtro -----
  const openFilterModal = () => setIsFilterModalOpen(true);
  const closeFilterModal = () => setIsFilterModalOpen(false);

  // ----- Função de abrir/fechar modal de adicionar -----

  const exportXML = () => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<produtos>\n';
    produtos.forEach((p) => {
      xml += `  <produto>\n`;
      Object.entries(p).forEach(([key, value]) => {
        xml += `    <${key}>${value}</${key}>\n`;
      });
      xml += `  </produto>\n`;
    });
    xml += '</produtos>';

    const blob = new Blob([xml], { type: "application/xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "produtos.xml";
    link.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text("Tabela de Produtos", 14, 20);

    let y = 30;
    produtos.forEach((p, index) => {
      doc.text(`${index + 1}. ${p.nome} - ${p.ncm} - ${p.preco} - ${p.unidade} - ${p.tipo} - ${p.status} - ${p.adicionado}`, 14, y);
      y += 10;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save("produtos.pdf");
  };

  // Estado para o modal de exportação
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Função para abrir
  const openExportModal = () => {
    setIsExportModalOpen(true);
  };

  // Buscar produtos e materiais
  useEffect(() => {
    fetch("http://localhost:3000/products")
      .then(res => res.json())
      .then(setProdutos)
      .catch(console.error);

    fetch("http://localhost:3000/materials")
      .then(res => res.json())
      .then(setMateriais)
      .catch(console.error);
  }, []);

  const salvarProduto = async () => {
    try {
      const payload = {
        name: novoProduto.nomeProduto,
        bom: materiasSelecionadas.map(m => ({ material: m.materialId, qty: m.qty }))
      };

      console.log("Payload enviado:", payload);

      const res = await fetch("http://localhost:3000/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const novo = await res.json();
      console.log("Resposta do backend:", novo);

      setProdutos(prev => [...prev, novo]);
      setIsAddModalOpen(false);
    } catch (err) {
      console.error("Erro no salvarProduto:", err);
    }
  };


  // ----- Paginação -----
  const itensPorPagina = 5;
  const produtosFiltrados = produtos.filter((p) =>
    p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filtros.status === "" || p.status === filtros.status) &&
    (filtros.tipo === "" || p.tipo === filtros.tipo)
  );

  const totalPaginas = Math.ceil(produtosFiltrados.length / itensPorPagina);
  const produtosPagina = produtosFiltrados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div>
      <div className="header-main">
        <a href="/produtos"><img src={headerLogo} alt="Logo" /></a>
      </div>
      <section className="section-stock-main">
        <div className="section-stock-text">
          <h1>Estoque - Produtos</h1>
          <p>Bem-vindo à tela de Estoque de produtos! Aqui você pode visualizar, gerenciar e atualizar seus produtos de forma rápida e organizada.</p>
        </div>

        {/* Ações */}
        <div className="section-stock-actions">

          {/* Pesquisar */}
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
                setPaginaAtual(1); // volta pra primeira página quando digitar
                setSearchTerm(e.target.value);
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
                      <label>Status</label>
                      <select
                        name="status"
                        value={filtros.status}  // <-- controla o select pelo estado
                        onChange={(e) => aplicarFiltro("status", e.target.value)}
                      >
                        <option value="">Todos</option>
                        <option value="Em estoque">Em estoque</option>
                        <option value="Fora de estoque">Fora de estoque</option>
                        <option value="Pendente">Pendente</option>
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

            {/* Adicionar matéria-prima */}
            <button
              className="stock-add-button"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Icon icon="ion:add" height="30" />
              <p>Adicionar novo produto</p>
            </button>

            {/* Modal simples */}
            {isAddModalOpen && (
              <div className="stock-modal-overlay">
                <div className="stock-modal-content">
                  <h2>Adicionar Produto</h2>

                  <div className="stock-modal-inputs">
                    <div className="stock-modal-field">
                      <label>Nome do Produto</label>
                      <input
                        type="text"
                        name="nomeProduto"
                        placeholder="Insira o nome do produto"
                        value={novoProduto.nomeProduto}
                        onChange={handleNovoProdutoChange}
                      />
                    </div>
                  </div>

                  <h3>Adicionar matérias-primas utilizadas</h3>
                  <div className="stock-modal-add-product">
                    {materiais.map((m) => {
                      const material = m.principal || m.variacoes?.[0];
                      if (!material) return null;

                      // Procurar se já tem seleção
                      const selecionado = materiasSelecionadas.find(p => p.materialId === material._id);
                      const qty = selecionado?.qty || 0;

                      // Encontrar batch do material
                      const batchDoMaterial = material.batches?.find(
                        b => b.material.toString() === material._id.toString()
                      ) || null;


                      // Debug logs
                      console.log("Material:", material.name);
                      console.log("Batch do material:", batchDoMaterial);
                      console.log("Quantidade digitada:", qty);

                      const precoUnitario = batchDoMaterial ? parseFloat(batchDoMaterial.unitCost) : 0;
                      const total = qty * precoUnitario;

                      console.log("Preço unitário:", precoUnitario);
                      console.log("Total calculado:", total);

                      return (
                        <div key={material._id} style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
                          <label style={{ width: "150px" }}>{material.name}</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            style={{ width: "80px", marginRight: "10px" }}
                            value={qty}
                            onChange={(e) => {
                              const newQty = Number(e.target.value);
                              setMateriasSelecionadas(prev => {
                                const other = prev.filter(p => p.materialId !== material._id);
                                return [...other, { materialId: material._id, qty: newQty }];
                              });
                            }}
                          />
                          <span style={{ fontWeight: "bold" }}>
                            {total.toFixed(2).replace(".", ",")} R$
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="stock-modal-actions">
                    <button
                      className="stock-modal-cancel"
                      onClick={() => setIsAddModalOpen(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="stock-modal-save"
                      disabled={!isSalvarHabilitado()}
                      style={{
                        opacity: isSalvarHabilitado() ? 1 : 0.5,
                        cursor: isSalvarHabilitado() ? "pointer" : "not-allowed"
                      }}
                      onClick={() => {
                        console.log("Salvando produto:", novoProduto, materiasSelecionadas);
                        salvarProduto().catch(err => console.error("Erro ao salvar:", err));
                      }}
                    >
                      Salvar
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
              {produtosPagina.map((produto, index) => (
                <tr key={index}>
                  <td>{produto.nome}</td>
                  <td>{produto.ncm}</td>
                  <td>{produto.preco}</td>
                  <td>{produto.unidade}</td>
                  <td>{produto.tipo}</td>
                  <td>
                    <span style={{ backgroundColor: getStatusColor(produto.status), color: "#fff", padding: "0.2rem 1rem", borderRadius: "4px", display: "inline-block", width: "155px" }}>
                      {produto.status}
                    </span>
                  </td>
                  {/* <td>{produto.variacao}</td> */}
                  <td className="stock-adicionado-td">
                    {produto.adicionado}
                    <span className="stock-tooltip">
                      Editado por último em: {produto.ultimaEdicao || produto.adicionado}
                    </span>
                  </td>
                  <td>
                    <Icon icon="uiw:setting" height="25" color="#676565" style={{ cursor: "pointer" }} onClick={() => openModal(produto)} />
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

      {isModalOpen && selectedProduct && (
        <div className="stock-modal-overlay">
          <div className="stock-modal-content">
            <h2>Editar Produto</h2>
            <form>
              {Object.keys(selectedProduct).map((campo) => {
                if (campo === "variacao") return null;

                const coluna = colunas.find(c => c.chave === campo);

                // Campo de status
                if (campo === "status") {
                  return (
                    <div key={campo} className="stock-modal-field">
                      <label>{coluna ? coluna.titulo : campo}</label>
                      <select
                        name={campo}
                        value={selectedProduct[campo]}
                        onChange={handleInputChange}
                      >
                        <option value="Em estoque">Em estoque</option>
                        <option value="Fora de estoque">Fora de estoque</option>
                        <option value="Pendente">Pendente</option>
                      </select>
                    </div>
                  );
                }

                // Campo de preço formatado
                if (campo === "preco") {
                  return (
                    <div key={campo} className="stock-modal-field">
                      <label>{coluna ? coluna.titulo : campo}</label>
                      <input
                        type="text"
                        name={campo}
                        value={selectedProduct[campo]}
                        onChange={(e) => {
                          let valor = e.target.value.replace(/\D/g, "");
                          valor = (parseInt(valor || 0) / 100).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          });
                          setSelectedProduct({ ...selectedProduct, [campo]: valor });
                        }}
                      />
                    </div>
                  );
                }

                // Dropdown de unidade
                if (campo === "unidade") {
                  return (
                    <div key={campo} className="stock-modal-field">
                      <label>{coluna ? coluna.titulo : campo}</label>
                      <select
                        name={campo}
                        value={selectedProduct[campo]}
                        onChange={handleInputChange}
                      >
                        <option value="Kg">Kg</option>
                        <option value="g">g</option>
                        <option value="L">L</option>
                        <option value="mL">mL</option>
                        <option value="Unidade">Unidade</option>
                        <option value="Pacote">Pacote</option>
                        <option value="Metro">Metro</option>
                        <option value="cm">cm</option>
                      </select>
                    </div>
                  );
                }

                // Campo Adicionado (não editável)
                if (campo === "adicionado") {
                  return (
                    <div key={campo} className="stock-modal-field">
                      <label>{coluna ? coluna.titulo : campo}</label>
                      <input
                        type="text"
                        name={campo}
                        value={selectedProduct[campo]}
                        readOnly
                      />
                    </div>
                  );
                }

                // Outros campos
                return (
                  <div key={campo} className="stock-modal-field">
                    <label>{coluna ? coluna.titulo : campo}</label>
                    <input
                      type="text"
                      name={campo}
                      value={selectedProduct[campo]}
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
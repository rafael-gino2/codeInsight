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
  const [isMaterialsModalOpen, setIsMaterialsModalOpen] = useState(false); // 👈 NOVO ESTADO
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductMaterials, setSelectedProductMaterials] = useState([]); // 👈 NOVO ESTADO
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtros, setFiltros] = useState({ status: "", tipo: "" });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [materiasSelecionadas, setMateriasSelecionadas] = useState([]);
  const [novoProduto, setNovoProduto] = useState({ nomeProduto: "", unidadeMedida: "" });
  const [produtos, setProdutos] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [searchMaterial, setSearchMaterial] = useState("");


  // ----- Funções de modal -----
  const openModal = (produto) => {
    setSelectedProduct(produto);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedProduct(null);
    setIsModalOpen(false);
  };

  // 👇 NOVA FUNÇÃO: Abrir modal de matérias-primas
  const openMaterialsModal = async (produto) => {
    setSelectedProduct(produto);

    // Buscar detalhes das matérias-primas do produto
    try {
      const productWithDetails = await fetch(`http://localhost:3000/products/${produto._id}`)
        .then(res => res.json());

      // Processar as matérias-primas para mostrar nome, quantidade e preço
      const materialsWithDetails = await Promise.all(
        productWithDetails.bom.map(async (item) => {
          const materialRes = await fetch(`http://localhost:3000/materials/${item.material._id}`);
          const materialData = await materialRes.json();

          const batchesRes = await fetch(`http://localhost:3000/batches/${item.material._id}`);
          const batches = await batchesRes.json();
          const lastBatch = batches[0];

          return {
            materialId: materialData._id,         // 👈 ADICIONE ESTA LINHA
            nome: materialData.name,
            quantidade: item.qty,
            unidade: materialData.unit,
            precoUnitario: lastBatch ? lastBatch.unitCost : 0,
            custoTotal: (lastBatch ? lastBatch.unitCost : 0) * item.qty
          };
        })
      );


      setSelectedProductMaterials(materialsWithDetails);

      setIsMaterialsModalOpen(true);
    } catch (err) {
      console.error("Erro ao carregar matérias-primas:", err);
    }
  };

  // 👇 NOVA FUNÇÃO: Fechar modal de matérias-primas
  const closeMaterialsModal = () => {
    setSelectedProductMaterials([]);
    setIsMaterialsModalOpen(false);
  };

  const handleInputChange = (e) => {
    setSelectedProduct({ ...selectedProduct, [e.target.name]: e.target.value });
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

  // ----- Colunas da tabela ATUALIZADA -----
  const colunas = [
    { chave: "nome", titulo: "Nome do produto" },
    { chave: "preco", titulo: "Preço" },
    { chave: "materiais", titulo: "Matérias-primas" },
    { chave: "adicionado", titulo: "Adicionado" },
  ];

  // ----- Resto do código permanece igual -----
  const aplicarFiltro = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
    setPaginaAtual(1);
  };

  const handleNovoProdutoChange = (e) => {
    const { name, value } = e.target;
    setNovoProduto(prev => ({ ...prev, [name]: value }));
  };

  const isSalvarHabilitado = () => {
    return novoProduto.nomeProduto.trim() !== "" &&
      materiasSelecionadas.length > 0;
  };

  const openFilterModal = () => setIsFilterModalOpen(true);
  const closeFilterModal = () => setIsFilterModalOpen(false);

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
      doc.text(`${index + 1}. ${p.nome} - ${p.preco}- ${p.adicionado}`, 14, y);
      y += 10;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save("produtos.pdf");
  };

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
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

        {/* Ações (código permanece igual) */}
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
                setPaginaAtual(1);
                setSearchTerm(e.target.value);
              }}
            />
          </div>

          <div className="section-actions-buttons">
            {/* Filtrar, Exportar e Adicionar (código permanece igual) */}
            <button className="section-actions-filter" onClick={openFilterModal}>
              <svg viewBox="0 0 512 512" height="16px">
                <path d="M0 416c0 17.7 14.3 32 32 32l54.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 448c17.7 0 32-14.3 32-32s-14.3-32-32-32l-246.7 0c-12.3-28.3-40.5-48-73.3-48s-61 19.7-73.3 48L32 384c-17.7 0-32 14.3-32 32zm128 0a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM320 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm32-80c-32.8 0-61 19.7-73.3 48L32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l246.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48l54.7 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-54.7 0c-12.3-28.3-40.5-48-73.3-48zM192 128a32 32 0 1 1 0-64 32 32 0 1 1 0 64zm73.3-64C253 35.7 224.8 16 192 16s-61 19.7-73.3 48L32 64C14.3 64 0 78.3 0 96s14.3 32 32 32l86.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 128c17.7 0 32-14.3 32-32s-14.3-32-32-32L265.3 64z"></path>
              </svg>
              <span className="filter-text">Filtrar</span>
            </button>

            {/* Exportar */}
            <button className="section-actions-export" onClick={openExportModal}>
              <Icon icon="solar:export-bold" height="25" />
              <span className="export-text">Exportar</span>
            </button>

            {/* Adicionar produto */}
            <button
              className="stock-add-button"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Icon icon="ion:add" height="30" />
              <p>Adicionar novo produto</p>
            </button>

            {/* Modais de Filtro, Exportação e Adicionar (código permanece igual) */}
            {isFilterModalOpen && (
              <div className="filter-modal-overlay" onClick={closeFilterModal}>
                <div className="filter-modal-content" onClick={(e) => e.stopPropagation()}>
                  <h2>Filtros</h2>
                  <form>
                    <div className="filter-field">
                      <label>Status</label>
                      <select
                        name="status"
                        value={filtros.status}
                        onChange={(e) => aplicarFiltro("status", e.target.value)}
                      >
                        <option value="">Todos</option>
                        <option value="Em estoque">Em estoque</option>
                        <option value="Fora de estoque">Fora de estoque</option>
                        <option value="Pendente">Pendente</option>
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
                    {/* Barra de pesquisa de matérias-primas */}
                    <input
                      type="text"
                      placeholder="Pesquisar matéria-prima..."
                      value={searchMaterial}
                      onChange={(e) => setSearchMaterial(e.target.value)}
                      style={{
                        width: "100%",
                        marginBottom: "1rem",
                        padding: "0.5rem",
                        borderRadius: "4px",
                        border: "1px solid #ccc"
                      }}
                    />

                    {materiais
                      .filter((material) => {
                        // 👇 AGORA CADA ITEM É UM MATERIAL DIRETO, NÃO UM GRUPO
                        return material.name?.toLowerCase().includes(searchMaterial.toLowerCase());
                      })
                      .map((material) => {
                        if (!material) return null;

                        const selecionado = materiasSelecionadas.find(p => p.materialId === material._id);
                        const qty = selecionado?.qty || 0;

                        // Buscar o preço do material (pode vir de diferentes campos)
                        const precoUnitario = material.lastUnitCost || material.unitCost || 0;
                        const total = qty * precoUnitario;

                        return (
                          <div key={material._id} style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
                            <label style={{ width: "150px" }}>{material.name}</label>

                            {/* Input de quantidade */}
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              style={{ width: "80px", marginRight: "5px" }}
                              value={qty}
                              onChange={(e) => {
                                const newQty = Number(e.target.value);
                                setMateriasSelecionadas(prev => {
                                  const other = prev.filter(p => p.materialId !== material._id);
                                  return [...other, { materialId: material._id, qty: newQty }];
                                });
                              }}
                            />

                            {/* Input de unidade - somente leitura */}
                            <input
                              type="text"
                              value={material.unit || ""}
                              readOnly
                              style={{
                                width: "60px",
                                marginRight: "10px",
                                border: "1px solid #ddd",
                                textAlign: "center",
                                borderRadius: '5px'
                              }}
                            />

                            {/* Preço unitário */}
                            <span style={{ marginRight: "10px", color: "#666" }}>
                              R$ {precoUnitario.toFixed(2).replace(".", ",")}
                            </span>

                            {/* Total */}
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

        {/* Tabela ATUALIZADA */}
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
                  <td>{produto.preco}</td>
                  <td>
                    {/* 👇 BOTÃO PARA VER MATÉRIAS-PRIMAS */}
                    <button
                      className="materials-button"
                      onClick={() => openMaterialsModal(produto)}
                      style={{
                        backgroundColor: "#6c6c6cff",
                        color: "#fff",
                        padding: "0.4rem 0rem",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        display: "inline-block",
                        width: "155px",
                        fontWeight: "bold"
                      }}
                    >
                      Ver Matérias-primas
                    </button>
                  </td>
                  <td className="stock-adicionado-td">
                    {produto.adicionado}
                    <span className="stock-tooltip">
                      Editado por último em: {produto.ultimaEdicao || produto.adicionado}
                    </span>
                  </td>
                  <td>
                    <Icon
                      icon="uiw:setting"
                      height="25"
                      color="#676565"
                      style={{ cursor: "pointer" }}
                      onClick={() => openModal(produto)}
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

      {/* 👇 MODAL EDITÁVEL: Versão Corrigida */}
      {isMaterialsModalOpen && selectedProduct && (
        <div className="stock-modal-overlay">
          <div className="stock-modal-content2" style={{ maxWidth: "900px", width: "95vw" }}>
            <div className="modal-header">
              <h2>Gerenciar Matérias-Primas</h2>
              <p className="product-name">{selectedProduct.nome}</p>
            </div>

            {/* Seção para adicionar nova matéria-prima */}
            <div className="add-material-section">
              <h3>Adicionar Material</h3>
              <div className="add-material-controls">
                <select
                  value=""
                  onChange={(e) => {
                    const materialId = e.target.value;
                    if (materialId) {
                      const material = materiais.find(m => m._id === materialId);
                      if (material) {
                        setSelectedProductMaterials(prev => [...prev, {
                          materialId: material._id,
                          nome: material.name,
                          quantidade: 1,
                          unidade: material.unit,
                          precoUnitario: material.lastUnitCost || 0,
                          custoTotal: material.lastUnitCost || 0
                        }]);
                        e.target.value = "";
                      }
                    }
                  }}
                  className="material-select"
                >
                  <option value="">Selecione um material para adicionar...</option>
                  {materiais
                    .filter(material => {
                      // Filtra apenas materiais que NÃO estão na lista atual
                      return !selectedProductMaterials.some(m => m.materialId === material._id);
                    })
                    .map(material => (
                      <option key={material._id} value={material._id}>
                        {material.name} • {material.unit} • R$ {(material.lastUnitCost || 0).toFixed(2)}
                      </option>
                    ))
                  }
                </select>
              </div>
            </div>

            {/* Lista de matérias-primas */}
            <div className="materials-table-container">
              <table className="materials-table">
                <thead>
                  <tr>
                    <th width="40%">Material</th>
                    <th width="15%">Quantidade</th>
                    <th width="15%">Preço Unit.</th>
                    <th width="15%">Total</th>
                    <th width="15%">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProductMaterials.map((material, index) => (
                    <tr key={material.materialId} className="material-row">
                      <td>
                        <div className="material-info">
                          <span className="material-name">{material.nome}</span>
                          <span className="material-unit">{material.unidade}</span>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={material.quantidade}
                          onChange={(e) => {
                            const newQty = Number(e.target.value);
                            const updatedMaterials = [...selectedProductMaterials];
                            updatedMaterials[index] = {
                              ...material,
                              quantidade: newQty,
                              custoTotal: newQty * material.precoUnitario
                            };
                            setSelectedProductMaterials(updatedMaterials);
                          }}
                          className="quantity-input"
                        />
                      </td>
                      <td className="price-cell">
                        R$ {material.precoUnitario.toFixed(2).replace(".", ",")}
                      </td>
                      <td className="total-cell">
                        R$ {material.custoTotal.toFixed(2).replace(".", ",")}
                      </td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remover ${material.nome} do produto?`)) {
                              setSelectedProductMaterials(prev =>
                                prev.filter(m => m.materialId !== material.materialId)
                              );
                            }
                          }}
                          className="remove-btn"
                          title="Remover material"
                        >
                          <Icon icon="mdi:trash" height="18" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedProductMaterials.length === 0 && (
                <div className="empty-state">
                  <Icon icon="mdi:package-variant" height="48" color="#ccc" />
                  <p>Nenhuma matéria-prima adicionada</p>
                </div>
              )}
            </div>

            {/* Resumo */}
            <div className="materials-summary">
              <div className="summary-item">
                <span>Materiais:</span>
                <strong>{selectedProductMaterials.length}</strong>
              </div>
              <div className="summary-item">
                <span>Custo Total:</span>
                <strong className="total-cost">
                  R$ {selectedProductMaterials.reduce((total, material) => total + material.custoTotal, 0).toFixed(2).replace(".", ",")}
                </strong>
              </div>
            </div>

            {/* Ações */}
            <div className="modal-actions">
              <button
                className="btn-cancel"
                type="button"
                onClick={closeMaterialsModal}
              >
                Cancelar
              </button>
              <button
                className="btn-save"
                type="button"
                onClick={async () => {
                  try {
                    const bom = selectedProductMaterials
                      .filter(material => material.quantidade > 0)
                      .map(material => ({
                        material: material.materialId,
                        qty: material.quantidade
                      }));

                    if (bom.length === 0) {
                      alert("Adicione pelo menos uma matéria-prima com quantidade maior que zero.");
                      return;
                    }

                    const response = await fetch(`http://localhost:3000/products/${selectedProduct._id}/bom`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ bom })
                    });

                    if (!response.ok) throw new Error("Erro ao atualizar matérias-primas");

                    const produtoAtualizado = await response.json();
                    setProdutos(prev => prev.map(p =>
                      p._id === selectedProduct._id ? produtoAtualizado : p
                    ));

                    closeMaterialsModal();
                    alert("✅ Matérias-primas atualizadas com sucesso!");
                  } catch (err) {
                    console.error("Erro:", err);
                    alert("❌ Erro ao atualizar matérias-primas");
                  }
                }}
              >
                <Icon icon="mdi:check" height="20" style={{ marginRight: "8px" }} />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edição (código permanece igual) */}
      {isModalOpen && selectedProduct && (
        <div className="stock-modal-overlay">
          <div className="stock-modal-content">
            <button
              className="stock-modal-close"
              type="button"
              onClick={closeModal}
            >
              <Icon icon="mdi:close" height="24" />
            </button>
            <h2>Editar Produto</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                // Faz o PUT no backend apenas com o nome
                const response = await fetch(`http://localhost:3000/products/${selectedProduct._id}`, {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    name: selectedProduct.nome
                  })
                });

                if (!response.ok) {
                  throw new Error("Erro ao atualizar produto");
                }

                const produtoAtualizado = await response.json();

                // Atualiza a lista local de produtos
                setProdutos(prev => prev.map(p =>
                  p._id === selectedProduct._id ? produtoAtualizado : p
                ));

                // Fecha o modal
                closeModal();
                alert("Produto atualizado com sucesso!");
              } catch (err) {
                console.error("Erro ao atualizar produto:", err);
                alert("Erro ao atualizar produto");
              }
            }}>
              {/* Campo NOME (editável) */}
              <div className="stock-modal-field">
                <label>Nome do Produto</label>
                <input
                  type="text"
                  name="nome"
                  value={selectedProduct.nome}
                  onChange={handleInputChange}
                  placeholder="Digite o nome do produto"
                />
              </div>

              {/* Campo PREÇO (somente leitura) */}
              <div className="stock-modal-field">
                <label>Preço</label>
                <input
                  type="text"
                  value={selectedProduct.preco}
                  readOnly
                  style={{ backgroundColor: '#f5f5f5', color: '#666' }}
                />
              </div>

              {/* Campo UNIDADE (somente leitura) */}
              <div className="stock-modal-field">
                <label>Unidade de Medida</label>
                <input
                  type="text"
                  value={selectedProduct.unidade}
                  readOnly
                  style={{ backgroundColor: '#f5f5f5', color: '#666' }}
                />
              </div>

              {/* Campo ADICIONADO (somente leitura) */}
              <div className="stock-modal-field">
                <label>Data de Adição</label>
                <input
                  type="text"
                  value={selectedProduct.adicionado}
                  readOnly
                  style={{ backgroundColor: '#f5f5f5', color: '#666' }}
                />
              </div>

              <div className="stock-modal-actions">
                <button
                  className="stock-modal-delete"
                  type="button"
                  onClick={async () => {
                    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
                      try {
                        // Faz o DELETE no backend
                        await fetch(`http://localhost:3000/products/${selectedProduct._id}`, {
                          method: "DELETE",
                        });
                        // Atualiza a lista local de produtos
                        setProdutos(prev => prev.filter(p => p._id !== selectedProduct._id));
                        // Fecha o modal
                        closeModal();
                        alert("Produto excluído com sucesso!");
                      } catch (err) {
                        console.error("Erro ao excluir produto:", err);
                        alert("Erro ao excluir produto");
                      }
                    }
                  }}
                >
                  Excluir
                </button>
                <button className="stock-modal-save" type="submit">
                  Salvar Alterações
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
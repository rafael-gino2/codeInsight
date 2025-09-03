import { useEffect, useState } from 'react';
import './App.css';
const API = 'http://localhost:3000';

export default function App() {
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [newMat, setNewMat] = useState({ name: '', code: '', unit: 'un', cost: 0 });
  const [newProd, setNewProd] = useState({ name: '', bom: [] });
  const [xmlFile, setXmlFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('materials');

  const loadAll = async () => {
    const [mats, prods] = await Promise.all([
      fetch(`${API}/materials`).then(r => r.json()),
      fetch(`${API}/products`).then(r => r.json()),
    ]);
    setMaterials(mats);
    setProducts(prods);
  };

  useEffect(() => { loadAll(); }, []);

  const addBomItem = () => {
    setNewProd(p => ({ ...p, bom: [...p.bom, { materialId: '', qty: 1 }] }));
  };

  const saveMaterial = async () => {
    if (!newMat.name) return;
    await fetch(`${API}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMat), // já inclui o cost
    });
    setNewMat({ name: '', code: '', unit: 'un', cost: 0 });
    loadAll();
  };


  const saveProduct = async () => {
    if (!newProd.name) return;
    // filtra itens válidos
    const bom = newProd.bom.filter(i => i.materialId && i.qty > 0);
    const created = await fetch(`${API}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProd.name, bom }),
    }).then(r => r.json());
    setNewProd({ name: '', bom: [] });
    loadAll();
    alert(`Produto criado. Custo inicial: R$ ${Number(created?.lastComputedCost || 0).toFixed(2)}`);
  };

  const uploadXml = async () => {
    if (!xmlFile) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('file', xmlFile);
    try {
      const res = await fetch(`${API}/upload/invoice-xml`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar XML');
      alert(`NF importada. Itens detectados: ${data.itemsDetected}`);
    } catch (e) {
      alert(e.message);
    } finally {
      setXmlFile(null);
      setLoading(false);
      loadAll();
    }
  };

  const recompute = async (id) => {
    const r = await fetch(`${API}/products/${id}/cost`).then(r => r.json());
    if (r.cost != null) {
      alert(`Custo atualizado: R$ ${r.cost.toFixed(2)}`);
      loadAll();
    } else {
      alert(r.error || 'Erro');
    }
  };



  return (
    <div className="cost-calculator-app">
      <header className="app-header">
        <h1><i className="icon-calculator"></i> Calculadora de Custo (LIFO)</h1>
        <div className="header-actions">
          <button className="btn-refresh" onClick={loadAll}>
            <i className="icon-refresh"></i> Atualizar Dados
          </button>
        </div>
      </header>

      <div className="upload-section">


        <div className="upload-card">
          <div className="upload-icon">
            <i className="icon-xml"></i>
          </div>
          <div className="upload-content">
            <h3>Lançar Nota Fiscal (XML)</h3>
            <div className="file-upload">
              <label className="file-label">
                <input type="file" accept=".xml" onChange={e => setXmlFile(e.target.files?.[0])} />
                <span className="file-button">{xmlFile ? xmlFile.name : 'Selecionar XML'}</span>
              </label>
              <button className="btn-upload" disabled={!xmlFile || loading} onClick={uploadXml}>
                {loading ? <i className="icon-loading"></i> : <i className="icon-process"></i>}
                {loading ? 'Processando...' : 'Processar NF'}
              </button>
            </div>
            <p className="upload-info">O sistema extrai os itens diretamente do XML da NF-e.</p>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'materials' ? 'active' : ''}`}
            onClick={() => setActiveTab('materials')}
          >
            <i className="icon-materials"></i> Materiais
          </button>
          <button
            className={`tab ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <i className="icon-products"></i> Produtos
          </button>
        </div>

        {activeTab === 'materials' && (
          <div className="tab-content">
            <div className="card">
              <h2>Adicionar Novo Material</h2>
              <div className="form-row">
                <div className="input-group">
                  <label>Nome</label>
                  <input
                    placeholder="Digite o nome do material"
                    value={newMat.name}
                    onChange={e => setNewMat({ ...newMat, name: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Código (opcional)</label>
                  <input
                    placeholder="Código do material"
                    value={newMat.code}
                    onChange={e => setNewMat({ ...newMat, code: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Unidade</label>
                  <input
                    placeholder="Ex: un, kg, m"
                    value={newMat.unit}
                    onChange={e => setNewMat({ ...newMat, unit: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Custo Unitário (R$)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={newMat.cost}
                    onChange={e => setNewMat({ ...newMat, cost: Number(e.target.value) })}
                  />
                </div>
                <button className="btn-primary" onClick={saveMaterial}>
                  <i className="icon-add"></i> Adicionar Material
                </button>
              </div>
            </div>

            <div className="card">
              <h2>Lista de Materiais</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>NCM</th>
                      <th>Unidade</th>
                      <th className="text-right">Último Custo (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map(m => (

                      <tr key={m._id}>
                        <td>{m.name}</td>
                        <td className="text-center">{m.ncm || '-'}</td>
                        <td className="text-center">{m.unit}</td>
                        <td className="text-right">{Number(m.lastUnitCost || 0).toFixed(2)}</td>
                        <td className="text-center">
                          <button
                            className="btn-delete"
                            onClick={async () => {
                              if (!confirm(`Deletar material "${m.name}"?`)) return;
                              await fetch(`${API}/materials/${m._id}`, { method: 'DELETE' });
                              loadAll();
                            }}
                          >
                            🗑️ Deletar
                          </button>
                          <button
                            className="btn-update-cost"
                            onClick={async () => {
                              const newCost = prompt(`Novo custo para ${m.name}:`, m.lastUnitCost);
                              if (newCost != null) {
                                await fetch(`${API}/materials/${m._id}/cost`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ cost: Number(newCost) })
                                });
                                loadAll();
                              }
                            }}
                          >
                            ✏️ Editar Custo
                          </button>
                        </td>

                      </tr>

                    ))}

                  </tbody>
                </table>
                {materials.length === 0 && (
                  <div className="empty-state">
                    <i className="icon-empty"></i>
                    <p>Nenhum material cadastrado</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="tab-content">
            <div className="card">
              <h2>Criar Novo Produto</h2>
              <div className="form-group">
                <label>Nome do Produto</label>
                <input
                  placeholder="Digite o nome do produto"
                  value={newProd.name}
                  onChange={e => setNewProd({ ...newProd, name: e.target.value })}
                />
              </div>

              <div className="bom-header">
                <h3>Lista de Materiais (BOM)</h3>
                <button className="btn-secondary" onClick={addBomItem}>
                  <i className="icon-add"></i> Adicionar Item
                </button>
              </div>

              {newProd.bom.map((it, idx) => (
                <div key={idx} className="bom-row">
                  <div className="form-group">
                    <label>Material</label>
                    <select
                      value={it.materialId}
                      onChange={e => {
                        const v = e.target.value;
                        setNewProd(p => {
                          const bom = [...p.bom]; bom[idx].materialId = v; return { ...p, bom };
                        });
                      }}
                    >
                      <option value="">Selecione um material</option>
                      {materials.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quantidade</label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={it.qty}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setNewProd(p => { const bom = [...p.bom]; bom[idx].qty = v; return { ...p, bom }; });
                      }}
                    />
                  </div>
                </div>
              ))}

              <button className="btn-primary" onClick={saveProduct}>
                <i className="icon-save"></i> Salvar Produto
              </button>
            </div>

            <div className="card">
              <h2>Lista de Produtos</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Materiais (BOM)</th>
                      <th className="text-right">Custo (R$)</th>
                      <th className="text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p._id}>
                        <td className="product-name">{p.name}</td>
                        <td>
                          <div className="bom-list">
                            {(p.bom || []).map(i => (
                              <span key={i.materialId} className="bom-tag">
                                {i.material?.name ?? '??'} x {i.qty}
                              </span>
                            ))}
                            {(!p.bom || p.bom.length === 0) && '-'}
                          </div>
                        </td>
                        <td className="text-right cost-value">R$ {Number(p.lastComputedCost || 0).toFixed(2)}</td>
                        <td className="text-center">
                          <div className="product-actions">
                            <button className="btn-recompute" onClick={() => recompute(p._id)}>
                              <i className="icon-refresh"></i> Recalcular
                            </button>
                            <button
                              className="btn-delete"
                              onClick={async () => {
                                if (!confirm(`Deletar produto "${p.name}"?`)) return;
                                await fetch(`${API}/products/${p._id}`, { method: 'DELETE' });
                                loadAll();
                              }}
                            >
                              🗑️ Deletar
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
                {products.length === 0 && (
                  <div className="empty-state">
                    <i className="icon-empty"></i>
                    <p>Nenhum produto cadastrado</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .cost-calculator-app {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 0;
          max-width: 1200px;
          margin: 0 auto;
          background-color: #ddd4d4ff;
          min-height: 100vh;
        }

        td {
          color #000000ff:
        }

        .app-header {
          background: linear-gradient(135deg, #2c3e50 0%, #4a6491 100%);
          color: white;
          padding: 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .app-header h1 {
          margin: 0;
          font-size: 1.8rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .header-actions {
          display: flex;
          gap: 1rem;
        }

        .btn-refresh {
          background-color: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: background-color 0.2s;
        }

        .btn-refresh:hover {
          background-color: rgba(255, 255, 255, 0.3);
        }

        .upload-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          padding: 2rem;
        }

        @media (max-width: 768px) {
          .upload-section {
            grid-template-columns: 1fr;
          }
        }

        .upload-card {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          display: flex;
          gap: 1rem;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .upload-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .upload-icon {
          font-size: 2rem;
          color: #4a6491;
        }

        .upload-content {
          flex: 1;
        }

        .upload-content h3 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
        }

        .upload-content p {
          margin: 0 0 1rem 0;
          color: #7a7a7a;
          font-size: 0.9rem;
        }

        .code-text {
          font-family: monospace;
          background-color: #f3f4f6;
          padding: 0.1rem 0.3rem;
          border-radius: 3px;
          font-size: 0.85rem;
        }

        .file-upload {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .file-label {
          flex: 1;
        }

        .file-label input[type="file"] {
          display: none;
        }

        .file-button {
          display: block;
          padding: 0.5rem 1rem;
          background-color: #f3f4f6;
          border: 1px dashed #d1d5db;
          border-radius: 4px;
          text-align: center;
          cursor: pointer;
          font-size: 0.9rem;
          color: #6b7280;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .btn-upload {
          background-color: #4a6491;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 0.5rem 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          transition: background-color 0.2s;
        }

        .btn-upload:hover:not(:disabled) {
          background-color: #3a5379;
        }

        .btn-upload:disabled {
          background-color: #9ca3af;
          cursor: not-allowed;
        }

        .upload-info {
          font-size: 0.8rem;
          color: #9ca3af;
          margin: 0;
        }

        .main-content {
          padding: 0 2rem 2rem 2rem;
        }

        .tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 1.5rem;
          gap: 20px;
        }

        .tab {
          background: none;
          border: none;
          padding: 0.75rem 1.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }


        .tab.active {
          border-bottom-color: #4a6491;
          font-weight: 500;
        }

        .card {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          margin-bottom: 1.5rem;
        }

        .card h2 {
          margin: 0 0 1.5rem 0;
          color: #2c3e50;
          font-size: 1.3rem;
        }

        // .form-row {
        //   display: grid;
        //   grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        //   gap: 1rem;
        //   margin-bottom: 1rem;
        // }

        .input-group {
          display: flex;
          flex-direction: column;
        }

        .input-group label {
          font-size: 0.85rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
          color: #374151;
        }

        .input-group input {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.9rem;
          background-color: #d1d5db;
          color: black;
        }

        .btn-primary {
          background-color: #d1d5db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 0.75rem 1.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
          transition: background-color 0.2s;
          align-self: flex-end;
        }

        .btn-primary:hover {
          background-color: #3a5379;
        }

        .table-container {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead th {
          background-color: #f9fafb;
          padding: 0.75rem;
          text-align: left;
          font-weight: 500;
          color: #000000ff;
          border-bottom: 1px solid #e5e7eb;
        }

        tbody td {
          padding: 0.75rem;
          border-bottom: 1px solid #f3f4f6;
        }

        tbody tr:hover {
          background-color: #f9fafb;
        }

        .text-right {
          text-align: right;
        }

        .text-center {
          text-align: center;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #9ca3af;
        }

        .empty-state i {
          font-size: 2rem;
          margin-bottom: 0.5rem;
          display: block;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          margin-bottom: 1rem;
        }

        .form-group label {
          font-size: 0.85rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
          color: #374151;
        }

        .form-group input,
        .form-group select {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.9rem;
          color: #374151;
          background-color:#d1d5db;
        }

        .bom-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 1.5rem 0 1rem 0;
        }

        .bom-header h3 {
          margin: 0;
          color: #2c3e50;
          font-size: 1.1rem;
        }

        .btn-secondary {
          background-color: #e5e7eb;
          color: #374151;
          border: none;
          border-radius: 4px;
          padding: 0.5rem 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          transition: background-color 0.2s;
        }

        .btn-secondary:hover {
          background-color: #d1d5db;
        }

        .bom-row {
          display: grid;
          grid-template-columns: 1fr 120px;
          gap: 1rem;
          margin-bottom: 1rem;
          padding: 1rem;
          background-color: #f9fafb;
          border-radius: 4px;
        }

        .bom-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .bom-tag {
          background-color: #e5e7eb;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.85rem;
        }

        .product-name {
          font-weight: 500;
          color: #2c3e50;
        }

        .cost-value {
          font-weight: 500;
          color: #059669;
        }

        .btn-recompute {
          background-color: #f3f4f6;
          color: #374151;
          border: none;
          border-radius: 4px;
          padding: 0.25rem 0.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.8rem;
          transition: background-color 0.2s;
        }

        .btn-recompute:hover {
          background-color: #e5e7eb;
        }

        /* Ícones (usando pseudo-elementos para simular ícones) */
        .icon-calculator:before { content: '📊'; }
        .icon-refresh:before { content: '🔄'; }
        .icon-excel:before { content: '📝'; }
        .icon-xml:before { content: '📄'; }
        .icon-upload:before { content: '⬆️'; }
        .icon-process:before { content: '⚙️'; }
        .icon-loading:before { content: '⏳'; }
        .icon-materials:before { content: '📦'; }
        .icon-products:before { content: '🏭'; }
        .icon-add:before { content: '➕'; }
        .icon-save:before { content: '💾'; }
        .icon-empty:before { content: '😴'; }
      `}</style>
    </div>
  );
}
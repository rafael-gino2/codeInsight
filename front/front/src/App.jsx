import { useEffect, useState } from 'react';

const API = 'http://localhost:3000';

export default function App() {
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [newMat, setNewMat] = useState({ name: '', code: '', unit: 'un' });
  const [newProd, setNewProd] = useState({ name: '', bom: [] });
  const [excelFile, setExcelFile] = useState(null);
  const [xmlFile, setXmlFile] = useState(null);
  const [loading, setLoading] = useState(false);

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
      body: JSON.stringify(newMat),
    });
    setNewMat({ name: '', code: '', unit: 'un' });
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

  const uploadExcel = async () => {
    if (!excelFile) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('file', excelFile);
    await fetch(`${API}/upload/initial-excel`, { method: 'POST', body: fd })
      .then(r => r.json()).then(j => alert(j.ok ? 'Planilha importada' : j.error));
    setExcelFile(null);
    setLoading(false);
    loadAll();
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
    <div style={{ fontFamily: 'Inter, system-ui, Arial', padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1>Calculadora de Custo (LIFO)</h1>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
          <h2>Importação Inicial (Excel)</h2>
          <p>Colunas esperadas: <code>material_code, name, unit, qty, unit_cost, date</code></p>
          <input type="file" accept=".xlsx,.xls" onChange={e => setExcelFile(e.target.files?.[0])} />
          <button disabled={!excelFile || loading} onClick={uploadExcel} style={{ marginLeft: 8 }}>
            {loading ? 'Enviando...' : 'Enviar'}
          </button>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
          <h2>Lançar Nota Fiscal (XML)</h2>
          <input type="file" accept=".xml" onChange={e => setXmlFile(e.target.files?.[0])} />
          <button disabled={!xmlFile || loading} onClick={uploadXml}>
            {loading ? 'Processando...' : 'Processar NF'}
          </button>

          <p style={{ fontSize: 12, color: '#666' }}>O sistema extrai os itens diretamente do XML da NF-e.</p>
        </div>

      </section>

      <section style={{ marginTop: 24, border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
        <h2>Materiais</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder="Nome" value={newMat.name} onChange={e => setNewMat({ ...newMat, name: e.target.value })} />
          <input placeholder="Código (opcional)" value={newMat.code} onChange={e => setNewMat({ ...newMat, code: e.target.value })} />
          <input placeholder="Unidade" value={newMat.unit} onChange={e => setNewMat({ ...newMat, unit: e.target.value })} style={{ width: 80 }} />
          <button onClick={saveMaterial}>Adicionar</button>
        </div>

        <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Nome</th>
              <th>Código</th>
              <th>Unidade</th>
              <th align="right">Último Custo (R$)</th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => (
              <tr key={m._id} style={{ borderTop: '1px solid #eee' }}>
                <td>{m.name}</td>
                <td align="center">{m.code || '-'}</td>
                <td align="center">{m.unit}</td>
                <td align="right">{Number(m.lastUnitCost || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>

        </table>
      </section>

      <section style={{ marginTop: 24, border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
        <h2>Produtos (Ficha Técnica)</h2>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr auto' }}>
          <input placeholder="Nome do produto" value={newProd.name} onChange={e => setNewProd({ ...newProd, name: e.target.value })} />
          <button onClick={addBomItem}>+ Item</button>
        </div>
        {newProd.bom.map((it, idx) => (
          <div key={idx} style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 120px', marginTop: 8 }}>
            <select value={it.materialId} onChange={e => {
              const v = e.target.value;
              setNewProd(p => {
                const bom = [...p.bom]; bom[idx].materialId = v; return { ...p, bom };
              });
            }}>
              <option value="">-- selecione material --</option>
              {materials.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
            <input type="number" min="0" step="0.0001" value={it.qty}
              onChange={e => {
                const v = Number(e.target.value);
                setNewProd(p => { const bom = [...p.bom]; bom[idx].qty = v; return { ...p, bom }; });
              }} />
          </div>
        ))}
        <div style={{ marginTop: 8 }}>
          <button onClick={saveProduct}>Salvar Produto</button>
        </div>

        <h3 style={{ marginTop: 16 }}>Lista</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th align="left">Produto</th><th align="left">BOM</th><th align="right">Custo (cache)</th><th></th></tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p._id} style={{ borderTop: '1px solid #eee' }}>
                <td>{p.name}</td>
                <td>
                  {(p.bom || []).map(i => `${i.material?.name ?? '??'} x ${i.qty}`).join(' + ') || '-'}
                </td>
                <td align="right">R$ {Number(p.lastComputedCost || 0).toFixed(2)}</td>
                <td align="right"><button onClick={() => recompute(p._id)}>Recalcular</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

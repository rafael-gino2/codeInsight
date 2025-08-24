import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import multer from 'multer';
import xml2js from 'xml2js'; // novo
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const upload = multer({ dest: 'uploads/' });

/* ---------- MongoDB Atlas ---------- */
const { MONGODB_URI, PORT = 3000 } = process.env;
if (!MONGODB_URI) {
  console.error('Defina MONGODB_URI no .env');
  process.exit(1);
}
await mongoose.connect(MONGODB_URI);

/* ---------- Schemas ---------- */
const MaterialSchema = new mongoose.Schema({
  code: { type: String, index: true },
  name: { type: String, required: true },
  unit: { type: String, default: 'un' },
}, { timestamps: true });

const BatchSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  qty: { type: Number, required: true },              // quantidade comprada
  unitCost: { type: Number, required: true },         // R$/unidade
  remainingQty: { type: Number, required: true },     // para LIFO
  date: { type: Date, required: true },
  invoiceRef: { type: String },                       // número NF
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  bom: [{
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
    qty: { type: Number, required: true }             // consumo por unidade de produto
  }],
  lastComputedCost: { type: Number, default: 0 },     // cache
  lastComputedAt: { type: Date }
}, { timestamps: true });

const InvoiceSchema = new mongoose.Schema({
  number: String,
  issueDate: Date,
  supplierCNPJ: String,
  lines: [{
    materialName: String,
    materialCode: String,
    qty: Number,
    unitCost: Number,
    total: Number
  }],
  rawText: String
}, { timestamps: true });

const Material = mongoose.model('Material', MaterialSchema);
const Batch = mongoose.model('Batch', BatchSchema);
const Product = mongoose.model('Product', ProductSchema);
const Invoice = mongoose.model('Invoice', InvoiceSchema);

/* ---------- Helpers ---------- */

// BRL "1.234,56" -> 1234.56
const parseBRLNumber = (s) => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  // remove tudo exceto dígitos, ponto e vírgula
  const clean = String(s).replace(/[^\d.,-]/g, '');
  // se tem vírgula, ela é decimal
  if (clean.includes(',')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(clean);
};

const pickDate = (text) => {
  // tenta formatos brasileiros comuns
  const m1 = text.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  if (m1) {
    const [_, d, m, y] = m1;
    return new Date(`${y}-${m}-${d}T00:00:00-03:00`);
  }
  return new Date();
};

const lifoCost = async (materialId, requiredQty) => {
  // consome lotes do mais recente para o mais antigo
  let remaining = requiredQty;
  let cost = 0;

  const cursor = Batch.find({ material: materialId, remainingQty: { $gt: 0 } })
    .sort({ date: -1, _id: -1 })
    .cursor();

  for (let doc = await cursor.next(); doc && remaining > 0; doc = await cursor.next()) {
    const take = Math.min(doc.remainingQty, remaining);
    cost += take * doc.unitCost;
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error('Estoque insuficiente para LIFO (matéria-prima sem saldo).');
  }
  return cost; // custo total para a qty pedida
};

const lifoConsume = async (materialId, requiredQty) => {
  // igual ao lifoCost, porém atualiza remainingQty (uso se quiser “baixar” consumo)
  let remaining = requiredQty;
  let cost = 0;

  const batches = await Batch.find({ material: materialId, remainingQty: { $gt: 0 } })
    .sort({ date: -1, _id: -1 });

  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.remainingQty, remaining);
    cost += take * b.unitCost;
    b.remainingQty -= take;
    remaining -= take;
    await b.save();
  }
  if (remaining > 0) throw new Error('Estoque insuficiente.');
  return cost;
};

const computeProductCost = async (productId) => {
  const p = await Product.findById(productId).populate('bom.material');
  if (!p) throw new Error('Produto não encontrado.');
  let total = 0;
  for (const item of p.bom) {
    const bomQty = item.qty;
    const bomUnit = item.material.unit; // unidade do material
    const mat = item.material;

    let requiredQty = bomQty;
    if (mat.unit !== 'un') {
      try {
        requiredQty = convertUnit(bomQty, 'un', mat.unit); // considera que BOM está em "un"
      } catch (e) {
        console.warn(`Erro de conversão de unidade para material ${mat.name}: ${e.message}`);
      }
    }

    total += await lifoCost(mat._id, requiredQty);

  }
  p.lastComputedCost = total;
  p.lastComputedAt = new Date();
  await p.save();
  return total;
};

// Recalcula produtos impactados por materiais afetados (simples e direto)
const recomputeImpactedProducts = async (materialIds) => {
  const products = await Product.find({ 'bom.material': { $in: materialIds } });
  for (const prod of products) {
    try { await computeProductCost(prod._id); } catch (e) { /* ignora erro de estoque */ }
  }
};

/* ---------- ROTAS ---------- */

// 1) Importação inicial por Excel (planilha base de matérias-primas e histórico)
app.post('/upload/initial-excel', upload.single('file'), async (req, res) => {
  try {
    const wb = xlsx.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

    // Espera colunas: material_code, name, unit, qty, unit_cost, date(DD/MM/YYYY)
    const touchedMaterials = new Set();

    for (const r of rows) {
      const code = String(r.material_code || '').trim() || undefined;
      const name = String(r.name || '').trim();
      if (!name) continue;
      const unit = String(r.unit || 'un').trim();
      const qty = Number(r.qty || 0);
      const unitCost = parseBRLNumber(r.unit_cost);
      const date = pickDate(String(r.date || ''));

      let mat = await Material.findOne(code ? { code } : { name });
      if (!mat) {
        mat = await Material.create({ code, name, unit });
      }

      const b = await Batch.create({
        material: mat._id,
        qty,
        unitCost,
        remainingQty: qty,
        date,
        invoiceRef: 'PLANILHA-INICIAL'
      });
      touchedMaterials.add(mat._id.toString());
    }

    await recomputeImpactedProducts([...touchedMaterials]);

    fs.unlinkSync(req.file.path);
    res.json({ ok: true, message: 'Planilha importada.' });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/upload/invoice-xml', upload.single('file'), async (req, res) => {
  try {
    const xmlData = fs.readFileSync(req.file.path, 'utf-8');
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] });
    const result = await parser.parseStringPromise(xmlData);


    // NF-e geralmente está em result.nfeProc.NFe.infNFe
    const infNFe = result?.nfeProc?.NFe?.infNFe
      || result?.NFe?.infNFe
      || result?.infNFe;

    if (!infNFe) throw new Error('Estrutura XML NF-e não reconhecida');


    const number = infNFe?.ide?.nNF || 'SEM_NUMERO';
    const issueDate = pickDate(infNFe?.ide?.dhEmi || infNFe?.ide?.dEmi || '');
    const supplierCNPJ = infNFe?.emit?.CNPJ || '';

    const det = Array.isArray(infNFe?.det) ? infNFe.det : [infNFe.det];
    const lines = det.map(d => {
      const prod = d?.prod || {};
      return {
        materialName: prod.xProd?.trim().slice(0, 120) || 'SEM_NOME',
        materialCode: prod.cProd?.trim() || '',
        qty: parseBRLNumber(prod.qCom),
        unitCost: parseBRLNumber(prod.vUnCom),
        total: parseBRLNumber(prod.vProd),
        unit: prod.uCom?.trim().toLowerCase() || 'un' // <- aqui capturamos a unidade
      };
    });

    const invoice = await Invoice.create({
      number, supplierCNPJ, issueDate, lines, rawText: xmlData
    });

    const touched = new Set();
    for (const it of lines) {
      if (!it.materialName || !it.qty || !it.unitCost) continue;
      let mat = await Material.findOne({ code: it.materialCode });
      if (!mat) mat = await Material.findOne({ name: it.materialName });
      if (!mat) {
        mat = await Material.create({ name: it.materialName, code: it.materialCode, unit: it.unit });
      }


      await Batch.create({
        material: mat._id,
        qty: it.qty,
        unitCost: it.unitCost,
        remainingQty: it.qty,
        date: issueDate,
        invoiceRef: number
      });
      touched.add(mat._id.toString());
    }

    await recomputeImpactedProducts([...touched]);
    fs.unlinkSync(req.file.path);

    res.json({ ok: true, invoiceId: invoice._id, itemsDetected: lines.length });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, error: e.message });
  }
});

// 3) Materiais (CRUD básico)
app.get('/materials', async (_req, res) => {
  const items = await Material.find().sort({ name: 1 });
  const result = [];

  for (const m of items) {
    // Pega o último lote do material (LIFO)
    const lastBatch = await Batch.findOne({ material: m._id }).sort({ date: -1, _id: -1 });
    result.push({
      _id: m._id,
      name: m.name,
      code: m.code,
      unit: m.unit,
      lastUnitCost: lastBatch?.unitCost || 0
    });
  }

  res.json(result);
});

app.post('/materials', async (req, res) => {
  try {
    const { code, name, unit, cost, qty } = req.body;

    // cria material
    let m = await Material.create({ code, name, unit });

    // se o usuário informou custo (e opcionalmente qtd)
    if (cost != null && !isNaN(cost)) {
      const q = qty && qty > 0 ? qty : 1; // se não informar, assume 1
      await Batch.create({
        material: m._id,
        qty: q,
        unitCost: cost,
        remainingQty: q,
        date: new Date(),
        invoiceRef: 'MANUAL'
      });
    }

    // recalcula produtos que dependem desse material
    await recomputeImpactedProducts([m._id]);

    res.json(m);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// 4) Produtos (BOM) e custo
app.get('/products', async (_req, res) => {
  const items = await Product.find().populate('bom.material');
  res.json(items);
});
app.post('/products', async (req, res) => {
  // body: { name, bom: [{ materialId, qty }] }
  const { name, bom } = req.body;
  const bomNorm = (bom || []).map(i => ({ material: i.materialId, qty: Number(i.qty) }));
  const p = await Product.create({ name, bom: bomNorm });
  // calcula custo inicial
  try { await computeProductCost(p._id); } catch { }
  const populated = await Product.findById(p._id).populate('bom.material');
  res.json(populated);
});
app.get('/products/:id/cost', async (req, res) => {
  try {
    const cost = await computeProductCost(req.params.id);
    res.json({ productId: req.params.id, cost });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// 5) Estoque/Lotes (para auditoria rápida)
app.get('/batches/:materialId', async (req, res) => {
  const batches = await Batch.find({ material: req.params.materialId }).sort({ date: -1, _id: -1 });
  res.json(batches);
});

app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));

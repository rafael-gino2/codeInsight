import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import multer from 'multer';
import xml2js from 'xml2js';
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
  ncm: { type: String, index: true },  // <- aqui
  code: { type: String, index: true },
  name: { type: String, required: true },
  unit: { type: String, default: 'un' },
}, { timestamps: true });


const BatchSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  qty: { type: Number, required: true },
  unitCost: { type: Number, required: true },
  remainingQty: { type: Number, required: true, default: function () { return this.qty } },
  date: { type: Date, required: true },
  invoiceRef: { type: String },
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  bom: [{
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
    qty: { type: Number, required: true }
  }],
  lastComputedCost: { type: Number, default: 0 },
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
const parseBRLNumber = (s) => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const clean = String(s).replace(/[^\d.,-]/g, '');
  if (clean.includes(',')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(clean);
};

const pickDate = (text) => {
  const m1 = text.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  if (m1) {
    const [_, d, m, y] = m1;
    return new Date(`${y}-${m}-${d}T00:00:00-03:00`);
  }
  return new Date();
};

// só calcula custo sem mexer no estoque
const lifoCost = async (materialId, requiredQty) => {
  let remaining = Number(requiredQty.toFixed(6));
  let cost = 0;

  const batches = await Batch.find({ material: materialId, remainingQty: { $gt: 0 } })
    .sort({ date: -1, _id: -1 });

  for (let b of batches) {
    if (remaining <= 1e-6) break;
    const take = Math.min(b.remainingQty, remaining);
    cost += take * b.unitCost;
    remaining = Number((remaining - take).toFixed(6));
  }

  if (remaining > 1e-6) {
    throw new Error('Estoque insuficiente para LIFO (matéria-prima sem saldo).');
  }
  return cost;
};

// realmente consome o estoque
const lifoConsume = async (materialId, requiredQty) => {
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

  // filtra apenas materiais existentes
  const validBOM = p.bom.filter(item => item.material != null);

  for (const item of validBOM) {
    const mat = item.material;
    const bomQty = item.qty;

    const lastBatch = await Batch.findOne({ material: mat._id }).sort({ date: -1, _id: -1 });
    const unitCost = lastBatch?.unitCost || 0;

    total += bomQty * unitCost;
  }

  p.lastComputedCost = total;
  p.lastComputedAt = new Date();
  await p.save();
  return total;
};



// Recalcula produtos impactados por materiais
const recomputeImpactedProducts = async (materialIds) => {
  const products = await Product.find({ 'bom.material': { $in: materialIds } });
  for (const prod of products) {
    try { await computeProductCost(prod._id); } catch { }
  }
};

/* ---------- ROTAS ---------- */

// 1) Upload Excel inicial
app.post('/upload/initial-excel', upload.single('file'), async (req, res) => {
  try {
    const wb = xlsx.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
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

      await Batch.create({
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

// 2) Upload XML NF-e
app.post('/upload/invoice-xml', upload.single('file'), async (req, res) => {
  try {
    const xmlData = fs.readFileSync(req.file.path, 'utf-8');
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] });
    const result = await parser.parseStringPromise(xmlData);

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
        ncm: prod.NCM?.trim() || '',   // 👈 capturar NCM
        qty: parseBRLNumber(prod.qCom),
        unitCost: parseBRLNumber(prod.vUnCom),
        total: parseBRLNumber(prod.vProd),
        unit: prod.uCom?.trim().toLowerCase() || 'un'
      };
    });


    const invoice = await Invoice.create({ number, supplierCNPJ, issueDate, lines, rawText: xmlData });
    const touched = new Set();

    for (const it of lines) {
      if (!it.materialName || !it.qty || !it.unitCost) continue;

      let mat = null;

      if (it.ncm) {
        mat = await Material.findOne({ ncm: it.ncm });
      }

      if (!mat && it.code) {
        mat = await Material.findOne({ code: it.code });
      }

      if (!mat) {
        mat = await Material.findOne({ name: it.materialName });
      }

      if (!mat) {
        // cria novo material com esse NCM
        mat = await Material.create({
          ncm: it.ncm,
          code: it.materialCode,
          name: it.materialName,
          unit: it.unit
        });
      } else {
        // se já existir, pode atualizar o nome para o mais recente
        if (it.materialName && mat.name !== it.materialName) {
          mat.name = it.materialName;
          await mat.save();
        }
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

// 3) Materiais CRUD
app.get('/materials', async (_req, res) => {
  const items = await Material.find().sort({ name: 1 });
  const result = [];
  for (const m of items) {
    const lastBatch = await Batch.findOne({ material: m._id }).sort({ date: -1, _id: -1 });
    result.push({
      _id: m._id,
      name: m.name,
      code: m.code,
      ncm: m.ncm,  // 👈
      unit: m.unit,
      lastUnitCost: lastBatch?.unitCost || 0
    });

  }
  res.json(result);
});

app.post('/materials', async (req, res) => {
  try {
    const { code, name, unit, cost, qty } = req.body;
    let m = await Material.create({ code, name, unit });
    if (cost != null && !isNaN(cost)) {
      const q = qty && qty > 0 ? qty : 1;
      await Batch.create({ material: m._id, qty: q, unitCost: cost, remainingQty: q, date: new Date(), invoiceRef: 'MANUAL' });
    }
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
  const { name, bom } = req.body;
  const bomNorm = (bom || []).map(i => ({ material: i.materialId, qty: Number(i.qty) }));
  const p = await Product.create({ name, bom: bomNorm });
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

/* ---------- Deletar Material ---------- */
app.delete('/materials/:id', async (req, res) => {
  try {
    const matId = req.params.id;
    await Material.findByIdAndDelete(matId);
    await Batch.deleteMany({ material: matId });

    // remove o material da BOM de todos os produtos
    await Product.updateMany(
      { 'bom.material': matId },
      { $pull: { bom: { material: matId } } }
    );

    await recomputeImpactedProducts([matId]);
    res.json({ ok: true, message: 'Material deletado e produtos atualizados.' });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});


/* ---------- Atualizar Último Custo do Material ---------- */
app.put('/materials/:id/cost', async (req, res) => {
  try {
    const { cost, qty } = req.body;
    const matId = req.params.id;
    if (cost == null) throw new Error('Informe o custo.');
    const q = qty && qty > 0 ? qty : 1;

    await Batch.create({
      material: matId,
      qty: q,
      remainingQty: q,
      unitCost: cost,
      date: new Date(),
      invoiceRef: 'MANUAL-UPDATE'
    });

    await recomputeImpactedProducts([matId]);
    res.json({ ok: true, message: 'Último custo atualizado.' });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/* ---------- Deletar Produto ---------- */
app.delete('/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ ok: true, message: 'Produto deletado.' });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});


// 5) Estoque/Lotes
app.get('/batches/:materialId', async (req, res) => {
  const batches = await Batch.find({ material: req.params.materialId }).sort({ date: -1, _id: -1 });
  res.json(batches);
});


app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));

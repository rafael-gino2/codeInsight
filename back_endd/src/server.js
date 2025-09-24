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
import PDFParser from "pdf2json";
import { execFile } from "child_process";
import { fileURLToPath } from "url";


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
  ncm: { type: String, index: true },
  code: { type: String, index: true },
  name: { type: String, required: true },
  unit: { type: String, default: 'un' },
  isOfficial: { type: Boolean, default: false },
  tipo: { type: String },      // 👈 adicionado
  possuiNF: { type: Boolean }, // 👈 adicionado
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

async function computeProductCost(productId) {
  const product = await Product.findById(productId).populate("bom.material");
  if (!product) throw new Error("Produto não encontrado");

  let custoTotal = 0;

  for (const item of product.bom) {
    const material = item.material;
    console.log("Processando material:", material?.name, "quantidade:", item.qty); // 👈

    if (!material) continue;

    const batch = await Batch.findOne({ material: material._id }).sort({ date: -1 });
    if (!batch) {
      console.log("Nenhum lote encontrado para material:", material.name); // 👈
      continue;
    }

    const custo = batch.unitCost * item.qty;
    console.log(`Custo do material ${material.name}: ${custo}`); // 👈
    custoTotal += custo;
  }

  product.lastComputedCost = custoTotal;
  product.lastComputedAt = new Date();
  await product.save();
  console.log("Custo total do produto salvo:", custoTotal); // 👈

  return custoTotal;
}

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

      let mat = await Material.findOne({ ncm: it.ncm, name: it.materialName });

      if (!mat) {
        const jaTemOficial = await Material.findOne({ ncm: it.ncm, isOfficial: true });

        mat = await Material.create({
          ncm: it.ncm,
          code: it.materialCode,
          name: it.materialName,
          unit: it.unit,
          isOfficial: !jaTemOficial // 👈 só o primeiro do NCM vira oficial
        });
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// caminho absoluto do parser_pdf.py
const scriptPath = path.join(__dirname, "parser_pdf.py");

// 2) Upload PDF NF-e (DANFE)
app.post("/upload/invoice-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) throw new Error("Nenhum arquivo enviado");

    const filePath = req.file.path;

    // Chama o script Python com caminho absoluto
    execFile("python", [scriptPath, filePath], async (err, stdout, stderr) => {
      if (err) {
        console.error("Erro no parser_pdf.py:", err, stderr);
        return res.status(400).json({ ok: false, error: "Erro ao processar PDF" });
      }

      let products;
      try {
        products = JSON.parse(stdout);
      } catch (parseErr) {
        console.error("Erro ao converter saída do Python:", parseErr, stdout);
        return res.status(400).json({ ok: false, error: "Erro na saída do parser" });
      }

      // cria invoice igual ao XML
      const invoice = await Invoice.create({
        number: "SEM_NUMERO",
        supplierCNPJ: "",
        issueDate: new Date(),
        lines: products,
        rawText: ""
      });

      // cadastra materiais/lotes
      const touched = new Set();
      for (const it of products) {
        if (!it.materialName || !it.unitCost) continue;

        let mat =
          (await Material.findOne({ code: it.materialCode })) ||
          (await Material.findOne({ name: it.materialName }));

        if (!mat) {
          mat = await Material.create({
            code: it.materialCode,
            name: it.materialName,
            unit: it.unit || "un"
          });
        }

        await Batch.create({
          material: mat._id,
          qty: it.qty,
          unitCost: it.unitCost,
          remainingQty: it.qty,
          date: new Date(),
          invoiceRef: invoice.number
        });

        touched.add(String(mat._id));
      }

      await recomputeImpactedProducts([...touched]);

      fs.unlinkSync(filePath);

      return res.json({
        ok: true,
        invoiceId: invoice._id,
        itemsDetected: products.length,
        preview: products.slice(0, 20)
      });
    });
  } catch (e) {
    console.error("Erro geral /upload/invoice-pdf:", e);
    return res.status(400).json({ ok: false, error: e.message });
  }
});



// 3) Materiais CRUD
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

app.put('/materials/:id/set-official', async (req, res) => {
  try {
    const mat = await Material.findById(req.params.id);
    if (!mat) return res.status(404).json({ error: "Material não encontrado" });

    // zera todos do mesmo grupo
    await Material.updateMany(
      { ncm: mat.ncm },
      { $set: { isOfficial: false } }
    );

    // define o atual como oficial
    mat.isOfficial = true;
    await mat.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Erro no set-official:", err);
    res.status(500).json({ error: "Erro ao atualizar oficialidade" });
  }
});

app.put("/materials/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ncm, unit, tipo, possuiNF, isOfficial, code } = req.body;

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (ncm !== undefined) updateFields.ncm = ncm;
    if (unit !== undefined) updateFields.unit = unit;
    if (tipo !== undefined) updateFields.tipo = tipo;
    if (possuiNF !== undefined) updateFields.possuiNF = possuiNF;
    if (isOfficial !== undefined) updateFields.isOfficial = isOfficial;
    if (code !== undefined) updateFields.code = code;

    const material = await Material.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );

    if (!material) {
      return res.status(404).json({ error: "Material não encontrado" });
    }

    res.json(material);
  } catch (err) {
    console.error("Erro ao atualizar material:", err);
    res.status(500).json({ error: "Erro ao atualizar material" });
  }
});


// rota para cadastrar manualmente uma matéria-prima
app.post('/materials/manual', async (req, res) => {
  try {
    const { name, ncm, unit, unitCost, tipo } = req.body;

    if (!name || !ncm || !unit || !unitCost) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, ncm, unit, unitCost' });
    }

    // cria material
    const material = await Material.create({
      name,
      ncm,
      unit,
      isOfficial: true
    });

    // cria lote inicial com a data de hoje
    await Batch.create({
      material: material._id,
      qty: 0, // 👈 pode começar sem estoque
      unitCost,
      remainingQty: 0,
      date: new Date(),
      invoiceRef: "manual"
    });

    res.status(201).json(material);
  } catch (err) {
    console.error("Erro ao cadastrar manualmente:", err);
    res.status(500).json({ error: 'Erro ao cadastrar matéria-prima manualmente' });
  }
});


app.get('/materials', async (req, res) => {
  try {
    const all = await Material.aggregate([
      {
        $lookup: {
          from: "batches",
          localField: "_id",
          foreignField: "material",
          as: "batches"
        }
      },
      {
        $addFields: {
          lastUnitCost: { $ifNull: [{ $last: "$batches.unitCost" }, 0] }
        }
      }
    ]);

    const grouped = {};
    all.forEach(m => {
      const key = m.ncm || "SEM_NCM";

      if (!grouped[key]) {
        grouped[key] = { principal: null, variacoes: [] };
      }

      if (m.isOfficial) {
        // só define se ainda não tem principal
        if (!grouped[key].principal) {
          grouped[key].principal = m;
        } else {
          // se já existe, joga como variação (evita "sumir")
          grouped[key].variacoes.push(m);
        }
      } else {
        grouped[key].variacoes.push(m);
      }
    });

    // fallback: se não houver oficial, promove o primeiro da lista
    const result = Object.values(grouped).map(g => {
      if (!g.principal && g.variacoes.length > 0) {
        g.principal = g.variacoes[0];
        g.variacoes = g.variacoes.slice(1);
      }
      return g;
    });

    res.json(result);
  } catch (err) {
    console.error("Erro no /materials:", err);
    res.status(500).json({ error: "Erro ao carregar materiais" });
  }
});


// 4) Produtos (BOM) e custo
app.get('/products', async (_req, res) => {
  const items = await Product.find().populate('bom.material');

  const formatted = items.map(prod => {
    const preco = prod.lastComputedCost?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";
    const now = new Date().toLocaleDateString("pt-BR");

    return {
      _id: prod._id,
      nome: prod.name,
      preco,
      unidade: "un",
      tipo: "Produto",
      status: "Em estoque",
      adicionado: prod.createdAt ? new Date(prod.createdAt).toLocaleDateString("pt-BR") : now,
      ultimaEdicao: prod.updatedAt ? new Date(prod.updatedAt).toLocaleDateString("pt-BR") : now,
      bom: prod.bom
    };
  });

  res.json(formatted);
});


app.post("/products", async (req, res) => {
  try {
    const { name, bom } = req.body;
    console.log("Dados recebidos para novo produto:", req.body); // 👈

    const prod = await Product.create({ name, bom });
    console.log("Produto criado no MongoDB:", prod); // 👈

    const custo = await computeProductCost(prod._id);
    console.log("Custo calculado:", custo); // 👈

    res.json({
      _id: prod._id,
      nome: prod.name,
      preco: custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      unidade: "un",
      tipo: "Produto",
      status: "Em estoque",
      adicionado: new Date().toLocaleDateString("pt-BR"),
      ultimaEdicao: new Date().toLocaleDateString("pt-BR"),
      bom
    });
  } catch (err) {
    console.error("Erro ao criar produto:", err);
    res.status(400).json({ error: err.message });
  }
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

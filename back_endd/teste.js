import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/Calculadora';

await mongoose.connect(MONGODB_URI);

const MaterialSchema = new mongoose.Schema({ name: String });
const Material = mongoose.model('Material', MaterialSchema);

const doc = await Material.create({ name: 'Teste' });
console.log('Documento inserido:', doc);

mongoose.disconnect();

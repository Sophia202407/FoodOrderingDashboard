// test-db.js
import { connectDB, getCollection } from './db.js';

await connectDB();

const menus = getCollection('menus');
const sample = await menus.find({}).toArray();
console.log('📄 Sample menus:', sample);

// cache.js
import { createClient } from 'redis';

const client = createClient();

client.on('error', (err) => console.error('❌ Redis error:', err));

await client.connect();
console.log('✅ Connected to Redis');

// Set popular items
export async function setTopMenus(menus) {
  await client.set('topMenus', JSON.stringify(menus));
  console.log('📝 Top menus cached in Redis');
}

// Get popular items
export async function getTopMenus() {
  const data = await client.get('topMenus');
  return data ? JSON.parse(data) : [];
}

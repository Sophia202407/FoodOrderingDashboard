// test-cache.js
import { setTopMenus, getTopMenus } from './cache.js';

await setTopMenus(["Classic Burger", "Fried Chicken", "Cheese Fries", "Spicy Ramen", "Fried Dumplings"]);

const cachedMenus = await getTopMenus();
console.log('📦 Cached Top Menus:', cachedMenus);

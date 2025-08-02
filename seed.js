// seed.js
import { connectDB, getCollection } from './db.js';

await connectDB();

const menus = getCollection('menus');
const users = getCollection('users');

// Sample menu
await menus.insertMany([
  {
    restaurant: "Burger Bros",
    items: [
      { name: "Classic Burger", price: 5.99 },
      { name: "Cheese Fries", price: 2.99 },
      { name: "Fried Chicken", price: 6.49 },
    ]
  },
  {
    restaurant: "Noodle Nest",
    items: [
      { name: "Spicy Ramen", price: 7.99 },
      { name: "Fried Dumplings", price: 4.50 }
    ]
  }
]);

// Sample users
await users.insertMany([
  { userId: "u123", name: "Alice" },
  { userId: "u456", name: "Bob" }
]);

console.log('✅ Sample menus and users inserted.');

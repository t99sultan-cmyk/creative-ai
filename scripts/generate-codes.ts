import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from "dotenv";
import { promoCodes } from '../src/db/schema';

// Load environment variables
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error("Использование: npx tsx scripts/generate-codes.ts <количество_кодов> <количество_импульсов>");
    console.error("Пример: npx tsx scripts/generate-codes.ts 10 50");
    process.exit(1);
  }

  const count = parseInt(args[0], 10);
  const impulses = parseInt(args[1], 10);

  if (isNaN(count) || count <= 0) {
    console.error("Количество кодов должно быть положительным числом.");
    process.exit(1);
  }

  if (isNaN(impulses) || impulses <= 0) {
    console.error("Количество импульсов должно быть положительным числом.");
    process.exit(1);
  }

  console.log(`Генерация ${count} промокодов на ${impulses} Импульсов...`);

  const codesToInsert = [];
  
  for (let i = 0; i < count; i++) {
    // Generate a code like: KASPI-XXXX-YYYY
    const codeStr = `KASPI-${generateRandomCode(4)}-${generateRandomCode(4)}`;
    codesToInsert.push({
      code: codeStr,
      impulses: impulses,
      isUsed: false,
    });
  }

  try {
    await db.insert(promoCodes).values(codesToInsert);
    console.log("Успешно созданы следующие коды:");
    console.log("-------------------------------------------------");
    codesToInsert.forEach((c) => {
      console.log(`${c.code}  ->  ${c.impulses} Импульсов`);
    });
    console.log("-------------------------------------------------");
    console.log("Скопируйте эти коды и выдавайте клиентам после оплаты.");
  } catch (err) {
    console.error("Ошибка при добавлении кодов в базу данных:", err);
  }

  process.exit(0);
}

main();

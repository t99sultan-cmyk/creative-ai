import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
async function run() {
  const models = await genAI.getModels();
  console.log(models.map(m => m.name));
}
run();

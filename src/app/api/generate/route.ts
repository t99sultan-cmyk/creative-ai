import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { creatives, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    const { prompt, format, isAnimated, referenceImagesBase64, productImagesBase64 } = await request.json();
    const hasProducts = productImagesBase64 && productImagesBase64.length > 0;
    const cost = isAnimated ? 4 : 3;

    // Check user balance
    const userRecords = await db.select({ impulses: users.impulses }).from(users).where(eq(users.id, userId));
    const currentImpulses = userRecords[0]?.impulses || 0;
    if (currentImpulses < cost) {
       return new Response(JSON.stringify({ error: "Недостаточно импульсов на балансе. Пожалуйста, пополните счет." }), { status: 400 });
    }

    // Improved System instruction for elite Generative UI generation
    const systemPrompt = `You are an absolute elite, award-winning Frontend Developer & UI/UX Designer.
Your task is to generate an incredibly beautiful, modern, and production-ready HTML document representing an ADVERTISEMENT BANNER / CREATIVE based on the user's request.

CRITICAL INSTRUCTIONS (FAILURE IS NOT AN OPTION):
1. Return ONLY raw HTML code. NO markdown formatting (\`\`\`html), NO explanations. Just start with <!DOCTYPE html> and end with </html>.
2. Single File: All HTML, CSS (<style>), and JS (<script>) must be in one file.
3. Libraries: 
   - ALWAYS include Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>.
   - ALWAYS use modern Google Fonts via CDN. Include them in the <head>.
   - Use FontAwesome or GSAP via CDN if needed.
4. STRICT BAN ON SOCIAL MEDIA UI:
   - You are generating the ACTUAL BANNER/CREATIVE graphic, NOT a mock-up of an Instagram post.
   - DO NOT include fake Instagram elements like "Fit_studio", user avatars, "Подробнее" buttons, like/comment buttons, or any social media UI frames. The result MUST be pure promotional banner content.
5. Colors & Layout: Adapt to the prompt. Give it deep modern aesthetics, smooth shadows, professional typography. Target aspect ratio is ${format}. The main wrapper MUST take up 100vh and 100vw seamlessly.
6. ${isAnimated ? 
  "ANIMATION REQUIRED: The user requested an ANIMATED creative. Use robust CSS keyframes or GSAP to make the text and elements fly in, slide, or scale beautifully." : 
  "STRICT BAN ON ANIMATION: The user requested a STATIC image. DO NOT use any CSS animations, transitions, or GSAP. The output must be a perfectly static scene."}
7. Images & Products (CRITICAL FOR SUCCESS): 
   - "Reference Images": strictly for layout, color, and vibe inspiration. DO NOT link to them.
   - 🔴 LAW OF THE REFERENCE: You MUST strictly interpret the visual tone and color scheme of the reference image! If the reference is a "Light/White" design, you MUST generate a light background and dark text. If it is "Dark/Neon", you MUST generate a dark background. Do not guess!
   - "Product Images": you MUST visually integrate these EXACT cut-out images into the final banner code (if provided).
   - CREATIVE LAYOUT (OVERLAYS ALLOWED): You CAN and SHOULD use highly creative typography positioning! Text can elegantly overlap product images. Feel free to use \`absolute\` positioning, severe negative margins, and overlapping elements to create deep 3D compositing. However, if text overlaps an image, you MUST ensure it remains 100% readable by applying heavy text shadows, glows, or background gradients behind the text. TEXT MUST ALWAYS BE ON TOP (use high z-index)! Do not let images hide text!
   - TYPOGRAPHY & LONG WORDS: NEVER break or chop words in the middle! Do NOT use \`break-words\` or \`break-all\`. To prevent long words from overflowing horizontally, use smaller dynamic typography (\`text-2xl\` or \`text-3xl\`), use \`text-balance\`, and add generous side padding. Headings must fit naturally.
   - 🔴 LAW OF THE ASPECT RATIO: Your generated HTML structure MUST NOT OVERFLOW. Use exactly \`h-screen w-[100vw] overflow-hidden flex flex-col\` on the main container. If format is "1:1", you must ignore any conflicting hints in the user prompt and ALWAYS output a perfect square. Ensure the bottom is physically visible.
   ${format === '9:16' 
   ? `- VIRAL REELS/STORIES STRUCTURE (CRITICAL 9:16): 
     1. THE HOOK (TOP): Place a punchy 3-4 word title (AIDA formula) at the very TOP to break banner blindness. It MUST be an Instagram-style pill (e.g., \`bg-black/80 backdrop-blur rounded-full px-5 py-2 text-white border border-white/20\`). You MUST include a CSS-animated emoji (e.g., smoothly bouncing 🔥, 🚀).
     2. THE CENTER: Leave the center of the screen mostly empty so the PERSON/PRODUCT image can stand out clearly.
     3. THE CAPTIONS (BOTTOM): Place descriptions/subtitles in the BOTTOM THIRD. They MUST be in ALL CAPS. Emulate the "Captions" or "CapCut" app style: ultra-bold text, heavy drop-shadows (\`drop-shadow-2xl\`). 
   `
   : `- FEED AD (1:1 SQUARE) STRUCTURE:
     1. SQUARE LAYOUT: Since the width and height are equal, use a strong Grid or Flex layout. You can place the product on the right and text on the left, OR use a bold center composition.
     2. THE HOOK: Make the main heading massive and highly visible. You MUST include a CSS-animated emoji.
     3. READABILITY: Ensure the text block has a beautiful dark underlay or heavy text-shadows so it's readable over any background.
   `}
   
   - DYNAMIC TEXT HIGHLIGHTS & ANIMATIONS (CRITICAL FOR ALL):
     1. YELLOW HIGHLIGHTS: Regardless of the format, you MUST highlight several key power words (5-7 words max) in a bright YELLOW color (\`text-yellow-400\`) in the main headings/captions.
     2. WORD-BY-WORD ANIMATION: If 'isAnimated' is true, text MUST NOT fade in all at once. Animate captions WORD-BY-WORD or line-by-line appearing smoothly (e.g. using CSS animation delays on \`<span style="animation-delay: ...s">\`), so the viewer reads them naturally.
   
   ${hasProducts 
     ? `- IMAGE PLACEMENT & FRAMING (CRITICAL): If the design has A LOT of text (bullet points, long descriptions), DO NOT use the product/person image as a full-screen background! It will get completely buried under text cards and look terrible. Instead, give the image its own dedicated structural space: place it inside a sleek rounded frame (\`rounded-2xl\`, \`shadow-2xl\`), a stylish circular avatar, or a distinct top/bottom block so it proudly stands out alongside the text!
   - DYNAMIC SCALING: You can scale images gracefully (e.g. \`scale-110\`) and use \`object-cover\`, \`object-top\` to crop beautifully. BUT DO NOT use excessive scaling that pushes the image out of bounds. All animations must settle perfectly on-screen.
   - HOW TO USE PRODUCTS: Since you cannot output binary data, you MUST use placeholders for the \`src\` attributes. Use the EXACT strings: \`PRODUCT_IMG_0\` for the first product, \`PRODUCT_IMG_1\` for the second. 
   - Example: \`<img src="PRODUCT_IMG_0" alt="Product" class="h-64 w-auto object-contain drop-shadow-2xl">\`
   - IF YOU FAIL TO ADD \`PRODUCT_IMG_0\`, THE PRODUCT WILL NOT APPEAR.`
     : `- NO PRODUCTS PROVIDED: The user did NOT upload any product images. DO NOT create any empty image blocks, placeholders, or <img> tags for products. Focus 100% of the layout on beautiful typography, background shapes, gradients, and text content.`
   }`;

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-pro-preview",
      systemInstruction: systemPrompt,
    });

    const parts: any[] = [];
    parts.push({ text: `Format required: ${format}.\n\nTask (ТЗ): ${prompt}` });

    // Handle references
    if (referenceImagesBase64 && Array.isArray(referenceImagesBase64) && referenceImagesBase64.length > 0) {
      parts.push({ text: "Here are REFERENCE IMAGES for atmosphere, style, and layout. Recreate this vibe/quality:" });
      for (const imgUrl of referenceImagesBase64) {
        let mimeType = "image/jpeg";
        let data = imgUrl;
        const match = imgUrl.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          data = match[2];
        }
        parts.push({ inlineData: { mimeType, data } });
      }
    }

    // Handle actual products
    if (productImagesBase64 && Array.isArray(productImagesBase64) && productImagesBase64.length > 0) {
      parts.push({ text: "Here are the actual PRODUCT IMAGES without backgrounds. You MUST use these exact images in the HTML creative as graphical assets:" });
      for (const imgUrl of productImagesBase64) {
        let mimeType = "image/png"; // Usually PNG due to cut-out
        let data = imgUrl;
        const match = imgUrl.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          data = match[2];
        }
        parts.push({ inlineData: { mimeType, data } });
      }
    }

    const result = await model.generateContent(parts);
    const rawText = result.response.text();
    
    // Clean up if the model magically returns markdown
    let code = rawText.trim();
    const match = code.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (match) {
      code = match[1];
    }

    // Replace placeholders with real Base64 data
    if (productImagesBase64 && Array.isArray(productImagesBase64)) {
      productImagesBase64.forEach((imgBase64, index) => {
        // Handle all occurrences of PRODUCT_IMG_X
        const searchPattern = new RegExp(`PRODUCT_IMG_${index}`, 'g');
        code = code.replace(searchPattern, imgBase64);
      });
    }

    // Deduct Balance and Save to History Bank
    const creativeId = crypto.randomUUID();
    if (userId) {
      await db.update(users)
        .set({ impulses: currentImpulses - cost })
        .where(eq(users.id, userId));

      await db.insert(creatives).values({
        id: creativeId,
        userId,
        prompt,
        format,
        cost,
        htmlCode: code,
      });
    }

    return new Response(
      JSON.stringify({ code, creativeId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error('Gemini Error:', error);
    return Response.json({ error: error.message || 'Error generating content' }, { status: 500 });
  }
}

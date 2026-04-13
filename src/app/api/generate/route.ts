import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { creatives, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const maxDuration = 60; // Allow Vercel functions to run up to 60s

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

    const userRecords = await db.select({ impulses: users.impulses, isBanned: users.isBanned }).from(users).where(eq(users.id, userId));
    let currentImpulses = 0;
    
    if (userRecords.length > 0 && userRecords[0].isBanned) {
       return new Response(JSON.stringify({ error: "Ваш аккаунт заблокирован по решению администратора." }), { status: 403 });
    }
    
    if (userRecords.length === 0) {
      const clerkUser = await currentUser();
      if (clerkUser) {
        const email = clerkUser.emailAddresses[0]?.emailAddress || "unknown";
        await db.insert(users).values({
          id: userId,
          email: email,
          name: clerkUser.firstName || "User",
          image: clerkUser.imageUrl || "",
          impulses: 17,
        });
        currentImpulses = 17;
      }
    } else {
      currentImpulses = userRecords[0].impulses || 0;
    }

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
   - ALWAYS use modern Google Fonts via CDN.
   - Use GSAP for animations if isAnimated is true.
4. STRICT BAN ON SOCIAL MEDIA UI:
   - Generate the ACTUAL promotional banner. DO NOT include fake Instagram UI (no comments, no avatars).

5. BEAUTIFUL LAYOUT & HIGH CONTRAST (CRITICAL):
   - You have FULL CREATIVE FREEDOM to make it look stunning, just like you would on Gemini Canvas.
   - 🔴 BUILD ROBUST LAYOUTS: DO NOT rely on haphazard absolute positioning that causes text to overlap with other elements. USE modern CSS Flexbox and CSS Grid. Create structured layouts where elements flow naturally.
   - 🔴 PREVENT OVERLAPS (CRITICAL): Never let text, badges, or images overlap making things unreadable. Use flex gaps (\`gap-4\`) and proper padding.
   - Ensure the outer container is bounded: \`max-w-[400px] h-[100vh]\` for 9:16 vertical layouts.
   - Inject these global CSS rules into your \`<style>\` to lock the viewport: \`html, body { width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; background-position: center; background-size: cover; }\`. Your main container wrapper inside body MUST naturally expand or flex without pushing items out of bounds.

6. FORMAT SPECIFICS:
   - The user requested aspect ratio: ${format}.
   - If 9:16: Make it vertical like a story. Keep the hook/title at the top, center empty for visuals/product, and heavily stylized captions at the bottom.
   - If 1:1: Make it a perfect square.

7. ANIMATIONS (${isAnimated ? 'ON' : 'OFF'}):
   - ${isAnimated ? 'You MUST animate the typography and elements beautifully using CSS keyframes or GSAP.' : 'NO animations. Output must be perfectly static.'}

8. HIGHLIGHTS & PRODUCT INTEGRATION:
   - Highlight 3-5 power words in a vibrant color (like text-yellow-400 or a gradient).
   ${hasProducts ? `- PRODUCT IMAGES: You MUST visually integrate these EXACT cut-out images. Use placeholders \`PRODUCT_IMG_0\`, \`PRODUCT_IMG_1\`. Example: \`<img src="PRODUCT_IMG_0" alt="Product" class="...">\`` : '- NO PRODUCTS PROVIDED. Focus 100% on beautiful typography and background.'}
`;

    const geminiParts: any[] = [];
    geminiParts.push({ text: `Format required: ${format}.\n\nTask (ТЗ): ${prompt}` });

    // Handle references
    if (referenceImagesBase64 && Array.isArray(referenceImagesBase64) && referenceImagesBase64.length > 0) {
      geminiParts.push({ text: "Here are REFERENCE IMAGES for atmosphere, style, and layout. Recreate this vibe/quality:" });
      for (const imgUrl of referenceImagesBase64) {
        let mimeType = "image/jpeg";
        let data = imgUrl;
        if (data.startsWith("data:")) {
           mimeType = data.split(";")[0].split(":")[1];
           data = data.split(",")[1];
        }
        geminiParts.push({
          inlineData: { mimeType, data }
        });
      }
    }

    // Handle actual products
    if (productImagesBase64 && Array.isArray(productImagesBase64) && productImagesBase64.length > 0) {
      geminiParts.push({ text: "Here are the actual PRODUCT IMAGES without backgrounds. You MUST use these exact images in the HTML creative as graphical assets:" });
      for (const imgUrl of productImagesBase64) {
        let mimeType = "image/png";
        let data = imgUrl;
        if (data.startsWith("data:")) {
           mimeType = data.split(";")[0].split(":")[1];
           data = data.split(",")[1];
        }
        geminiParts.push({
          inlineData: { mimeType, data }
        });
      }
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is missing");

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: geminiParts }],
          generationConfig: {
             maxOutputTokens: 8192,
             temperature: 0.7,
          }
       })
    });

    if (!geminiResponse.ok) {
        const errPayload = await geminiResponse.text();
        throw new Error(`Gemini API error: ${errPayload}`);
    }

    const result = await geminiResponse.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Calculate API Cost in KZT (Formula adapted for Gemini 3.1 Pro placeholder pricing: 1.25$ in / 5.00$ out per MTok. 1 USD = 480 KZT)
    let apiCostKzt = 0;
    if (result.usageMetadata) {
       const inTokens = result.usageMetadata.promptTokenCount || 0;
       const outTokens = result.usageMetadata.candidatesTokenCount || 0;
       const usdCost = (inTokens / 1_000_000) * 1.25 + (outTokens / 1_000_000) * 5.00;
       apiCostKzt = usdCost * 480;
       console.log(`[API Cost] Gemini 3.1 Pro Usage: ${inTokens} in, ${outTokens} out = $${usdCost.toFixed(4)} (~${apiCostKzt.toFixed(2)} KZT)`);
    }

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
        prompt: prompt,
        format,
        cost: cost,
        apiCostKzt: apiCostKzt,
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
    console.error('Claude API Error:', error);
    return Response.json({ error: error.message || 'Error generating content via Claude' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from "@/db";
import { users, creatives } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
       return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    const { prompt, isAnimated, format, referenceImagesBase64, productImagesBase64, remixHtmlCode } = await req.json();
    
    const cost = 3;
    let currentImpulses = 0;

    const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRecords.length === 0) {
      const resp = await fetch("https://api.clerk.com/v1/users/" + userId, {
        headers: { Authorization: "Bearer " + process.env.CLERK_SECRET_KEY }
      });
      if (resp.ok) {
        const clerkUser = await resp.json();
        await db.insert(users).values({
          id: userId,
          email: clerkUser.email_addresses[0].email_address,
          name: clerkUser.first_name || "Пользователь",
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
4. STRICT BAN ON SOCIAL MEDIA UI & EXTERNAL BUTTONS:
   - Generate the ACTUAL promotional banner. DO NOT include fake Instagram UI (no comments, no avatars).
   - DO NOT generate external link buttons like "Подробнее", "Узнать подробнее", or "Перейти", because social media ad platforms natively overlay their own link buttons over the creative.

5. BEAUTIFUL LAYOUT & HIGH CONTRAST (CRITICAL):
   - You have FULL CREATIVE FREEDOM to make it look stunning.
   - 🔴 BUILD ROBUST LAYOUTS: DO NOT rely on haphazard absolute positioning that causes text to overlap with other elements. USE modern CSS Flexbox and CSS Grid. Create structured layouts where elements flow naturally.
   - 🔴 PREVENT OVERLAPS & TIGHT SPACING (CRITICAL): Never let text, badges, checkmarks, or list items overlap with or tightly hug the central graphics/products! Always use generous padding (\`p-4\`), margins (\`m-4\`), and rich flex/grid gaps (\`gap-6\` or \`gap-8\`). Elements placed around a central visual MUST be pushed outwards so they maintain clean, breathable white space around the visual.
   - Ensure the outer container is bounded: \`max-w-[400px] h-[100vh]\` for 9:16 vertical layouts.
   - Inject these global CSS rules into your \`<style>\` to lock the viewport: \`html, body { width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; background-position: center; background-size: cover; }\`. Your main container wrapper inside body MUST naturally expand or flex without pushing items out of bounds.

6. FORMAT SPECIFICS:
   - The user requested aspect ratio: ${format}.
   - If 9:16: Make it vertical like a story. Keep the hook/title at the top, center empty for visuals/product, and heavily stylized captions at the bottom.
   - If 1:1: Make it a perfect square.

7. ANIMATIONS (${isAnimated ? 'ON' : 'OFF'}):
   - ${isAnimated ? 'You MUST animate the typography and elements beautifully using CSS keyframes or GSAP. Ensure all animations have `yoyo: true, repeat: -1` so the video loops seamlessly.' : 'NO animations. Output must be ONE perfectly static visual poster/picture. DO NOT USE ANY ANIMATIONS, GSAP, or KEYFRAMES. You are designing a flat graphic image.'}

8. HIGHLIGHTS & PRODUCT INTEGRATION:
   - Highlight 3-5 power words in a vibrant color (like text-yellow-400 or a gradient).
   ${productImagesBase64 && productImagesBase64.length > 0 ? `- PRODUCT IMAGES: You MUST visually integrate these EXACT cut-out images. Use placeholders \`PRODUCT_IMG_0\`, \`PRODUCT_IMG_1\`. Example: \`<img src="PRODUCT_IMG_0" alt="Product" class="...">\`` : '- NO PRODUCTS PROVIDED. Focus 100% on beautiful typography and background.'}
`;

    const claudeContent: any[] = [];
    
    if (remixHtmlCode) {
      claudeContent.push({ 
        type: "text", 
        text: `Format required: ${format}.\n\nOriginal Task (ТЗ): ${prompt}\n\nIMPORTANT: THIS IS A REMIX REQUEST! The user wants to modify an existing creative.\nBelow is the previous HTML code. RE-USE this structure completely. Keep the layout, core vibe, and animations identical, but make the changes requested by the user. Return the fully updated HTML code:\n\n\`\`\`html\n${remixHtmlCode}\n\`\`\`` 
      });
    } else {
      claudeContent.push({ type: "text", text: `Format required: ${format}.\n\nTask (ТЗ): ${prompt}` });
    }

    // Handle references
    if (referenceImagesBase64 && Array.isArray(referenceImagesBase64) && referenceImagesBase64.length > 0) {
      claudeContent.push({ type: "text", text: "Here are REFERENCE IMAGES for atmosphere, style, and layout. Recreate this vibe/quality:" });
      for (const imgUrl of referenceImagesBase64) {
        let mimeType = "image/jpeg";
        let data = imgUrl;
        if (data.startsWith("data:")) {
           mimeType = data.split(";")[0].split(":")[1];
           data = data.split(",")[1];
        }
        claudeContent.push({
          type: "image",
          source: { type: "base64", media_type: mimeType, data: data }
        });
      }
    }

    // Handle actual products
    if (productImagesBase64 && Array.isArray(productImagesBase64) && productImagesBase64.length > 0) {
      claudeContent.push({ type: "text", text: "Here are the actual PRODUCT IMAGES without backgrounds. You MUST use these exact images in the HTML creative as graphical assets:" });
      for (const imgUrl of productImagesBase64) {
        let mimeType = "image/png";
        let data = imgUrl;
        if (data.startsWith("data:")) {
           mimeType = data.split(";")[0].split(":")[1];
           data = data.split(",")[1];
        }
        claudeContent.push({
          type: "image",
          source: { type: "base64", media_type: mimeType, data: data }
        });
      }
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is missing");

    const claudeResponse = await fetch(`https://api.anthropic.com/v1/messages`, {
       method: "POST",
       headers: { 
         "Content-Type": "application/json",
         "x-api-key": anthropicApiKey,
         "anthropic-version": "2023-06-01"
       },
       body: JSON.stringify({
          model: "claude-opus-4-7",
          system: systemPrompt,
          max_tokens: 8192,
          messages: [{ role: "user", content: claudeContent }]
       })
    });

    if (!claudeResponse.ok) {
        const errPayload = await claudeResponse.text();
        throw new Error(`Claude API error: ${errPayload}`);
    }

    const result = await claudeResponse.json();
    const rawText = result.content?.[0]?.text || "";
    
    // Calculate API Cost (Placeholder for Claude 3.7 Sonnet: 3$ in / 15$ out per MTok. 1 USD = 480 KZT)
    let apiCostKzt = 0;
    if (result.usage) {
       const inTokens = result.usage.input_tokens || 0;
       const outTokens = result.usage.output_tokens || 0;
       const usdCost = (inTokens / 1_000_000) * 3.00 + (outTokens / 1_000_000) * 15.00;
       apiCostKzt = usdCost * 480;
       console.log(`[API Cost] Claude Usage: ${inTokens} in, ${outTokens} out = $${usdCost.toFixed(4)} (~${apiCostKzt.toFixed(2)} KZT)`);
    }

    // Clean up if the model magically returns markdown
    let code = rawText.trim();
    const match = code.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (match) {
      code = match[1];
    }

    // Replace placeholders with real Base64 data
    if (productImagesBase64 && Array.isArray(productImagesBase64)) {
      productImagesBase64.forEach((imgBase64: string, index: number) => {
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

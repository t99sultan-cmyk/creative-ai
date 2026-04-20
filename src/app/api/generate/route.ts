import { NextResponse } from 'next/server';
import { db } from "@/db";
import { users, creatives } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";
import { checkGenerateRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-guard";

export const maxDuration = 300;

// ---- Input validation limits ----
// These protect Claude-budget and API-call size.
const MAX_PROMPT_LEN = 4000; // chars
const MAX_REF_IMAGES = 4;
const MAX_PRODUCT_IMAGES = 4;
// Claude accepts base64 up to ~5 MB per image; we cap per-request total.
const MAX_TOTAL_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB across all images
// Raw remix HTML can carry several MB of embedded base64 product images.
// We strip those out below (base64Regex → REMIX_PRESERVED_IMG_N) before
// sending to Claude, so the effective Claude payload is small. This cap is
// just a sanity check on the raw request.
const MAX_REMIX_HTML_LEN = 10_000_000; // chars

function approxBase64Bytes(dataUrlOrBase64: string): number {
  if (typeof dataUrlOrBase64 !== "string") return 0;
  const idx = dataUrlOrBase64.indexOf(",");
  const b64 = idx >= 0 ? dataUrlOrBase64.slice(idx + 1) : dataUrlOrBase64;
  // base64 -> bytes: length * 3/4, minus padding
  return Math.floor((b64.length * 3) / 4);
}

export async function POST(req: Request) {
  // `deductedCost` is read in the catch block for refund. It must be declared
  // outside the try so it's in scope there. We set it > 0 only AFTER a
  // successful atomic deduct, so a pre-deduct failure never triggers refund.
  let deductedUserId: string | null = null;
  let deductedCost = 0;
  try {
    const { userId } = await auth();
    if (!userId) {
       return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    const body = await req.json();
    const { prompt, isAnimated, format, referenceImagesBase64, productImagesBase64, remixHtmlCode, remixScreenshotBase64, strictClone } = body;

    // ---- Input validation ----
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Промпт не может быть пустым." }), { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_LEN) {
      return new Response(
        JSON.stringify({ error: `Промпт слишком длинный (${prompt.length} симв., максимум ${MAX_PROMPT_LEN}).` }),
        { status: 400 }
      );
    }
    if (format !== "9:16" && format !== "1:1") {
      return new Response(JSON.stringify({ error: "Неверный формат. Ожидается 9:16 или 1:1." }), { status: 400 });
    }
    const refs = Array.isArray(referenceImagesBase64) ? referenceImagesBase64 : [];
    const prods = Array.isArray(productImagesBase64) ? productImagesBase64 : [];
    if (refs.length > MAX_REF_IMAGES) {
      return new Response(JSON.stringify({ error: `Максимум ${MAX_REF_IMAGES} референсных изображений.` }), { status: 400 });
    }
    if (prods.length > MAX_PRODUCT_IMAGES) {
      return new Response(JSON.stringify({ error: `Максимум ${MAX_PRODUCT_IMAGES} фото продукта.` }), { status: 400 });
    }
    let totalImgBytes = 0;
    for (const img of [...refs, ...prods]) totalImgBytes += approxBase64Bytes(img);
    if (remixScreenshotBase64) totalImgBytes += approxBase64Bytes(remixScreenshotBase64);
    if (totalImgBytes > MAX_TOTAL_IMAGE_BYTES) {
      return new Response(
        JSON.stringify({
          error: `Слишком большой объём изображений (${(totalImgBytes / 1024 / 1024).toFixed(1)} МБ). Максимум ${(MAX_TOTAL_IMAGE_BYTES / 1024 / 1024).toFixed(0)} МБ.`,
        }),
        { status: 413 }
      );
    }
    if (typeof remixHtmlCode === "string" && remixHtmlCode.length > MAX_REMIX_HTML_LEN) {
      return new Response(
        JSON.stringify({ error: `Слишком большой HTML в remix-контексте (${remixHtmlCode.length} симв.).` }),
        { status: 413 }
      );
    }

    // ---- Rate limit (admins bypass) ----
    const adminBypass = await isAdmin();
    if (!adminBypass) {
      const rl = await checkGenerateRateLimit(userId);
      if (!rl.ok) {
        return new Response(
          JSON.stringify({ error: rateLimitMessage(rl), rateLimit: rl }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(rl.retryAfterSec),
            },
          }
        );
      }
    }

    const cost = 3;

    // ---- Lazy-create the user row on first generation (from Clerk). ----
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
      }
    }

    // ---- Atomic deduct-upfront (fixes race condition on concurrent requests). ----
    // We UPDATE with a DB-side `impulses - cost` expression AND a WHERE guard
    // that only matches when the current balance is still >= cost. If two
    // requests race, only one WHERE matches; the other gets an empty result
    // and we reject with 400 BEFORE spending real money on the Claude API.
    //
    // If the Claude call (or anything below) fails, the catch block at the
    // bottom refunds `deductedCost` back to the user.
    const deducted = await db.update(users)
      .set({ impulses: sql`${users.impulses} - ${cost}` })
      .where(and(eq(users.id, userId), gte(users.impulses, cost)))
      .returning({ impulses: users.impulses });

    if (deducted.length === 0) {
      return new Response(
        JSON.stringify({ error: "Недостаточно импульсов на балансе. Пожалуйста, пополните счет." }),
        { status: 400 }
      );
    }

    deductedUserId = userId;
    deductedCost = cost;

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

5. BEAUTIFUL LAYOUT & BRANDING AWARENESS (CRITICAL):
   - You have FULL CREATIVE FREEDOM to make it look stunning.
   - 🔴 NO UNREQUESTED CLIP ART: DO NOT hallucinate or generate literal SVG/emoji representations of brand names! If the brand is "Золотое Яблоко", do NOT draw literal apples. If it's "Tiger", do not draw a tiger. Your visual decorations should be abstract, geometric, elegant, CSS gradients, or typography-focused. The user's provided PRODUCT IMAGES are the ONLY real-world objects you should display.
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

${strictClone ? `9. STRICT CLONE MODE [CRITICAL]:
- EXACT ALIGNMENT & SPACING: You MUST copy the exact spatial layout, padding, and proportions of the reference image. The spacing (breathing room) around the visual and text must be identical to the reference.
- OVERLAPPING ELEMENTS: If the reference has elements (like floating badges, pills, or buttons) that overlap the boundary between an image and the background, you MUST perfectly replicate this overlap using CSS (e.g., absolute positioning, 'translate-y-[-50%]', 'z-index'). Do NOT let 'overflow-hidden' clip them off. Do not cramp them.
- EXACT COLORS & TYPOGRAPHY: You MUST strictly use the exact color palette (backgrounds, fonts, accents) and font weights seen in the reference image. DO NOT hallucinate new colors based on the product.
- Your job is to output HTML/CSS that produces a 1:1 structural copy of the reference with only the product and text swapped out.` : `9. CREATIVE FREEDOM:
- REPLICATE STRUCTURE: Carefully look at how elements (images, text, buttons) are positioned in the reference image and replicate that structural layout. DO NOT randomly scatter products.
- CHANGE CONTEXT & VIBE: You have full freedom to modify the color palette, typography style, and background decorations to perfectly match the theme/brand requested by the user, while keeping the structural skeleton of the reference.`}
`;

    const claudeContent: any[] = [];
    
    // Base64 Extract for Rate Limits
    const preservedImages: string[] = [];
    let cleanedRemixHtmlCode = remixHtmlCode;
    
    if (cleanedRemixHtmlCode) {
      // Find all huge base64 strings in data:image payload to prevent token explosion
      const base64Regex = /data:image\/[^"']+/g;
      
      cleanedRemixHtmlCode = cleanedRemixHtmlCode.replace(base64Regex, (match: string) => {
        const id = preservedImages.length;
        preservedImages.push(match);
        return `REMIX_PRESERVED_IMG_${id}`;
      });
      
      claudeContent.push({ 
        type: "text", 
        text: `Format required: ${format}.\n\nOriginal Task (ТЗ): ${prompt}\n\nIMPORTANT: THIS IS A REMIX REQUEST! The user wants to modify an existing creative.\nBelow is the previous HTML code. RE-USE this structure completely. Keep the layout, core vibe, and animations identical, but make the changes requested by the user. Return the fully updated HTML code:\n\n\`\`\`html\n${cleanedRemixHtmlCode}\n\`\`\`` 
      });

      if (remixScreenshotBase64) {
         claudeContent.push({
           type: "text",
           text: "Here is the visual rendering (screenshot) of the current HTML. Use your Vision capabilities to 'see' where elements are positioned, so you can accurately process the User's changes!"
         });
         
         let mimeType = "image/png";
         let data = remixScreenshotBase64;
         if (data.startsWith("data:")) {
            mimeType = data.split(";")[0].split(":")[1];
            data = data.split(",")[1];
         }
         claudeContent.push({
           type: "image",
           source: { type: "base64", media_type: mimeType, data: data }
         });
      }
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

    let claudeResponse: Response | null = null;
    let retries = 0;
    let errPayload = "";

    while (retries < 3) {
      claudeResponse = await fetch(`https://api.anthropic.com/v1/messages`, {
         method: "POST",
         headers: { 
           "Content-Type": "application/json",
           "x-api-key": anthropicApiKey,
           "anthropic-version": "2023-06-01"
         },
         body: JSON.stringify({
            model: "claude-opus-4-7",
            system: systemPrompt,
            max_tokens: 4000,
            messages: [{ role: "user", content: claudeContent }]
         })
      });

      if (claudeResponse.status === 429) {
          retries++;
          console.warn(`[Claude Rate Limit] Hit TPM limit (429). Retrying ${retries}/3 in 15 seconds...`);
          await new Promise(r => setTimeout(r, 15000));
          continue;
      }
      
      if (!claudeResponse.ok) {
          errPayload = await claudeResponse.text();
          throw new Error(`Claude API error: ${errPayload}`);
      }
      
      break;
    }

    if (!claudeResponse || !claudeResponse.ok) {
        throw new Error(`Claude API error (max retries exceeded): ${errPayload}`);
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

    // Replace placeholders with real Base64 data (From original generation)
    if (productImagesBase64 && Array.isArray(productImagesBase64)) {
      productImagesBase64.forEach((imgBase64: string, index: number) => {
        const searchPattern = new RegExp(`PRODUCT_IMG_${index}`, 'g');
        code = code.replace(searchPattern, imgBase64);
      });
    }

    // Re-inject preserved base64 images from Remix context
    if (preservedImages && preservedImages.length > 0) {
      preservedImages.forEach((imgBase64: string, index: number) => {
        const searchPattern = new RegExp(`REMIX_PRESERVED_IMG_${index}`, 'g');
        code = code.replace(searchPattern, imgBase64);
      });
    }

    // Balance was deducted up-front; now just record the creative.
    // If this INSERT itself throws, the outer catch refunds the user.
    const creativeId = crypto.randomUUID();
    await db.insert(creatives).values({
      id: creativeId,
      userId,
      prompt: prompt,
      format,
      cost: cost,
      apiCostKzt: apiCostKzt,
      htmlCode: code,
    });

    // Success — do NOT refund.
    deductedCost = 0;

    return new Response(
      JSON.stringify({ code, creativeId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    // If we already deducted impulses but failed before returning success,
    // refund them. Claude API cost is sunk on our side, but the USER should
    // not lose balance for a failed generation.
    if (deductedCost > 0 && deductedUserId) {
      try {
        await db.update(users)
          .set({ impulses: sql`${users.impulses} + ${deductedCost}` })
          .where(eq(users.id, deductedUserId));
        console.warn(`[Refund] Returned ${deductedCost} impulses to ${deductedUserId} after generation failure.`);
      } catch (refundErr) {
        // If the refund itself fails, log loudly — this needs manual fix.
        console.error('[Refund FAILED]', { userId: deductedUserId, cost: deductedCost, refundErr });
      }
    }
    console.error('Claude API Error:', error);
    return Response.json({ error: error.message || 'Error generating content via Claude' }, { status: 500 });
  }
}

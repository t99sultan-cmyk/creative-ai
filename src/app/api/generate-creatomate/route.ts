import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { creatives, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export const maxDuration = 60; 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    const { prompt, format, isAnimated, referenceImagesBase64, productImagesBase64 } = await request.json();
    const cost = 5; // Creatomate generations are expensive

    const userRecords = await db.select({ impulses: users.impulses, isBanned: users.isBanned }).from(users).where(eq(users.id, userId));
    let currentImpulses = 0;
    
    if (userRecords.length > 0 && userRecords[0].isBanned) {
       return new Response(JSON.stringify({ error: "Ваш аккаунт заблокирован." }), { status: 403 });
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
       return new Response(JSON.stringify({ error: "Недостаточно импульсов на балансе." }), { status: 400 });
    }

    // New System Prompt specifically designed for Creatomate JSON format
    const systemPrompt = `You are an absolute elite API integration expert for the Creatomate video generation service.
Your task is to generate a raw JSON object representing a "Creatomate RenderScript" configuration based on the user's request.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON format. Start with { and end with }. Do not use markdown backticks like \`\`\`json.
2. The JSON must define the "source" property which describes the video configuration for Creatomate.
3. The format requires a specific width and height:
   - For 9:16 format use width: 1080, height: 1920
   - For 1:1 format use width: 1080, height: 1080

4. ELEMENTS:
   Creatomate provides key elements: "text", "image", "video", and "composition". You need to assemble them.
   - You can use random high-quality Unsplash image URLs for backgrounds if necessary, e.g., "source": "https://source.unsplash.com/random/1080x1920?abstract,dark" (or gradient colors using compositions). Note: Creatomate also supports "fill_color": "#ff0000" on elements.
   
5. ANIMATIONS:
   If the creative is meant to be animated, add the "animations" array to elements.
   E.g., "animations": [{ "type": "scale", "start_scale": "0%", "end_scale": "100%", "duration": "1s" }]

6. STRUCTURE EXAMPLE:
{
  "source": {
    "output_format": "mp4",
    "width": 1080,
    "height": 1920,
    "elements": [
      {
        "type": "image",
        "track": 1,
        "source": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&auto=format&fit=crop"
      },
      {
        "type": "text",
        "track": 2,
        "text": "АВТО КРЕДИТ ДО 50 МЛН",
        "font_family": "Montserrat",
        "font_weight": "900",
        "font_size": 90,
        "fill_color": "#ffffff",
        "x": "50%",
        "y": "30%",
        "animations": [
          { "type": "slide", "direction": "up", "duration": "1s" }
        ]
      }
    ]
  }
}

You must create a visually beautiful and completely valid layout based on the user's task. Use your best aesthetic judgment for colors and placement. Output ONLY the JSON.`;

    const geminiParts: any[] = [];
    geminiParts.push({ text: `Format required: ${format}. Animated: ${isAnimated}. Task (ТЗ): ${prompt}` });

    // Handle references
    if (referenceImagesBase64 && Array.isArray(referenceImagesBase64) && referenceImagesBase64.length > 0) {
      geminiParts.push({ text: "Here are REFERENCE IMAGES for atmosphere and layout:" });
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

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is missing");

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${geminiApiKey}`, {
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
    
    // Clean up markdown wrapper
    let jsonString = rawText.trim();
    const match = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      jsonString = match[1];
    }
    
    let parsedCreatomateData;
    try {
       parsedCreatomateData = JSON.parse(jsonString);
    } catch (e) {
       throw new Error("Failed to parse Creatomate JSON from AI: " + jsonString);
    }

    const creatomateKey = process.env.CREATOMATE_API_KEY;
    if (!creatomateKey) throw new Error("CREATOMATE_API_KEY is missing in env");

    // Submit to Creatomate
    const creatomateRes = await fetch("https://api.creatomate.com/v1/renders", {
       method: "POST",
       headers: {
          "Authorization": `Bearer ${creatomateKey}`,
          "Content-Type": "application/json",
       },
       body: JSON.stringify(parsedCreatomateData)
    });

    if (!creatomateRes.ok) {
        const errBody = await creatomateRes.text();
        throw new Error(`Creatomate API Error: ${errBody}`);
    }

    const rendersData = await creatomateRes.json();
    const renderId = rendersData[0]?.id;
    if (!renderId) throw new Error(`Creatomate returned an invalid render job: ${JSON.stringify(rendersData)}`);

    // Poll until complete
    let renderStatus = rendersData[0].status;
    let videoUrl = null;
    let attempts = 0;

    while (renderStatus !== 'succeeded') {
        if (attempts > 30) throw new Error("Render timeout on Creatomate (waited > 60s)");
        
        await new Promise(r => setTimeout(r, 2000)); // sleep 2 seconds
        
        const pollRes = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
           headers: { "Authorization": `Bearer ${creatomateKey}` },
           cache: 'no-store'
        });
        
        if (!pollRes.ok) continue; // retry on brief network glitches
        const pollData = await pollRes.json();
        
        if (pollData && pollData.status) {
           renderStatus = pollData.status;
           if (renderStatus === 'succeeded') {
               videoUrl = pollData.url;
               break;
           }
           if (renderStatus === 'failed') {
               throw new Error(`Creatomate compilation failed: ${pollData.error_message}`);
           }
        }
        attempts++;
    }

    // Deduct Balance
    const creativeId = crypto.randomUUID();
    if (userId) {
      await db.update(users)
        .set({ impulses: currentImpulses - cost })
        .where(eq(users.id, userId));

      await db.insert(creatives).values({
        id: creativeId,
        userId,
        prompt: prompt + " [CREATOMATE TEST]",
        format,
        cost: cost,
        apiCostKzt: 0,
        htmlCode: videoUrl, // We hijack the htmlCode field to temporarily save the URL
      });
    }

    return new Response(
      JSON.stringify({ 
         videoUrl, 
         creativeId,
         sourceJson: jsonString 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error('Creatomate Route Error:', error);
    return Response.json({ error: error.message || 'Error generating via Creatomate' }, { status: 500 });
  }
}

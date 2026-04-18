const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const timecut = require('timecut');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const OUT_DIR = path.join(__dirname, 'out');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Uses Default Compute Credentials injected by Google Cloud Run automatically
const storage = new Storage();
const BUCKET_NAME = process.env.BUCKET_NAME || 'creative-coder-outputs-dev';

// Health Check
app.get('/', (req, res) => res.send('OK'));

app.post('/gcp/render/task', async (req, res) => {
    // This endpoint is meant to be called securely by Cloud Tasks
    const { html, format, creativeId } = req.body;
    if (!html || !creativeId) {
        return res.status(400).json({ error: 'No html or creativeId provided' });
    }

    console.log(`[Cloud Task] Commencing render for creative: ${creativeId}`);

    const finalOutputFile = path.join(OUT_DIR, `${creativeId}.mp4`);
    const rawOutputFile = path.join(OUT_DIR, `raw_${creativeId}.mp4`);
    const htmlFile = path.join(__dirname, `temp_${creativeId}.html`);

    try {
        const isVertical = format === '9:16';
        const cssWidth = isVertical ? 360 : 640;
        const cssHeight = isVertical ? 640 : 640;
        const scale = 3; 
        
        const injectedHtml = html.replace('</head>', `<style>
            body, html { 
                width: ${cssWidth}px !important; 
                height: ${cssHeight}px !important; 
                margin: 0 !important; 
                padding: 0 !important; 
                overflow: hidden !important; 
            }
        </style></head>`);

        fs.writeFileSync(htmlFile, injectedHtml);
        console.log(`[Cloud Task] Running timecut...`);

        await timecut({
            url: 'file://' + htmlFile,
            output: rawOutputFile,
            duration: 15,
            fps: 30,
            viewport: { width: cssWidth, height: cssHeight, deviceScaleFactor: scale },
            roundToEvenWidth: true,
            roundToEvenHeight: true,
            executablePath: '/usr/bin/google-chrome-stable',
            launchArguments: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--autoplay-policy=no-user-gesture-required'
            ],
            transparentBackground: true,
            preparePageForScreenshot: async (page, frameCount, totalFrames) => {
                await page.evaluate((frame) => {
                    // Force any HTML5 videos to seek to the exact physical frame time
                    const videos = document.querySelectorAll('video');
                    videos.forEach(v => {
                        v.pause();
                        // frameCount is 1-indexed, so we subtract 1.
                        v.currentTime = (frame - 1) / 30;
                    });
                }, frameCount);
            }
        });

        console.log(`[Cloud Task] Timecut complete. Running FFMPEG H.264 Conversion...`);
        execSync(`ffmpeg -y -i "${rawOutputFile}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "${finalOutputFile}"`);

        console.log(`[Cloud Task] FFMPEG complete. Uploading to GCS Bucket: ${BUCKET_NAME}...`);
        
        // Exact deterministic destination so frontend knows where to look!
        const destinationName = `renders/${creativeId}.mp4`;
        
        await storage.bucket(BUCKET_NAME).upload(finalOutputFile, {
            destination: destinationName,
            metadata: {
                contentType: 'video/mp4',
                // cache-control forces browsers to check if video exists, but allowing cache when it does
                cacheControl: 'public, max-age=31536000' 
            }
        });
        
        const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destinationName}`;
        console.log(`[Cloud Task] SUCCESS! Uploaded to ${publicUrl}`);

        res.status(200).send('Render Complete');

    } catch (err) {
        console.error(`[Cloud Task ERROR]`, err);
        // Important: return 500 so Cloud Tasks can RETRY if we want it to, or just fail safely
        res.status(500).send(err.message);
    } finally {
        try {
            if (fs.existsSync(htmlFile)) fs.unlinkSync(htmlFile);
            if (fs.existsSync(rawOutputFile)) fs.unlinkSync(rawOutputFile);
            if (fs.existsSync(finalOutputFile)) fs.unlinkSync(finalOutputFile);
        } catch(e) {
            console.error('Cleanup error:', e);
        }
    }
});

// Original Screenshot Endpoint
const puppeteer = require('puppeteer');

app.post('/screenshot', async (req, res) => {
    // Keep screenshot endpoint fast and sync
    const { html, format } = req.body;
    if (!html) return res.status(400).json({ error: 'No html provided' });

    const isVertical = format === '9:16';
    const cssWidth = isVertical ? 360 : 640;
    const cssHeight = isVertical ? 640 : 640;
    const scale = 3;

    const injectedHtml = html.replace('</head>', `<style>
        body, html { 
            width: ${cssWidth}px !important; 
            height: ${cssHeight}px !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            overflow: hidden !important; 
        }
    </style></head>`);

    try {
        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome-stable',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: cssWidth, height: cssHeight, deviceScaleFactor: scale });
        
        await page.setContent(injectedHtml, { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3500)); 

        const buffer = await page.screenshot({ type: 'png', omitBackground: true });
        await browser.close();

        res.set('Content-Type', 'image/png');
        res.send(buffer);
    } catch (err) {
        console.error('Screenshot error:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cloud Renderer listening on port ${PORT}`);
});

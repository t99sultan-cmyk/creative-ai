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
const storage = new Storage();
const BUCKET_NAME = process.env.BUCKET_NAME || 'creative-coder-outputs-dev';

app.post('/gcp/render/task', async (req, res) => {
    const { creativeId, format, html } = req.body;
    if (!creativeId || !format || !html) return res.status(400).send('Bad Request');

    const OUT_DIR = '/tmp';
    const finalOutputFile = path.join(OUT_DIR, `${creativeId}.mp4`);
    const rawOutputFile = path.join(OUT_DIR, `raw_${creativeId}.mp4`);
    const htmlFile = path.join(OUT_DIR, `temp_${creativeId}.html`);

    try {
        const isVertical = format === '9:16';
        // USE REAL EDITOR DIMENSIONS TO PREVENT CROPPING
        const cssWidth = isVertical ? 400 : 500;
        const cssHeight = isVertical ? 711 : 500;
        const scale = isVertical ? 2.7 : 2.16; // 400 * 2.7 = 1080, 500 * 2.16 = 1080
        
        const injectedHtml = html.replace('</head>', `<style>
            body, html { width: ${cssWidth}px !important; height: ${cssHeight}px !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
        </style></head>`);
        fs.writeFileSync(htmlFile, injectedHtml);

        await timecut({
            url: 'file://' + htmlFile,
            output: rawOutputFile,
            duration: 15,
            fps: 30,
            viewport: { width: cssWidth, height: cssHeight, deviceScaleFactor: scale },
            roundToEvenWidth: true,
            roundToEvenHeight: true,
            executablePath: '/usr/bin/google-chrome',
            launchArguments: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--disable-web-security', '--autoplay-policy=no-user-gesture-required'
            ],
            transparentBackground: true,
            preparePageForScreenshot: async (page, frameCount) => {
                await page.evaluate((frame) => {
                    const videos = document.querySelectorAll('video');
                    videos.forEach(v => {
                        v.pause();
                        v.currentTime = (frame - 1) / 30;
                    });
                }, frameCount);
            }
        });

        execSync(`ffmpeg -y -i "${rawOutputFile}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "${finalOutputFile}"`);
        
        const destinationName = `renders/${creativeId}.mp4`;
        await storage.bucket(BUCKET_NAME).upload(finalOutputFile, {
            destination: destinationName,
            metadata: { contentType: 'video/mp4', cacheControl: 'public, max-age=31536000' }
        });
        
        res.status(200).send('Render Complete');
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        try {
            if (fs.existsSync(htmlFile)) fs.unlinkSync(htmlFile);
            if (fs.existsSync(rawOutputFile)) fs.unlinkSync(rawOutputFile);
            if (fs.existsSync(finalOutputFile)) fs.unlinkSync(finalOutputFile);
        } catch(e) {}
    }
});

app.listen(8080, () => console.log('Renderer Listening on port 8080'));

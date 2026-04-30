const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const timecut = require('timecut');
const { Storage } = require('@google-cloud/storage');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
const storage = new Storage();
const BUCKET_NAME = process.env.BUCKET_NAME || 'creative-coder-outputs-dev';

// ============================================================
// Existing HTML → MP4 (timecut + Chrome) pipeline.
// Used by /api/render in Creative_Coder_App for the legacy
// HTML-creative animation path. Untouched — additions go below.
// ============================================================
app.post('/gcp/render/task', async (req, res) => {
    const { creativeId, format, html } = req.body;
    if (!creativeId || !format || !html) return res.status(400).send('Bad Request');

    const OUT_DIR = '/tmp';
    const finalOutputFile = path.join(OUT_DIR, `${creativeId}.mp4`);
    const rawOutputFile = path.join(OUT_DIR, `raw_${creativeId}.mp4`);
    const htmlFile = path.join(OUT_DIR, `temp_${creativeId}.html`);

    try {
        const isVertical = format === '9:16';
        const cssWidth = isVertical ? 400 : 500;
        const cssHeight = isVertical ? 711 : 500;
        const scale = isVertical ? 2.7 : 2.16;

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

// ============================================================
// NEW: Remotion-based text overlay on top of an input video.
//
// Pipeline:
//   1. POST /text-overlay { videoUrl, text, accent?, width?, height? }
//   2. Server renders the "TextOverlay" Composition with Remotion,
//      which uses <OffthreadVideo src={videoUrl}> as background and
//      animates the text on top.
//   3. Output MP4 is uploaded to GCS and a public URL is returned.
//
// Bundling is done ONCE per container boot (~5-10 sec) and cached.
// First request after a cold start will pay this cost; subsequent
// requests render in ~10-30 sec for 5-second clips.
// ============================================================

// Lazy-init bundle. We don't await at boot because Cloud Run cold
// starts have to listen() within ~10 sec, but bundling can take
// longer. Instead the first /text-overlay call awaits this promise.
let remotionBundlePromise = null;
function getBundle() {
    if (!remotionBundlePromise) {
        remotionBundlePromise = bundle({
            entryPoint: path.join(__dirname, 'remotion', 'index.ts'),
            // Webpack override — disable type checking for faster bundles.
            // We've already type-checked locally before deploy.
            webpackOverride: (config) => config,
        });
    }
    return remotionBundlePromise;
}

app.post('/text-overlay', async (req, res) => {
    const { videoUrl, text, accent, width, height, durationSec, fps } = req.body || {};
    if (!videoUrl || !text) {
        return res.status(400).json({ error: 'videoUrl and text are required' });
    }

    const W = Math.max(360, Math.min(2160, Number(width) || 1080));
    const H = Math.max(360, Math.min(2160, Number(height) || 1920));
    const FPS = Math.max(24, Math.min(60, Number(fps) || 30));
    const DURATION_SEC = Math.max(2, Math.min(15, Number(durationSec) || 5));
    const DURATION_FRAMES = Math.round(FPS * DURATION_SEC);

    const jobId = crypto.randomUUID();
    const outputFile = path.join('/tmp', `overlay_${jobId}.mp4`);

    try {
        const serveUrl = await getBundle();

        const inputProps = {
            videoUrl,
            text: String(text).slice(0, 120),
            accent: typeof accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#f37021',
        };

        const composition = await selectComposition({
            serveUrl,
            id: 'TextOverlay',
            inputProps,
        });

        // Override metadata that defaultProps in Root.tsx can't know
        // until the request lands (orientation, exact length, fps).
        const renderComposition = {
            ...composition,
            durationInFrames: DURATION_FRAMES,
            fps: FPS,
            width: W,
            height: H,
        };

        await renderMedia({
            composition: renderComposition,
            serveUrl,
            codec: 'h264',
            outputLocation: outputFile,
            inputProps,
            chromiumOptions: {
                // Same flags we use for timecut; required for Cloud Run sandbox.
                disableWebSecurity: true,
                ignoreCertificateErrors: true,
            },
            // Cap concurrency — Cloud Run instances have 2 vCPU by default,
            // higher concurrency just thrashes the CPU without speedup.
            concurrency: 2,
            x264Preset: 'fast',
            crf: 22,
            pixelFormat: 'yuv420p',
            timeoutInMilliseconds: 5 * 60 * 1000,
        });

        const destination = `text-overlays/${jobId}.mp4`;
        await storage.bucket(BUCKET_NAME).upload(outputFile, {
            destination,
            metadata: { contentType: 'video/mp4', cacheControl: 'public, max-age=31536000' },
        });

        // Public URL — GCS bucket should be configured with allUsers:
        // objectViewer, same as the existing /gcp/render/task path.
        const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;

        res.status(200).json({ ok: true, videoUrl: publicUrl, jobId });
    } catch (err) {
        console.error('[text-overlay] failed:', err);
        res.status(500).json({ ok: false, error: err.message || 'render failed' });
    } finally {
        try {
            if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        } catch (e) {}
    }
});

// Health endpoint — also kicks off the Remotion bundle in the
// background so the first real request doesn't pay the cost.
app.get('/healthz', (req, res) => {
    if (!remotionBundlePromise) {
        getBundle().catch((e) => {
            console.warn('[bundle] background prepare failed:', e.message);
        });
    }
    res.status(200).json({ ok: true });
});

app.listen(8080, () => console.log('Renderer listening on port 8080 — text-overlay enabled'));

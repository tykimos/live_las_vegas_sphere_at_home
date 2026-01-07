const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const PORT = 8080;
const QUERY = "Las Vegas Sphere Live 24/7";

// Global cache for stream URL
let cachedUrl = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/stream') {
        if (req.method === 'HEAD') {
            res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame' });
            res.end();
            return;
        }

        console.log('Client connected. Preparing stream...');

        // Check cache
        if (!cachedUrl || Date.now() - cacheTime > CACHE_DURATION) {
            console.log('Fetching new stream URL...');
            
            const ytdl = spawn('yt-dlp', [
                '--no-playlist',
                '--quiet',
                '--get-url',
                '-f', 'best[ext=mp4]',
                `ytsearch1:${QUERY}`
            ]);

            let streamUrl = '';
            ytdl.stdout.on('data', (data) => {
                streamUrl += data.toString();
            });

            await new Promise((resolve) => {
                ytdl.on('close', (code) => {
                    if (code === 0 && streamUrl.trim()) {
                        cachedUrl = streamUrl.trim().split('\n')[0];
                        cacheTime = Date.now();
                        console.log('Stream URL cached');
                    }
                    resolve();
                });
            });
        }

        if (!cachedUrl) {
            console.error('Failed to get stream URL');
            res.writeHead(500);
            res.end('Failed to find stream');
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
            'Cache-Control': 'no-cache',
            'Connection': 'close',
            'Pragma': 'no-cache'
        });

        // Simple MJPEG stream with frame boundaries
        const ffmpeg = spawn('ffmpeg', [
            '-i', cachedUrl,
            '-f', 'image2',
            '-vcodec', 'mjpeg',
            '-q:v', '5',
            '-r', '10',
            '-vf', 'scale=800:-1',
            'pipe:1'
        ]);

        let buffer = Buffer.alloc(0);
        
        ffmpeg.stdout.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            
            // Look for JPEG start and end markers
            let start = 0;
            while (true) {
                const jpegStart = buffer.indexOf(Buffer.from([0xFF, 0xD8]), start);
                if (jpegStart === -1) break;
                
                const jpegEnd = buffer.indexOf(Buffer.from([0xFF, 0xD9]), jpegStart + 2);
                if (jpegEnd === -1) break;
                
                // Extract complete JPEG
                const jpeg = buffer.slice(jpegStart, jpegEnd + 2);
                
                // Send frame with boundary
                res.write(`--frame\r\n`);
                res.write(`Content-Type: image/jpeg\r\n`);
                res.write(`Content-Length: ${jpeg.length}\r\n\r\n`);
                res.write(jpeg);
                res.write(`\r\n`);
                
                start = jpegEnd + 2;
            }
            
            // Keep remaining data
            if (start > 0) {
                buffer = buffer.slice(start);
            }
            
            // Prevent buffer overflow
            if (buffer.length > 1000000) {
                buffer = Buffer.alloc(0);
            }
        });

        ffmpeg.stderr.on('data', (data) => {
            // Suppress verbose output
        });

        ffmpeg.on('close', (code) => {
            console.log('ffmpeg closed with code:', code);
            res.end();
        });

        req.on('close', () => {
            console.log('Client disconnected');
            ffmpeg.kill('SIGTERM');
        });

    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`MJPEG Streamer running at http://localhost:${PORT}/stream`);
});

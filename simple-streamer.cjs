const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const PORT = 8080;
const QUERY = "Las Vegas Sphere Live 24/7";

// Global state
let ffmpegProcess = null;
let streamUrl = null;
let lastFetchTime = 0;

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/frame' || req.url.startsWith('/frame?')) {
        console.log('Frame requested');
        
        // Get stream URL if we don't have one or it's old
        if (!streamUrl || Date.now() - lastFetchTime > 300000) { // 5 minutes
            console.log('Fetching fresh stream URL...');
            
            const ytdl = spawn('yt-dlp', [
                '--no-playlist',
                '--quiet',
                '--get-url',
                '-f', 'best[ext=mp4]',
                `ytsearch1:${QUERY}`
            ]);

            let url = '';
            ytdl.stdout.on('data', (data) => {
                url += data.toString();
            });

            await new Promise((resolve) => {
                ytdl.on('close', () => {
                    if (url.trim()) {
                        streamUrl = url.trim().split('\n')[0];
                        lastFetchTime = Date.now();
                        console.log('Got stream URL');
                    }
                    resolve();
                });
            });
        }

        if (!streamUrl) {
            res.writeHead(500);
            res.end('No stream available');
            return;
        }

        // Extract a single frame
        const ffmpeg = spawn('ffmpeg', [
            '-i', streamUrl,
            '-frames:v', '1',
            '-f', 'image2',
            '-vcodec', 'mjpeg',
            '-q:v', '5',
            '-vf', 'scale=800:-1',
            'pipe:1'
        ]);

        res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        ffmpeg.stdout.pipe(res);

        ffmpeg.stderr.on('data', (data) => {
            // Ignore stderr unless debugging
        });

        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                console.log('ffmpeg exited with code', code);
            }
            res.end();
        });

        req.on('close', () => {
            ffmpeg.kill('SIGKILL');
        });

    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`Simple Frame Server running at http://localhost:${PORT}/frame`);
});
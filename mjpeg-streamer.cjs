const http = require('http');
const { spawn } = require('child_process');

const PORT = 8080;
const QUERY = "Las Vegas Sphere Live 24/7";

let cachedUrl = null;
let urlTime = 0;

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/stream' || req.url.startsWith('/stream?')) {
        if (req.method === 'HEAD') {
            res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame' });
            res.end();
            return;
        }

        console.log('Client connected for streaming');

        // Get stream URL if needed
        if (!cachedUrl || Date.now() - urlTime > 300000) { // 5 minutes
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
                        cachedUrl = url.trim().split('\n')[0];
                        urlTime = Date.now();
                        console.log('Got stream URL');
                    }
                    resolve();
                });
            });
        }

        if (!cachedUrl) {
            res.writeHead(500);
            res.end('No stream available');
            return;
        }

        // Send multipart header
        res.writeHead(200, {
            'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
            'Cache-Control': 'no-cache',
            'Connection': 'close',
            'Pragma': 'no-cache'
        });

        // Start continuous ffmpeg stream
        const ffmpeg = spawn('ffmpeg', [
            '-i', cachedUrl,
            '-f', 'mjpeg',  // Output format as MJPEG stream
            '-q:v', '5',
            '-r', '10', // 10 FPS
            '-vf', 'scale=800:-1',
            '-'  // Output to stdout
        ]);

        let buffer = Buffer.alloc(0);
        let framesSent = 0;
        
        ffmpeg.stdout.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            
            // Look for complete JPEG frames
            let pos = 0;
            while (true) {
                // Find JPEG start marker
                const jpegStart = buffer.indexOf(Buffer.from([0xFF, 0xD8]), pos);
                if (jpegStart === -1) break;
                
                // Find JPEG end marker
                const jpegEnd = buffer.indexOf(Buffer.from([0xFF, 0xD9]), jpegStart + 2);
                if (jpegEnd === -1) break;
                
                // Extract complete JPEG frame
                const frame = buffer.slice(jpegStart, jpegEnd + 2);
                
                // Send frame with proper multipart boundaries
                try {
                    res.write(`--frame\r\n`);
                    res.write(`Content-Type: image/jpeg\r\n`);
                    res.write(`Content-Length: ${frame.length}\r\n\r\n`);
                    res.write(frame);
                    res.write(`\r\n`);
                    framesSent++;
                    
                    if (framesSent % 100 === 0) {
                        console.log(`Sent ${framesSent} frames`);
                    }
                } catch (err) {
                    // Client disconnected
                    console.log('Client disconnected');
                    ffmpeg.kill('SIGTERM');
                    break;
                }
                
                pos = jpegEnd + 2;
            }
            
            // Keep unprocessed data
            if (pos > 0) {
                buffer = buffer.slice(pos);
            }
            
            // Prevent buffer overflow
            if (buffer.length > 1000000) {
                console.warn('Buffer overflow, clearing');
                buffer = Buffer.alloc(0);
            }
        });

        ffmpeg.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('Error')) {
                console.error('ffmpeg error:', msg);
            }
        });

        ffmpeg.on('close', (code) => {
            console.log(`ffmpeg closed with code ${code}, sent ${framesSent} frames`);
            res.end();
        });

        req.on('close', () => {
            console.log(`Client disconnected after ${framesSent} frames`);
            ffmpeg.kill('SIGTERM');
        });

    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`MJPEG Streaming Server running at http://localhost:${PORT}/stream`);
});
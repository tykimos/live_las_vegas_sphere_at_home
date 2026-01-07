const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');

const PORT = 8080;
// Direct URL to the live Las Vegas Sphere stream
const YOUTUBE_URL = "https://www.youtube.com/watch?v=AnzVZRaujNA";

let cachedUrl = null;
let urlTime = 0;
let ffmpegProcess = null;
let clients = new Set();

// Create HTTP server
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200);
    res.end('WebSocket Server Running');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

async function getStreamUrl() {
    if (cachedUrl && Date.now() - urlTime < 300000) {
        return cachedUrl;
    }

    console.log('Fetching fresh stream URL...');
    
    const ytdl = spawn('yt-dlp', [
        '--no-playlist',
        '--quiet',
        '--get-url',
        '-f', 'best[ext=mp4]',
        YOUTUBE_URL
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

    return cachedUrl;
}

function startStreaming() {
    if (ffmpegProcess || clients.size === 0) return;
    
    getStreamUrl().then(url => {
        if (!url) {
            console.error('No stream URL available');
            return;
        }

        console.log('Starting ffmpeg stream for', clients.size, 'clients');
        
        // Start ffmpeg with stable settings for smooth streaming
        ffmpegProcess = spawn('ffmpeg', [
            '-reconnect', '1',
            '-reconnect_streamed', '1', 
            '-reconnect_delay_max', '5',
            '-i', url,
            '-f', 'image2pipe',
            '-vcodec', 'mjpeg',
            '-q:v', '2',  // Higher quality (lower = better)
            '-r', '10',   // 10 FPS - stable
            '-vf', 'scale=1280:-1,eq=brightness=0.1:contrast=1.1',  // HD resolution with brightness/contrast adjustment
            '-threads', '1',
            'pipe:1'
        ]);

        let buffer = Buffer.alloc(0);
        
        ffmpegProcess.stdout.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            
            // Look for complete JPEG frames
            let pos = 0;
            while (true) {
                const jpegStart = buffer.indexOf(Buffer.from([0xFF, 0xD8]), pos);
                if (jpegStart === -1) break;
                
                const jpegEnd = buffer.indexOf(Buffer.from([0xFF, 0xD9]), jpegStart + 2);
                if (jpegEnd === -1) break;
                
                // Extract complete frame
                const frame = buffer.slice(jpegStart, jpegEnd + 2);
                
                // Send to all connected clients with throttling
                clients.forEach(ws => {
                    if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 65536) {
                        // Only send if client's buffer is not overwhelmed
                        ws.send(frame);
                    }
                });
                
                pos = jpegEnd + 2;
            }
            
            if (pos > 0) {
                buffer = buffer.slice(pos);
            }
            
            if (buffer.length > 1000000) {
                buffer = Buffer.alloc(0);
            }
        });

        ffmpegProcess.on('close', (code) => {
            console.log('ffmpeg closed with code:', code);
            ffmpegProcess = null;
            
            // Restart if clients still connected
            if (clients.size > 0) {
                setTimeout(startStreaming, 1000);
            }
        });

        ffmpegProcess.stderr.on('data', (data) => {
            // Log errors silently
        });
    });
}

function stopStreaming() {
    if (ffmpegProcess) {
        console.log('Stopping ffmpeg');
        ffmpegProcess.kill('SIGTERM');
        ffmpegProcess = null;
    }
}

wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.add(ws);
    
    // Start streaming if not already
    if (!ffmpegProcess) {
        startStreaming();
    }
    
    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
        
        // Stop streaming if no clients
        if (clients.size === 0) {
            stopStreaming();
        }
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        clients.delete(ws);
    });
});

server.listen(PORT, () => {
    console.log(`WebSocket Streaming Server running at ws://localhost:${PORT}`);
});
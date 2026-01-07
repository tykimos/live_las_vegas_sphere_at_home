import ytSearch from 'yt-search';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { proxyUrl } = req.query;

    // Proxy mode: fetch and return content from external URL
    if (proxyUrl) {
        try {
            const decodedUrl = decodeURIComponent(proxyUrl);
            const response = await fetch(decodedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const contentType = response.headers.get('content-type') || 'application/octet-stream';

            res.setHeader('Content-Type', contentType);

            // If it's a manifest, rewrite URLs
            if (contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL') || decodedUrl.includes('.m3u8')) {
                let body = await response.text();
                const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);

                // Rewrite relative URLs to proxied URLs
                body = body.replace(/^(?!#)(\S.*)$/gm, (match) => {
                    const absoluteUrl = match.startsWith('http') ? match : new URL(match, baseUrl).href;
                    return `/api?proxyUrl=${encodeURIComponent(absoluteUrl)}`;
                });

                res.status(200).send(body);
            } else {
                // For binary segments, return the buffer
                const buffer = await response.arrayBuffer();
                res.status(200).send(Buffer.from(buffer));
            }
            return;
        } catch (error) {
            console.error('Proxy Error:', error);
            res.status(500).json({ success: false, error: 'Proxy error: ' + error.message });
            return;
        }
    }

    // Search mode: find Las Vegas Sphere live stream
    try {
        const query = "Las Vegas Sphere Live 24/7";
        const searchResults = await ytSearch(query);
        
        // Find live streams first
        let liveVideo = searchResults.videos.find(v => v.live === true);
        
        // If no live stream, get the first video result
        if (!liveVideo && searchResults.videos.length > 0) {
            liveVideo = searchResults.videos[0];
        }

        if (liveVideo) {
            // Return the video info - client will need to handle HLS separately
            // For live streams, we return the video URL for iframe embed or direct link
            res.status(200).json({
                success: true,
                videoId: liveVideo.videoId,
                title: liveVideo.title,
                isLive: liveVideo.live || false,
                url: `https://www.youtube.com/watch?v=${liveVideo.videoId}`,
                embedUrl: `https://www.youtube.com/embed/${liveVideo.videoId}?autoplay=1&mute=1`,
                thumbnail: liveVideo.thumbnail
            });
        } else {
            res.status(200).json({
                success: false,
                error: 'No live stream found for Las Vegas Sphere'
            });
        }

    } catch (error) {
        console.error('API Error:', error);
        res.status(200).json({
            success: false,
            error: error.message || 'Failed to search for stream'
        });
    }
}

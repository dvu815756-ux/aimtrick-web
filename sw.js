// sw.js - VTĐZAI - SERVICE WORKER PROXY CORS
self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    
    // Chỉ xử lý request đến Supabase
    if (url.hostname === 'dgcnstiwchdqlgddcnca.supabase.co') {
        const newHeaders = new Headers(event.request.headers);
        newHeaders.set('Origin', 'https://dvu815756-ux.github.io');
        
        const modifiedRequest = new Request(event.request, {
            method: event.request.method,
            headers: newHeaders,
            mode: 'cors',
            credentials: 'omit'
        });
        
        event.respondWith(fetch(modifiedRequest).catch(function(err) {
            // Fallback nếu lỗi
            return new Response(JSON.stringify({ error: 'CORS proxy failed' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }));
    }
});

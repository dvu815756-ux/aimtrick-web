// sw.js - Service Worker Proxy
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    if (url.hostname === 'dgcnstiwchdqlgddcnca.supabase.co') {
        const newRequest = new Request(event.request, {
            mode: 'cors',
            credentials: 'omit',
            headers: new Headers({
                'Origin': 'https://dvu815756-ux.github.io'
            })
        });
        event.respondWith(fetch(newRequest));
    }
});

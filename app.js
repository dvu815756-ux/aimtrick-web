// app.js - VTĐZAI - GIAO DIỆN CHÍNH
(function() {
    const auth = window.VTDZAI_AUTH;

    async function checkAuthAndRender() {
        const status = await auth.checkActivation();
        if (!status.valid) {
            localStorage.removeItem('vtd_activated');
            window.location.href = 'index.html';
            return;
        }

        const authStatus = document.getElementById('auth-status');
        const deviceInfo = document.getElementById('device-info');
        const expiry = status.data.expiry;
        let statusText = '🔐 ĐÃ KÍCH HOẠT - ';
        if (expiry === 'VV') statusText += 'VĨNH VIỄN';
        else if (expiry === '24H') statusText += '24H';
        else if (expiry === '7D') statusText += '7 NGÀY';
        authStatus.textContent = statusText;

        const deviceId = auth.getDeviceId();
        deviceInfo.textContent = 'DEV: ' + deviceId.substring(0, 12);

        renderOffsets();
        setupWebclipCanvas();

        document.getElementById('logoutBtn').addEventListener('click', function() {
            localStorage.removeItem('vtd_auth_data');
            localStorage.removeItem('vtd_activated');
            window.location.href = 'index.html';
        });
    }

    function renderOffsets() {
        const data = auth.getOffsetData();
        const grid = document.getElementById('offset-grid');
        grid.innerHTML = '';
        const sorted = Object.keys(data).sort();
        for (const key of sorted) {
            const val = data[key];
            const div = document.createElement('div');
            div.className = 'offset-item';
            div.innerHTML = `<span class="offset-name">${key}</span><span class="offset-value">${val}</span>`;
            grid.appendChild(div);
        }
    }

    function setupWebclipCanvas() {
        const canvas = document.getElementById('offsetCanvas');
        const container = canvas.parentElement;

        function draw() {
            const w = container.clientWidth || 800;
            const h = container.clientHeight || 400;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            const grad = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, w/2);
            grad.addColorStop(0, '#0a1a2a');
            grad.addColorStop(1, '#000000');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            const data = auth.getOffsetData();
            const keys = Object.keys(data);
            const cols = 4;
            const rows = Math.ceil(keys.length / cols);
            const cellW = w / cols;
            const cellH = h / rows;

            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';

            for (let i = 0; i < keys.length; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = col * cellW + cellW/2;
                const y = row * cellH + cellH/2;
                const name = keys[i];
                const val = data[name];

                ctx.strokeStyle = '#00aaff44';
                ctx.lineWidth = 1;
                ctx.strokeRect(x - cellW/2 + 10, y - cellH/2 + 10, cellW - 20, cellH - 20);

                ctx.fillStyle = '#88ddff';
                ctx.font = '10px Courier New';
                ctx.fillText(name, x, y - 8);

                ctx.fillStyle = '#ffaa44';
                ctx.font = 'bold 14px Courier New';
                ctx.fillText(val, x, y + 14);
            }

            ctx.fillStyle = '#44ffaa44';
            ctx.font = '18px Courier New';
            ctx.textAlign = 'right';
            ctx.fillText('VTĐZAI OFFSET', w-20, 30);
            ctx.fillStyle = '#446688';
            ctx.font = '10px Courier New';
            ctx.fillText('LevelPhotograph : MonoBehaviour', w-20, 50);

            ctx.fillStyle = '#44aaff22';
            ctx.beginPath();
            ctx.arc(w-60, h-40, 20, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#44aaff44';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('📷', w-60, h-34);

            ctx.fillStyle = '#44668866';
            ctx.font = '9px Courier New';
            ctx.textAlign = 'left';
            ctx.fillText('🔗 SUPABASE CONNECTED', 15, h-15);
            ctx.fillText('vtd.empire', 15, h-4);
        }

        draw();

        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(draw, 200);
        });
    }

    window.addEventListener('load', checkAuthAndRender);
})();

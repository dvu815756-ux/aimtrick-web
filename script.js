// script.js - VTĐZAI - XỬ LÝ KÍCH HOẠT
(function() {
    const keyInput = document.getElementById('keyInput');
    const activateBtn = document.getElementById('activateBtn');
    const statusMsg = document.getElementById('statusMsg');
    const loading = document.getElementById('loading');

    const auth = window.VTDZAI_AUTH;

    function showStatus(text, isError = true) {
        statusMsg.textContent = text;
        statusMsg.style.color = isError ? '#ff4444' : '#44ff88';
        statusMsg.style.textShadow = isError ? '0 0 10px #ff000088' : '0 0 10px #44ff8888';
    }

    function setLoading(state) {
        loading.style.display = state ? 'block' : 'none';
        activateBtn.disabled = state;
        keyInput.disabled = state;
    }

    async function handleActivation() {
        const rawKey = keyInput.value.trim().toUpperCase();
        if (!rawKey) {
            showStatus('LỖI: NHẬP MÃ KÍCH HOẠT', true);
            return;
        }

        setLoading(true);
        showStatus('ĐANG XÁC THỰC VỚI SUPABASE...', false);

        try {
            const result = await auth.activateKeyWithSupabase(rawKey);
            if (result.success) {
                showStatus('✓ KÍCH HOẠT THÀNH CÔNG! CHUYỂN VÀO HỆ THỐNG...', false);
                localStorage.setItem('vtd_activated', 'true');
                localStorage.setItem('vtd_key_data', JSON.stringify(result.data));
                setTimeout(() => {
                    window.location.href = 'app.html';
                }, 800);
            } else {
                showStatus('✗ ' + result.message, true);
                keyInput.value = '';
                keyInput.focus();
            }
        } catch (err) {
            showStatus('✗ LỖI KẾT NỐI SUPABASE: ' + err.message, true);
        } finally {
            setLoading(false);
        }
    }

    activateBtn.addEventListener('click', handleActivation);
    keyInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleActivation();
        }
    });

    window.addEventListener('load', function() {
        keyInput.focus();
    });

    keyInput.addEventListener('focus', function() {
        this.style.borderColor = '#44ff88';
        this.style.boxShadow = '0 0 20px #44ff8844';
    });
    keyInput.addEventListener('blur', function() {
        this.style.borderColor = '#00aaff';
        this.style.boxShadow = 'none';
    });
})();

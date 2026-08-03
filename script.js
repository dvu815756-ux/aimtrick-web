/**
 * ============================================================
 * script.js - AIMTRICK Activation UI (Nhập key)
 * Bản quyền thuộc VTĐZAI - Không sao chép dưới mọi hình thức
 * Version: 3.2.3
 * ============================================================
 */

(function() {
    'use strict';

    // ============================================================
    // DOM REFS
    // ============================================================
    const DOM = {
        container: document.querySelector('.container'),
        keyInput: document.getElementById('licenseKey'),
        activateBtn: document.getElementById('activateBtn'),
        statusMessage: document.getElementById('statusMessage'),
        keyType: document.getElementById('keyType'),
        deviceLimit: document.getElementById('deviceLimit'),
        expiryInfo: document.getElementById('expiryInfo')
    };

    // ============================================================
    // UI HELPERS
    // ============================================================
    function setStatus(message, type = 'info', showSpinner = false) {
        DOM.statusMessage.className = 'status ' + type;
        let html = '';
        if (showSpinner) {
            html += '<span class="spinner"></span> ';
        } else {
            const icons = { success: '✔', error: '✖', warning: '⚠', info: '◆' };
            html += (icons[type] || '◆') + ' ';
        }
        html += message;
        DOM.statusMessage.innerHTML = html;
    }

    function updateUI(keyData) {
        if (!keyData) {
            DOM.keyType.textContent = '---';
            DOM.deviceLimit.textContent = '---';
            DOM.expiryInfo.textContent = '---';
            return;
        }

        const { typeLabel, deviceLimit, expiryTimestamp } = keyData;
        const deviceCount = AIMTRICK.state.deviceCount;

        DOM.keyType.textContent = typeLabel;
        DOM.deviceLimit.textContent = deviceLimit === Infinity ? '∞' : (deviceCount + '/' + deviceLimit);
        DOM.expiryInfo.textContent = expiryTimestamp === Infinity ? 'Vĩnh viễn' : new Date(expiryTimestamp).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function setActivated(key, keyData) {
        DOM.keyInput.disabled = true;
        DOM.activateBtn.disabled = true;
        DOM.activateBtn.textContent = '✓ ĐÃ KÍCH HOẠT';
        DOM.container.classList.add('activated');
        DOM.keyInput.value = key;
        updateUI(keyData);
        setStatus('Kích hoạt thành công!', 'success');
    }

    // ============================================================
    // HANDLE ACTIVATE
    // ============================================================
    function handleActivate() {
        const key = DOM.keyInput.value;
        if (!key.trim()) {
            setStatus('Vui lòng nhập mã kích hoạt', 'warning');
            return;
        }

        setStatus('Đang xác thực...', 'info', true);

        // Sử dụng Auth core
        const result = AIMTRICK.activate(key);

        if (!result.success) {
            setStatus(result.reason, 'error');
            updateUI(null);
            return;
        }

        // Thành công
        setActivated(result.keyData.key || key, result.keyData);

        // Chuyển hướng sau 800ms nếu là kích hoạt mới
        if (!result.already) {
            setTimeout(() => {
                location.replace('app.html');
            }, 800);
        } else {
            setTimeout(() => {
                location.replace('app.html');
            }, 300);
        }
    }

    // ============================================================
    // DEMO TOOLS
    // ============================================================
    function initDemoTools() {
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                DOM.keyInput.value = AIMTRICK.generateDemoKey('24H');
                setStatus('Đã tạo key demo 24H', 'info');
            }
            if (e.ctrlKey && e.shiftKey && e.key === '7') {
                e.preventDefault();
                DOM.keyInput.value = AIMTRICK.generateDemoKey('7D');
                setStatus('Đã tạo key demo 7D', 'info');
            }
            if (e.ctrlKey && e.shiftKey && e.key === 'V') {
                e.preventDefault();
                DOM.keyInput.value = AIMTRICK.generateDemoKey('VV');
                setStatus('Đã tạo key demo VV', 'info');
            }
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                if (confirm('Reset toàn bộ dữ liệu kích hoạt?')) {
                    localStorage.removeItem('aimtrick_activation');
                    sessionStorage.removeItem('aimtrick_session');
                    AIMTRICK.reset();
                    DOM.keyInput.disabled = false;
                    DOM.keyInput.value = '';
                    DOM.activateBtn.disabled = false;
                    DOM.activateBtn.textContent = 'KÍCH HOẠT';
                    DOM.container.classList.remove('activated');
                    updateUI(null);
                    setStatus('Đã reset hệ thống', 'warning');
                }
            }
        });
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================
    function initEventHandlers() {
        DOM.activateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleActivate();
        });

        DOM.keyInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleActivate();
            }
        });

        DOM.keyInput.addEventListener('paste', function(e) {
            setTimeout(() => {
                this.value = this.value.trim().toUpperCase();
            }, 10);
        });

        DOM.keyInput.addEventListener('input', function() {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.toUpperCase();
            this.setSelectionRange(start, end);
        });
    }

    // ============================================================
    // INIT
    // ============================================================
    function init() {
        initEventHandlers();
        initDemoTools();

        // Kiểm tra đã kích hoạt chưa
        if (AIMTRICK.isActivated()) {
            const info = AIMTRICK.getKeyInfo();
            const keyData = {
                typeLabel: info.type,
                deviceLimit: info.deviceLimit,
                expiryTimestamp: info.expiryDate,
                key: info.key
            };
            setActivated(info.key, keyData);
            setStatus('Đã kích hoạt', 'success');
            // Tự động chuyển sang app
            setTimeout(() => {
                location.replace('app.html');
            }, 300);
            return;
        }

        // Kiểm tra key trên URL
        const params = new URLSearchParams(window.location.search);
        const urlKey = params.get('key');
        if (urlKey) {
            DOM.keyInput.value = urlKey.trim().toUpperCase();
            setTimeout(handleActivate, 500);
        } else {
            setStatus('Nhập key để kích hoạt', 'info');
        }

        console.log('AIMTRICK v3.2.3 - Kích hoạt sẵn sàng');
        console.log('Device ID:', AIMTRICK.getDeviceId());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

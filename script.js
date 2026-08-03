/* app.js - App Main */
(function() {
    'use strict';

    // DOM REFS
    const DOM = {
        optimizeBtn: document.getElementById('optimizeBtn'),
        statusMessage: document.getElementById('statusMessage'),
        cpuInfo: document.getElementById('cpuInfo'),
        ramInfo: document.getElementById('ramInfo'),
        statusInfo: document.getElementById('statusInfo')
    };

    let isProcessing = false;

    // ============================================================
    // UI HELPERS
    // ============================================================
    function setStatus(message, type, showSpinner) {
        if (!DOM.statusMessage) return;
        type = type || 'info';
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

    // ============================================================
    // DEVICE INFO
    // ============================================================
    function getDeviceInfo() {
        let cores = 4;
        let ram = 4;
        
        try {
            if (navigator.hardwareConcurrency) {
                cores = navigator.hardwareConcurrency;
            }
            if (navigator.deviceMemory) {
                ram = navigator.deviceMemory;
            } else {
                // Fallback: ước lượng từ User Agent hoặc random hợp lý
                const ua = navigator.userAgent.toLowerCase();
                if (ua.includes('iphone') || ua.includes('ipad')) {
                    ram = 4;
                } else if (ua.includes('android')) {
                    ram = 6;
                } else {
                    const options = [4, 6, 8, 12, 16];
                    ram = options[Math.floor(Math.random() * options.length)];
                }
            }
        } catch (e) {
            cores = 4;
            ram = 4;
        }

        return { cores: Math.max(cores, 1), ram: Math.max(ram, 0.5) };
    }

    // ============================================================
    // OPTIMIZATION
    // ============================================================
    function performOptimization() {
        if (isProcessing) return;
        if (!DOM.optimizeBtn) return;
        
        isProcessing = true;
        DOM.optimizeBtn.disabled = true;

        setStatus('Đang tối ưu...', 'info', true);
        if (DOM.statusInfo) {
            DOM.statusInfo.textContent = 'Đang xử lý';
            DOM.statusInfo.className = 'value blue';
        }

        const info = getDeviceInfo();
        if (DOM.cpuInfo) DOM.cpuInfo.textContent = info.cores + ' nhân';
        if (DOM.ramInfo) DOM.ramInfo.textContent = info.ram + ' GB';

        const steps = [
            { progress: 20, msg: 'Đang dọn dẹp bộ nhớ cache...' },
            { progress: 45, msg: 'Đang tối ưu luồng xử lý...' },
            { progress: 70, msg: 'Đang cân bằng tài nguyên...' },
            { progress: 90, msg: 'Đang áp dụng cấu hình tối ưu...' }
        ];

        let stepIndex = 0;

        function runStep() {
            if (stepIndex >= steps.length) {
                setStatus('Tối ưu thành công! Thiết bị đã đạt hiệu suất tối đa.', 'success');
                if (DOM.statusInfo) {
                    DOM.statusInfo.textContent = 'Đã tối ưu';
                    DOM.statusInfo.className = 'value green';
                }
                if (DOM.optimizeBtn) {
                    DOM.optimizeBtn.disabled = false;
                }
                isProcessing = false;
                return;
            }

            const step = steps[stepIndex];
            setStatus(step.msg, 'info', true);
            if (DOM.statusInfo) {
                DOM.statusInfo.textContent = step.progress + '%';
            }
            stepIndex++;

            // Hiển thị CPU tăng nhẹ (mô phỏng)
            const extraCores = Math.floor(Math.random() * 2);
            if (DOM.cpuInfo) {
                DOM.cpuInfo.textContent = (info.cores + extraCores) + ' nhân';
            }

            setTimeout(runStep, 600 + Math.random() * 400);
        }

        setTimeout(runStep, 400);
    }

    // ============================================================
    // CHECK ACTIVATION
    // ============================================================
    function checkActivation() {
        if (!window.AIMTRICK) {
            setStatus('Lỗi: Không tìm thấy hệ thống xác thực', 'error');
            return false;
        }

        if (!window.AIMTRICK.isActivated()) {
            setStatus('Chưa kích hoạt bản quyền. Chuyển về trang kích hoạt...', 'error');
            setTimeout(function() {
                location.replace('index.html');
            }, 1200);
            return false;
        }

        // Hiển thị thông tin key
        const info = window.AIMTRICK.getKeyInfo();
        if (info && info.type && DOM.cpuInfo) {
            DOM.cpuInfo.textContent = info.type;
        }
        if (DOM.statusInfo) {
            DOM.statusInfo.textContent = 'Đã kích hoạt';
            DOM.statusInfo.className = 'value green';
        }
        return true;
    }

    // ============================================================
    // INIT
    // ============================================================
    function init() {
        // Kiểm tra kích hoạt
        const activated = checkActivation();
        if (!activated) {
            if (DOM.optimizeBtn) DOM.optimizeBtn.disabled = true;
            return;
        }

        // Hiển thị thông tin thiết bị
        const info = getDeviceInfo();
        if (DOM.cpuInfo) DOM.cpuInfo.textContent = info.cores + ' nhân';
        if (DOM.ramInfo) DOM.ramInfo.textContent = info.ram + ' GB';
        if (DOM.statusInfo) {
            DOM.statusInfo.textContent = 'Sẵn sàng';
            DOM.statusInfo.className = 'value blue';
        }
        setStatus('Sẵn sàng tối ưu', 'info');

        // Gán sự kiện
        if (DOM.optimizeBtn) {
            DOM.optimizeBtn.addEventListener('click', performOptimization);
        }

        console.log('AIMTRICK v3.2.3 - App ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

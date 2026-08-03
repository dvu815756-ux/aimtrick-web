/**
 * ============================================================
 * script.js - AIMTRICK Activation System
 * Bản quyền thuộc VTĐZAI - Không sao chép dưới mọi hình thức
 * Version: 3.2.2
 * ============================================================
 */

(function() {
    'use strict';

    // ============================================================
    // CẤU HÌNH HỆ THỐNG
    // ============================================================
    const CONFIG = {
        API_URL: 'https://your-activation-server.com/api/verify',
        TIMEOUT: 8000,
        STORAGE_KEY: 'aimtrick_activation',
        DEVICE_KEY: 'aimtrick_device_id',
        DEMO_MODE: true,
        KEY_TYPES: {
            '24H': { label: '24 giờ', deviceLimit: Infinity, expiryHours: 24 },
            '7D': { label: '7 ngày', deviceLimit: 70, expiryDays: 7 },
            'VV': { label: 'Vĩnh viễn', deviceLimit: 1, expiryDays: Infinity }
        }
    };

    // ============================================================
    // TRẠNG THÁI ỨNG DỤNG
    // ============================================================
    const state = {
        isActivated: false,
        currentKey: null,
        keyType: null,
        deviceCount: 0,
        deviceLimit: 0,
        expiryDate: null,
        deviceId: null,
        isProcessing: false
    };

    // ============================================================
    // DOM REFS
    // ============================================================
    const DOM = {
        container: document.querySelector('.container'),
        logo: document.querySelector('.logo'),
        title: document.querySelector('h1'),
        sub: document.querySelector('.sub'),
        keyInput: document.getElementById('licenseKey'),
        activateBtn: document.getElementById('activateBtn'),
        statusMessage: document.getElementById('statusMessage'),
        keyType: document.getElementById('keyType'),
        deviceLimit: document.getElementById('deviceLimit'),
        expiryInfo: document.getElementById('expiryInfo'),
        footer: document.querySelector('.footer')
    };

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================
    const Utils = {
        generateDeviceId: function() {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substr(2, 8);
            const nav = navigator.userAgent.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
            return 'DEV-' + timestamp + '-' + random + '-' + nav;
        },

        getDeviceId: function() {
            let id = localStorage.getItem(CONFIG.DEVICE_KEY);
            if (!id) {
                id = this.generateDeviceId();
                localStorage.setItem(CONFIG.DEVICE_KEY, id);
            }
            return id;
        },

        now: function() {
            return Date.now();
        },

        formatDate: function(timestamp) {
            if (!timestamp) return '---';
            const date = new Date(timestamp);
            return date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        isExpired: function(expiryTimestamp) {
            if (!expiryTimestamp) return true;
            if (expiryTimestamp === Infinity) return false;
            return Date.now() > expiryTimestamp;
        },

        simpleHash: function(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(36);
        },

        generateDemoKey: function(type) {
            const prefix = type;
            const random = Math.random().toString(36).substr(2, 8).toUpperCase();
            const hash = this.simpleHash(random + Date.now().toString()).substr(0, 4);
            return prefix + '-' + random + '-' + hash;
        },

        isValidKeyFormat: function(key) {
            const clean = key.trim().toUpperCase();
            if (/^24H-[A-Z0-9]{4,}$/.test(clean)) return { valid: true, type: '24H' };
            if (/^7D-[A-Z0-9]{4,}$/.test(clean)) return { valid: true, type: '7D' };
            if (/^VV-[A-Z0-9]{4,}$/.test(clean)) return { valid: true, type: 'VV' };
            return { valid: false };
        }
    };

    // ============================================================
    // DATABASE (localStorage) MANAGEMENT
    // ============================================================
    const DB = {
        get: function() {
            try {
                const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
                if (raw) return JSON.parse(raw);
            } catch (e) {
                console.warn('DB read error:', e);
            }
            return null;
        },

        save: function(data) {
            try {
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
                return true;
            } catch (e) {
                console.error('DB save error:', e);
                return false;
            }
        },

        getDevices: function(key) {
            const data = this.get();
            if (data && data[key]) {
                return data[key].devices || [];
            }
            return [];
        },

        addDevice: function(key, deviceId) {
            const data = this.get() || {};
            if (!data[key]) {
                data[key] = { devices: [] };
            }
            if (!data[key].devices.includes(deviceId)) {
                data[key].devices.push(deviceId);
                this.save(data);
                return true;
            }
            return false;
        },

        isDeviceActivated: function(key, deviceId) {
            const devices = this.getDevices(key);
            return devices.includes(deviceId);
        },

        getDeviceCount: function(key) {
            return this.getDevices(key).length;
        },

        clear: function() {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
        }
    };

    // ============================================================
    // KEY VALIDATION (DEMO & API)
    // ============================================================
    const KeyValidator = {
        validate: async function(key) {
            const cleanKey = key.trim().toUpperCase();
            if (!cleanKey) {
                return { valid: false, reason: 'Vui lòng nhập mã kích hoạt' };
            }

            const formatCheck = Utils.isValidKeyFormat(cleanKey);
            if (!formatCheck.valid) {
                return { valid: false, reason: 'Mã kích hoạt không đúng định dạng' };
            }

            if (CONFIG.DEMO_MODE) {
                return this.validateLocal(cleanKey, formatCheck.type);
            }

            try {
                const response = await this.callAPI(cleanKey);
                if (response.valid) {
                    return {
                        valid: true,
                        key: cleanKey,
                        keyData: response.keyData,
                        serverData: response
                    };
                } else {
                    return { valid: false, reason: response.reason || 'Key không hợp lệ' };
                }
            } catch (error) {
                console.error('API error:', error);
                if (CONFIG.DEMO_MODE) {
                    return this.validateLocal(cleanKey, formatCheck.type);
                }
                return { valid: false, reason: 'Lỗi kết nối server, vui lòng thử lại' };
            }
        },

        validateLocal: function(key, type) {
            const typeInfo = CONFIG.KEY_TYPES[type];
            if (!typeInfo) {
                return { valid: false, reason: 'Loại key không hợp lệ' };
            }

            const blacklist = ['24H-DEMO-EXPIRED', '7D-DEMO-BLOCKED'];
            if (blacklist.includes(key)) {
                return { valid: false, reason: 'Key đã bị khóa' };
            }

            let expiryTimestamp = Infinity;
            if (typeInfo.expiryHours) {
                expiryTimestamp = Date.now() + (typeInfo.expiryHours * 60 * 60 * 1000);
            } else if (typeInfo.expiryDays && typeInfo.expiryDays !== Infinity) {
                expiryTimestamp = Date.now() + (typeInfo.expiryDays * 24 * 60 * 60 * 1000);
            }

            const deviceCount = DB.getDeviceCount(key);
            if (deviceCount >= typeInfo.deviceLimit) {
                return {
                    valid: false,
                    reason: 'Đã đạt giới hạn ' + typeInfo.deviceLimit + ' thiết bị',
                    deviceCount: deviceCount,
                    deviceLimit: typeInfo.deviceLimit
                };
            }

            return {
                valid: true,
                key: key,
                keyData: {
                    type: type,
                    typeLabel: typeInfo.label,
                    deviceLimit: typeInfo.deviceLimit,
                    expiryTimestamp: expiryTimestamp,
                    currentDevices: deviceCount
                }
            };
        },

        callAPI: function(key) {
            return new Promise((resolve, reject) => {
                const controller = new AbortController();
                const timeout = setTimeout(() => {
                    controller.abort();
                    reject(new Error('Request timeout'));
                }, CONFIG.TIMEOUT);

                fetch(CONFIG.API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Device-Id': state.deviceId
                    },
                    body: JSON.stringify({ key: key, deviceId: state.deviceId }),
                    signal: controller.signal
                })
                .then(response => {
                    clearTimeout(timeout);
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }
                    return response.json();
                })
                .then(data => {
                    resolve(data);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
        }
    };

    // ============================================================
    // ACTIVATION ENGINE
    // ============================================================
    const ActivationEngine = {
        activate: async function(key) {
            if (state.isProcessing) return;
            state.isProcessing = true;
            this.setStatus('Đang xác thực...', 'info', true);

            try {
                const result = await KeyValidator.validate(key);

                if (!result.valid) {
                    this.setStatus(result.reason, 'error');
                    state.isProcessing = false;
                    return false;
                }

                const isActivated = DB.isDeviceActivated(result.key, state.deviceId);
                if (isActivated) {
                    this.setActivatedState(result.key, result.keyData);
                    this.setStatus('Thiết bị đã được kích hoạt', 'success');
                    state.isProcessing = false;
                    // Chuyển hướng sau 300ms khi thiết bị đã kích hoạt
                    setTimeout(() => {
                        location.replace("app.html");
                    }, 300);
                    return true;
                }

                const added = DB.addDevice(result.key, state.deviceId);
                if (!added) {
                    this.setStatus('Không thể kích hoạt thiết bị', 'error');
                    state.isProcessing = false;
                    return false;
                }

                this.setActivatedState(result.key, result.keyData);
                this.setStatus('Kích hoạt thành công!', 'success');

                // Lưu session và chuyển hướng sau 800ms
                this.saveSession(result.key, result.keyData);
                setTimeout(() => {
                    location.replace("app.html");
                }, 800);

                state.isProcessing = false;
                return true;

            } catch (error) {
                console.error('Activation error:', error);
                this.setStatus('Lỗi hệ thống, vui lòng thử lại', 'error');
                state.isProcessing = false;
                return false;
            }
        },

        setActivatedState: function(key, keyData) {
            const { typeLabel, deviceLimit, expiryTimestamp, currentDevices } = keyData;
            const deviceCount = DB.getDeviceCount(key);

            state.isActivated = true;
            state.currentKey = key;
            state.keyType = typeLabel;
            state.deviceCount = deviceCount;
            state.deviceLimit = deviceLimit;

            DOM.keyType.textContent = typeLabel;
            DOM.deviceLimit.textContent = deviceLimit === Infinity ? '∞' : (deviceCount + '/' + deviceLimit);
            DOM.expiryInfo.textContent = expiryTimestamp === Infinity ? 'Vĩnh viễn' : Utils.formatDate(expiryTimestamp);

            DOM.keyInput.disabled = true;
            DOM.activateBtn.disabled = true;
            DOM.activateBtn.textContent = '✓ ĐÃ KÍCH HOẠT';

            DOM.container.classList.add('activated');
            DOM.keyInput.value = key;

            document.dispatchEvent(new CustomEvent('aimtrick:activated', {
                detail: { key, keyData }
            }));
        },

        saveSession: function(key, keyData) {
            sessionStorage.setItem('aimtrick_session', JSON.stringify({
                key: key,
                keyData: keyData,
                timestamp: Date.now()
            }));
        },

        restoreSession: function() {
            try {
                const raw = sessionStorage.getItem('aimtrick_session');
                if (!raw) return false;
                const data = JSON.parse(raw);
                if (!data.key || !data.keyData) return false;

                const isActive = DB.isDeviceActivated(data.key, state.deviceId);
                if (!isActive) {
                    sessionStorage.removeItem('aimtrick_session');
                    return false;
                }

                this.setActivatedState(data.key, data.keyData);
                this.setStatus('Đã kích hoạt', 'success');
                // Chuyển hướng sau 300ms khi khôi phục session thành công
                setTimeout(() => {
                    location.replace("app.html");
                }, 300);
                return true;
            } catch (e) {
                return false;
            }
        },

        setStatus: function(message, type = 'info', showSpinner = false) {
            DOM.statusMessage.className = 'status ' + type;
            let html = '';
            if (showSpinner) {
                html += '<span class="spinner"></span> ';
            } else {
                const icons = {
                    success: '✔',
                    error: '✖',
                    warning: '⚠',
                    info: '◆'
                };
                html += (icons[type] || '◆') + ' ';
            }
            html += message;
            DOM.statusMessage.innerHTML = html;
        },

        reset: function() {
            state.isActivated = false;
            state.currentKey = null;
            state.keyType = null;
            state.deviceCount = 0;
            state.deviceLimit = 0;
            state.expiryDate = null;

            DOM.keyInput.disabled = false;
            DOM.keyInput.value = '';
            DOM.activateBtn.disabled = false;
            DOM.activateBtn.textContent = 'KÍCH HOẠT';
            DOM.keyType.textContent = '---';
            DOM.deviceLimit.textContent = '---';
            DOM.expiryInfo.textContent = '---';
            DOM.container.classList.remove('activated');

            sessionStorage.removeItem('aimtrick_session');
            this.setStatus('Nhập key để kích hoạt', 'info');
        }
    };

    // ============================================================
    // EVENT HANDLERS
    // ============================================================
    function initEventHandlers() {
        DOM.activateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const key = DOM.keyInput.value;
            if (!key.trim()) {
                ActivationEngine.setStatus('Vui lòng nhập mã kích hoạt', 'warning');
                return;
            }
            ActivationEngine.activate(key);
        });

        DOM.keyInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                DOM.activateBtn.click();
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
    // DEMO KEY GENERATOR (Ẩn - dùng cho testing)
    // ============================================================
    function initDemoTools() {
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                const key = Utils.generateDemoKey('24H');
                DOM.keyInput.value = key;
                ActivationEngine.setStatus('Đã tạo key demo 24H', 'info');
                console.log('Demo key 24H:', key);
            }
            if (e.ctrlKey && e.shiftKey && e.key === '7') {
                e.preventDefault();
                const key = Utils.generateDemoKey('7D');
                DOM.keyInput.value = key;
                ActivationEngine.setStatus('Đã tạo key demo 7D', 'info');
                console.log('Demo key 7D:', key);
            }
            if (e.ctrlKey && e.shiftKey && e.key === 'V') {
                e.preventDefault();
                const key = Utils.generateDemoKey('VV');
                DOM.keyInput.value = key;
                ActivationEngine.setStatus('Đã tạo key demo VV', 'info');
                console.log('Demo key VV:', key);
            }
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                if (confirm('Reset toàn bộ dữ liệu kích hoạt?')) {
                    DB.clear();
                    sessionStorage.removeItem('aimtrick_session');
                    ActivationEngine.reset();
                    ActivationEngine.setStatus('Đã reset hệ thống', 'warning');
                }
            }
        });
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    function init() {
        state.deviceId = Utils.getDeviceId();
        initEventHandlers();
        if (CONFIG.DEMO_MODE) {
            initDemoTools();
        }

        const restored = ActivationEngine.restoreSession();

        if (!restored) {
            const params = new URLSearchParams(window.location.search);
            const urlKey = params.get('key');
            if (urlKey) {
                DOM.keyInput.value = urlKey.trim().toUpperCase();
                setTimeout(() => {
                    DOM.activateBtn.click();
                }, 500);
            } else {
                ActivationEngine.setStatus('Nhập key để kích hoạt', 'info');
            }
        }

        console.log('AIMTRICK v3.2.2 - Hệ thống kích hoạt đã sẵn sàng');
        console.log('Device ID:', state.deviceId);

        document.dispatchEvent(new CustomEvent('aimtrick:ready', {
            detail: { deviceId: state.deviceId, isActivated: state.isActivated }
        }));
    }

    // ============================================================
    // EXPOSE API (cho tích hợp bên ngoài)
    // ============================================================
    window.AIMTRICK = {
        version: '3.2.2',
        state: state,
        activate: function(key) {
            return ActivationEngine.activate(key);
        },
        reset: function() {
            ActivationEngine.reset();
        },
        getDeviceId: function() {
            return state.deviceId;
        },
        isActivated: function() {
            return state.isActivated;
        },
        getCurrentKey: function() {
            return state.currentKey;
        },
        getKeyInfo: function() {
            return {
                type: state.keyType,
                deviceCount: state.deviceCount,
                deviceLimit: state.deviceLimit
            };
        },
        generateDemoKey: function(type) {
            const validTypes = ['24H', '7D', 'VV'];
            if (!validTypes.includes(type)) {
                throw new Error('Loại key không hợp lệ. Chỉ hỗ trợ: 24H, 7D, VV');
            }
            return Utils.generateDemoKey(type);
        }
    };

    // ============================================================
    // KHỞI CHẠY
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

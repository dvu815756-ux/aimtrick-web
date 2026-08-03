/* auth.js - Core Authentication v3.2.4 */
(function() {
    'use strict';

    // ============================================================
    // CẤU HÌNH
    // ============================================================
    const CONFIG = {
        STORAGE_KEY: 'aimtrick_auth',
        SESSION_KEY: 'aimtrick_session',
        DEVICE_KEY: 'aimtrick_device',
        DEMO_MODE: true,
        VERSION: '3.2.4',
        KEY_TYPES: {
            '24H': { label: '24 giờ', deviceLimit: Infinity, expiryHours: 24 },
            '7D': { label: '7 ngày', deviceLimit: 70, expiryDays: 7 },
            'VV': { label: 'Vĩnh viễn', deviceLimit: 1, expiryDays: Infinity }
        }
    };

    // ============================================================
    // STORAGE WRAPPER (XỬ LÝ LỖI TOÀN DIỆN)
    // ============================================================
    const Storage = {
        _available: true,

        _check: function() {
            try {
                localStorage.setItem('_test', '1');
                localStorage.removeItem('_test');
                return true;
            } catch (e) {
                this._available = false;
                return false;
            }
        },

        get: function(key) {
            if (!this._available && !this._check()) return null;
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        },

        set: function(key, data) {
            if (!this._available && !this._check()) return false;
            try {
                localStorage.setItem(key, JSON.stringify(data));
                return true;
            } catch (e) {
                return false;
            }
        },

        getSession: function(key) {
            if (!this._available && !this._check()) return null;
            try {
                const raw = sessionStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        },

        setSession: function(key, data) {
            if (!this._available && !this._check()) return false;
            try {
                sessionStorage.setItem(key, JSON.stringify(data));
                return true;
            } catch (e) {
                return false;
            }
        },

        remove: function(key) {
            if (!this._available && !this._check()) return false;
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                return false;
            }
        },

        removeSession: function(key) {
            if (!this._available && !this._check()) return false;
            try {
                sessionStorage.removeItem(key);
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    // Kiểm tra storage ngay khi khởi tạo
    Storage._check();

    // ============================================================
    // DEVICE ID (ỔN ĐỊNH, KHÔNG BỊ RESET)
    // ============================================================
    const DeviceId = {
        _id: null,

        _generate: function() {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substr(2, 8);
            const nav = navigator.userAgent.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
            return 'DEV-' + timestamp + '-' + random + '-' + nav;
        },

        get: function() {
            if (this._id) return this._id;

            let id = Storage.get(CONFIG.DEVICE_KEY);
            if (id && typeof id === 'string' && id.startsWith('DEV-')) {
                this._id = id;
                return id;
            }

            id = this._generate();
            Storage.set(CONFIG.DEVICE_KEY, id);
            this._id = id;
            return id;
        },

        reset: function() {
            Storage.remove(CONFIG.DEVICE_KEY);
            this._id = null;
            return this.get();
        }
    };

    // ============================================================
    // VALIDATOR
    // ============================================================
    const Validator = {
        isValidFormat: function(key) {
            const clean = key.trim().toUpperCase();
            if (/^24H-[A-Z0-9]{4,}$/.test(clean)) return { valid: true, type: '24H' };
            if (/^7D-[A-Z0-9]{4,}$/.test(clean)) return { valid: true, type: '7D' };
            if (/^VV-[A-Z0-9]{4,}$/.test(clean)) return { valid: true, type: 'VV' };
            return { valid: false };
        },

        validate: function(key) {
            const cleanKey = key.trim().toUpperCase();
            if (!cleanKey) {
                return { valid: false, reason: 'Vui lòng nhập mã kích hoạt' };
            }

            const formatCheck = this.isValidFormat(cleanKey);
            if (!formatCheck.valid) {
                return { valid: false, reason: 'Mã kích hoạt không đúng định dạng (VD: 24H-XXXX-XXXX)' };
            }

            if (!CONFIG.DEMO_MODE) {
                return { valid: false, reason: 'Hệ thống đang trong chế độ bảo trì' };
            }

            return this.validateLocal(cleanKey, formatCheck.type);
        },

        validateLocal: function(key, type) {
            const typeInfo = CONFIG.KEY_TYPES[type];
            if (!typeInfo) {
                return { valid: false, reason: 'Loại key không hợp lệ' };
            }

            // Blacklist
            const blacklist = ['24H-DEMO-EXPIRED', '7D-DEMO-BLOCKED'];
            if (blacklist.includes(key)) {
                return { valid: false, reason: 'Key đã bị khóa' };
            }

            // Tính thời gian hết hạn (xử lý Infinity an toàn)
            let expiryTimestamp = null;
            if (typeInfo.expiryHours) {
                expiryTimestamp = Date.now() + (typeInfo.expiryHours * 60 * 60 * 1000);
            } else if (typeInfo.expiryDays && typeInfo.expiryDays !== Infinity) {
                expiryTimestamp = Date.now() + (typeInfo.expiryDays * 24 * 60 * 60 * 1000);
            } else {
                expiryTimestamp = Infinity;
            }

            // Kiểm tra giới hạn thiết bị
            const data = Storage.get(CONFIG.STORAGE_KEY) || {};
            const devices = (data[key] && data[key].devices) ? data[key].devices : [];
            const deviceLimit = typeInfo.deviceLimit;

            if (devices.length >= deviceLimit) {
                return {
                    valid: false,
                    reason: 'Đã đạt giới hạn ' + deviceLimit + ' thiết bị',
                    deviceCount: devices.length,
                    deviceLimit: deviceLimit
                };
            }

            return {
                valid: true,
                key: key,
                keyData: {
                    type: type,
                    typeLabel: typeInfo.label,
                    deviceLimit: deviceLimit,
                    expiryTimestamp: expiryTimestamp,
                    currentDevices: devices.length
                }
            };
        }
    };

    // ============================================================
    // AUTH CORE
    // ============================================================
    const Auth = {
        state: {
            isActivated: false,
            currentKey: null,
            keyType: null,
            deviceCount: 0,
            deviceLimit: 0,
            expiryDate: null,
            deviceId: null,
            version: CONFIG.VERSION
        },

        init: function() {
            this.state.deviceId = DeviceId.get();
            this._restore();
            return this;
        },

        activate: function(key) {
            try {
                const result = Validator.validate(key);
                if (!result.valid) {
                    return { success: false, reason: result.reason };
                }

                const deviceId = this.state.deviceId;
                const data = Storage.get(CONFIG.STORAGE_KEY) || {};

                // Kiểm tra đã kích hoạt chưa
                const devices = (data[result.key] && data[result.key].devices) ? data[result.key].devices : [];
                if (devices.includes(deviceId)) {
                    this._setState(result.key, result.keyData);
                    return { success: true, already: true, keyData: result.keyData };
                }

                // Thêm thiết bị mới
                if (!data[result.key]) {
                    data[result.key] = { devices: [] };
                }
                data[result.key].devices.push(deviceId);

                if (!Storage.set(CONFIG.STORAGE_KEY, data)) {
                    return { success: false, reason: 'Không thể lưu dữ liệu kích hoạt' };
                }

                this._setState(result.key, result.keyData);
                this._saveSession(result.key, result.keyData);
                return { success: true, already: false, keyData: result.keyData };

            } catch (e) {
                return { success: false, reason: 'Lỗi hệ thống: ' + e.message };
            }
        },

        isActivated: function() {
            if (!this.state.isActivated) return false;

            // Kiểm tra thời gian hết hạn
            if (this.state.expiryDate !== null && this.state.expiryDate !== Infinity) {
                if (Date.now() > this.state.expiryDate) {
                    this.reset();
                    return false;
                }
            }
            return true;
        },

        getDeviceId: function() {
            return this.state.deviceId;
        },

        getKeyInfo: function() {
            return {
                key: this.state.currentKey,
                type: this.state.keyType,
                deviceCount: this.state.deviceCount,
                deviceLimit: this.state.deviceLimit,
                expiryDate: this.state.expiryDate,
                version: this.state.version
            };
        },

        reset: function() {
            this.state.isActivated = false;
            this.state.currentKey = null;
            this.state.keyType = null;
            this.state.deviceCount = 0;
            this.state.deviceLimit = 0;
            this.state.expiryDate = null;
            Storage.removeSession(CONFIG.SESSION_KEY);
        },

        generateDemoKey: function(type) {
            const validTypes = ['24H', '7D', 'VV'];
            if (!validTypes.includes(type)) {
                throw new Error('Loại key không hợp lệ. Chỉ hỗ trợ: 24H, 7D, VV');
            }
            const random = Math.random().toString(36).substr(2, 8).toUpperCase();
            const hash = Math.abs(random.split('').reduce(function(h, c) {
                return ((h << 5) - h) + c.charCodeAt(0);
            }, 0) & 0x7FFFFFFF).toString(36).substr(0, 4);
            return type + '-' + random + '-' + hash.toUpperCase();
        },

        // Private
        _setState: function(key, keyData) {
            const { typeLabel, deviceLimit, expiryTimestamp } = keyData;
            const data = Storage.get(CONFIG.STORAGE_KEY) || {};
            const devices = (data[key] && data[key].devices) ? data[key].devices : [];

            this.state.isActivated = true;
            this.state.currentKey = key;
            this.state.keyType = typeLabel;
            this.state.deviceCount = devices.length;
            this.state.deviceLimit = deviceLimit;
            this.state.expiryDate = expiryTimestamp;
        },

        _saveSession: function(key, keyData) {
            Storage.setSession(CONFIG.SESSION_KEY, {
                key: key,
                keyData: keyData,
                timestamp: Date.now()
            });
        },

        _restore: function() {
            try {
                const session = Storage.getSession(CONFIG.SESSION_KEY);
                if (!session || !session.key || !session.keyData) {
                    return false;
                }

                // Kiểm tra hết hạn
                const expiry = session.keyData.expiryTimestamp;
                if (expiry !== null && expiry !== Infinity && Date.now() > expiry) {
                    Storage.removeSession(CONFIG.SESSION_KEY);
                    return false;
                }

                // Kiểm tra thiết bị
                const data = Storage.get(CONFIG.STORAGE_KEY) || {};
                const devices = (data[session.key] && data[session.key].devices) ? data[session.key].devices : [];
                if (!devices.includes(this.state.deviceId)) {
                    Storage.removeSession(CONFIG.SESSION_KEY);
                    return false;
                }

                this._setState(session.key, session.keyData);
                return true;

            } catch (e) {
                return false;
            }
        }
    };

    // ============================================================
    // GLOBAL ERROR HANDLER
    // ============================================================
    window.addEventListener('error', function(e) {
        console.error('[AIMTRICK] Uncaught error:', e.message);
    });

    window.addEventListener('unhandledrejection', function(e) {
        console.error('[AIMTRICK] Unhandled rejection:', e.reason);
    });

    // ============================================================
    // EXPOSE
    // ============================================================
    window.AIMTRICK = Auth.init();

    // Log version
    console.log('[AIMTRICK] v' + CONFIG.VERSION + ' initialized');
    console.log('[AIMTRICK] Device ID:', window.AIMTRICK.getDeviceId());

})();

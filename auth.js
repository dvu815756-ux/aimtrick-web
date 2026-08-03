/**
 * ============================================================
 * auth.js - AIMTRICK Authentication Core
 * Bản quyền thuộc VTĐZAI - Không sao chép dưới mọi hình thức
 * Version: 3.2.3
 * ============================================================
 */

(function() {
    'use strict';

    // ============================================================
    // CẤU HÌNH HỆ THỐNG
    // ============================================================
    const CONFIG = {
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
    // TRẠNG THÁI
    // ============================================================
    const state = {
        isActivated: false,
        currentKey: null,
        keyType: null,
        deviceCount: 0,
        deviceLimit: 0,
        expiryDate: null,
        deviceId: null
    };

    // ============================================================
    // UTILITY
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

        formatDate: function(timestamp) {
            if (!timestamp) return '---';
            if (timestamp === Infinity) return 'Vĩnh viễn';
            const date = new Date(timestamp);
            return date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
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
    // DATABASE
    // ============================================================
    const DB = {
        get: function() {
            try {
                const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
                if (raw) return JSON.parse(raw);
            } catch (e) {}
            return null;
        },

        save: function(data) {
            try {
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
                return true;
            } catch (e) {
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
    // VALIDATOR
    // ============================================================
    const Validator = {
        validate: function(key) {
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

            return { valid: false, reason: 'Server chưa được cấu hình' };
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
        }
    };

    // ============================================================
    // AUTH ENGINE (PUBLIC API)
    // ============================================================
    const Auth = {
        state: state,

        init: function() {
            state.deviceId = Utils.getDeviceId();
            this.restore();
            return this;
        },

        activate: function(key) {
            const result = Validator.validate(key);
            if (!result.valid) {
                return { success: false, reason: result.reason };
            }

            const isActivated = DB.isDeviceActivated(result.key, state.deviceId);
            if (isActivated) {
                this._setState(result.key, result.keyData);
                return { success: true, already: true, keyData: result.keyData };
            }

            const added = DB.addDevice(result.key, state.deviceId);
            if (!added) {
                return { success: false, reason: 'Không thể kích hoạt thiết bị' };
            }

            this._setState(result.key, result.keyData);
            this._saveSession(result.key, result.keyData);
            return { success: true, already: false, keyData: result.keyData };
        },

        restore: function() {
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

                this._setState(data.key, data.keyData);
                return true;
            } catch (e) {
                return false;
            }
        },

        reset: function() {
            state.isActivated = false;
            state.currentKey = null;
            state.keyType = null;
            state.deviceCount = 0;
            state.deviceLimit = 0;
            state.expiryDate = null;
            sessionStorage.removeItem('aimtrick_session');
        },

        isActivated: function() {
            return state.isActivated;
        },

        getDeviceId: function() {
            return state.deviceId;
        },

        getKeyInfo: function() {
            return {
                key: state.currentKey,
                type: state.keyType,
                deviceCount: state.deviceCount,
                deviceLimit: state.deviceLimit,
                expiryDate: state.expiryDate
            };
        },

        // Internal
        _setState: function(key, keyData) {
            const { typeLabel, deviceLimit, expiryTimestamp } = keyData;
            const deviceCount = DB.getDeviceCount(key);

            state.isActivated = true;
            state.currentKey = key;
            state.keyType = typeLabel;
            state.deviceCount = deviceCount;
            state.deviceLimit = deviceLimit;
            state.expiryDate = expiryTimestamp;
        },

        _saveSession: function(key, keyData) {
            sessionStorage.setItem('aimtrick_session', JSON.stringify({
                key: key,
                keyData: keyData,
                timestamp: Date.now()
            }));
        },

        // Demo key generator
        generateDemoKey: function(type) {
            const validTypes = ['24H', '7D', 'VV'];
            if (!validTypes.includes(type)) {
                throw new Error('Loại key không hợp lệ');
            }
            const prefix = type;
            const random = Math.random().toString(36).substr(2, 8).toUpperCase();
            const hash = Math.abs(random.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0) & 0x7FFFFFFF).toString(36).substr(0, 4);
            return prefix + '-' + random + '-' + hash.toUpperCase();
        }
    };

    // ============================================================
    // EXPOSE
    // ============================================================
    window.AIMTRICK = Auth.init();

})();

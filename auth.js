/* auth.js - Sửa phần restore và isActivated */
// ============================================================
// AUTH CORE - FIXED
// ============================================================
const Auth = {
    // ... các phần khác giữ nguyên ...

    isActivated: function() {
        // Luôn kiểm tra từ storage, không dùng state cache
        const session = Storage.getSession(CONFIG.SESSION_KEY);
        if (!session || !session.key || !session.keyData) {
            this.state.isActivated = false;
            return false;
        }

        // Kiểm tra hết hạn
        const expiry = session.keyData.expiryTimestamp;
        if (expiry !== null && expiry !== Infinity && Date.now() > expiry) {
            Storage.removeSession(CONFIG.SESSION_KEY);
            this.state.isActivated = false;
            return false;
        }

        // Kiểm tra thiết bị
        const data = Storage.get(CONFIG.STORAGE_KEY) || {};
        const devices = (data[session.key] && data[session.key].devices) ? data[session.key].devices : [];
        if (!devices.includes(this.state.deviceId)) {
            Storage.removeSession(CONFIG.SESSION_KEY);
            this.state.isActivated = false;
            return false;
        }

        // Cập nhật state
        this.state.isActivated = true;
        this.state.currentKey = session.key;
        this.state.keyType = session.keyData.typeLabel;
        this.state.expiryDate = session.keyData.expiryTimestamp;
        
        // Cập nhật deviceCount
        this.state.deviceCount = devices.length;
        this.state.deviceLimit = session.keyData.deviceLimit || Infinity;
        
        return true;
    },

    // ... code khác ...
};

// auth.js - VTĐZAI - HỆ THỐNG KEY & SUPABASE
(function() {
    // ===== CẤU HÌNH SUPABASE =====
    // THAY THẾ BẰNG URL VÀ ANON KEY CỦA BẠN
    const SUPABASE_URL = 'https://dgcnstiwchdqlgddcnca.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnY25zdGl3Y2hkcWxnZGRjbmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU0MjU2MDAsImV4cCI6MjAzMTAwMTYwMH0.6hJkLmN9qR2tX7wY4zA1bC3dE5fG8iK0oLpQ2sT4uV6';
    // =================================

    const STORAGE_KEY = 'vtd_auth_data';

    async function supabaseRequest(endpoint, method = 'GET', body = null) {
        const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
        
        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Prefer': 'return=representation'
        };

        const options = {
            method: method,
            headers: headers,
            mode: 'cors',
            credentials: 'omit'
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
            }
            return await response.json();
        } catch (error) {
            throw new Error(`Không thể kết nối Supabase: ${error.message}`);
        }
    }

    function getDeviceId() {
        let deviceId = localStorage.getItem('vtd_device_id');
        if (!deviceId) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(0, 0, 128, 64);
            ctx.fillStyle = '#fff';
            ctx.fillText('VTĐZAI', 10, 10);
            const fingerprint = canvas.toDataURL();
            let hash = 0;
            for (let i = 0; i < fingerprint.length; i++) {
                const char = fingerprint.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            deviceId = 'DEV_' + Math.abs(hash).toString(16).padStart(12, '0').toUpperCase();
            localStorage.setItem('vtd_device_id', deviceId);
        }
        return deviceId;
    }

    async function activateKeyWithSupabase(rawKey) {
        const deviceId = getDeviceId();
        const keyCode = rawKey.trim().toUpperCase();

        try {
            // Kiểm tra key tồn tại
            const keys = await supabaseRequest(
                `keys?key_code=eq.${encodeURIComponent(keyCode)}&select=*`
            );
            if (!keys || keys.length === 0) {
                return { success: false, message: 'KEY KHÔNG TỒN TẠI' };
            }
            const keyData = keys[0];
            if (!keyData.is_active) {
                return { success: false, message: 'KEY ĐÃ BỊ VÔ HIỆU HÓA' };
            }

            const expiryType = keyData.expiry_type;
            const deviceLimit = keyData.device_limit;

            // Kiểm tra giới hạn device cho key 7D
            if (expiryType === '7D') {
                const countResult = await supabaseRequest(
                    `device_count?key_code=eq.${encodeURIComponent(keyCode)}&select=count`
                );
                const currentCount = (countResult && countResult.length > 0) ? countResult[0].count : 0;
                if (currentCount >= deviceLimit) {
                    return { success: false, message: 'KEY 7 NGÀY ĐÃ ĐẠT GIỚI HẠN 70 THIẾT BỊ' };
                }
            }

            // Kiểm tra key VV đã dùng trên device khác
            if (expiryType === 'VV') {
                const existing = await supabaseRequest(
                    `activations?key_code=eq.${encodeURIComponent(keyCode)}&select=device_id`
                );
                if (existing && existing.length > 0) {
                    const usedDevice = existing[0].device_id;
                    if (usedDevice !== deviceId) {
                        return { success: false, message: 'KEY VĨNH VIỄN ĐÃ ĐƯỢC SỬ DỤNG TRÊN THIẾT BỊ KHÁC' };
                    }
                }
            }

            // Kiểm tra device đã kích hoạt chưa
            const existingAct = await supabaseRequest(
                `activations?key_code=eq.${encodeURIComponent(keyCode)}&device_id=eq.${encodeURIComponent(deviceId)}&select=*`
            );
            if (existingAct && existingAct.length > 0) {
                const validUntil = expiryType === '24H' ? new Date(Date.now() + 24*60*60*1000).toISOString() :
                                   expiryType === '7D' ? new Date(Date.now() + 7*24*60*60*1000).toISOString() :
                                   null;
                await supabaseRequest(
                    `activations?key_code=eq.${encodeURIComponent(keyCode)}&device_id=eq.${encodeURIComponent(deviceId)}`,
                    'PATCH',
                    { valid_until: validUntil }
                );
            } else {
                const validUntil = expiryType === '24H' ? new Date(Date.now() + 24*60*60*1000).toISOString() :
                                   expiryType === '7D' ? new Date(Date.now() + 7*24*60*60*1000).toISOString() :
                                   null;
                await supabaseRequest('activations', 'POST', {
                    key_code: keyCode,
                    device_id: deviceId,
                    valid_until: validUntil
                });
            }

            const authData = {
                key: keyCode,
                expiry: expiryType,
                deviceId: deviceId,
                activatedAt: Date.now(),
                validUntil: expiryType === 'VV' ? Infinity : Date.now() + 
                    (expiryType === '24H' ? 24*60*60*1000 : 7*24*60*60*1000)
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
            return { success: true, data: authData };

        } catch (error) {
            return { success: false, message: 'LỖI KẾT NỐI SUPABASE: ' + error.message };
        }
    }

    async function checkActivationRemote() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { valid: false, reason: 'CHƯA KÍCH HOẠT' };
        try {
            const data = JSON.parse(raw);
            const deviceId = getDeviceId();
            if (data.deviceId !== deviceId) {
                localStorage.removeItem(STORAGE_KEY);
                return { valid: false, reason: 'THIẾT BỊ KHÔNG KHỚP' };
            }
            const keys = await supabaseRequest(
                `keys?key_code=eq.${encodeURIComponent(data.key)}&select=is_active`
            );
            if (!keys || keys.length === 0 || !keys[0].is_active) {
                localStorage.removeItem(STORAGE_KEY);
                return { valid: false, reason: 'KEY ĐÃ BỊ VÔ HIỆU HÓA' };
            }
            if (data.expiry === 'VV') {
                return { valid: true, data: data };
            }
            if (Date.now() > data.validUntil) {
                localStorage.removeItem(STORAGE_KEY);
                return { valid: false, reason: 'KEY ĐÃ HẾT HẠN' };
            }
            return { valid: true, data: data };
        } catch (error) {
            localStorage.removeItem(STORAGE_KEY);
            return { valid: false, reason: 'LỖI KẾT NỐI: ' + error.message };
        }
    }

    function checkActivation() {
        return checkActivationRemote();
    }

    function getOffsetData() {
        return {
            moveSpeedScale: '0x20',
            XMoveRange: '0x24',
            YMoveRange: '0x2c',
            MAX_FOV: '0x34',
            MIN_FOV: '0x38',
            EventLogClickType: '0x40',
            SoundId: '0x48',
            EffectId: '0x50',
            EffectObject: '0x58',
            EffectShowTime: '0x60',
            IsCoverDefaultSound: '0x64',
            PhotoCamera: '0x68',
            m_OrgFOV: '0x70',
            m_IsPlayerInTrigger: '0x74',
            SoundResId: '0x78',
            m_ModelMatch: '0x80',
            m_AsyncLoadTickets: '0x88',
            BanTriggerMatchTime: '0x90',
            m_IsTraingMode: '0x94',
            m_IsInPhotogragphMode: '0x95'
        };
    }

    window.VTDZAI_AUTH = {
        activateKeyWithSupabase: activateKeyWithSupabase,
        checkActivation: checkActivation,
        getDeviceId: getDeviceId,
        getOffsetData: getOffsetData,
        supabaseRequest: supabaseRequest
    };
})();

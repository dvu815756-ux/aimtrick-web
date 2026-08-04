// auth.js - VTĐZAI - HỆ THỐNG KEY & SUPABASE (dùng chung)
(function() {
    // ===== CẤU HÌNH SUPABASE =====
    // THAY THẾ BẰNG URL VÀ ANON KEY CỦA BẠN
    const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
    const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
    // ==============================

    const STORAGE_KEY = 'vtd_auth_data';
    const ACTIVATED_KEY = 'vtd_activated';

    // Hàm gọi API Supabase REST (thay vì dùng client)
    async function supabaseRequest(endpoint, method = 'GET', body = null) {
        const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        };
        const options = {
            method: method,
            headers: headers
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Supabase error ${response.status}: ${text}`);
        }
        return response.json();
    }

    // Tạo device ID
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

    // Hàm kích hoạt với Supabase
    async function activateKeyWithSupabase(rawKey) {
        const deviceId = getDeviceId();
        const keyCode = rawKey.trim().toUpperCase();

        // Bước 1: Kiểm tra key tồn tại và còn hiệu lực
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

        // Bước 2: Kiểm tra số lượng thiết bị cho key 7D
        if (expiryType === '7D') {
            const countResult = await supabaseRequest(
                `device_count?key_code=eq.${encodeURIComponent(keyCode)}&select=count`
            );
            const currentCount = (countResult && countResult.length > 0) ? countResult[0].count : 0;
            if (currentCount >= deviceLimit) {
                return { success: false, message: 'KEY 7 NGÀY ĐÃ ĐẠT GIỚI HẠN 70 THIẾT BỊ' };
            }
        }

        // Bước 3: Kiểm tra key VV đã dùng trên device khác
        if (expiryType === 'VV') {
            const existing = await supabaseRequest(
                `activations?key_code=eq.${encodeURIComponent(keyCode)}&select=device_id`
            );
            if (existing && existing.length > 0) {
                const usedDevice = existing[0].device_id;
                if (usedDevice !== deviceId) {
                    return { success: false, message: 'KEY VĨNH VIỄN ĐÃ ĐƯỢC SỬ DỤNG TRÊN THIẾT BỊ KHÁC' };
                }
                // Cùng device -> gia hạn
            }
        }

        // Bước 4: Kiểm tra xem device đã kích hoạt key này chưa
        const existingAct = await supabaseRequest(
            `activations?key_code=eq.${encodeURIComponent(keyCode)}&device_id=eq.${encodeURIComponent(deviceId)}&select=*`
        );
        if (existingAct && existingAct.length > 0) {
            // Đã kích hoạt trước đó, cập nhật thời gian
            const validUntil = expiryType === '24H' ? new Date(Date.now() + 24*60*60*1000).toISOString() :
                               expiryType === '7D' ? new Date(Date.now() + 7*24*60*60*1000).toISOString() :
                               null;
            await supabaseRequest(
                `activations?key_code=eq.${encodeURIComponent(keyCode)}&device_id=eq.${encodeURIComponent(deviceId)}`,
                'PATCH',
                { valid_until: validUntil }
            );
        } else {
            // Bước 5: Thêm activation mới
            const validUntil = expiryType === '24H' ? new Date(Date.now() + 24*60*60*1000).toISOString() :
                               expiryType === '7D' ? new Date(Date.now() + 7*24*60*60*1000).toISOString() :
                               null;
            await supabaseRequest('activations', 'POST', {
                key_code: keyCode,
                device_id: deviceId,
                valid_until: validUntil
            });
        }

        // Bước 6: Lưu local
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
    }

    // Kiểm tra trạng thái kích hoạt (local + remote)
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
            // Kiểm tra remote xem key còn hiệu lực không
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
        } catch (e) {
            localStorage.removeItem(STORAGE_KEY);
            return { valid: false, reason: 'LỖI PHÂN TÍCH' };
        }
    }

    // Hàm đồng bộ cho check (trả về Promise)
    function checkActivation() {
        return checkActivationRemote();
    }

    // Lấy offset data
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

    // Export
    window.VTDZAI_AUTH = {
        activateKeyWithSupabase: activateKeyWithSupabase,
        checkActivation: checkActivation,
        getDeviceId: getDeviceId,
        getOffsetData: getOffsetData,
        supabaseRequest: supabaseRequest
    };

    console.log('[VTĐZAI] Supabase auth sẵn sàng. Device ID:', getDeviceId());
})();

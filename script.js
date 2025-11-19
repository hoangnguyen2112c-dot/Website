// =========================================================
// CẤU HÌNH API
// =========================================================
const API_GATEWAY_URL = "https://runninghub-api-gateway.onrender.com";

const WORKFLOW_OPTIONS = {
    "Phục chế Thường (ID 1984)": {
        "workflow_id": "1984294242724036609",
        "prompt_id": "416",
        "image_id": "284",
        "strength_id": "134",
    },
    "Upscale (ID 1981)": {
        "workflow_id": "1981382064639492097",
        "prompt_id": "45",
        "image_id": "59",
        "strength_id": "",
    }
};

// =========================================================
// LOGIC CHUYỂN ĐỔI GIAO DIỆN
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    const landingView = document.getElementById('landing-view');
    const restorationApp = document.getElementById('restoration-app');
    const showRestorationBtn = document.getElementById('show-restoration-ui-btn');
    const sidebarRestoreLink = document.getElementById('sidebar-restore-link');

    // Nút BẮT ĐẦU PHỤC HỒI (Tile)
    if (showRestorationBtn) {
        showRestorationBtn.addEventListener('click', function() {
            landingView.style.display = 'none';
            restorationApp.style.display = 'block';
        });
    }

    // Nút PHỤC HỒI ẢNH (Sidebar) - Để người dùng quay lại giao diện chính nếu đang ở trang khác
    if (sidebarRestoreLink) {
        sidebarRestoreLink.addEventListener('click', function(e) {
            e.preventDefault();
            landingView.style.display = 'block';
            restorationApp.style.display = 'none';
        });
    }
});


// =========================================================
// LOGIC API
// =========================================================

// --- HÀM ĐĂNG NHẬP (userLogin) ---
document.getElementById('login-btn').addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const msgOut = document.getElementById('login-msg');

    msgOut.textContent = "Đang đăng nhập...";

    try {
        const res = await fetch(`${API_GATEWAY_URL}/api/v1/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (data.success) {
            const credits = data.credits || 0;
            msgOut.textContent = `✅ Xin chào ${username}! Bạn còn: ${credits} lượt.`;
            document.getElementById('login-view').style.display = 'none';
            document.getElementById('main-view').style.display = 'block';
            document.getElementById('credits-out').textContent = `Lượt gen ảnh còn lại: ${credits}`;
        } else {
            msgOut.textContent = `❌ ${data.message || 'Lỗi đăng nhập'}`;
        }
    } catch (e) {
        msgOut.textContent = `Lỗi Server: ${e.message}`;
    }
});

// --- HÀM CHẠY TASK (runTask) ---
document.getElementById('run-btn').addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const selectedPreset = document.getElementById('preset-select').value;
    const prompt = document.getElementById('prompt-input').value;
    const strength = document.getElementById('strength-input').value;
    const imgFile = document.getElementById('image-upload').files[0];
    const statusOut = document.getElementById('status-out');
    
    if (!imgFile) return alert("Vui lòng chọn ảnh!");

    const presetConfig = WORKFLOW_OPTIONS[selectedPreset];
    if (!presetConfig) return alert("Chế độ không hợp lệ.");

    statusOut.textContent = "Đang upload ảnh...";

    try {
        // --- BƯỚC 1: UPLOAD ẢNH (Dùng FormData) ---
        const formData = new FormData();
        formData.append('file', imgFile, imgFile.name);
        formData.append('fileType', 'image');
        
        const upRes = await fetch(`${API_GATEWAY_URL}/api/v1/upload`, {
            method: 'POST',
            body: formData 
        });
        
        const upData = await upRes.json();
        if (!upRes.ok || !upData.fileName) {
            throw new Error(`Upload lỗi: ${upData.detail || upRes.statusText}`);
        }
        const remotePath = upData.fileName;

        // --- BƯỚC 2: TẠO TASK ---
        statusOut.textContent = "Đang xử lý (Sẽ trừ 1 lượt)...";

        const payload = {
            username,
            password,
            "workflow_id": presetConfig.workflow_id,
            "prompt_id": presetConfig.prompt_id,
            "image_id": presetConfig.image_id,
            "strength_id": presetConfig.strength_id,
            "gpu_mode": "Standard (24G)",
            "prompt_text": prompt,
            "img_path": remotePath,
            "strength": presetConfig.strength_id ? parseFloat(strength) : null
        };

        const res = await fetch(`${API_GATEWAY_URL}/api/v1/workflow/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
             throw new Error(`Lỗi tạo task: ${data.detail || res.statusText}`);
        }
        
        const taskId = data.taskId;
        trackStatus(taskId, statusOut);

    } catch (e) {
        statusOut.textContent = `Lỗi: ${e.message}`;
    }
});


// --- HÀM THEO DÕI (trackStatus) ---
function trackStatus(taskId, statusOut) {
    const galleryOut = document.getElementById('gallery-output');
    galleryOut.innerHTML = 'Đang chờ kết quả...';
    
    // Xóa interval cũ nếu có để tránh chạy nhiều lần
    let intervalId = window.lastTaskId;
    if (intervalId) clearInterval(intervalId);

    intervalId = setInterval(async () => {
        try {
            const res = await fetch(`${API_GATEWAY_URL}/api/v1/task/status/${taskId}`);
            const data = await res.json();
            const status = data.data || data;

            if (status === "SUCCESS") {
                clearInterval(intervalId);
                statusOut.textContent = "✅ SUCCESS (Hoàn thành)";
                
                // Lấy kết quả
                const outputRes = await fetch(`${API_GATEWAY_URL}/api/v1/task/outputs/${taskId}`);
                const outputData = await outputRes.json();

                if (outputData && outputData.data && Array.isArray(outputData.data)) {
                    galleryOut.innerHTML = '';
                    outputData.data.forEach(item => {
                        if (item.fileType === 'png' && item.fileUrl) {
                            const img = document.createElement('img');
                            img.src = item.fileUrl;
                            img.style.maxWidth = '300px'; 
                            img.style.margin = '10px';
                            galleryOut.appendChild(img);
                        }
                    });
                }
            } else if (status === "FAILED") {
                clearInterval(intervalId);
                statusOut.textContent = `❌ FAILED (Thất bại)`;
            } else {
                statusOut.textContent = `Trạng thái: ${status}`;
            }
        } catch (e) {
            clearInterval(intervalId);
            statusOut.textContent = `Lỗi theo dõi: ${e.message}`;
        }
    }, 3000); 
    
    window.lastTaskId = intervalId; // Lưu ID interval hiện tại
}

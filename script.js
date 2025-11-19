// =========================================================
// CẤU HÌNH CHUNG & BYPASS LOGIN
// =========================================================
const API_GATEWAY_URL = "https://runninghub-api-gateway.onrender.com";

// Thay thế bằng tài khoản và mật khẩu hợp lệ của bạn để test API
const TEST_USERNAME = "your_test_username"; 
const TEST_PASSWORD = "your_test_password"; 

// Biến toàn cục để lưu trữ credentials khi bypass
let TEMP_USERNAME = TEST_USERNAME; 
let TEMP_PASSWORD = TEST_PASSWORD;
let TEMP_CREDITS = 99; // Giả sử credits test

// Cấu hình ID Workflow cho từng tính năng
const RESTORATION_CONFIG = {
    workflow_id: "1984294242724036609",
    prompt_id: "416",
    image_id: "284",
    strength_id: "134",
    gpu_mode: "Standard (24G)"
};

const UPSCALE_CONFIG = {
    workflow_id: "1981382064639492097",
    prompt_id: "45",
    image_id: "59",
    strength_id: null, 
    gpu_mode: "Standard (24G)"
};


// =========================================================
// LOGIC CHUYỂN ĐỔI GIAO DIỆN VÀ BYPASS LOGIN
// =========================================================

// Hàm bypass Login (TẠM THỜI)
function bypassLogin(appId) {
    const loginViewId = appId === '#restoration-app' ? 'restore-login-view' : 'upscale-login-view';
    const mainViewId = appId === '#restoration-app' ? 'restore-main-view' : 'upscale-main-view';
    const creditsOutId = appId === '#restoration-app' ? 'restore-credits-out' : 'upscale-credits-out';

    const loginView = document.getElementById(loginViewId);
    const mainView = document.getElementById(mainViewId);
    const creditsOut = document.getElementById(creditsOutId);

    if (loginView && mainView && creditsOut) {
        loginView.style.display = 'none';
        mainView.style.display = 'block';
        creditsOut.textContent = `Lượt gen ảnh còn lại (TEST): ${TEMP_CREDITS}`;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const landingView = document.getElementById('landing-view');
    const restorationApp = document.getElementById('restoration-app');
    const upscaleApp = document.getElementById('upscale-app');
    
    // Hàm chung để chuyển đổi view
    const switchView = (targetApp) => {
        // Ẩn tất cả views
        landingView.style.display = 'none';
        restorationApp.style.display = 'none';
        upscaleApp.style.display = 'none';
        
        // Hiện view mục tiêu
        targetApp.style.display = 'block';
        
        // --- CHẠY BYPASS LOGIN KHI CHUYỂN SANG GIAO DIỆN THỰC THI ---
        if (targetApp.id === 'restoration-app') {
            bypassLogin('#restoration-app');
        } else if (targetApp.id === 'upscale-app') {
            bypassLogin('#upscale-app');
        }
    };

    // Kích hoạt giao diện Restoration
    document.getElementById('show-restoration-ui-btn').addEventListener('click', () => {
        switchView(restorationApp);
    });

    // Kích hoạt giao diện Upscale
    document.getElementById('show-upscale-ui-btn').addEventListener('click', () => {
        switchView(upscaleApp);
    });
    
    // Nút Quay Lại
    document.querySelectorAll('.back-to-landing').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(landingView);
        });
    });
});


// =========================================================
// LOGIC API CHUNG (UPLOAD, TRACK, RUN)
// =========================================================

// Hàm Login chung (Đã bị Bypass)
async function apiLogin(usernameId, passwordId, msgId, loginViewId, mainViewId, creditsOutId) {
    document.getElementById(msgId).textContent = "Chức năng đăng nhập đang bị Bypass.";
    bypassLogin(`#${document.getElementById(loginViewId).parentElement.id}`);
}


// Hàm Theo dõi chung
function trackStatus(taskId, statusOutId, galleryOutId) {
    const galleryOut = document.getElementById(galleryOutId);
    const statusOut = document.getElementById(statusOutId);
    galleryOut.innerHTML = 'Đang chờ kết quả...';
    
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
    
    window.lastTaskId = intervalId; 
}


// Hàm Chạy Task chung
async function runWorkflowTask(config, viewIds) {
    const { 
        imageUploadId, 
        promptInputId, strengthInputId, statusOutId, 
        galleryOutId 
    } = viewIds;

    // LẤY TÀI KHOẢN VÀ MẬT KHẨU TỪ BIẾN TẠM THỜI
    const username = TEMP_USERNAME;
    const password = TEMP_PASSWORD;

    const prompt = document.getElementById(promptInputId).value;
    const strengthInput = document.getElementById(strengthInputId);
    const strength = strengthInput ? strengthInput.value : null;
    const imgFile = document.getElementById(imageUploadId).files[0];
    const statusOut = document.getElementById(statusOutId);
    
    if (!imgFile) return alert("Vui lòng chọn ảnh!");
    if (!username || !password) return alert("Vui lòng thiết lập TEMP_USERNAME và TEMP_PASSWORD trong script.js");


    statusOut.textContent = "Đang upload ảnh...";

    try {
        // --- BƯỚC 1: UPLOAD ẢNH ---
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
            "workflow_id": config.workflow_id,
            "prompt_id": config.prompt_id,
            "image_id": config.image_id,
            "strength_id": config.strength_id,
            "gpu_mode": config.gpu_mode,
            "prompt_text": prompt,
            "img_path": remotePath,
            "strength": config.strength_id ? parseFloat(strength) : null
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
        trackStatus(taskId, statusOutId, galleryOutId);

    } catch (e) {
        statusOut.textContent = `Lỗi: ${e.message}`;
    }
}


// =========================================================
// KÍCH HOẠT EVENTS
// =========================================================

const RESTORE_VIEW_IDS = {
    usernameId: 'restore-username', passwordId: 'restore-password', msgId: 'restore-login-msg',
    loginViewId: 'restore-login-view', mainViewId: 'restore-main-view', creditsOutId: 'restore-credits-out',
    imageUploadId: 'restore-image-upload', promptInputId: 'restore-prompt-input', strengthInputId: 'restore-strength-input',
    statusOutId: 'restore-status-out', galleryOutId: 'restore-gallery-output'
};

document.getElementById('restore-login-btn').addEventListener('click', () => {
    apiLogin(
        RESTORE_VIEW_IDS.usernameId, RESTORE_VIEW_IDS.passwordId, RESTORE_VIEW_IDS.msgId, 
        RESTORE_VIEW_IDS.loginViewId, RESTORE_VIEW_IDS.mainViewId, RESTORE_VIEW_IDS.creditsOutId
    );
});

document.getElementById('restore-run-btn').addEventListener('click', () => {
    runWorkflowTask(RESTORATION_CONFIG, RESTORE_VIEW_IDS);
});

const UPSCALE_VIEW_IDS = {
    usernameId: 'upscale-username', passwordId: 'upscale-password', msgId: 'upscale-login-msg',
    loginViewId: 'upscale-login-view', mainViewId: 'upscale-main-view', creditsOutId: 'upscale-credits-out',
    imageUploadId: 'upscale-image-upload', promptInputId: 'upscale-prompt-input', strengthInputId: 'upscale-strength-input',
    statusOutId: 'upscale-status-out', galleryOutId: 'upscale-gallery-output'
};

document.getElementById('upscale-login-btn').addEventListener('click', () => {
    apiLogin(
        UPSCALE_VIEW_IDS.usernameId, UPSCALE_VIEW_IDS.passwordId, UPSCALE_VIEW_IDS.msgId, 
        UPSCALE_VIEW_IDS.loginViewId, UPSCALE_VIEW_IDS.mainViewId, UPSCALE_VIEW_IDS.creditsOutId
    );
});

document.getElementById('upscale-run-btn').addEventListener('click', () => {
    runWorkflowTask(UPSCALE_CONFIG, UPSCALE_VIEW_IDS);
});

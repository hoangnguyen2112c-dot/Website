// =========================================================
// CẤU HÌNH CHUNG
// =========================================================
const API_GATEWAY_URL = "https://runninghub-api-gateway.onrender.com";

// ⚠️ KHÓA API CỦA BẠN (Sử dụng trực tiếp cho xác thực)
const API_KEY = "69ba75ff24924a69a7944c6d8118e0be"; 
const TEMP_CREDITS = 99; 

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
// HÀM XEM TRƯỚC ẢNH
// =========================================================

function setupImagePreview(inputId, previewId) {
    const inputElement = document.getElementById(inputId);
    const previewElement = document.getElementById(previewId);

    if (inputElement && previewElement) {
        inputElement.addEventListener('change', function(e) {
            const file = e.target.files[0];
            
            if (file) {
                const reader = new FileReader();
                
                reader.onload = function(event) {
                    previewElement.src = event.target.result;
                    previewElement.style.display = 'block'; 
                };
                
                reader.readAsDataURL(file); 
            } else {
                previewElement.style.display = 'none'; 
                previewElement.src = '#';
            }
        });
    }
}


// =========================================================
// LOGIC CHUYỂN ĐỔI GIAO DIỆN
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    const landingView = document.getElementById('landing-view');
    const restorationApp = document.getElementById('restoration-app');
    const upscaleApp = document.getElementById('upscale-app');
    
    // Gán credits (tạm thời) cho giao diện chính
    document.getElementById('restore-credits-out').textContent = `Lượt gen ảnh còn lại (TEST): ${TEMP_CREDITS}`;
    document.getElementById('upscale-credits-out').textContent = `Lượt gen ảnh còn lại (TEST): ${TEMP_CREDITS}`;
    
    const switchView = (targetApp) => {
        landingView.style.display = 'none';
        restorationApp.style.display = 'none';
        upscaleApp.style.display = 'none';
        
        targetApp.style.display = 'block';
    };

    document.getElementById('show-restoration-ui-btn').addEventListener('click', () => {
        switchView(restorationApp);
    });

    document.getElementById('show-upscale-ui-btn').addEventListener('click', () => {
        switchView(upscaleApp);
    });
    
    document.querySelectorAll('.back-to-landing').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(landingView);
        });
    });

    // --- KÍCH HOẠT PREVIEW ẢNH ---
    setupImagePreview('restore-image-upload', 'restore-image-preview');
    setupImagePreview('upscale-image-upload', 'upscale-image-preview');
});


// =========================================================
// LOGIC API CHUNG (UPLOAD, TRACK, RUN)
// =========================================================

// Không cần hàm apiLogin vì đã loại bỏ cơ chế ID/Pass.


function trackStatus(taskId, statusOutId, galleryOutId) {
    const galleryOut = document.getElementById(galleryOutId);
    const statusOut = document.getElementById(statusOutId);
    galleryOut.innerHTML = 'Đang chờ kết quả...';
    
    let intervalId = window.lastTaskId;
    if (intervalId) clearInterval(intervalId);

    intervalId = setInterval(async () => {
        try {
            const res = await fetch(`${API_GATEWAY_URL}/api/v1/task/status/${taskId}`, {
                method: 'POST', // API Gateway có thể yêu cầu POST ngay cả khi query status
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, apiKey: API_KEY }) // Gửi API Key trong payload
            });
            const data = await res.json();
            const status = data.data || data;

            if (status === "SUCCESS") {
                clearInterval(intervalId);
                statusOut.textContent = "✅ SUCCESS (Hoàn thành)";
                
                const outputRes = await fetch(`${API_GATEWAY_URL}/api/v1/task/outputs/${taskId}`, {
                     method: 'POST', // API Gateway có thể yêu cầu POST
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ taskId, apiKey: API_KEY }) // Gửi API Key trong payload
                });
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


async function runWorkflowTask(config, viewIds) {
    const { 
        imageUploadId, 
        promptInputId, strengthInputId, statusOutId, 
        galleryOutId 
    } = viewIds;

    const prompt = document.getElementById(promptInputId).value;
    const strengthInput = document.getElementById(strengthInputId);
    const strength = strengthInput ? strengthInput.value : null;
    const imgFile = document.getElementById(imageUploadId).files[0];
    const statusOut = document.getElementById(statusOutId);
    
    if (!imgFile) return alert("Vui lòng chọn ảnh!");
    if (!API_KEY) return alert("Lỗi cấu hình: Vui lòng thiết lập API_KEY trong script.js");

    statusOut.textContent = "Đang upload ảnh...";

    try {
        // --- BƯỚC 1: UPLOAD ẢNH (Sử dụng API Key trong FormData nếu cần) ---
        const formData = new FormData();
        formData.append('file', imgFile, imgFile.name);
        formData.append('fileType', 'image');
        // Thử thêm API Key vào FormData (Đôi khi API Gateway cần nó ở đây)
        formData.append('apiKey', API_KEY); 
        
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
            // API Key sẽ được thêm vào Payload chính
            "apiKey": API_KEY,
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
             // Sử dụng message lỗi chính xác từ API Gateway
             throw new Error(`Lỗi tạo task: ${data.message || data.detail || res.statusText}`);
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
    imageUploadId: 'restore-image-upload', promptInputId: 'restore-prompt-input', strengthInputId: 'restore-strength-input',
    statusOutId: 'restore-status-out', galleryOutId: 'restore-gallery-output'
};

document.getElementById('restore-run-btn').addEventListener('click', () => {
    runWorkflowTask(RESTORATION_CONFIG, RESTORE_VIEW_IDS);
});

const UPSCALE_VIEW_IDS = {
    imageUploadId: 'upscale-image-upload', promptInputId: 'upscale-prompt-input', strengthInputId: 'upscale-strength-input',
    statusOutId: 'upscale-status-out', galleryOutId: 'upscale-gallery-output'
};

document.getElementById('upscale-run-btn').addEventListener('click', () => {
    runWorkflowTask(UPSCALE_CONFIG, UPSCALE_VIEW_IDS);
});

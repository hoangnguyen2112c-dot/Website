// =========================================================
// CẤU HÌNH API VÀ WORKFLOW (DỰA TRÊN CODE PYTHON THÀNH CÔNG)
// =========================================================

// ⚠️ KHÓA API CỦA BẠN (Sử dụng trực tiếp cho xác thực)
const API_KEY = "69ba75ff24924a69a7944c6d8118e0be"; 
const TEMP_CREDITS = 99; // Tạm thời hiển thị

const RUNNINGHUB_URLS = {
    "create": "https://www.runninghub.cn/task/openapi/create",
    "status": "https://www.runninghub.ai/task/openapi/status",
    "outputs": "https://www.runninghub.ai/task/openapi/outputs",
    "upload": "https://www.runninghub.ai/task/openapi/upload",
    "account_status": "https://www.runninghub.ai/uc/openapi/accountStatus",
    // Lưu ý: api-app/run bị bỏ qua vì chúng ta dùng 'create' (Standard Workflow)
};

// Cấu hình ID Workflow và NODE ID
const RESTORATION_CONFIG = {
    workflow_id: "1984294242724036609",
    // Map các trường input đến Node ID và Field Name chuẩn của ComfyUI
    prompt_node_id: "416", // Giả sử Field Name là "text"
    image_node_id: "284",  // Giả sử Field Name là "image"
    strength_node_id: "134", // Giả sử Field Name là "guidance" (từ code Python)
};

const UPSCALE_CONFIG = {
    workflow_id: "1981382064639492097",
    prompt_node_id: "45",
    image_node_id: "59",
    strength_node_id: null, // Upscale không dùng Strength
};

// =========================================================
// HÀM XEM TRƯỚC ẢNH (Giữ nguyên)
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
    
    // Gán credits (tạm thời)
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
// HÀM API TRỰC TIẾP
// =========================================================

/**
 * BƯỚC 1: Tải ảnh lên RunningHub và trả về fileName.
 */
async function uploadImageToRunningHub(imgFile) {
    const statusOut = document.getElementById('restore-status-out') || document.getElementById('upscale-status-out');
    
    const formData = new FormData();
    formData.append('apiKey', API_KEY); // Gửi API Key trong FormData
    formData.append('file', imgFile, imgFile.name);
    formData.append('fileType', 'image'); 

    statusOut.textContent = "Đang upload ảnh lên RunningHub...";

    try {
        const upRes = await fetch(RUNNINGHUB_URLS["upload"], {
            method: 'POST',
            body: formData 
        });
        
        const resData = await upRes.json();
        
        if (resData.code !== 0) {
            throw new Error(`Upload thất bại: ${resData.msg || "Lỗi không xác định."}`);
        }
        
        // Trả về fileName (ví dụ: api/bf431957f5980e7cd0748d46715254987353e9290d11ffef3cc3f326186f5c38.png)
        return resData.data.fileName; 

    } catch (e) {
        statusOut.textContent = `Lỗi Upload: ${e.message}`;
        throw new Error(e.message);
    }
}

/**
 * BƯỚC 3: Theo dõi trạng thái task.
 */
function trackStatus(taskId, statusOutId, galleryOutId) {
    const galleryOut = document.getElementById(galleryOutId);
    const statusOut = document.getElementById(statusOutId);
    galleryOut.innerHTML = 'Đang chờ kết quả...';
    
    let intervalId = window.lastTaskId;
    if (intervalId) clearInterval(intervalId);

    intervalId = setInterval(async () => {
        try {
            // Theo dõi trạng thái
            const statusRes = await fetch(RUNNINGHUB_URLS["status"], {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, apiKey: API_KEY })
            });
            const statusData = await statusRes.json();
            const status = statusData.data || statusData.msg;

            if (status === "SUCCESS") {
                clearInterval(intervalId);
                statusOut.textContent = "✅ SUCCESS (Hoàn thành)";
                
                // Lấy kết quả
                const outputRes = await fetch(RUNNINGHUB_URLS["outputs"], {
                     method: 'POST', 
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ taskId, apiKey: API_KEY })
                });
                const outputData = await outputRes.json();

                if (outputData.code === 0 && Array.isArray(outputData.data)) {
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
                } else {
                    statusOut.textContent = `Lỗi lấy kết quả: ${outputData.msg}`;
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


/**
 * BƯỚC 2: Tạo task (Advanced Workflow Execution).
 */
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
    if (!API_KEY) return alert("Lỗi cấu hình: Vui lòng thiết lập API_KEY.");

    try {
        // 1. UPLOAD ẢNH & LẤY ĐƯỜNG DẪN FILE NAME
        const remoteFileName = await uploadImageToRunningHub(imgFile);

        // 2. XÂY DỰNG PAYLOAD nodeInfoList
        const nodeInfoList = [];
        
        // A. Thêm Prompt Text (Node ID: config.prompt_node_id, Field Name: "text")
        if (prompt && config.prompt_node_id) {
            nodeInfoList.push({ "nodeId": config.prompt_node_id, "fieldName": "text", "fieldValue": prompt });
        }
        
        // B. Thêm Strength (Node ID: config.strength_node_id, Field Name: "guidance")
        if (strength && config.strength_node_id) {
            nodeInfoList.push({ "nodeId": config.strength_node_id, "fieldName": "guidance", "fieldValue": parseFloat(strength) });
        }
        
        // C. Thêm Image Path (Node ID: config.image_node_id, Field Name: "image")
        if (remoteFileName && config.image_node_id) {
            nodeInfoList.push({ "nodeId": config.image_node_id, "fieldName": "image", "fieldValue": remoteFileName });
        }


        // 3. TẠO TASK CHÍNH
        statusOut.textContent = "Đang xử lý (Tạo task)...";

        const payload = {
            "apiKey": API_KEY, 
            "workflowId": config.workflow_id,
            "nodeInfoList": nodeInfoList
        };

        const res = await fetch(RUNNINGHUB_URLS["create"], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.code !== 0) {
             throw new Error(`Lỗi tạo task: ${data.msg || res.statusText}`);
        }
        
        const taskId = data.data.taskId;
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

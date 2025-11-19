// =========================================================
// CẤU HÌNH CHUNG & API
// =========================================================
const API_KEY = "69ba75ff24924a69a7944c6d8118e0be"; 
const TEMP_CREDITS = 99; // Tạm thời hiển thị

const RUNNINGHUB_URLS = {
    "create": "https://www.runninghub.cn/task/openapi/create", 
    "status": "https://www.runninghub.ai/task/openapi/status",
    "outputs": "https://www.runninghub.ai/task/openapi/outputs",
    "upload": "https://www.runninghub.ai/task/openapi/upload",
    // Endpoint fulfill bị loại bỏ logic front-end vì không còn nút download
};

// Cấu hình ID Workflow cho từng tính năng
const RESTORATION_CONFIG = {
    workflow_id: "1984294242724036609",
    prompt_node_id: "416", 
    image_node_id: "284",  
    strength_node_id: "134", 
};

const UPSCALE_CONFIG = {
    workflow_id: "1981382064639492097",
    prompt_node_id: "45",
    image_node_id: "59",
    strength_node_id: null, 
};


// =========================================================
// HÀM XEM TRƯỚC ẢNH & LOGIC CHUYỂN ĐỔI GIAO DIỆN
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


document.addEventListener('DOMContentLoaded', () => {
    const landingView = document.getElementById('landing-view');
    const restorationApp = document.getElementById('restoration-app');
    const upscaleApp = document.getElementById('upscale-app');
    
    document.getElementById('restore-credits-out').textContent = `Lượt gen ảnh còn lại (TEST): ${TEMP_CREDITS}`;
    document.getElementById('upscale-credits-out').textContent = `Lượt gen ảnh còn lại (TEST): ${TEMP_CREDITS}`;
    
    const switchView = (targetApp) => {
        landingView.style.display = 'none';
        restorationApp.style.display = 'none';
        upscaleApp.style.display = 'none';
        
        targetApp.style.display = 'block';
    };

    // Gắn sự kiện click cho nút BẮT ĐẦU PHỤC HỒI
    const restoreBtn = document.getElementById('show-restoration-ui-btn');
    if (restoreBtn) {
        restoreBtn.addEventListener('click', () => {
            // Ẩn thông báo phí cũ khi bắt đầu tác vụ mới
            document.getElementById('restore-fulfillment-message').style.display = 'none'; 
            switchView(restorationApp);
        });
    }

    // Gắn sự kiện click cho nút BẮT ĐẦU UPSCALE
    const upscaleBtn = document.getElementById('show-upscale-ui-btn');
    if (upscaleBtn) {
        upscaleBtn.addEventListener('click', () => {
             // Ẩn thông báo phí cũ khi bắt đầu tác vụ mới
            document.getElementById('upscale-fulfillment-message').style.display = 'none'; 
            switchView(upscaleApp);
        });
    }
    
    document.querySelectorAll('.back-to-landing').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(landingView);
        });
    });

    setupImagePreview('restore-image-upload', 'restore-image-preview');
    setupImagePreview('upscale-image-upload', 'upscale-image-preview');
});


// =========================================================
// LOGIC ĐẾM NGƯỢC (TIMER)
// =========================================================

let timerInterval = null; 

function startTimer(statusOutId) {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    let timeRemaining = 4 * 60; // 4 phút = 240 giây
    const statusOut = document.getElementById(statusOutId);

    function updateDisplay() {
        if (statusOut.textContent.includes("SUCCESS") || statusOut.textContent.includes("FAILED")) {
            clearInterval(timerInterval);
            timerInterval = null;
            return;
        }

        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeRemaining > 0) {
            statusOut.innerHTML = `Trạng thái: RUNNING <span style="color: yellow; font-size: 1.1em;">(Còn ${display})</span>`;
            timeRemaining--;
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            statusOut.innerHTML = `Trạng thái: RUNNING <span style="color: red; font-size: 1.1em;">(Quá thời gian ước tính. Vui lòng chờ thêm.)</span>`;
        }
    }
    
    updateDisplay(); 
    timerInterval = setInterval(updateDisplay, 1000); 
}


// =========================================================
// LOGIC API CHUNG (UPLOAD, TRACK, RUN)
// =========================================================

function trackStatus(taskId, statusOutId, galleryOutId, fulfillmentMsgId) {
    const galleryOut = document.getElementById(galleryOutId);
    const statusOut = document.getElementById(statusOutId);
    const fulfillmentMsg = document.getElementById(fulfillmentMsgId);
    
    galleryOut.innerHTML = 'Đang chờ kết quả...';
    fulfillmentMsg.style.display = 'none'; // Đảm bảo thông báo phí ẩn

    let intervalId = window.lastTaskId;
    if (intervalId) clearInterval(intervalId);

    intervalId = setInterval(async () => {
        try {
            const statusRes = await fetch(RUNNINGHUB_URLS["status"], {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, apiKey: API_KEY })
            });
            const statusData = await statusRes.json();
            const status = statusData.data || statusData.msg;

            if (status === "SUCCESS" || status === "FAILED") {
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
            }
            
            if (status === "RUNNING" && !timerInterval) {
                startTimer(statusOutId);
            }

            if (status === "SUCCESS") {
                clearInterval(intervalId);
                statusOut.textContent = "✅ SUCCESS (Hoàn thành) - Ảnh Preview sẵn sàng.";
                
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
                            
                            const container = document.createElement('div');
                            container.className = 'result-image-container'; 
                            
                            const img = document.createElement('img');
                            img.src = item.fileUrl;
                            img.alt = "Ảnh kết quả";
                            
                            // Không gán onclick
                            container.appendChild(img);
                            galleryOut.appendChild(container);
                        }
                    });
                     // ⚠️ HIỂN THỊ THÔNG BÁO THANH TOÁN KHI CÓ KẾT QUẢ
                    fulfillmentMsg.style.display = 'block';

                } else {
                    statusOut.textContent = `Lỗi lấy kết quả: ${outputData.msg}`;
                }

            } else if (status === "FAILED") {
                clearInterval(intervalId);
                statusOut.textContent = `❌ FAILED (Thất bại)`;
            } else if (status !== "RUNNING") {
                statusOut.textContent = `Trạng thái: ${status}`;
            }
        } catch (e) {
            clearInterval(intervalId);
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            statusOut.textContent = `Lỗi theo dõi: ${e.message}`;
        }
    }, 3000); 
    
    window.lastTaskId = intervalId; 
}


async function runWorkflowTask(config, viewIds) {
    const { 
        imageUploadId, 
        promptInputId, strengthInputId, statusOutId, 
        galleryOutId,
        fulfillmentMsgId // Lấy ID thông báo phí
    } = viewIds;

    const prompt = document.getElementById(promptInputId).value;
    const strengthInput = document.getElementById(strengthInputId);
    const strength = strengthInput ? strengthInput.value : null;
    const imgFile = document.getElementById(imageUploadId).files[0];
    const statusOut = document.getElementById(statusOutId);
    
    if (!imgFile) return alert("Vui lòng chọn ảnh!");
    if (!API_KEY) return alert("Lỗi cấu hình: Vui lòng thiết lập API_KEY.");

    try {
        const remoteFileName = await uploadImageToRunningHub(imgFile);
        const nodeInfoList = [];
        
        if (prompt && config.prompt_node_id) {
            nodeInfoList.push({ "nodeId": config.prompt_node_id, "fieldName": "text", "fieldValue": prompt });
        }
        
        if (strength && config.strength_node_id) {
            nodeInfoList.push({ "nodeId": config.strength_node_id, "fieldName": "guidance", "fieldValue": parseFloat(strength) });
        }
        
        if (remoteFileName && config.image_node_id) {
            nodeInfoList.push({ "nodeId": config.image_node_id, "fieldName": "image", "fieldValue": remoteFileName });
        }

        statusOut.textContent = "Đang khởi tạo tác vụ xử lý...";

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
             throw new Error(`Lỗi khởi tạo tác vụ: ${data.msg || res.statusText}`);
        }
        
        const taskId = data.data.taskId;
        // ⚠️ Truyền ID thông báo phí vào hàm trackStatus
        trackStatus(taskId, statusOutId, galleryOutId, fulfillmentMsgId);

    } catch (e) {
        statusOut.textContent = `Lỗi: ${e.message}`;
    }
}


async function uploadImageToRunningHub(imgFile) {
    const statusOut = document.getElementById('restore-status-out') || document.getElementById('upscale-status-out');
    
    const formData = new FormData();
    formData.append('apiKey', API_KEY); 
    formData.append('file', imgFile, imgFile.name);
    formData.append('fileType', 'image'); 

    statusOut.textContent = "Đang tải ảnh lên hệ thống...";

    try {
        const upRes = await fetch(RUNNINGHUB_URLS["upload"], {
            method: 'POST',
            body: formData 
        });
        
        const resData = await upRes.json();
        
        if (resData.code !== 0) {
            throw new Error(`Tải ảnh thất bại: ${resData.msg || "Lỗi không xác định."}`);
        }
        
        return resData.data.fileName; 

    } catch (e) {
        statusOut.textContent = `Lỗi Tải ảnh: ${e.message}`;
        throw new Error(e.message);
    }
}

// =========================================================
// KÍCH HOẠT EVENTS
// =========================================================

const RESTORE_VIEW_IDS = {
    imageUploadId: 'restore-image-upload', promptInputId: 'restore-prompt-input', strengthInputId: 'restore-strength-input',
    statusOutId: 'restore-status-out', galleryOutId: 'restore-gallery-output',
    fulfillmentMsgId: 'restore-fulfillment-message'
};

document.getElementById('restore-run-btn').addEventListener('click', () => {
    runWorkflowTask(RESTORATION_CONFIG, RESTORE_VIEW_IDS);
});

const UPSCALE_VIEW_IDS = {
    imageUploadId: 'upscale-image-upload', promptInputId: 'upscale-prompt-input', strengthInputId: 'upscale-strength-input',
    statusOutId: 'upscale-status-out', galleryOutId: 'upscale-gallery-output',
    fulfillmentMsgId: 'upscale-fulfillment-message'
};

document.getElementById('upscale-run-btn').addEventListener('click', () => {
    runWorkflowTask(UPSCALE_CONFIG, UPSCALE_VIEW_IDS);
});

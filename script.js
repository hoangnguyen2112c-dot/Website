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
    // Endpoint fulfill đã bị loại bỏ chức năng thực tế
    "fulfill": "https://www.runninghub.ai/task/openapi/fulfill_payment_disabled" 
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
        // Dừng timer nếu task đã hoàn thành hoặc thất bại
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
// HÀM MODAL (CHỈ HIỂN THỊ THÔNG BÁO, KHÔNG TẢI FILE)
// =========================================================

const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");
const downloadBtn = document.getElementById("downloadButton"); // Đổi tên biến cho rõ ràng
const spanClose = document.getElementsByClassName("close")[0];

spanClose.onclick = function() { modal.style.display = "none"; }
window.onclick = function(event) { if (event.target == modal) { modal.style.display = "none"; } }

function openContactModal(imgUrl) {
  modal.style.display = "block";
  modalImg.src = imgUrl; // Vẫn hiển thị ảnh trong modal
  
  // Nút download giờ chỉ hiển thị thông báo liên hệ
  downloadBtn.onclick = () => {
      alert("Vui

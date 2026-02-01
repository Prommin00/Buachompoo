document.addEventListener("DOMContentLoaded", () => {
    // 1. ตัวแปร config และ element ต่างๆ
    const API_URL = window.PPG_API_URL || "https://ppg-chat-api.2551prommin.workers.dev/"; // Fallback เผื่อ config ไม่โหลด
    const input = document.getElementById("user-input");
    const box = document.getElementById("chat-box");
    const btn = document.getElementById("send-btn");
  
    // 2. ฟังก์ชันจัดการ History (localStorage)
    function getUserKey() {
      let k = localStorage.getItem("ppg_user_key");
      if (!k) {
        k = "guest_" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
        localStorage.setItem("ppg_user_key", k);
      }
      return k;
    }
  
    function loadLocalHistory() {
      try {
        const k = getUserKey();
        const raw = localStorage.getItem("ppg_history_" + k);
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    }
  
    function saveLocalHistory(item) {
      const k = getUserKey();
      let items = loadLocalHistory();
      items.push(item);
      // เก็บแค่ 50 ข้อความล่าสุดพอเครื่องจะได้ไม่หน่วง
      if (items.length > 50) items = items.slice(-50); 
      localStorage.setItem("ppg_history_" + k, JSON.stringify(items));
    }
  
    // 3. ฟังก์ชันวาดหน้าจอ (Render)
    function appendMessage(role, text) {
      const div = document.createElement("div");
      div.className = `bubble ${role === "user" ? "user" : "bot"}`;
      // แปลงพวกอักขระพิเศษเพื่อความปลอดภัย
      div.innerText = text; 
      box.appendChild(div);
      box.scrollTop = box.scrollHeight; // เลื่อนลงล่างสุดเสมอ
    }
  
    // โหลดประวัติเก่ามาแสดงตอนเปิดเว็บ
    const history = loadLocalHistory();
    if (history.length === 0) {
      appendMessage("bot", "สวัสดีครับ มีอะไรให้ PPG ช่วยไหมครับ?");
    } else {
      history.forEach(h => appendMessage(h.role, h.content));
    }
  
    // 4. ฟังก์ชันส่งข้อความ (หัวใจหลัก)
    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
  
      // เคลียร์ช่องพิมพ์
      input.value = "";
      
      // แสดงข้อความฝั่งเรา
      appendMessage("user", text);
      saveLocalHistory({ role: "user", content: text });
  
      // แสดงสถานะ "กำลังพิมพ์..."
      const loadingDiv = document.createElement("div");
      loadingDiv.className = "bubble bot typing";
      loadingDiv.innerText = "กำลังพิมพ์...";
      box.appendChild(loadingDiv);
      box.scrollTop = box.scrollHeight;
      btn.disabled = true; // ล็อคปุ่มกันกดรัว
  
      try {
        // ยิงไปหา Cloudflare Worker ของคุณ
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text })
        });
  
        const data = await res.json();
        
        // ลบสถานะกำลังพิมพ์ออก
        loadingDiv.remove();
  
        if (data.reply) {
          appendMessage("bot", data.reply);
          saveLocalHistory({ role: "bot", content: data.reply });
        } else if (data.error) {
          appendMessage("bot", "ขออภัย ระบบขัดข้อง: " + data.error);
        } else {
          appendMessage("bot", "ไม่ได้รับคำตอบจากเซิร์ฟเวอร์");
        }
      } catch (err) {
        loadingDiv.remove();
        appendMessage("bot", "เกิดข้อผิดพลาดในการเชื่อมต่อ");
        console.error(err);
      } finally {
        btn.disabled = false; // ปลดล็อคปุ่ม
        box.scrollTop = box.scrollHeight;
        input.focus();
      }
    }
  
    // 5. ผูกปุ่มกด
    btn.addEventListener("click", sendMessage);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  });

document.addEventListener("DOMContentLoaded", () => {
  // --- 1. CONFIG & ELEMENTS ---
  const API_URL = window.PPG_API_URL || "https://ppg-chat-api.2551prommin.workers.dev/";
  const ADMIN_API = "https://ppgadmin.2551prommin.workers.dev/api/public_faq";
  
  const input = document.getElementById("user-input");
  const box = document.getElementById("chat-box");
  const btn = document.getElementById("send-btn");
  
  // FAQ Elements
  const faqFab = document.getElementById("faqFab");
  const faqPanel = document.getElementById("faqPanel");
  const faqClose = document.getElementById("faqClose");
  const faqListEl = document.getElementById("faq-list");
  const faqSearch = document.getElementById("faqSearch");
  
  // --- 2. LOGIC ช่องพิมพ์ (Auto Resize & Enter) ---
  function autoResize() {
    input.style.height = 'auto'; // Reset ความสูง
    input.style.height = input.scrollHeight + 'px'; // ตั้งตามเนื้อหา
  }

  input.addEventListener("input", autoResize);

  input.addEventListener("keydown", (e) => {
    // Enter = ส่ง, Shift+Enter = ขึ้นบรรทัดใหม่
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // กันไม่ให้ขึ้นบรรทัดใหม่
      sendMessage();
    }
  });

  // --- 3. CHAT FUNCTIONS ---
  function getUserKey() {
    let k = localStorage.getItem("ppg_user_key");
    if (!k) {
      k = "user_" + Date.now();
      localStorage.setItem("ppg_user_key", k);
    }
    return k;
  }

  function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `msg-row ${role}`;
    
    // Avatar (ถ้าเป็น Bot ให้ใส่รูป)
    const avatarHTML = role === 'bot' 
      ? `<img src="img/av2.png" class="avatar" onerror="this.style.display='none'">` 
      : ``;

    div.innerHTML = `
      ${role === 'bot' ? avatarHTML : ''}
      <div class="bubble ${role}">${text}</div>
    `;
    
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  async function sendMessage(textOverride) {
    const text = textOverride || input.value.trim();
    if (!text) return;

    // เคลียร์ช่องพิมพ์
    if (!textOverride) {
      input.value = "";
      autoResize(); // Reset ความสูง
    }
    
    // 1. แสดงข้อความเรา
    appendMessage("user", text);

    // 2. แสดงสถานะกำลังพิมพ์
    const loadingId = "loading-" + Date.now();
    const loadingDiv = document.createElement("div");
    loadingDiv.id = loadingId;
    loadingDiv.className = "msg-row bot";
    loadingDiv.innerHTML = `
      <img src="img/av2.png" class="avatar" onerror="this.style.display='none'">
      <div class="bubble bot typing">กำลังพิมพ์...</div>
    `;
    box.appendChild(loadingDiv);
    box.scrollTop = box.scrollHeight;

    try {
      // 3. ยิง API
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, userKey: getUserKey() })
      });
      const data = await res.json();

      // ลบสถานะกำลังพิมพ์
      document.getElementById(loadingId).remove();

      if (data.reply) {
        appendMessage("bot", data.reply);
      } else {
        appendMessage("bot", "ขออภัย ระบบขัดข้องชั่วคราว");
      }

    } catch (err) {
      if(document.getElementById(loadingId)) document.getElementById(loadingId).remove();
      appendMessage("bot", "เกิดข้อผิดพลาดในการเชื่อมต่อ");
      console.error(err);
    }
  }

  btn.addEventListener("click", () => sendMessage());

  // --- 4. FAQ LOGIC ---
  let faqData = [];

  async function loadFAQ() {
    try {
      const res = await fetch(ADMIN_API);
      const data = await res.json();
      faqData = data.faq || [];
      renderFAQ(faqData);
    } catch (err) {
      console.error("Load FAQ Error:", err);
      faqListEl.innerHTML = "<div style='text-align:center; color:#999'>โหลด FAQ ไม่สำเร็จ</div>";
    }
  }

  function renderFAQ(list) {
    faqListEl.innerHTML = "";
    if (list.length === 0) {
      faqListEl.innerHTML = "<div style='text-align:center; color:#999'>ไม่พบข้อมูล</div>";
      return;
    }

    list.forEach(item => {
      const el = document.createElement("div");
      el.className = "faq-item";
      el.innerHTML = `
        <button class="faq-q">
          <span>${item.q}</span>
          <span>▼</span>
        </button>
        <div class="faq-a">
          ${item.a.replace(/\n/g, "<br>")}
          <div style="margin-top:10px; text-align:right;">
            <button class="faq-chip" style="background:#0b5cff; color:white;">ถามคำถามนี้</button>
          </div>
        </div>
      `;

      // คลิกเพื่อขยาย
      el.querySelector(".faq-q").addEventListener("click", () => {
        el.classList.toggle("open");
      });

      // คลิกปุ่ม "ถามคำถามนี้"
      el.querySelector(".faq-chip").addEventListener("click", () => {
        faqPanel.classList.remove("open"); // ปิด FAQ
        sendMessage(item.q); // ส่งข้อความเลย
      });

      faqListEl.appendChild(el);
    });
  }

  // Event Listeners สำหรับ FAQ
  faqFab.addEventListener("click", () => {
    faqPanel.classList.add("open");
    if(faqData.length === 0) loadFAQ(); // โหลดครั้งแรกเมื่อกดเปิด
  });
  faqClose.addEventListener("click", () => faqPanel.classList.remove("open"));
  
  // Search FAQ
  faqSearch.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = faqData.filter(f => f.q.toLowerCase().includes(term) || f.a.toLowerCase().includes(term));
    renderFAQ(filtered);
  });

  // Chip Filter
  document.querySelectorAll(".faq-chip[data-tag]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      const filtered = faqData.filter(f => (f.q + f.a).includes(tag));
      renderFAQ(filtered);
    });
  });

  // --- 5. INITIALIZE ---
  // โหลดประวัติเก่า (ถ้าต้องการ) หรือทักทาย
  appendMessage("bot", "สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?");
});

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("user-input");
  const box = document.getElementById("chat-box");
  const btn = document.getElementById("send-btn");

  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // Guest/User key (แยกประวัติด้วย localStorage)
  function getUserKey() {
    let k = localStorage.getItem("ppg_user_key");
    if (!k) {
      k = "guest_" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
      localStorage.setItem("ppg_user_key", k);
    }
    return k;
  }

  // เก็บประวัติแชตฝั่งหน้าเว็บ (สำหรับ history.html)
  function loadLocalHistory() {
    try {
      const k = getUserKey();
      const raw = localStorage.getItem("ppg_history_" + k);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  function saveLocalHistory(items) {
    const k = getUserKey();
    localStorage.setItem("ppg_history_" + k, JSON.stringify(items.slice(-200)));
  }

  let history = loadLocalHistory();

  function renderHistoryToChatBox() {
    box.innerHTML = "";
    if (history.length === 0) {
      box.innerHTML += `<div class="bubble bot">สวัสดีครับ 👋 มีอะไรให้ช่วยไหม</div>`;
      return;
    }
    for (const m of history) {
      const cls = m.role === "user" ? "user" : "bot";
      box.innerHTML += `<div class="bubble ${cls}">${esc(m.content)}</div>`;
    }
    box.scrollTop = box.scrollHeight;
  }

  renderHistoryToChatBox();

  function showTyping(on) {
    let typing = document.getElementById("typing-bubble");
    if (on) {
      if (!typing) {
        typing = document.createElement("div");
        typing.id = "typing-bubble";
        typing.className = "bubble bot typing";
        typing.textContent = "กำลังตอบ...";
        box.appendChild(typing);
      }
      box.scrollTop = box.scrollHeight;
    } else {
      if (typing) typing.remove();
    }
  }

  async function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return;

    // render user message
    box.innerHTML += `<div class="bubble user">${esc(msg)}</div>`;
    input.value = "";
    box.scrollTop = box.scrollHeight;

    history.push({ role: "user", content: msg, ts: Date.now() });
    saveLocalHistory(history);

    showTyping(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);

    try {
      const apiUrl = window.PPG_API_URL || "";
      if (!apiUrl) throw new Error("ยังไม่ได้ตั้งค่า API URL");

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, userKey: getUserKey() }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      showTyping(false);

      if (!res.ok) {
        const detail = data?.error || data?.detail?.error?.message || "ระบบตอบกลับผิดพลาด";
        box.innerHTML += `<div class="bubble bot">ขออภัย: ${esc(detail)}</div>`;
        history.push({ role: "assistant", content: "ขออภัย: " + detail, ts: Date.now() });
        saveLocalHistory(history);
        box.scrollTop = box.scrollHeight;
        return;
      }

      const reply = data.reply || "ขออภัย ระบบไม่สามารถตอบได้ในขณะนี้";
      box.innerHTML += `<div class="bubble bot">${esc(reply)}</div>`;
      history.push({ role: "assistant", content: reply, ts: Date.now() });
      saveLocalHistory(history);
    } catch (e) {
      showTyping(false);
      const msgErr =
        e.name === "AbortError"
          ? "AI ตอบช้าเกินไป กรุณาลองใหม่"
          : "เกิดข้อผิดพลาด: " + (e.message || String(e));
      box.innerHTML += `<div class="bubble bot">${esc(msgErr)}</div>`;
      history.push({ role: "assistant", content: msgErr, ts: Date.now() });
      saveLocalHistory(history);
    } finally {
      clearTimeout(timer);
      box.scrollTop = box.scrollHeight;
    }
  }

  btn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => e.key === "Enter" && sendMessage());

  // expose for FAQ buttons
  window.askFromFAQ = function (question) {
    input.value = question;
    input.focus();
    // auto send optional:
    // sendMessage();
  };
});
(function initFAQ(){
  const fab = document.getElementById("faqFab");
  const panel = document.getElementById("faqPanel");
  const closeBtn = document.getElementById("faqClose");
  const listEl = document.getElementById("faqList");
  const searchEl = document.getElementById("faqSearch");

  if (!fab || !panel || !listEl) return;

  const FAQ = (window.PPG_FAQ || []).map(x => ({
    q: x.q || "",
    a: x.a || "",
    tag: x.tag || "" // ถ้าไม่มี tag ก็ว่าง
  }));

  function render(items){
    listEl.innerHTML = "";
    if (!items.length){
      listEl.innerHTML = `<div style="color:#666;font-size:13px;">ไม่พบคำถามที่ตรงกัน</div>`;
      return;
    }

    items.forEach((it) => {
      const wrap = document.createElement("div");
      wrap.className = "faq-item";
      wrap.innerHTML = `
        <button class="faq-q" type="button">
          <span>${escapeHtml(it.q)}</span>
          <span>▾</span>
        </button>
        <div class="faq-a">${escapeHtml(it.a).replace(/\n/g,"<br>")}</div>
      `;
      wrap.querySelector(".faq-q").addEventListener("click", () => {
        wrap.classList.toggle("open");
      });
      listEl.appendChild(wrap);
    });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }

  fab.addEventListener("click", () => panel.classList.add("open"));
  closeBtn.addEventListener("click", () => panel.classList.remove("open"));

  document.querySelectorAll(".faq-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.getAttribute("data-tag") || "";
      const filtered = FAQ.filter(x => (x.q+x.a).includes(tag));
      render(filtered.length ? filtered : FAQ);
    });
  });

  if (searchEl){
    searchEl.addEventListener("input", () => {
      const t = searchEl.value.trim();
      const filtered = !t ? FAQ : FAQ.filter(x =>
        (x.q+x.a).toLowerCase().includes(t.toLowerCase())
      );
      render(filtered);
    });
  }

  render(FAQ);
})();

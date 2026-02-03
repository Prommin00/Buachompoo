document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // CONFIG + ELEMENTS
  // =========================
  const input = document.getElementById("user-input");
  const box = document.getElementById("chat-box");
  const btn = document.getElementById("send-btn");

  const apiUrl =
    window.PPG_API_URL ||
    "https://ppg-chat-api.2551prommin.workers.dev/";

  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // =========================
  // USER KEY (ไม่ระบุตัวตน)
  // =========================
  function getUserKey() {
    let k = sessionStorage.getItem("ppg_user_key");
    if (!k) {
      k =
        "guest_" +
        (crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now() + "_" + Math.random().toString(16).slice(2));
      sessionStorage.setItem("ppg_user_key", k);
    }
    return k;
  }

  // =========================
  // SESSION HISTORY (ปลอดภัย)
  // =========================
  function loadHistory() {
    try {
      const k = getUserKey();
      const raw = sessionStorage.getItem("ppg_history_" + k);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    const k = getUserKey();
    sessionStorage.setItem(
      "ppg_history_" + k,
      JSON.stringify(items.slice(-200))
    );
  }

  let history = loadHistory();

  // =========================
  // RENDER CHAT
  // =========================
 const BOT_AVATAR_URL = "image.png"; // หรือใส่ลิงก์รูปเต็มก็ได้

function appendBubble(role, text) {
  const cls = role === "user" ? "user" : "bot";

  const msg = document.createElement("div");
  msg.className = `msg ${cls}`;

  // avatar เฉพาะ bot
  if (cls === "bot") {
    const av = document.createElement("div");
    av.className = "avatar";
    av.innerHTML = `<img src="${BOT_AVATAR_URL}" alt="bot">`;
    msg.appendChild(av);
  }

  const bubble = document.createElement("div");
  bubble.className = `bubble ${cls}`;
  bubble.innerHTML = esc(text).replace(/\n/g, "<br>");
  msg.appendChild(bubble);

  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

  function renderHistory() {
    box.innerHTML = "";
    if (!history.length) {
      appendBubble(
        "assistant",
        "สวัสดีครับ 👋 มีอะไรให้ PPG ช่วยไหมครับ?"
      );
      return;
    }
    history.forEach((m) => appendBubble(m.role, m.content));
  }

  renderHistory();

  function showTyping(on) {
    let el = document.getElementById("typing-bubble");
    if (on) {
      if (!el) {
        el = document.createElement("div");
        el.id = "typing-bubble";
        el.className = "bubble bot typing";
        el.textContent = "กำลังตอบ...";
        box.appendChild(el);
      }
      box.scrollTop = box.scrollHeight;
    } else {
      if (el) el.remove();
    }
  }

  // =========================
  // SEND MESSAGE
  // =========================
  async function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return;

    appendBubble("user", msg);
    input.value = "";

    history.push({ role: "user", content: msg });
    saveHistory(history);

    showTyping(true);
    btn.disabled = true;

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          userKey: getUserKey(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      showTyping(false);

      if (!res.ok) {
        const err = data?.error || "ระบบขัดข้อง";
        appendBubble("assistant", "ขออภัย: " + err);
        history.push({ role: "assistant", content: "ขออภัย: " + err });
        saveHistory(history);
        return;
      }

      const reply = data.reply || "ไม่สามารถตอบได้ในขณะนี้";
      appendBubble("assistant", reply);
      history.push({ role: "assistant", content: reply });
      saveHistory(history);
    } catch (e) {
      showTyping(false);
      const msgErr = "เกิดข้อผิดพลาด กรุณาลองใหม่";
      appendBubble("assistant", msgErr);
      history.push({ role: "assistant", content: msgErr });
      saveHistory(history);
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  btn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // =========================
  // FAQ SUPPORT
  // =========================
  window.askFromFAQ = function (q) {
    input.value = q;
    input.focus();
  };

  // =========================
  // FAQ PANEL
  // =========================
  (function initFAQ() {
    const fab = document.getElementById("faqFab");
    const panel = document.getElementById("faqPanel");
    const closeBtn = document.getElementById("faqClose");
    const listEl = document.getElementById("faqList");
    const searchEl = document.getElementById("faqSearch");

    if (!fab || !panel || !closeBtn || !listEl) return;

    const FAQ = (window.PPG_FAQ || []).map((x) => ({
      q: x.q || "",
      a: x.a || "",
    }));

    function render(items) {
      listEl.innerHTML = "";
      if (!items.length) {
        listEl.innerHTML =
          `<div style="color:#666;font-size:13px;">ไม่พบคำถาม</div>`;
        return;
      }

      items.forEach((it) => {
        const wrap = document.createElement("div");
        wrap.className = "faq-item";
        wrap.innerHTML = `
          <button class="faq-q">
            <span>${esc(it.q)}</span>
            <span>▾</span>
          </button>
          <div class="faq-a">${esc(it.a).replace(/\n/g, "<br>")}</div>
        `;
        wrap.querySelector(".faq-q").onclick = () =>
          wrap.classList.toggle("open");
        wrap.querySelector(".faq-q").ondblclick = () => {
          askFromFAQ(it.q);
          panel.classList.remove("open");
        };
        listEl.appendChild(wrap);
      });
    }

    fab.onclick = () => panel.classList.add("open");
    closeBtn.onclick = () => panel.classList.remove("open");

    if (searchEl) {
      searchEl.oninput = () => {
        const t = searchEl.value.toLowerCase();
        render(
          !t
            ? FAQ
            : FAQ.filter((x) =>
                (x.q + x.a).toLowerCase().includes(t)
              )
        );
      };
    }

    render(FAQ);
  })();
});

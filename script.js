document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // CONFIG + ELEMENTS
  // =========================
  const input = document.getElementById("user-input");
  const box = document.getElementById("chat-box");
  const btn = document.getElementById("send-btn");

  const apiUrl = window.PPG_API_URL || "https://ppg-chat-api.2551prommin.workers.dev/";

  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // =========================
  // USER KEY + LOCAL HISTORY
  // =========================
  function getUserKey() {
    let k = localStorage.getItem("ppg_user_key");
    if (!k) {
      k =
        "guest_" +
        (crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()) + "_" + Math.random().toString(16).slice(2));
      localStorage.setItem("ppg_user_key", k);
    }
    return k;
  }

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

  // =========================
  // RENDER
  // =========================
  function appendBubble(role, text) {
    const cls = role === "user" ? "user" : "bot";
    // ใช้ div + esc แล้วให้ CSS จัด pre-wrap (แก้บรรทัดใหม่ติดกัน)
    box.innerHTML += `<div class="bubble ${cls}">${esc(text)}</div>`;
    box.scrollTop = box.scrollHeight;
  }

  function renderHistoryToChatBox() {
    box.innerHTML = "";
    if (!history.length) {
      appendBubble("assistant", "สวัสดีครับ 👋 มีอะไรให้ PPG ช่วยไหมครับ?");
      return;
    }
    for (const m of history) {
      appendBubble(m.role, m.content);
    }
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

  // =========================
  // SEND MESSAGE
  // =========================
  async function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return;

    appendBubble("user", msg);
    input.value = "";

    history.push({ role: "user", content: msg, ts: Date.now() });
    saveLocalHistory(history);

    showTyping(true);
    btn.disabled = true;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);

    try {
      if (!apiUrl) throw new Error("ยังไม่ได้ตั้งค่า API URL");

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ใส่ userKey เผื่ออนาคตคุณอยากทำ history ฝั่ง server
        body: JSON.stringify({ message: msg, userKey: getUserKey() }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      showTyping(false);

      if (!res.ok) {
        const detail = data?.error || "ระบบตอบกลับผิดพลาด";
        appendBubble("assistant", "ขออภัย: " + detail);
        history.push({ role: "assistant", content: "ขออภัย: " + detail, ts: Date.now() });
        saveLocalHistory(history);
        return;
      }

      const reply = data.reply || "ขออภัย ระบบไม่สามารถตอบได้ในขณะนี้";
      appendBubble("assistant", reply);
      history.push({ role: "assistant", content: reply, ts: Date.now() });
      saveLocalHistory(history);
    } catch (e) {
      showTyping(false);
      const msgErr =
        e.name === "AbortError"
          ? "AI ตอบช้าเกินไป กรุณาลองใหม่"
          : "เกิดข้อผิดพลาด: " + (e.message || String(e));
      appendBubble("assistant", msgErr);
      history.push({ role: "assistant", content: msgErr, ts: Date.now() });
      saveLocalHistory(history);
    } finally {
      clearTimeout(timer);
      btn.disabled = false;
      box.scrollTop = box.scrollHeight;
      input.focus();
    }
  }

  btn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // =========================
  // FAQ: expose for click-to-fill
  // =========================
  window.askFromFAQ = function (question) {
    input.value = question;
    input.focus();
    // ถ้าอยากให้คลิกแล้วส่งเลย ให้เปิดบรรทัดนี้:
    // sendMessage();
  };

  // =========================
  // INIT FAQ PANEL
  // =========================
  (function initFAQ() {
    const fab = document.getElementById("faqFab");
    const panel = document.getElementById("faqPanel");
    const closeBtn = document.getElementById("faqClose");
    const listEl = document.getElementById("faqList");
    const searchEl = document.getElementById("faqSearch");

    // ถ้า id ใน HTML ไม่ตรง จะกดแล้วไม่เปิด
    if (!fab || !panel || !closeBtn || !listEl) return;

    const FAQ = (window.PPG_FAQ || []).map((x) => ({
      id: x.id || "",
      q: x.q || "",
      a: x.a || "",
      tag: x.tag || "",
    }));

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (m) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
      );
    }

    function render(items) {
      listEl.innerHTML = "";
      if (!items.length) {
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
          <div class="faq-a">${escapeHtml(it.a).replace(/\n/g, "<br>")}</div>
        `;

        wrap.querySelector(".faq-q").addEventListener("click", () => {
          wrap.classList.toggle("open");
        });

        // ถ้าอยากให้คลิกคำถามแล้วเอาไปใส่ช่องพิมพ์ทันที (คล้ายเดิม)
        wrap.querySelector(".faq-q").addEventListener("dblclick", () => {
          window.askFromFAQ(it.q);
          panel.classList.remove("open");
        });

        listEl.appendChild(wrap);
      });
    }

    fab.addEventListener("click", () => panel.classList.add("open"));
    closeBtn.addEventListener("click", () => panel.classList.remove("open"));

    document.querySelectorAll(".faq-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-tag") || "";
        const filtered = FAQ.filter((x) => (x.q + x.a).includes(tag));
        render(filtered.length ? filtered : FAQ);
      });
    });

    if (searchEl) {
      searchEl.addEventListener("input", () => {
        const t = searchEl.value.trim().toLowerCase();
        const filtered = !t
          ? FAQ
          : FAQ.filter((x) => (x.q + x.a).toLowerCase().includes(t));
        render(filtered);
      });
    }

    render(FAQ);
  })();
});

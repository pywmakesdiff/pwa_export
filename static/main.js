(function () {
  // ---------- helpers ----------
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showRuntimeError(msg) {
    const host = document.getElementById("addAlertHost");
    if (host) {
      host.innerHTML = `<div class="alert alert-danger rounded-4 mb-3">${escapeHtml(msg)}</div>`;
    }
  }

  window.addEventListener("error", (e) => {
    showRuntimeError("Ошибка JS: " + (e?.message || "unknown"));
  });

  window.addEventListener("unhandledrejection", (e) => {
    showRuntimeError("Ошибка: " + String(e?.reason || "unknown"));
  });

  // ========== PIN GATE ==========
  const PIN_STORAGE_KEY = "finance_pin_v1";
  const PIN_UNLOCKED_KEY = "finance_pin_unlocked";

  function bufToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  function randomHex(bytesLen = 16) {
    const bytes = new Uint8Array(bytesLen);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", enc);
    return bufToHex(hash);
  }
  function getStoredPin() {
    try {
      const raw = localStorage.getItem(PIN_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null; // {salt, hash}
    } catch { return null; }
  }
  function setStoredPin(obj) {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(obj));
  }
  function setUnlocked() {
    sessionStorage.setItem(PIN_UNLOCKED_KEY, "1");
    document.body.classList.remove("pin-locked");
    const overlay = document.getElementById("pinOverlay");
    if (overlay) overlay.setAttribute("aria-hidden", "true");
  }
  function isUnlockedSession() {
    return sessionStorage.getItem(PIN_UNLOCKED_KEY) === "1";
  }
  function showPinError(msg) {
    const el = document.getElementById("pinError");
    if (!el) return;
    el.style.display = "block";
    el.textContent = msg;
  }
  function clearPinError() {
    const el = document.getElementById("pinError");
    if (!el) return;
    el.style.display = "none";
    el.textContent = "";
  }

  async function initPinGate() {
    const overlay = document.getElementById("pinOverlay");
    const form = document.getElementById("pinForm");
    const pin1 = document.getElementById("pinInput1");
    const pin2 = document.getElementById("pinInput2");
    const title = document.getElementById("pinTitle");
    const subtitle = document.getElementById("pinSubtitle");
    const btn = document.getElementById("pinSubmitBtn");
    if (!overlay || !form || !pin1 || !pin2 || !title || !subtitle || !btn) return;

    const stored = getStoredPin();
    if (stored && isUnlockedSession()) { setUnlocked(); return; }

    document.body.classList.add("pin-locked");
    overlay.setAttribute("aria-hidden", "false");

    const isSetup = !stored;
    if (isSetup) {
      title.textContent = "Создайте PIN";
      subtitle.textContent = "PIN хранится локально на устройстве";
      btn.textContent = "Сохранить и войти";
      pin2.style.display = "block";
    } else {
      title.textContent = "Введите PIN";
      subtitle.textContent = "Для доступа к приложению";
      btn.textContent = "Войти";
      pin2.style.display = "none";
    }

    pin1.value = ""; pin2.value = "";
    clearPinError();
    pin1.focus();

    return new Promise((resolve) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearPinError();

        const v1 = (pin1.value || "").trim();
        const v2 = (pin2.value || "").trim();

        if (!/^\d{4,6}$/.test(v1)) { showPinError("PIN должен быть 4–6 цифр."); return; }

        if (isSetup) {
          if (v1 !== v2) { showPinError("PIN не совпадает. Повторите."); return; }
          const salt = randomHex(16);
          const hash = await sha256Hex(salt + v1);
          setStoredPin({ salt, hash });
          setUnlocked(); resolve(); return;
        }

        const cur = getStoredPin();
        const hash = await sha256Hex(cur.salt + v1);
        if (hash !== cur.hash) { showPinError("Неверный PIN."); pin1.value=""; pin1.focus(); return; }

        setUnlocked(); resolve();
      }, { once: true });
    });
  }

  // ---------- dates/labels ----------
  const MONTHS_NOM = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  const MONTHS_GEN = ["Января","Февраля","Марта","Апреля","Мая","Июня","Июля","Августа","Сентября","Октября","Ноября","Декабря"];

  function monthLabel(ym) {
    if (!ym || ym.length !== 7) return String(ym || "");
    const y = ym.slice(0, 4);
    const m = Number(ym.slice(5, 7));
    return `${MONTHS_NOM[m - 1] || ym} ${y}`;
  }

  function dateLabel(iso) {
    if (!iso || iso.length !== 10) return String(iso || "");
    const y = iso.slice(0, 4);
    const m = Number(iso.slice(5, 7));
    const d = Number(iso.slice(8, 10));
    return `${d} ${MONTHS_GEN[m - 1] || ""} ${y}`.trim();
  }

  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function monthKeyFromISO(iso) {
    return String(iso).slice(0, 7);
  }

  function addMonths(dateObj, n) {
    const d = new Date(dateObj);
    d.setMonth(d.getMonth() + n);
    return d;
  }

  function ymFromDate(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }

  function showAlert(hostEl, message, type = "success") {
    if (!hostEl) return;
    hostEl.innerHTML = `<div class="alert alert-${type} rounded-4 mb-3">${escapeHtml(message)}</div>`;
    setTimeout(() => { hostEl.innerHTML = ""; }, 2500);
  }

  // ---------- IndexedDB ----------
  const DB_NAME = "finance_pwa_db";
  const DB_VERSION = 1;
  const STORE = "purchases";

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
          store.createIndex("month_key", "month_key", { unique: false });
          store.createIndex("purchased_at", "purchased_at", { unique: false });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function getAllPurchases() {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const res = await reqToPromise(store.getAll());
    await txDone(tx);
    db.close();
    return res || [];
  }

  async function getPurchase(id) {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const res = await reqToPromise(store.get(Number(id)));
    await txDone(tx);
    db.close();
    return res || null;
  }

  async function addPurchase(p) {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const id = await reqToPromise(store.add(p));
    await txDone(tx);
    db.close();
    return id;
  }

  async function updatePurchase(p) {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    await reqToPromise(store.put(p));
    await txDone(tx);
    db.close();
  }

  async function deletePurchase(id) {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    await reqToPromise(store.delete(Number(id)));
    await txDone(tx);
    db.close();
  }

  // ---------- state ----------
  const state = { purchases: null };

  async function reloadState() {
    state.purchases = await getAllPurchases();
    return state.purchases;
  }

  async function ensureState() {
    if (state.purchases === null) await reloadState();
    return state.purchases;
  }

  function getAvailableMonthsFromPurchases(purchases) {
    const set = new Set();
    for (const p of purchases) set.add(p.month_key);
    return Array.from(set).filter(Boolean).sort().reverse();
  }

  function groupSummaryForPurchases(purchases) {
    const map = new Map();
    for (const p of purchases) {
      const cat = p.category || "Без категории";
      const cur = map.get(cat) || { category: cat, count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += Number(p.amount || 0);
      map.set(cat, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.sum - a.sum);
  }

  function detailsByCategory(purchases) {
    const byCat = {};
    const sorted = [...purchases].sort((a, b) => (b.purchased_at || "").localeCompare(a.purchased_at || ""));
    for (const p of sorted) {
      const cat = p.category || "Без категории";
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(p);
    }
    return byCat;
  }

  // ---------- delete modal ----------
  function initDeleteModal(onAfterDelete) {
    const modalEl = document.getElementById("deleteConfirmModal");
    const confirmBtn = document.getElementById("deleteConfirmBtn");
    const confirmText = document.getElementById("deleteConfirmText");
    if (!modalEl || !confirmBtn) return;

    let deleteId = null;

    modalEl.addEventListener("show.bs.modal", (event) => {
      const btn = event.relatedTarget;
      if (!btn) return;

      const pid = btn.getAttribute("data-purchase-id");
      if (!pid) return;

      deleteId = Number(pid);
      const title = btn.getAttribute("data-title") || "";
      if (confirmText) {
        confirmText.textContent = title
          ? `Удалить «${title}»? Запись будет удалена без возможности восстановления.`
          : "Запись будет удалена без возможности восстановления.";
      }
    });

    confirmBtn.addEventListener("click", async () => {
      if (!deleteId) return;
      await deletePurchase(deleteId);
      await reloadState();
      const inst = bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
      if (onAfterDelete) onAfterDelete();
      deleteId = null;
    });
  }

  // ---------- ADD ----------
  let addChart = null;

  function pickAddChartMonth(purchases) {
    const months = getAvailableMonthsFromPurchases(purchases);
    const now = new Date();
    const current = ymFromDate(now);
    const prev = ymFromDate(addMonths(now, -1));

    if (months.includes(current)) return current;
    if (months.includes(prev)) return prev;
    if (months.length) return months[0];
    return prev;
  }

  function purchasesForMonth(purchases, ym) {
    return purchases.filter(p => p.month_key === ym);
  }

  function renderAddChartFromPurchases(purchases, ym) {
    const titleEl = document.getElementById("addChartTitle");
    if (titleEl) titleEl.textContent = `Расходы за ${monthLabel(ym)}`;

    const canvas = document.getElementById("addMonthChart");
    if (!canvas) return;
    if (typeof Chart === "undefined") return;

    const monthPurchases = purchasesForMonth(purchases, ym);
    const summary = groupSummaryForPurchases(monthPurchases);

    const labels = summary.map(x => x.category);
    const sums = summary.map(x => x.sum);

    if (addChart) addChart.destroy();
    addChart = new Chart(canvas, {
      type: "doughnut",
      data: { labels, datasets: [{ label: "Сумма", data: sums }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
    });
  }

  async function initAddPage() {
    const form = document.getElementById("purchaseForm");
    if (!form) return;

    const alertHost = document.getElementById("addAlertHost");
    const pageTitle = document.getElementById("addPageTitle");

    const idEl = document.getElementById("purchaseId");
    const nextEl = document.getElementById("nextUrl");

    const titleEl = document.getElementById("titleInput");
    const categoryEl = document.getElementById("categoryInput");
    const amountEl = document.getElementById("amountInput");
    const commentEl = document.getElementById("commentInput");
    const dateEl = document.getElementById("dateInput");

    const submitBtn = document.getElementById("submitBtn");
    const cancelBtn = document.getElementById("cancelEditBtn");

    await ensureState();

    const ym = pickAddChartMonth(state.purchases);
    renderAddChartFromPurchases(state.purchases, ym);

    const params = new URLSearchParams(location.search);
    const editId = params.get("edit");
    const nextUrl = params.get("next") || "";
    if (nextEl) nextEl.value = nextUrl;

    async function enterEditMode(pid) {
      const p = await getPurchase(pid);
      if (!p) {
        showAlert(alertHost, "Покупка для редактирования не найдена.", "danger");
        return;
      }
      if (pageTitle) pageTitle.textContent = "Редактирование покупки";
      if (idEl) idEl.value = String(p.id);

      titleEl.value = p.title || "";
      categoryEl.value = p.category || "";
      amountEl.value = String(Number(p.amount || 0).toFixed(1));
      commentEl.value = p.comment || "";
      dateEl.value = p.purchased_at || "";

      if (submitBtn) submitBtn.textContent = "Внести изменения";
      if (cancelBtn) cancelBtn.classList.remove("d-none");
    }

    function exitEditMode() {
      if (pageTitle) pageTitle.textContent = "Внесение расходов";
      if (idEl) idEl.value = "";
      form.reset();
      if (submitBtn) submitBtn.textContent = "Внести данные";
      if (cancelBtn) cancelBtn.classList.add("d-none");

      const p = new URLSearchParams(location.search);
      p.delete("edit");
      history.replaceState({}, "", `${location.pathname}${p.toString() ? "?" + p.toString() : ""}`);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        const n = nextEl?.value || "";
        if (n) location.href = n;
        else exitEditMode();
      });
    }

    if (editId) await enterEditMode(editId);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const title = (titleEl.value || "").trim();
      const category = (categoryEl.value || "").trim();
      const amountRaw = (amountEl.value || "").trim().replace(",", ".");
      const comment = (commentEl.value || "").trim();
      const purchased_at = (dateEl.value || "").trim() || todayISO();

      if (!title || !category || !amountRaw) {
        showAlert(alertHost, "Заполните: название, категорию и сумму.", "danger");
        return;
      }

      const amount = Number(amountRaw);
      if (!Number.isFinite(amount)) {
        showAlert(alertHost, "Сумма должна быть числом.", "danger");
        return;
      }

      const month_key = monthKeyFromISO(purchased_at);
      const existingId = idEl?.value ? Number(idEl.value) : null;

      try {
        if (existingId) {
          const old = await getPurchase(existingId);
          if (!old) {
            showAlert(alertHost, "Не удалось сохранить: запись не найдена.", "danger");
            return;
          }
          old.title = title;
          old.category = category;
          old.amount = amount;
          old.comment = comment;
          old.purchased_at = purchased_at;
          old.month_key = month_key;

          await updatePurchase(old);
          await reloadState();

          showAlert(alertHost, "Изменения сохранены.", "success");

          const n = nextEl?.value || "";
          if (n) { location.href = n; return; }
          exitEditMode();
        } else {
          await addPurchase({ title, category, amount, comment, purchased_at, month_key });
          await reloadState();
          showAlert(alertHost, "Покупка добавлена.", "success");
          form.reset();
        }
      } catch (err) {
        console.error(err);
        showAlert(alertHost, "Не удалось сохранить покупку (IndexedDB).", "danger");
        return;
      }

      const newYm = pickAddChartMonth(state.purchases);
      renderAddChartFromPurchases(state.purchases, newYm);
    });
  }

  // ---------- EXPENSES ----------
  function buildPurchaseCardHTML(p, nextUrl) {
    const faceDate = dateLabel(p.purchased_at);
    const sum = Number(p.amount || 0).toFixed(1);

    const editUrl = new URL("./index.html", location.href);
    editUrl.searchParams.set("edit", String(p.id));
    editUrl.searchParams.set("next", nextUrl);

    return `
<div class="card purchase-card shadow-sm rounded-4 mb-2">
  <button class="btn text-start p-3" type="button" data-bs-toggle="collapse" data-bs-target="#p${p.id}">
    <div class="d-flex justify-content-between align-items-start gap-3">
      <div class="flex-grow-1">
        <div class="fw-semibold">${escapeHtml(p.title)}</div>
        <div class="text-muted small mt-1">${escapeHtml(faceDate)}</div>
      </div>
      <div class="badge rounded-pill price-badge align-self-center">${sum}</div>
    </div>
  </button>

  <div id="p${p.id}" class="collapse">
    <div class="px-3 pb-3 text-muted small">
      <div><b>Категория:</b> ${escapeHtml(p.category)}</div>
      ${p.comment ? `<div><b>Комментарий:</b> ${escapeHtml(p.comment)}</div>` : ``}

      <div class="d-flex gap-2 mt-3">
        <a class="btn btn-outline-primary btn-sm rounded-pill" href="${editUrl.toString()}">Редактировать</a>

        <button type="button"
                class="btn btn-outline-danger btn-sm rounded-pill"
                data-bs-toggle="modal"
                data-bs-target="#deleteConfirmModal"
                data-purchase-id="${p.id}"
                data-title="${escapeHtml(p.title)}">
          Удалить
        </button>
      </div>
    </div>
  </div>
</div>
`;
  }

  async function initExpensesPage() {
    const monthSelect = document.getElementById("expensesMonthSelect");
    const sortSelect = document.getElementById("expensesSortSelect");
    const form = document.getElementById("expensesFilters");
    const listEl = document.getElementById("purchaseList");
    const noDataEl = document.getElementById("expensesNoData");
    const contentEl = document.getElementById("expensesContent");
    const titleEl = document.getElementById("expensesMonthTitle");
    if (!monthSelect || !sortSelect || !form || !listEl || !noDataEl || !contentEl || !titleEl) return;

    // ✅ вот тут место для мобильного сокращения текста (а НЕ в initAddPage)
    if (window.matchMedia("(max-width: 576px)").matches) {
      const opts = sortSelect.querySelectorAll("option");
      if (opts[0]) opts[0].textContent = "Новые";
      if (opts[1]) opts[1].textContent = "Старые";
    }

    await ensureState();

    function render() {
      const purchases = state.purchases || [];
      const months = getAvailableMonthsFromPurchases(purchases);

      if (!months.length) {
        monthSelect.innerHTML = "";
        monthSelect.disabled = true;
        sortSelect.disabled = true;
        noDataEl.classList.remove("d-none");
        contentEl.classList.add("d-none");
        return;
      }

      noDataEl.classList.add("d-none");
      contentEl.classList.remove("d-none");
      monthSelect.disabled = false;
      sortSelect.disabled = false;

      const url = new URL(location.href);
      const qMonth = url.searchParams.get("month");
      const qSort = url.searchParams.get("sort");
      const currentYm = ymFromDate(new Date());
      const selectedMonth = (qMonth && months.includes(qMonth)) ? qMonth : (months.includes(currentYm) ? currentYm : months[0]);
      const sortMode = (qSort === "old" || qSort === "new") ? qSort : (sortSelect.value || "new");

      monthSelect.innerHTML = months.map(m => `
        <option value="${m}" ${m === selectedMonth ? "selected" : ""}>${escapeHtml(monthLabel(m))}</option>
      `).join("");

      sortSelect.value = sortMode;
      titleEl.textContent = monthLabel(selectedMonth);

      let items = purchases.filter(p => p.month_key === selectedMonth);
      items.sort((a, b) => {
        const da = a.purchased_at || "";
        const db = b.purchased_at || "";
        return (sortMode === "old") ? da.localeCompare(db) : db.localeCompare(da);
      });

      const nextUrl = `${location.pathname}?month=${encodeURIComponent(selectedMonth)}&sort=${encodeURIComponent(sortMode)}`;
      listEl.innerHTML = items.map(p => buildPurchaseCardHTML(p, nextUrl)).join("");
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const url = new URL(location.href);
      url.searchParams.set("month", monthSelect.value);
      url.searchParams.set("sort", sortSelect.value);
      history.replaceState({}, "", url.toString());
      render();
    });

    render();
    initDeleteModal(() => render());
  }

  // ---------- REPORTS ----------
  let reportChart = null;

  function filterByPeriod(purchases, period, monthKey) {
    const today = new Date();
    if (period === "all") return purchases;

    if (period === "month") {
      if (!monthKey) return [];
      return purchases.filter(p => p.month_key === monthKey);
    }

    let start = (period === "3m") ? addMonths(today, -3) : addMonths(today, -12);
    const startISO = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
    const endISO = todayISO();
    return purchases.filter(p => (p.purchased_at >= startISO && p.purchased_at <= endISO));
  }

  function renderReportsUI(purchases, period, monthKey) {
    const noData = document.getElementById("reportsNoData");
    const content = document.getElementById("reportsContent");
    const summaryTbody = document.getElementById("summaryTbody");
    const detailsAccordion = document.getElementById("detailsAccordion");
    const chartCanvas = document.getElementById("reportChart");
    if (!noData || !content || !summaryTbody || !detailsAccordion || !chartCanvas) return;

    const months = getAvailableMonthsFromPurchases(purchases);
    if (!months.length) {
      noData.classList.remove("d-none");
      content.classList.add("d-none");
      return;
    }

    noData.classList.add("d-none");
    content.classList.remove("d-none");

    const filtered = filterByPeriod(purchases, period, monthKey);
    const summary = groupSummaryForPurchases(filtered);
    const details = detailsByCategory(filtered);

    // --- Total spent title ---
    const totalTitleEl = document.getElementById("reportsTotalTitle");
    const totalSum = filtered.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    let label = "";
    if (period === "month") label = monthLabel(monthKey);
    else if (period === "3m") label = "3 месяца";
    else if (period === "year") label = "год";
    else label = "все время";

    if (totalTitleEl) {
      totalTitleEl.textContent = `Потрачено за ${label}: ${totalSum.toFixed(1)} ₽`;
    }



    summaryTbody.innerHTML = summary.map(row => `
      <tr>
        <td>
          <button class="btn btn-link p-0 text-decoration-none fw-semibold summary-cat-link"
                  data-open-cat="${escapeHtml(row.category)}">
            ${escapeHtml(row.category)}
          </button>
        </td>
        <td class="text-center">${row.count}</td>
        <td class="text-end" style="padding-right:30px;">${row.sum.toFixed(1)}</td>
      </tr>
    `).join("");

    summaryTbody.querySelectorAll("[data-open-cat]").forEach(btn => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-open-cat");
        const safe = String(cat).replace(/[^a-zA-Z0-9_-]/g, "_");
        const el = document.getElementById(`acc-${safe}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        const collapse = document.getElementById(`col-${safe}`);
        if (collapse) bootstrap.Collapse.getOrCreateInstance(collapse, { toggle: false }).show();
      });
    });

    const sumByCat = {};
    for (const s of summary) sumByCat[s.category] = s.sum;

    const cats = Object.keys(details);
    detailsAccordion.innerHTML = cats.map((cat) => {
      const safe = String(cat).replace(/[^a-zA-Z0-9_-]/g, "_");
      const items = details[cat] || [];
      const sum = Number(sumByCat[cat] ?? 0);

      const itemHtml = items.map(p => `
        <div class="border rounded-4 p-3 mb-2">
          <div class="d-flex justify-content-between align-items-center gap-3">
            <div class="flex-grow-1">
              <div class="fw-semibold">${escapeHtml(p.title)}</div>
              <div class="text-muted small mt-1">
                <div><b>Дата:</b> ${escapeHtml(dateLabel(p.purchased_at))}</div>
                ${p.comment ? `<div><b>Комментарий:</b> ${escapeHtml(p.comment)}</div>` : ``}
              </div>
            </div>
            <div class="badge rounded-pill report-item-badge align-self-center">
              ${Number(p.amount).toFixed(1)}
            </div>
          </div>
        </div>
      `).join("");

      return `
<div class="accordion-item rounded-4 overflow-hidden mb-2" id="acc-${safe}">
  <h2 class="accordion-header">
    <button class="accordion-button collapsed" type="button"
            data-bs-toggle="collapse" data-bs-target="#col-${safe}">
      <div class="d-flex w-100 justify-content-between align-items-center gap-3">
        <div>
          ${escapeHtml(cat)}
          <span class="text-muted small">(Количество покупок - ${items.length})</span>
        </div>
        <div class="badge rounded-pill report-sum-badge">${sum.toFixed(1)}</div>
      </div>
    </button>
  </h2>
  <div id="col-${safe}" class="accordion-collapse collapse" data-bs-parent="#detailsAccordion">
    <div class="accordion-body">
      ${itemHtml || `<div class="text-muted">Покупок нет.</div>`}
    </div>
  </div>
</div>`;
    }).join("");

    // chart (не ломает страницу, если Chart не загрузился)
    if (typeof Chart === "undefined") return;

    const labels = summary.map(x => x.category);
    const sums = summary.map(x => x.sum);
    if (reportChart) reportChart.destroy();
    reportChart = new Chart(chartCanvas, {
      type: "bar",
      data: { labels, datasets: [{ label: "Сумма", data: sums }] },
      options: { responsive: true }
    });
  }

  async function initReportsPage() {
    const periodSelect = document.getElementById("periodSelect");
    const monthSelect = document.getElementById("monthSelect");
    const chartCanvas = document.getElementById("reportChart");
    if (!periodSelect || !monthSelect || !chartCanvas) return;

    await ensureState();

    function fillMonths(months, selected) {
      monthSelect.innerHTML = months.map(m => `
        <option value="${m}" ${m === selected ? "selected" : ""}>${escapeHtml(monthLabel(m))}</option>
      `).join("");
    }

    function setMonthSelectVisible() {
      monthSelect.style.display = (periodSelect.value === "month") ? "block" : "none";
    }

    function render() {
      const purchases = state.purchases || [];
      const months = getAvailableMonthsFromPurchases(purchases);

      const currentYm = ymFromDate(new Date());
      const selectedMonth = (months.includes(currentYm) ? currentYm : (months[0] || currentYm));

      if (!monthSelect.value || !months.includes(monthSelect.value)) fillMonths(months, selectedMonth);
      else fillMonths(months, monthSelect.value);

      setMonthSelectVisible();

      const period = periodSelect.value || "month";
      renderReportsUI(purchases, period, monthSelect.value);
    }

    periodSelect.addEventListener("change", render);
    monthSelect.addEventListener("change", render);

    render();
    initDeleteModal(() => render());
  }

  // ---------- boot ----------
  async function boot() {
    if (typeof initPinGate === "function") await initPinGate();
    await initAddPage();
    await initExpensesPage();
    await initReportsPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

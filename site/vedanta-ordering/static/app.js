const API = "/api/vedanta-ordering";
const FETCH_OPTS = { credentials: "include" };

let currentUser = null;
let alarmEnabled = true;
let lastPendingCount = 0;
let activeStockCheckId = null;
let products = [];
let suppliers = [];
let stockChecks = [];
let pollInterval = null;
let ethosSummary = "";

const audioCtx = typeof AudioContext !== "undefined" ? new (window.AudioContext || window.webkitAudioContext)() : null;

function playOrderAlarm() {
  if (!alarmEnabled || !audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  const now = audioCtx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = i % 2 === 0 ? 880 : 660;
    osc.type = "square";
    const start = now + i * 0.35;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
    osc.start(start);
    osc.stop(start + 0.32);
  }
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    if (typeof options.body === "object") {
      options = { ...options, body: JSON.stringify(options.body) };
    }
  }
  const res = await fetch(API + path, { ...FETCH_OPTS, ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function setStatus(el, msg, ok) {
  if (!el) return;
  el.textContent = msg;
  el.className = "status-msg " + (ok ? "ok" : "err");
  el.classList.remove("hidden");
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function supplierClass(slug) {
  return "supplier-pill supplier-" + (slug || "").replace(/\s/g, "-");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function showLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appShell").classList.add("hidden");
  currentUser = null;
}

function showApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  const label = `${currentUser.display_name} (${currentUser.department})`;
  document.getElementById("userInfo").textContent = label;
  document.getElementById("stockUserLabel").textContent = label;
  document.getElementById("orderUserLabel").textContent = label;
  const adminTab = document.querySelector('.phase-tab[data-phase="admin"]');
  if (currentUser.role === "admin") {
    adminTab.classList.remove("hidden");
  } else {
    adminTab.classList.add("hidden");
  }
}

async function loadEthos() {
  /* ethos banner removed */
}

async function checkAuth() {
  try {
    const me = await api("/auth/me");
    if (me.authenticated) {
      currentUser = me;
      showApp();
      await initApp();
      return true;
    }
  } catch {
    /* not logged in */
  }
  showLogin();
  return false;
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("loginError");
  errEl.classList.add("hidden");
  const login_id = document.getElementById("loginId").value.trim();
  const pin = document.getElementById("loginPin").value.trim();
  try {
    currentUser = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id, pin }),
    });
    showApp();
    await initApp();
  } catch (err) {
    setStatus(errEl, err.message, false);
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = null;
  showLogin();
  document.getElementById("loginForm").reset();
});

function switchPhase(num) {
  document.querySelectorAll(".phase-tab").forEach((t) => {
    const phase = t.dataset.phase;
    t.classList.toggle("active", phase === String(num) || phase === num);
  });
  document.querySelectorAll(".phase-panel").forEach((p) => {
    p.classList.toggle("active", p.id === "phase" + num);
  });
  if (num === 2) refreshOrderForm();
  if (num === 3) loadOrders();
  if (num === "admin") loadAdminUsers();
}

document.querySelectorAll(".phase-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchPhase(tab.dataset.phase));
});

document.getElementById("alarmToggle").addEventListener("click", () => {
  alarmEnabled = !alarmEnabled;
  document.getElementById("alarmToggle").textContent = alarmEnabled ? "\u{1F514} Alarm on" : "\u{1F515} Alarm off";
});

document.getElementById("stockPhoto").addEventListener("change", (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById("photoPreview");
  const img = document.getElementById("photoPreviewImg");
  if (file) {
    img.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
  }
});

document.getElementById("startStockCheck").addEventListener("click", async () => {
  const photo = document.getElementById("stockPhoto").files[0];
  const notes = document.getElementById("stockNotes").value.trim();
  const statusEl = document.getElementById("stockCheckStatus");

  const form = new FormData();
  form.append("notes", notes);
  if (photo) form.append("photo", photo);

  try {
    const result = await api("/stock-checks", { method: "POST", body: form });
    activeStockCheckId = result.id;
    document.getElementById("activeCheckId").textContent = "#" + result.id;
    document.getElementById("stockCountSection").classList.remove("hidden");
    setStatus(statusEl, "Stock check started — count each item below", true);
    renderStockCountList();
  } catch (err) {
    setStatus(statusEl, err.message, false);
  }
});

function unitHint(unit) {
  if (unit === "kg") return "kg - weigh/count kilos";
  if (unit === "each") return "each - count whole items";
  if (unit === "case") return "cases - count full boxes";
  return unit;
}

function productMeta(p) {
  const parts = [];
  if (p.product_code) parts.push(p.product_code);
  if (p.pack_size) parts.push(p.pack_size);
  if (p.case_price != null) parts.push(`£${Number(p.case_price).toFixed(2)}/case`);
  parts.push(unitHint(p.unit));
  return parts.join(" · ");
}

function renderStockCountList() {
  const list = document.getElementById("stockCountList");
  list.innerHTML = products
    .map(
      (p) => `
    <div class="stock-row ${p.current_stock !== null && p.current_stock <= p.reorder_level ? "low" : ""}" data-product-id="${p.id}">
      <div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="meta">${escapeHtml(productMeta(p))} · reorder ${p.reorder_level} ${p.unit}</div>
      </div>
      <input type="number" min="0" step="0.1" placeholder="0" class="stock-qty" data-product-id="${p.id}">
      <span class="meta" title="${escapeHtml(p.pack_size || '')}">${unitHint(p.unit)}</span>
    </div>`
    )
    .join("");

  list.querySelectorAll(".stock-qty").forEach((input) => {
    input.addEventListener("change", () => saveStockItem(input));
    input.addEventListener("blur", () => saveStockItem(input));
  });
}

async function saveStockItem(input) {
  if (!activeStockCheckId || input.value === "") return;
  const productId = Number(input.dataset.productId);
  try {
    await api(`/stock-checks/${activeStockCheckId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, quantity_counted: parseFloat(input.value) }),
    });
    input.style.borderColor = "var(--success)";
  } catch {
    input.style.borderColor = "var(--danger)";
  }
}

document.getElementById("completeStockCheck").addEventListener("click", async () => {
  const statusEl = document.getElementById("stockCheckStatus");
  if (!activeStockCheckId) return;
  try {
    await api(`/stock-checks/${activeStockCheckId}/complete`, { method: "POST" });
    setStatus(statusEl, "Stock check complete — Phase 2 can now place orders", true);
    activeStockCheckId = null;
    document.getElementById("stockCountSection").classList.add("hidden");
    await loadStockChecks();
    await loadProducts();
  } catch (err) {
    setStatus(statusEl, err.message, false);
  }
});

async function loadStockChecks() {
  stockChecks = await api("/stock-checks");
  const completed = stockChecks.filter((c) => c.completed);

  const recent = document.getElementById("recentStockChecks");
  recent.innerHTML =
    stockChecks.length === 0
      ? '<p class="hint">No stock checks yet</p>'
      : stockChecks
          .slice(0, 10)
          .map(
            (c) => `
      <div class="history-item">
        <span>#${c.id} · ${escapeHtml(c.staff_name)} · ${escapeHtml(c.department || "")} · ${formatTime(c.created_at)} · ${c.item_count} items</span>
        <span class="${c.completed ? "done" : ""}">${c.completed ? "Complete" : "In progress"}</span>
      </div>`
          )
          .join("");

  const select = document.getElementById("orderStockCheck");
  select.innerHTML = completed
    .map((c) => `<option value="${c.id}">#${c.id} — ${escapeHtml(c.staff_name)} (${formatTime(c.created_at)})</option>`)
    .join("");

  const warning = document.getElementById("noStockCheckWarning");
  const formSection = document.getElementById("orderFormSection");
  if (completed.length === 0) {
    warning.classList.remove("hidden");
    formSection.classList.add("hidden");
  } else {
    warning.classList.add("hidden");
    formSection.classList.remove("hidden");
  }
}

async function loadProducts() {
  products = await api("/products");
}

async function loadSuppliers() {
  suppliers = await api("/suppliers");
  const select = document.getElementById("orderSupplier");
  select.innerHTML =
    '<option value="">Choose supplier…</option>' +
    suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
}

async function refreshOrderForm() {
  await loadProducts();
  await loadStockChecks();
  renderOrderItems();
}

document.getElementById("orderSupplier").addEventListener("change", renderOrderItems);
document.getElementById("orderStockCheck").addEventListener("change", renderOrderItems);

async function renderOrderItems() {
  const supplierId = Number(document.getElementById("orderSupplier").value);
  const checkId = Number(document.getElementById("orderStockCheck").value);
  const list = document.getElementById("orderItemsList");

  if (!supplierId || !checkId) {
    list.innerHTML = '<p class="hint">Select supplier and stock check</p>';
    return;
  }

  let checkItems = {};
  try {
    const check = await api(`/stock-checks/${checkId}`);
    check.items.forEach((i) => {
      checkItems[i.product_id] = i.quantity_counted;
    });
  } catch {
    list.innerHTML = '<p class="hint">Could not load stock check</p>';
    return;
  }

  const filtered = products.filter((p) => p.supplier_id === supplierId);
  if (filtered.length === 0) {
    list.innerHTML = '<p class="hint">No products for this supplier</p>';
    return;
  }

  list.innerHTML = filtered
    .map((p) => {
      const stock = checkItems[p.id];
      const hasStock = stock !== undefined;
      const low = hasStock && stock <= p.reorder_level;
      return `
    <div class="order-row ${low ? "low" : ""} ${!hasStock ? "hidden" : ""}" data-product-id="${p.id}" data-has-stock="${hasStock}">
      <div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="meta">${escapeHtml(productMeta(p))}</div>
        <div class="meta">In stock: ${hasStock ? stock + " " + p.unit : "Not counted"}</div>
      </div>
      <input type="number" min="0" step="0.1" placeholder="Qty" class="order-qty" data-product-id="${p.id}" ${!hasStock ? "disabled" : ""}>
      <span class="meta">${p.unit}</span>
    </div>`;
    })
    .join("");

  if (list.querySelectorAll('[data-has-stock="true"]').length === 0) {
    list.innerHTML = '<p class="hint">No counted stock for this supplier in the selected check.</p>';
  }
}

document.getElementById("submitOrder").addEventListener("click", async () => {
  const statusEl = document.getElementById("orderStatus");
  const supplierId = Number(document.getElementById("orderSupplier").value);
  const stockCheckId = Number(document.getElementById("orderStockCheck").value);
  const notes = document.getElementById("orderNotes").value.trim();

  if (!supplierId || !stockCheckId) {
    setStatus(statusEl, "Select supplier and stock check", false);
    return;
  }

  const items = [];
  document.querySelectorAll("#orderItemsList .order-qty").forEach((input) => {
    const qty = parseFloat(input.value);
    if (qty > 0) {
      items.push({ product_id: Number(input.dataset.productId), quantity_ordered: qty });
    }
  });

  if (items.length === 0) {
    setStatus(statusEl, "Add at least one item with quantity", false);
    return;
  }

  try {
    const result = await api("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier_id: supplierId, stock_check_id: stockCheckId, notes, items }),
    });
    setStatus(statusEl, `Order #${result.id} sent to Phase 3`, true);
    document.querySelectorAll("#orderItemsList .order-qty").forEach((i) => (i.value = ""));
    pollPendingOrders();
  } catch (err) {
    setStatus(statusEl, err.message, false);
  }
});

async function loadOrders() {
  const orders = await api("/orders?status=pending");
  const acked = await api("/orders?status=acknowledged");
  const all = [...orders, ...acked].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const queue = document.getElementById("ordersQueue");
  const empty = document.getElementById("noOrdersMsg");

  if (all.length === 0) {
    queue.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  queue.innerHTML = "";

  for (const order of all) {
    const detail = await api(`/orders/${order.id}`);
    const card = document.createElement("div");
    card.className = "order-card" + (order.status === "acknowledged" ? " acknowledged" : "");
    card.innerHTML = `
      <div class="order-card-header">
        <h3>Order #${order.id} <span class="${supplierClass(suppliers.find((s) => s.name === order.supplier_name)?.slug)}">${escapeHtml(order.supplier_name)}</span></h3>
        <span class="time">${formatTime(order.created_at)}</span>
      </div>
      <div class="order-card-meta">
        ${escapeHtml(order.department || "")} · Requested by ${escapeHtml(order.requested_by)}
        ${order.notes ? " · " + escapeHtml(order.notes) : ""}
        · Stock check #${order.stock_check_id}
      </div>
      <ul class="order-card-items">
        ${detail.items.map((i) => `<li>${escapeHtml(i.product_name)}: order <strong>${i.quantity_ordered}</strong> ${i.unit} (had ${i.stock_before} in stock)</li>`).join("")}
      </ul>
      <div class="order-card-actions">
        ${
          order.status === "pending"
            ? `<button type="button" class="btn btn-warning ack-btn" data-id="${order.id}">Take order</button>`
            : `<span class="tag">Taken by ${escapeHtml(order.acknowledged_by || "")}</span>`
        }
        <button type="button" class="btn btn-success place-btn" data-id="${order.id}">Place with supplier</button>
      </div>`;
    queue.appendChild(card);
  }

  queue.querySelectorAll(".ack-btn").forEach((btn) => {
    btn.addEventListener("click", () => acknowledgeOrder(Number(btn.dataset.id)));
  });
  queue.querySelectorAll(".place-btn").forEach((btn) => {
    btn.addEventListener("click", () => placeOrder(Number(btn.dataset.id)));
  });
}

async function acknowledgeOrder(id) {
  try {
    await api(`/orders/${id}/acknowledge`, { method: "POST" });
    loadOrders();
  } catch (err) {
    alert(err.message);
  }
}

async function placeOrder(id) {
  if (!confirm("Mark this order as placed with the supplier?")) return;
  try {
    await api(`/orders/${id}/place`, { method: "POST" });
    loadOrders();
  } catch (err) {
    alert(err.message);
  }
}

async function pollPendingOrders() {
  if (!currentUser) return;
  try {
    const { count } = await api("/orders/pending-count");
    const badge = document.getElementById("pendingBadge");
    if (count > 0) {
      badge.textContent = count + " new";
      badge.classList.remove("hidden");
      if (count > lastPendingCount) playOrderAlarm();
    } else {
      badge.classList.add("hidden");
    }
    lastPendingCount = count;
    if (document.getElementById("phase3").classList.contains("active")) loadOrders();
  } catch {
    /* server may be starting */
  }
}

async function loadAdminUsers() {
  if (currentUser?.role !== "admin") return;
  const users = await api("/admin/users");
  const list = document.getElementById("usersList");
  list.innerHTML = users
    .map(
      (u) => `
    <div class="user-row ${u.active ? "" : "inactive"}">
      <div>
        <div class="name">${escapeHtml(u.display_name)} <span class="tag">${escapeHtml(u.login_id)}</span></div>
        <div class="meta">${escapeHtml(u.department)} · ${u.role} · ${u.active ? "Active" : "Disabled"}</div>
      </div>
      <div class="user-actions">
        <button type="button" class="btn btn-ghost reset-pin-btn" data-id="${u.id}">Reset PIN</button>
        <button type="button" class="btn btn-ghost toggle-active-btn" data-id="${u.id}" data-active="${u.active ? "1" : "0"}">${u.active ? "Disable" : "Enable"}</button>
      </div>
    </div>`
    )
    .join("");

  list.querySelectorAll(".reset-pin-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const pin = prompt("Enter new PIN (min 4 characters):");
      if (!pin) return;
      try {
        await api(`/admin/users/${btn.dataset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        setStatus(document.getElementById("adminStatus"), "PIN updated", true);
      } catch (err) {
        setStatus(document.getElementById("adminStatus"), err.message, false);
      }
    });
  });

  list.querySelectorAll(".toggle-active-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const active = btn.dataset.active !== "1";
      try {
        await api(`/admin/users/${btn.dataset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        });
        loadAdminUsers();
      } catch (err) {
        setStatus(document.getElementById("adminStatus"), err.message, false);
      }
    });
  });
}

document.getElementById("createUserBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("adminStatus");
  const payload = {
    login_id: document.getElementById("newLoginId").value.trim(),
    pin: document.getElementById("newPin").value.trim(),
    display_name: document.getElementById("newDisplayName").value.trim(),
    department: document.getElementById("newDepartment").value.trim(),
    role: document.getElementById("newRole").value,
  };
  try {
    await api("/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setStatus(statusEl, "User created", true);
    document.getElementById("newLoginId").value = "";
    document.getElementById("newPin").value = "";
    document.getElementById("newDisplayName").value = "";
    document.getElementById("newDepartment").value = "";
    loadAdminUsers();
  } catch (err) {
    setStatus(statusEl, err.message, false);
  }
});

async function initApp() {
  await loadSuppliers();
  await loadProducts();
  await loadStockChecks();
  pollPendingOrders();
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(pollPendingOrders, 5000);
}

async function boot() {
  await loadEthos();
  await checkAuth();
}

boot();

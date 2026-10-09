const STORAGE_KEY = "invoice-generator:v1";
const form = document.getElementById("editor");
const itemsEl = document.getElementById("items");
const tpl = document.getElementById("item-tpl");
const $ = (id) => document.getElementById(id);

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function defaults() {
  const issued = today();
  return {
    number: `INV-${new Date().getFullYear()}-001`,
    currency: "USD",
    issued,
    due: plusDays(issued, 14),
    accent: "#4f46e5",
    logo: "",
    fromName: "MoonWave Studio",
    fromDetails: "manjak.studio@gmail.com\nmoonwave-studio.com",
    toName: "Sugar Petal Bakery",
    toDetails: "Attn: Anna\n12 Rose Street",
    items: [
      { desc: "Landing page design & development", qty: 1, price: 450 },
      { desc: "Contact form + Telegram notifications", qty: 1, price: 120 },
      { desc: "Extra revision round", qty: 2, price: 40 },
    ],
    discount: 0,
    tax: 17,
    notes: "Payment via Upwork or bank transfer within 14 days.\nThank you for your business!",
  };
}

let state = load() || defaults();

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}
let saveTimer;
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { return; }
  const badge = $("saved");
  badge.classList.add("show");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => badge.classList.remove("show"), 1200);
}

// ---------- Form <-> state ----------
const FIELDS = ["number", "currency", "issued", "due", "accent", "fromName", "fromDetails", "toName", "toDetails", "discount", "tax", "notes"];

function fillForm() {
  FIELDS.forEach((f) => { form.elements[f].value = state[f] ?? ""; });
  itemsEl.innerHTML = "";
  state.items.forEach(addItemRow);
}

function addItemRow(item = { desc: "", qty: 1, price: 0 }) {
  const row = tpl.content.firstElementChild.cloneNode(true);
  row.querySelector('[name="desc"]').value = item.desc;
  row.querySelector('[name="qty"]').value = item.qty;
  row.querySelector('[name="price"]').value = item.price;
  itemsEl.append(row);
  return row;
}

function readForm() {
  FIELDS.forEach((f) => { state[f] = form.elements[f].value; });
  state.items = [...itemsEl.children].map((row) => ({
    desc: row.querySelector('[name="desc"]').value,
    qty: row.querySelector('[name="qty"]').value,
    price: row.querySelector('[name="price"]').value,
  }));
}

// ---------- Rendering ----------
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
function money(v) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: state.currency }).format(v); }
  catch { return `${v.toFixed(2)} ${state.currency}`; }
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function text(id, value) { $(id).textContent = value; }

function render() {
  document.documentElement.style.setProperty("--accent", state.accent || "#4f46e5");
  text("p-number", state.number || "—");
  text("p-issued", fmtDate(state.issued));
  text("p-due", fmtDate(state.due));
  ["fromName", "fromDetails", "toName", "toDetails"].forEach((f) => text(`p-${f}`, state[f]));

  const logo = $("p-logo");
  logo.hidden = !state.logo;
  if (state.logo) logo.src = state.logo; else logo.removeAttribute("src");

  const tbody = $("p-lines");
  tbody.innerHTML = "";
  let subtotal = 0;
  const lines = state.items.filter((i) => i.desc.trim() || num(i.price));
  lines.forEach((i) => {
    const amount = num(i.qty) * num(i.price);
    subtotal += amount;
    const tr = document.createElement("tr");
    [i.desc || "—", num(i.qty), money(num(i.price)), money(amount)].forEach((v, idx) => {
      const td = document.createElement("td");
      td.textContent = v;
      if (idx) td.className = "num";
      tr.append(td);
    });
    tbody.append(tr);
  });
  if (!lines.length) tbody.innerHTML = '<tr class="empty"><td colspan="4">Add your first item on the left</td></tr>';

  const discountRate = Math.min(100, Math.max(0, num(state.discount)));
  const taxRate = Math.max(0, num(state.tax));
  const discount = subtotal * discountRate / 100;
  const tax = (subtotal - discount) * taxRate / 100;
  const total = subtotal - discount + tax;

  text("p-subtotal", money(subtotal));
  $("row-discount").hidden = !discountRate;
  text("p-discount-rate", `(${discountRate}%)`);
  text("p-discount", `−${money(discount)}`);
  $("row-tax").hidden = !taxRate;
  text("p-tax-rate", `(${taxRate}%)`);
  text("p-tax", money(tax));
  text("p-total", money(total));

  $("p-notes-wrap").hidden = !state.notes.trim();
  text("p-notes", state.notes);
  document.title = `${state.number || "Invoice"} — Invoice Generator`;
}

function update() { readForm(); render(); save(); }

// ---------- Events ----------
form.addEventListener("input", update);
form.addEventListener("submit", (e) => e.preventDefault());

$("add-item").addEventListener("click", () => {
  addItemRow().querySelector("input").focus();
  update();
});
itemsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove");
  if (!btn) return;
  const row = btn.closest(".item");
  const next = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  (next?.querySelector(".remove") || $("add-item")).focus();
  update();
});

$("logo-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 1_000_000) { alert("Please choose an image under 1 MB."); e.target.value = ""; return; }
  const reader = new FileReader();
  reader.onload = () => { state.logo = reader.result; render(); save(); };
  reader.readAsDataURL(file);
});
$("logo-clear").addEventListener("click", () => { state.logo = ""; $("logo-file").value = ""; render(); save(); });

$("pdf").addEventListener("click", () => window.print());

$("new").addEventListener("click", () => {
  if (!confirm("Start a new invoice? The current one will be cleared.")) return;
  const d = defaults();
  const next = String(state.number).replace(/(\d+)(?!.*\d)/, (m) => String(Number(m) + 1).padStart(m.length, "0"));
  state = { ...d, number: next, fromName: state.fromName, fromDetails: state.fromDetails, logo: state.logo, accent: state.accent, currency: state.currency, toName: "", toDetails: "", items: [{ desc: "", qty: 1, price: 0 }], notes: state.notes };
  fillForm(); render(); save();
});

$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${state.number || "invoice"}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});
$("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.items)) throw new Error("bad file");
    state = { ...defaults(), ...data };
    fillForm(); render(); save();
  } catch {
    alert("This file doesn't look like an exported invoice.");
  }
  e.target.value = "";
});

fillForm();
render();

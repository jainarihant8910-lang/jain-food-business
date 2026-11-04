const CONFIG = window.JFF_CONFIG || {};
let BUSINESS_WHATSAPP = CONFIG.businessWhatsApp || "";
const db = CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && window.supabase?.createClient
  ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey) : null;
const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
document.querySelectorAll("[data-year],#year").forEach((node) => { node.textContent = new Date().getFullYear(); });

let tiffinItems = [];
let products = [];

async function loadWebsiteContent() {
  if (!db) return;
  const { data, error } = await db.from("website_content").select("business,content_key,content_value");
  if (error) { console.warn("Could not load website text and images.", error); return; }
  const values = new Map((data || []).map((row) => [`${row.business}.${row.content_key}`, row.content_value]));
  const whatsapp = values.get("shared.contact_whatsapp");
  if (whatsapp && /^\d{8,15}$/.test(whatsapp)) BUSINESS_WHATSAPP = whatsapp;
  document.querySelectorAll("[data-content]").forEach((node) => {
    const value = values.get(node.dataset.content);
    if (value !== undefined) { node.textContent = value; node.style.whiteSpace = "pre-line"; }
  });
  document.querySelectorAll("[data-content-image]").forEach((node) => {
    const value = values.get(node.dataset.contentImage);
    if (value && /^https?:\/\//i.test(value)) {
      node.src = value;
      const note = node.parentElement?.querySelector(".photo-note, figcaption");
      if (note) note.hidden = true;
    }
  });
}

async function loadLiveCatalog() {
  if (!db) return;
  const [menu, catalogue] = await Promise.all([
    db.from("menu_items").select("*").eq("available", true).order("sort_order").order("name"),
    db.from("products").select("*").eq("available", true).gt("stock", 0).order("sort_order").order("name"),
  ]);
  if (menu.error || catalogue.error) { console.warn("Could not load the live menu or catalogue.", menu.error || catalogue.error); return; }
  tiffinItems = (menu.data || []).map((item) => ({ ...item, addons: Array.isArray(item.addons) ? item.addons : [] }));
  products = (catalogue.data || []).map((item) => ({ ...item, variants: Array.isArray(item.variants) && item.variants.length ? item.variants : [{ size: "Standard", price: Number(item.price) }], emoji: item.emoji || "🫙" }));
  document.querySelectorAll(".demo-banner").forEach((banner) => { banner.hidden = true; });
}

function openWhatsApp(message, note) {
  if (!BUSINESS_WHATSAPP) {
    if (note) note.textContent = "Your cart is ready. Add the verified business WhatsApp number in either owner dashboard.";
    return false;
  }
  window.open(`https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  return true;
}

function renderTiffinMenu() {
  const menu = document.querySelector("#tiffin-menu"), lines = document.querySelector("#tiffin-order-lines");
  if (!menu || !lines) return;
  menu.innerHTML = tiffinItems.length ? tiffinItems.map((item) => `<article class="menu-card"><div class="menu-art">${item.image_url ? `<img src="${esc(item.image_url)}" alt="">` : esc(item.emoji || "🍱")}</div><div class="menu-card-copy"><p class="menu-portion">${esc(item.portion || "One meal")}</p><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><strong>${money(item.price)}</strong></div><a class="text-button" href="#order" data-focus-order="${esc(item.id)}">Add to enquiry ↗</a></article>`).join("") : `<div class="catalogue-empty"><h3>Today's menu will appear here.</h3><p>The Jain Tiffin team can update meals and availability through the owner dashboard.</p></div>`;
  lines.innerHTML = tiffinItems.length ? tiffinItems.map((item) => `<fieldset class="order-item"><legend>${esc(item.name)} <span>${money(item.price)}</span></legend><div class="order-controls"><label>Quantity<input type="number" min="0" max="20" value="0" name="qty-${esc(item.id)}" data-qty="${esc(item.id)}"></label><label>Add-on<select name="addon-${esc(item.id)}" data-addon="${esc(item.id)}"><option value="">None</option>${(item.addons || []).map((addon) => `<option value="${esc(addon.name)}" data-price="${Number(addon.price)}">${esc(addon.name)} + ${money(addon.price)}</option>`).join("")}</select></label><label>Add-on qty<input type="number" min="0" max="20" value="0" name="addon-qty-${esc(item.id)}" data-addon-qty="${esc(item.id)}"></label></div></fieldset>`).join("") : `<p class="form-note">The order form becomes available when the current menu is added.</p>`;
  const updateTotal = () => {
    let total = 0;
    tiffinItems.forEach((item) => { const qty = Number(lines.querySelector(`[data-qty="${CSS.escape(item.id)}"]`)?.value || 0), addonSelect = lines.querySelector(`[data-addon="${CSS.escape(item.id)}"]`), addonQty = Number(lines.querySelector(`[data-addon-qty="${CSS.escape(item.id)}"]`)?.value || 0); total += qty * Number(item.price) + Number(addonSelect?.selectedOptions[0]?.dataset.price || 0) * addonQty; });
    const output = document.querySelector("#tiffin-total"); if (output) output.textContent = money(total);
  };
  lines.addEventListener("input", updateTotal); lines.addEventListener("change", updateTotal);
  menu.addEventListener("click", (event) => { const link = event.target.closest("[data-focus-order]"); if (!link) return; event.preventDefault(); const input = lines.querySelector(`[data-qty="${CSS.escape(link.dataset.focusOrder)}"]`); if (input) { input.value = String(Number(input.value || 0) + 1); updateTotal(); document.querySelector("#order").scrollIntoView({ behavior: "smooth" }); } });
  document.querySelector("#tiffin-order-form")?.addEventListener("submit", (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget), note = document.querySelector("#tiffin-checkout-note"), order = []; let total = 0;
    tiffinItems.forEach((item) => { const qty = Number(data.get(`qty-${item.id}`) || 0), addonName = data.get(`addon-${item.id}`), addonQty = Number(data.get(`addon-qty-${item.id}`) || 0), addon = (item.addons || []).find((entry) => entry.name === addonName); if (qty) { total += qty * Number(item.price); order.push(`- ${item.name} × ${qty} — ${money(qty * Number(item.price))}`); } if (addon && addonQty) { total += addonQty * Number(addon.price); order.push(`- ${addon.name} × ${addonQty} — ${money(addonQty * Number(addon.price))}`); } });
    if (!order.length) { note.textContent = "Choose at least one tiffin or add-on first."; return; }
    openWhatsApp(`Hello Jain Tiffin!\n\nI would like to place an order.\n\nName: ${data.get("name")}\nPhone: ${data.get("phone")}\nAddress: ${data.get("address")}${data.get("location") ? `\nMap: ${data.get("location")}` : ""}\n\nOrder:\n${order.join("\n")}\n\nEstimated total: ${money(total)}\n\nPlease confirm availability and delivery.`, note);
  });
}

let cartMemory = [];
function getCart() { try { const saved = localStorage.getItem("sudhasagar-cart"); return saved === null ? cartMemory : JSON.parse(saved); } catch { return cartMemory; } }
function saveCart(cart) { cartMemory = cart; try { localStorage.setItem("sudhasagar-cart", JSON.stringify(cart)); } catch { /* In-memory cart remains usable for this visit. */ } renderCart(); }

function renderProducts() {
  const grid = document.querySelector("#product-grid"), filters = document.querySelector("#category-filters");
  if (!grid || !filters) return;
  const categories = ["All", "Pickles", "Namkeen", "Spices", "Flour", "Other packaged food", ...new Set(products.map((item) => item.category))].filter((category, index, all) => all.indexOf(category) === index); let active = "All";
  filters.innerHTML = categories.map((category) => `<button type="button" class="filter-chip${category === active ? " active" : ""}" data-category="${esc(category)}">${esc(category)}</button>`).join("");
  const paint = () => {
    const visible = products.filter((item) => active === "All" || item.category === active);
    grid.innerHTML = visible.length ? visible.map((item) => `<article class="product-card"><div class="product-image">${item.image_url ? `<img src="${esc(item.image_url)}" alt="">` : esc(item.emoji || "🫙")}<span>${esc(item.category)}</span></div><div class="product-info"><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><details><summary>Ingredients &amp; details</summary><p>${esc(item.ingredients || "Details coming soon")}</p></details><label>Pack size<select data-variant="${esc(item.id)}">${(item.variants || []).map((variant, index) => `<option value="${index}">${esc(variant.size)} · ${money(variant.price)}</option>`).join("")}</select></label><button type="button" class="card-button" data-add="${esc(item.id)}">Add to cart</button></div></article>`).join("") : `<div class="catalogue-empty"><h3>Product details are being added.</h3><p>Check back for current products, pack sizes and availability.</p></div>`;
  };
  filters.addEventListener("click", (event) => { const button = event.target.closest("[data-category]"); if (!button) return; active = button.dataset.category; filters.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip === button)); paint(); });
  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]"); if (!button) return;
    const product = products.find((item) => item.id === button.dataset.add), variant = product.variants[Number(grid.querySelector(`[data-variant="${CSS.escape(product.id)}"]`).value)], key = `${product.id}:${variant.size}`;
    const cart = getCart(), existing = cart.find((item) => item.key === key);
    if (existing) existing.quantity += 1; else cart.push({ key, id: product.id, name: product.name, size: variant.size, price: Number(variant.price), quantity: 1 });
    saveCart(cart); button.textContent = "Added ✓"; window.openStoreCart?.(true); window.setTimeout(() => { button.textContent = "Add to cart"; }, 1100);
  });
  paint();
}

function renderCart() {
  const container = document.querySelector("#cart-items"); if (!container) return;
  const cart = getCart(), count = cart.reduce((sum, item) => sum + item.quantity, 0), subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((node) => { node.textContent = String(count); });
  container.innerHTML = cart.length ? cart.map((item) => `<article class="cart-item"><div><strong>${esc(item.name)}</strong><small>${esc(item.size)} · ${money(item.price)} each</small></div><div class="cart-item-actions"><button type="button" data-cart-minus="${esc(item.key)}" aria-label="Decrease ${esc(item.name)} quantity">−</button><span>${item.quantity}</span><button type="button" data-cart-plus="${esc(item.key)}" aria-label="Increase ${esc(item.name)} quantity">+</button><button type="button" class="remove-item" data-cart-remove="${esc(item.key)}">Remove</button></div><strong>${money(item.price * item.quantity)}</strong></article>`).join("") : `<p class="empty-cart">Your cart is empty. Add a pantry favourite to get started.</p>`;
  document.querySelector("#cart-subtotal").textContent = money(subtotal); document.querySelector("#cart-total").textContent = money(subtotal);
  container.onclick = (event) => { const button = event.target.closest("[data-cart-minus],[data-cart-plus],[data-cart-remove]"); if (!button) return; const key = button.dataset.cartMinus || button.dataset.cartPlus || button.dataset.cartRemove; const next = getCart().map((item) => item.key === key ? { ...item, quantity: item.quantity + (button.hasAttribute("data-cart-plus") ? 1 : button.hasAttribute("data-cart-minus") ? -1 : 0) } : item).filter((item) => item.key !== key || (!button.hasAttribute("data-cart-remove") && item.quantity > 0)); saveCart(next); };
}

function initProductCart() {
  const drawer = document.querySelector("#cart-drawer"); if (!drawer) return;
  const backdrop = document.querySelector("#drawer-backdrop"), setOpen = (open) => { drawer.classList.toggle("is-open", open); drawer.setAttribute("aria-hidden", String(!open)); backdrop.classList.toggle("is-open", open); document.body.classList.toggle("drawer-open", open); };
  window.openStoreCart = setOpen;
  document.querySelector(".cart-open")?.addEventListener("click", () => setOpen(true)); document.querySelector(".cart-close")?.addEventListener("click", () => setOpen(false)); backdrop.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") setOpen(false); });
  document.querySelector("#product-order-form")?.addEventListener("submit", (event) => {
    event.preventDefault(); const cart = getCart(), note = document.querySelector("#product-checkout-note");
    if (!cart.length) { note.textContent = "Your cart is empty. Add products before checkout."; return; }
    const data = new FormData(event.currentTarget), subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0), lines = cart.map((item, index) => `${index + 1}. ${item.name} — ${item.size} × ${item.quantity} — ${money(item.price * item.quantity)}`);
    openWhatsApp(`Hello Sudhasagar Ji Products!\n\nI would like to order:\n\n${lines.join("\n")}\n\nCustomer Name: ${data.get("name")}\nPhone: ${data.get("phone")}\nAddress: ${data.get("address")}${data.get("location") ? `\nMap: ${data.get("location")}` : ""}\n\nSubtotal: ${money(subtotal)}\nDelivery: To be confirmed\nTotal: ${money(subtotal)} + delivery\n\nPlease confirm my order.`, note);
  });
  renderCart();
}

function initScrollTiffin() {
  const stage = document.querySelector("#tiffin-animation"); if (!stage || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let queued = false;
  const update = () => { if (queued) return; queued = true; requestAnimationFrame(() => { const rect = stage.getBoundingClientRect(); stage.style.setProperty("--open", String(Math.max(0, Math.min(1, (innerHeight * .82 - rect.top) / (rect.height + innerHeight * .28))))); queued = false; }); };
  addEventListener("scroll", update, { passive: true }); addEventListener("resize", update); update();
}

async function startStorefront() { try { await Promise.all([loadLiveCatalog(), loadWebsiteContent()]); } catch (error) { console.warn("Could not load the live storefront.", error); } renderTiffinMenu(); renderProducts(); initProductCart(); }
startStorefront();
if (document.querySelector("#tiffin3d-canvas")) import("./tiffin-3d.js").catch((error) => console.warn("Showing the static tiffin fallback.", error));
document.querySelector("#contact-form")?.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); openWhatsApp(`Hello ${data.get("business")}!\n\n${data.get("message")}\n\nName: ${data.get("name")}\nPhone: ${data.get("phone")}`, document.querySelector("#contact-note")); });


const config = window.JFF_CONFIG || {};
const business = document.body.dataset.business === "products" ? "products" : "tiffin";
const itemType = business === "products" ? "product" : "menu";
const table = business === "products" ? "products" : "menu_items";
const yearNode = document.querySelector("[data-year]");
if (yearNode) yearNode.textContent = new Date().getFullYear();
const supabaseReady = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase?.createClient);
const db = supabaseReady ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
const loginPanel = document.querySelector("#admin-login");
const dashboard = document.querySelector("#admin-dashboard");
const loginMessage = document.querySelector("#admin-login-message");
const editorMessage = document.querySelector("#editor-message");
const editor = document.querySelector("#admin-item-form");
const itemList = document.querySelector("#admin-items");
const animationForm = document.querySelector("#tiffin-animation-form");
const bulkForm = document.querySelector("#bulk-products-form");
const bulkRows = document.querySelector("#bulk-product-rows");
const bulkMessage = document.querySelector("#bulk-products-message");
let items = [];

if (!supabaseReady) {
  loginMessage.textContent = "Owner sign-in is not connected yet. Add the Supabase project URL and public key to config.js, then apply supabase/schema.sql.";
  document.querySelector("#admin-login-form").querySelectorAll("input, button").forEach((control) => { control.disabled = true; });
  editor.querySelectorAll("input, textarea, select, button").forEach((control) => { control.disabled = true; });
  bulkForm?.querySelectorAll("input, textarea, select, button").forEach((control) => { control.disabled = true; });
} else {
  loginMessage.textContent = "Sign in with the owner account assigned to this business.";
  db.auth.getSession().then(({ data }) => { if (data.session) enterDashboard(); });
}

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const priceText = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount) || 0);

async function checkAdmin() {
  const { data, error } = await db.rpc("is_store_admin", { target_business: business });
  if (error || data !== true) {
    await db.auth.signOut();
    loginPanel.hidden = false;
    dashboard.hidden = true;
    loginMessage.textContent = `This account is not assigned to ${business === "products" ? "Sudhasagar Ji Products" : "Jain Tiffin"}. Use the matching owner account.`;
    return false;
  }
  return true;
}

async function enterDashboard() {
  loginMessage.textContent = "Checking owner access…";
  if (!await checkAdmin()) return;
  loginPanel.hidden = true;
  dashboard.hidden = false;
  await Promise.all([loadItems(), loadWebsiteContentForms()]);
}

async function loadItems() {
  itemList.innerHTML = "<p>Loading…</p>";
  const { data, error } = await db.from(table).select("*").order("sort_order", { ascending: true }).order("name", { ascending: true });
  if (error) { itemList.innerHTML = `<p class="admin-error">${esc(error.message)}</p>`; return; }
  items = data || [];
  itemList.innerHTML = items.length ? items.map((item) => `<article class="admin-item"><div><strong>${esc(item.name)}</strong><p>${itemType === "menu" ? esc(item.portion) : esc(item.category)} · ${priceText(item.price)} · ${item.available ? "Available" : "Hidden"}</p></div><div class="admin-item-buttons"><button type="button" class="filter-chip" data-edit="${esc(item.id)}">Edit</button><button type="button" class="filter-chip danger-chip" data-delete="${esc(item.id)}">Delete</button></div></article>`).join("") : `<p>No ${itemType === "menu" ? "menu items" : "products"} yet. Add the first one using the form.</p>`;
}

async function loadWebsiteContentForms() {
  const { data, error } = await db.from("website_content").select("business,content_key,content_value").in("business", ["shared", business]);
  if (error) { document.querySelectorAll("[data-content-message]").forEach((node) => { node.textContent = error.message; }); return; }
  const values = new Map((data || []).map((row) => [`${row.business}.${row.content_key}`, row.content_value]));
  const fill = (form, scope) => {
    if (!form) return;
    for (const [key, value] of values) {
      const prefix = `${scope}.`;
      if (!key.startsWith(prefix)) continue;
      const field = form.elements.namedItem(key.slice(prefix.length));
      if (field && field.type !== "file") field.value = value || "";
    }
  };
  fill(document.querySelector("#shared-content-form"), "shared");
  fill(document.querySelector("#brand-content-form"), business);
  if (business === "tiffin") fill(document.querySelector("#tiffin-animation-form"), "tiffin");
}

async function uploadImage(file) {
  if (!file || !file.size) return "";
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be 5 MB or smaller.");
  const ext = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${business}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from("store-media").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  return db.storage.from("store-media").getPublicUrl(path).data.publicUrl;
}

async function saveContentForm(form, scope) {
  const messageScope = scope === "shared" ? "shared" : scope === "animation" ? "animation" : "brand";
  const message = document.querySelector(`[data-content-message="${messageScope}"]`);
  message.textContent = "Saving…";
  const data = new FormData(form);
  try {
    const records = [];
    for (const [key, value] of data.entries()) {
      if (key.endsWith("_file")) continue;
      const file = data.get(`${key}_file`);
      const uploaded = file instanceof File && file.size ? await uploadImage(file) : "";
      if (uploaded) form.elements.namedItem(key).value = uploaded;
      records.push({ business: scope === "animation" ? "tiffin" : scope, content_key: key, content_value: uploaded || String(value || "").trim(), updated_at: new Date().toISOString() });
    }
    const { error } = await db.from("website_content").upsert(records, { onConflict: "business,content_key" });
    if (error) throw error;
    message.textContent = "Saved. Reload the public website to see the changes.";
    form.querySelectorAll('input[type="file"]').forEach((input) => { input.value = ""; });
  } catch (error) { message.textContent = error.message || "Could not save website content."; }
}

for (const form of document.querySelectorAll("#shared-content-form, #brand-content-form, #tiffin-animation-form")) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!db || !await checkAdmin()) return;
    const scope = form.id === "shared-content-form" ? "shared" : form.id === "tiffin-animation-form" ? "animation" : business;
    await saveContentForm(form, scope);
  });
}

const parsePairs = (text) => text.split(",").map((part) => {
  const [name, rawPrice] = part.split(":").map((value) => value.trim());
  return name && rawPrice && Number.isFinite(Number(rawPrice)) ? { name, price: Number(rawPrice) } : null;
}).filter(Boolean);
const parseVariants = (text) => text.split(",").map((part) => {
  const [size, rawPrice] = part.split(":").map((value) => value.trim());
  return size && rawPrice && Number.isFinite(Number(rawPrice)) ? { size, price: Number(rawPrice) } : null;
}).filter(Boolean);

function addBulkProductRow() {
  if (!bulkRows) return;
  const row = document.createElement("fieldset");
  row.className = "bulk-product-row";
  row.innerHTML = `
    <legend>New product</legend>
    <button class="bulk-remove-row" type="button" aria-label="Remove this product row">Remove</button>
    <div class="bulk-product-fields">
      <label>Product name<input data-field="name" maxlength="100" placeholder="e.g. Mango pickle"></label>
      <label>Category<input data-field="category" placeholder="Pickles, Namkeen, Spices…"></label>
      <label>Description<textarea data-field="description" rows="2"></textarea></label>
      <label>Ingredients<textarea data-field="details" rows="2"></textarea></label>
      <label>Price (₹)<input data-field="price" type="number" min="0" step="0.01"></label>
      <label>Stock quantity<input data-field="stock" type="number" min="0" step="1" value="0"></label>
      <label>Pack variants<input data-field="variants" placeholder="250 g:120, 500 g:210"></label>
      <label>Photo link<input data-field="imageUrl" type="url" placeholder="https://…"></label>
      <label>Upload photo<input data-field="image" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <label class="check-row"><input data-field="available" type="checkbox" checked> Available for sale</label>
    </div>`;
  bulkRows.append(row);
}

if (bulkRows && bulkForm) {
  for (let index = 0; index < 3; index++) addBulkProductRow();
  document.querySelector("#bulk-add-row")?.addEventListener("click", addBulkProductRow);
  bulkRows.addEventListener("click", (event) => {
    const remove = event.target.closest(".bulk-remove-row");
    if (remove) remove.closest(".bulk-product-row").remove();
  });
  bulkRows.addEventListener("input", (event) => {
    const name = event.target.closest(".bulk-product-row")?.querySelector('[data-field="name"]')?.value.trim();
    if (name) event.target.closest(".bulk-product-row").querySelector("legend").textContent = name;
  });
  bulkForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (itemType !== "product" || !db || !await checkAdmin()) return;
    const rows = [...bulkRows.querySelectorAll(".bulk-product-row")];
    const populated = rows.filter((row) => {
      const values = ["name", "category", "description", "details", "price", "variants", "imageUrl"];
      return values.some((key) => row.querySelector(`[data-field="${key}"]`).value.trim()) || row.querySelector('[data-field="image"]').files.length > 0;
    });
    if (!populated.length) { bulkMessage.textContent = "Add details for at least one product."; return; }
    const invalidRow = populated.find((row) => !row.querySelector('[data-field="name"]').value.trim() || row.querySelector('[data-field="price"]').value === "");
    if (invalidRow) {
      bulkMessage.textContent = "Each product needs a name and price. Check the rows and try again.";
      invalidRow.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    bulkMessage.textContent = "Saving products…";
    try {
      const payloads = [];
      for (const row of populated) {
        const value = (key) => row.querySelector(`[data-field="${key}"]`).value.trim();
        const price = Number(value("price"));
        const stock = Number(value("stock") || 0);
        if (!Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) throw new Error("Enter valid prices and stock amounts for every product.");
        const file = row.querySelector('[data-field="image"]').files[0];
        const imageUrl = await uploadImage(file) || value("imageUrl");
        const variants = parseVariants(value("variants"));
        payloads.push({
          id: crypto.randomUUID(),
          name: value("name"),
          category: value("category") || "Other packaged food",
          description: value("description"),
          ingredients: value("details"),
          price,
          image_url: imageUrl,
          stock,
          variants: variants.length ? variants : [{ size: "Standard", price }],
          available: row.querySelector('[data-field="available"]').checked,
          sort_order: 0,
          updated_at: new Date().toISOString(),
        });
      }
      const { error } = await db.from(table).upsert(payloads);
      if (error) throw error;
      bulkMessage.textContent = `${payloads.length} ${payloads.length === 1 ? "product" : "products"} saved.`;
      bulkRows.replaceChildren();
      for (let index = 0; index < 3; index++) addBulkProductRow();
      await loadItems();
    } catch (error) { bulkMessage.textContent = error.message || "Could not save the products."; }
  });
}

function resetEditor() {
  editor.reset();
  editor.elements.originalId.value = "";
  document.querySelector("#editor-title").textContent = itemType === "menu" ? "Add a menu item" : "Add a product";
  editorMessage.textContent = "";
}

function editItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  editor.elements.originalId.value = item.id;
  editor.elements.name.value = item.name || "";
  editor.elements.description.value = item.description || "";
  editor.elements.details.value = itemType === "menu" ? item.portion || "" : item.ingredients || "";
  editor.elements.price.value = item.price || 0;
  if (itemType === "menu") editor.elements.addons.value = (item.addons || []).map((pair) => `${pair.name}:${pair.price}`).join(", ");
  else {
    editor.elements.category.value = item.category || "";
    editor.elements.stock.value = item.stock || 0;
    editor.elements.variants.value = (item.variants || []).map((pair) => `${pair.size}:${pair.price}`).join(", ");
  }
  editor.elements.imageUrl.value = item.image_url || "";
  editor.elements.available.checked = Boolean(item.available);
  document.querySelector("#editor-title").textContent = `Edit ${item.name}`;
  editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

editor.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!db || !await checkAdmin()) return;
  const data = new FormData(editor);
  editorMessage.textContent = "Saving…";
  try {
    const imageUrl = await uploadImage(data.get("image")) || String(data.get("imageUrl") || "").trim();
    const common = { id: data.get("originalId") || crypto.randomUUID(), name: String(data.get("name")).trim(), description: String(data.get("description") || "").trim(), price: Number(data.get("price")), image_url: imageUrl, available: data.get("available") === "on", sort_order: 0, updated_at: new Date().toISOString() };
    const payload = itemType === "menu" ? { ...common, portion: String(data.get("details") || "").trim(), addons: parsePairs(String(data.get("addons") || "")) } : { ...common, category: String(data.get("category") || "Other packaged food").trim(), ingredients: String(data.get("details") || "").trim(), stock: Number(data.get("stock") || 0), variants: parseVariants(String(data.get("variants") || "")) };
    if (itemType === "product" && !payload.variants.length) payload.variants = [{ size: "Standard", price: common.price }];
    const { error } = await db.from(table).upsert(payload);
    if (error) throw error;
    editorMessage.textContent = "Saved. The storefront will show this update when it reloads.";
    resetEditor();
    await loadItems();
  } catch (error) { editorMessage.textContent = error.message || "Could not save the item."; }
});

itemList.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit]");
  if (edit) return editItem(edit.dataset.edit);
  const remove = event.target.closest("[data-delete]");
  if (!remove || !confirm("Delete this item from the storefront?")) return;
  if (!await checkAdmin()) return;
  const { error } = await db.from(table).delete().eq("id", remove.dataset.delete);
  if (error) editorMessage.textContent = error.message;
  await loadItems();
});

document.querySelector("#editor-reset").addEventListener("click", resetEditor);
document.querySelector("#admin-signout").addEventListener("click", async () => { await db?.auth.signOut(); dashboard.hidden = true; loginPanel.hidden = false; loginMessage.textContent = "You have signed out."; });
document.querySelector("#admin-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!db) return;
  loginMessage.textContent = "Signing in…";
  const data = new FormData(event.currentTarget);
  const { error } = await db.auth.signInWithPassword({ email: data.get("email"), password: data.get("password") });
  if (error) { loginMessage.textContent = error.message; return; }
  await enterDashboard();
});


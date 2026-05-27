const STORE_KEY = "pharmacy-sales-dashboard-v1";
const AUTO = "auto";
const NO_BRAND = "none";
const NO_CLINIC = "none";
const CLOUD_ROW_ID = "main";
const DELETE_REPORT_PASSWORD = "2727Baseline!";

const sampleCsv = `Practice Name,Quantity,Drug Name,Patient Price,Shipping Cost,Reason for Replacment or Reshipment,Written in Reason,Tracking Number
Rose MedSpa and Wellness,3.00,TV3 TIRZEPATIDE/VITAMIN B6 (3ML),250.00,20.89,,,1ZH4V7841317054095
Rose MedSpa and Wellness,3.00,TV3 TIRZEPATIDE/VITAMIN B6 (3ML),250.00,20.89,,,1ZH4V7841333698388
Rose MedSpa and Wellness,3.00,TV3 TIRZEPATIDE/VITAMIN B6 (3ML),250.00,20.89,,,1ZH4V7841307685271
Rose MedSpa and Wellness,3.00,TV3 TIRZEPATIDE/VITAMIN B6 (3ML),250.00,20.89,,,1ZH4V7841322484147
Rose MedSpa and Wellness,6.00,TV3 TIRZEPATIDE/VITAMIN B6 (3ML),,20.89,,,1ZH4V7841306277311
Rose MedSpa and Wellness,3.00,TV3 TIRZEPATIDE/VITAMIN B6 (3ML),250.00,20.89,,,1ZH4V7841323599709
Rose MedSpa and Wellness,3.00,TV3 TIRZEPATIDE/VITAMIN B6 (3ML),250.00,20.89,,,1ZH4V7841324657537
Rose MedSpa and Wellness,3.00,TV3 TIRZEPATIDE/VITAMIN B6 (3ML),250.00,20.89,,,1ZH4V7841336748363
Rose MedSpa and Wellness,3.00,TV3 TIRZEPATIDE/VITAMIN B6 (3ML),250.00,20.89,,,1ZH4V7841308282856
Rose MedSpa and Wellness,3.00,TV3 TIRZEPATIDE/VITAMIN B6 (3ML),250.00,20.89,,,1ZH4V7841338172196`;

let state = loadState();
let supabaseClient = null;
let cloudReady = false;
let saveTimer = null;

const els = {
  uploadForm: document.querySelector("#uploadForm"),
  repForm: document.querySelector("#repForm"),
  brandForm: document.querySelector("#brandForm"),
  reportName: document.querySelector("#reportName"),
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
  brandSelect: document.querySelector("#brandSelect"),
  clinicSelect: document.querySelector("#clinicSelect"),
  repSelect: document.querySelector("#repSelect"),
  fileInput: document.querySelector("#fileInput"),
  uploadStatus: document.querySelector("#uploadStatus"),
  repName: document.querySelector("#repName"),
  repRate: document.querySelector("#repRate"),
  repList: document.querySelector("#repList"),
  brandName: document.querySelector("#brandName"),
  brandRep: document.querySelector("#brandRep"),
  brandNoRep: document.querySelector("#brandNoRep"),
  brandStatus: document.querySelector("#brandStatus"),
  brandList: document.querySelector("#brandList"),
  clinicForm: document.querySelector("#clinicForm"),
  clinicName: document.querySelector("#clinicName"),
  clinicRep: document.querySelector("#clinicRep"),
  clinicNoRep: document.querySelector("#clinicNoRep"),
  clinicStatus: document.querySelector("#clinicStatus"),
  clinicList: document.querySelector("#clinicList"),
  viewFilter: document.querySelector("#viewFilter"),
  filterStart: document.querySelector("#filterStart"),
  filterEnd: document.querySelector("#filterEnd"),
  filterBrand: document.querySelector("#filterBrand"),
  filterClinic: document.querySelector("#filterClinic"),
  filterRep: document.querySelector("#filterRep"),
  totalRevenue: document.querySelector("#totalRevenue"),
  totalShipping: document.querySelector("#totalShipping"),
  netRevenue: document.querySelector("#netRevenue"),
  totalCommission: document.querySelector("#totalCommission"),
  totalQuantity: document.querySelector("#totalQuantity"),
  totalReplacements: document.querySelector("#totalReplacements"),
  brandChart: document.querySelector("#brandChart"),
  clinicChart: document.querySelector("#clinicChart"),
  repChart: document.querySelector("#repChart"),
  brandChartNote: document.querySelector("#brandChartNote"),
  clinicChartNote: document.querySelector("#clinicChartNote"),
  repChartNote: document.querySelector("#repChartNote"),
  brandTable: document.querySelector("#brandTable"),
  clinicTable: document.querySelector("#clinicTable"),
  repTable: document.querySelector("#repTable"),
  drugTable: document.querySelector("#drugTable"),
  historyTable: document.querySelector("#historyTable"),
  sampleBtn: document.querySelector("#sampleBtn"),
  refreshCloudBtn: document.querySelector("#refreshCloudBtn"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authStatus: document.querySelector("#authStatus"),
  authMode: document.querySelector("#authMode"),
  signOutBtn: document.querySelector("#signOutBtn"),
  syncStatus: document.querySelector("#syncStatus"),
};

function loadState() {
  const unassignedRep = { id: crypto.randomUUID(), name: "Unassigned", rate: 0 };
  const unassignedBrand = { id: crypto.randomUUID(), name: "Unassigned", repId: null };
  const unassignedClinic = {
    id: crypto.randomUUID(),
    name: "Unassigned",
    repId: null,
  };
  const fallback = {
    reps: [unassignedRep],
    brands: [unassignedBrand],
    clinics: [unassignedClinic],
    reports: [],
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!parsed || !Array.isArray(parsed.reports)) return fallback;
    const reps = parsed.reps?.length ? parsed.reps : fallback.reps;
    const brands = parsed.brands?.length
      ? parsed.brands.map((brand) => ({
          id: brand.id || crypto.randomUUID(),
          name: brand.name || "Unassigned",
          repId: reps.some((rep) => rep.id === brand.repId) ? brand.repId : null,
        }))
      : fallback.brands;
    let clinics = parsed.clinics?.length ? parsed.clinics : [];

    if (!clinics.length) {
      parsed.brands?.forEach((brand) => {
        (brand.clinics || []).forEach((clinicName) => {
          clinics.push({ id: crypto.randomUUID(), name: clinicName, repId: brand.repId || null });
        });
      });
    }

    if (!clinics.length) clinics = [{ id: crypto.randomUUID(), name: "Unassigned", repId: null }];
    clinics = clinics.map((clinic) => ({
      id: clinic.id || crypto.randomUUID(),
      name: clinic.name || "Unassigned",
      repId: reps.some((rep) => rep.id === clinic.repId) ? clinic.repId : null,
    }));

    const findBrand = (practiceName) => {
      const normalizedPractice = normalizeKey(practiceName);
      return (
        brands.find((brand) => normalizeKey(brand.name) === normalizedPractice) ||
        brands.find((brand) => normalizedPractice.includes(normalizeKey(brand.name)) || normalizeKey(brand.name).includes(normalizedPractice))
      );
    };
    const findClinic = (practiceName) => {
      const normalizedPractice = normalizeKey(practiceName);
      return (
        clinics.find((clinic) => normalizeKey(clinic.name) === normalizedPractice) ||
        clinics.find((clinic) => normalizedPractice.includes(normalizeKey(clinic.name)) || normalizeKey(clinic.name).includes(normalizedPractice))
      );
    };
    const reports = parsed.reports.map((report) => {
      const nextReport = {
        ...report,
        clinicId: report.clinicId || "auto",
        rows: (report.rows || []).map((row) => ({ ...row, clinicId: row.clinicId || "auto" })),
      };
      nextReport.rows.forEach((row) => {
        if (row.clinicId && row.clinicId !== AUTO && row.clinicId !== NO_CLINIC) {
          const clinic = clinics.find((item) => item.id === row.clinicId);
          row.brandId = NO_BRAND;
          row.repId = clinic ? clinic.repId : row.repId || null;
          return;
        }
        if (row.brandId && row.brandId !== AUTO && row.brandId !== NO_BRAND) {
          const brand = brands.find((item) => item.id === row.brandId);
          row.clinicId = NO_CLINIC;
          row.repId = brand ? brand.repId : row.repId || null;
          return;
        }
        const brand = findBrand(row.practiceName);
        const clinic = findClinic(row.practiceName);
        if (brand && !clinic) {
          row.brandId = brand.id;
          row.clinicId = NO_CLINIC;
          row.repId = brand.repId;
        } else if (clinic) {
          row.brandId = NO_BRAND;
          row.clinicId = clinic.id;
          row.repId = clinic.repId;
        } else {
          row.brandId = row.brandId && row.brandId !== AUTO ? row.brandId : NO_BRAND;
          row.clinicId = row.clinicId && row.clinicId !== AUTO ? row.clinicId : NO_CLINIC;
          row.repId = row.repId || null;
        }
      });
      const firstRow = nextReport.rows[0];
      nextReport.clinicId = firstRow?.clinicId || nextReport.clinicId || NO_CLINIC;
      nextReport.brandId = firstRow?.brandId || nextReport.brandId || NO_BRAND;
      nextReport.repId = firstRow?.repId || nextReport.repId || null;
      return nextReport;
    });

    return {
      reps,
      brands,
      clinics,
      reports,
    };
  } catch {
    return fallback;
  }
}

function localStateSnapshot() {
  return JSON.parse(JSON.stringify(state));
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  if (!cloudReady) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveCloudState();
    } catch (error) {
      setSyncStatus(`Cloud save failed: ${error.message}`);
    }
  }, 350);
}

function configuredForSupabase() {
  const config = window.SUPABASE_CONFIG || {};
  return Boolean(config.url && config.anonKey && window.supabase?.createClient);
}

function setSyncStatus(message) {
  els.syncStatus.textContent = message;
}

function syncTimeLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function confirmProtectedDelete(label) {
  const password = prompt(`Enter password to remove ${label}`);
  if (password === null) return false;

  if (password !== DELETE_REPORT_PASSWORD) {
    alert("Incorrect password. Nothing was removed.");
    return false;
  }

  return true;
}

async function saveCloudState() {
  if (!supabaseClient || !cloudReady) return;
  setSyncStatus("Cloud saving...");
  const { error } = await supabaseClient
    .from("dashboard_state")
    .upsert({ id: CLOUD_ROW_ID, payload: localStateSnapshot(), updated_at: new Date().toISOString() });
  if (error) throw error;
  setSyncStatus(`Cloud synced ${syncTimeLabel()}`);
}

async function loadCloudState() {
  const { data, error } = await supabaseClient.from("dashboard_state").select("payload").eq("id", CLOUD_ROW_ID).maybeSingle();
  if (error) throw error;

  if (data?.payload) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data.payload));
    state = loadState();
  } else {
    await saveCloudState();
  }
}

async function forceCloudRefresh() {
  if (!configuredForSupabase()) {
    setSyncStatus("Cloud not configured");
    return;
  }

  supabaseClient = supabaseClient || window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
  const { data } = await supabaseClient.auth.getSession();
  if (!data?.session) {
    setSyncStatus("Cloud signed out");
    els.authStatus.textContent = "Sign in before refreshing cloud data.";
    return;
  }

  try {
    cloudReady = true;
    setSyncStatus("Cloud loading...");
    await loadCloudState();
    render();
    setSyncStatus(`Cloud loaded ${syncTimeLabel()}`);
  } catch (error) {
    setSyncStatus(`Cloud load failed: ${error.message}`);
  }
}

async function refreshAuthState() {
  if (!configuredForSupabase()) {
    els.authMode.textContent = "Not configured";
    els.authStatus.textContent = "Add your Supabase URL and anon key to supabase-config.js.";
    setSyncStatus("Local mode");
    return;
  }

  const config = window.SUPABASE_CONFIG;
  supabaseClient = supabaseClient || window.supabase.createClient(config.url, config.anonKey);
  const { data } = await supabaseClient.auth.getSession();
  const session = data?.session;

  if (!session) {
    cloudReady = false;
    els.authMode.textContent = "Sign in";
    els.authStatus.textContent = "Sign in to use shared cloud data.";
    setSyncStatus("Cloud signed out");
    return;
  }

  cloudReady = true;
  els.authMode.textContent = "Signed in";
  els.authStatus.textContent = session.user.email || "Signed in.";
  setSyncStatus("Cloud loading");
  await loadCloudState();
  setSyncStatus("Cloud synced");
  render();
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function compactMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function number(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value || 0);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function parseAmount(value) {
  if (value === null || value === undefined || value === "") return 0;
  return Number(String(value).replace(/[$,\s]/g, "")) || 0;
}

function normalizeKey(key) {
  return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findColumn(row, names) {
  const keys = Object.keys(row);
  const normalized = names.map(normalizeKey);
  return keys.find((key) => normalized.includes(normalizeKey(key)));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.trim()) || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim()))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ""])));
}

async function readFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "csv") {
    return parseCsv(await file.text());
  }

  if (!window.XLSX) {
    throw new Error("Excel support is still loading. Try again in a moment, or upload CSV.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function normalizeRows(rows, report) {
  return rows.flatMap((row) => {
    const quantityKey = findColumn(row, ["Quantity", "Qty"]);
    const drugKey = findColumn(row, ["Drug Name", "Medication", "Product"]);
    const priceKey = findColumn(row, ["Patient Price", "Sales Revenue", "Revenue", "Price"]);
    const shippingKey = findColumn(row, ["Shipping Cost", "Shipping"]);
    const practiceKey = findColumn(row, ["Practice Name", "Clinic", "Brand", "Account"]);
    const replacementKey = findColumn(row, [
      "Reason for Replacment or Reshipment",
      "Reason for Replacement or Reshipment",
      "Replacement",
      "Reshipment",
    ]);
    const writtenKey = findColumn(row, ["Written in Reason", "Written Reason", "Reason"]);
    const trackingKey = findColumn(row, ["Tracking Number", "Tracking"]);
    const replacementText = [row[replacementKey], row[writtenKey]].filter(Boolean).join(" ").trim();
    const drugName = String(row[drugKey] || "").trim();

    if (!drugName) return [];

    return [{
      id: crypto.randomUUID(),
      reportId: report.id,
      reportName: report.name,
      startDate: report.startDate,
      endDate: report.endDate,
      brandId: report.brandId,
      clinicId: report.clinicId,
      repId: report.repId,
      practiceName: String(row[practiceKey] || "").trim() || "Unknown clinic",
      quantity: parseAmount(row[quantityKey]),
      drugName,
      revenue: parseAmount(row[priceKey]),
      shipping: parseAmount(row[shippingKey]),
      replacementText,
      isReplacement: replacementText.length > 0,
      trackingNumber: String(row[trackingKey] || "").trim(),
    }];
  });
}

function getRep(id) {
  if (!id) return { id: null, name: "No sales rep", rate: 0 };
  return state.reps.find((rep) => rep.id === id) || state.reps[0];
}

function getBrand(id) {
  if (id === NO_BRAND || id === AUTO) return { id: NO_BRAND, name: "No brand", repId: state.reps[0].id };
  return state.brands.find((brand) => brand.id === id) || state.brands[0];
}

function getClinic(id) {
  if (id === NO_CLINIC || id === AUTO) return { id: NO_CLINIC, name: "No clinic", repId: state.reps[0].id };
  return state.clinics.find((clinic) => clinic.id === id) || state.clinics[0];
}

function matchBrandByPractice(practiceName) {
  const normalizedPractice = normalizeKey(practiceName);
  return (
    state.brands.find((brand) => normalizeKey(brand.name) === normalizedPractice) ||
    state.brands.find((brand) => normalizedPractice.includes(normalizeKey(brand.name)) || normalizeKey(brand.name).includes(normalizedPractice))
  );
}

function matchClinicByPractice(practiceName) {
  const normalizedPractice = normalizeKey(practiceName);
  return (
    state.clinics.find((clinic) => normalizeKey(clinic.name) === normalizedPractice) ||
    state.clinics.find((clinic) => normalizedPractice.includes(normalizeKey(clinic.name)) || normalizeKey(clinic.name).includes(normalizedPractice))
  );
}

function rowsForFilters() {
  const reportId = els.viewFilter.value;
  const start = els.filterStart.value;
  const end = els.filterEnd.value;
  const brandId = els.filterBrand.value;
  const clinicId = els.filterClinic.value;
  const repId = els.filterRep.value;

  return state.reports.flatMap((report) => report.rows).filter((row) => {
    if (reportId !== "all" && row.reportId !== reportId) return false;
    if (start && row.endDate < start) return false;
    if (end && row.startDate > end) return false;
    if (brandId !== "all" && row.brandId !== brandId) return false;
    if (clinicId !== "all" && row.clinicId !== clinicId) return false;
    if (repId !== "all" && row.repId !== repId) return false;
    return true;
  });
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function commissionForRows(rows) {
  return rows.reduce((total, row) => {
    if (!row.repId) return total;
    const rate = getRep(row.repId)?.rate || 0;
    return total + row.revenue * (rate / 100);
  }, 0);
}

function groupRows(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!map.has(key)) {
      map.set(key, { quantity: 0, revenue: 0, shipping: 0, replacements: 0, rows: [] });
    }
    const item = map.get(key);
    item.quantity += row.quantity;
    item.revenue += row.revenue;
    item.shipping += row.shipping;
    item.replacements += row.isReplacement ? 1 : 0;
    item.rows.push(row);
  });
  return [...map.entries()].map(([name, totals]) => ({ name, ...totals }));
}

function restoreSelect(select, value, fallback) {
  select.value = [...select.options].some((option) => option.value === value) ? value : fallback;
}

function renderOptions() {
  const current = {
    repSelect: els.repSelect.value,
    brandSelect: els.brandSelect.value,
    clinicSelect: els.clinicSelect.value,
    clinicRep: els.clinicRep.value,
    brandRep: els.brandRep.value,
    brandNoRep: els.brandNoRep.checked,
    clinicNoRep: els.clinicNoRep.checked,
    filterRep: els.filterRep.value,
    filterBrand: els.filterBrand.value,
    filterClinic: els.filterClinic.value,
    viewFilter: els.viewFilter.value,
  };
  const repOptions = state.reps
    .map((rep) => `<option value="${rep.id}">${escapeHtml(rep.name)} (${number(rep.rate)}%)</option>`)
    .join("");
  const brandOptions = state.brands.map((brand) => `<option value="${brand.id}">${escapeHtml(brand.name)}</option>`).join("");
  const clinicOptions = state.clinics.map((clinic) => `<option value="${clinic.id}">${escapeHtml(clinic.name)}</option>`).join("");

  els.repSelect.innerHTML = repOptions;
  els.clinicRep.innerHTML = repOptions;
  els.brandRep.innerHTML = repOptions;
  els.brandSelect.innerHTML = `<option value="${AUTO}">Auto-match brand</option><option value="${NO_BRAND}">No brand</option>${brandOptions}`;
  els.clinicSelect.innerHTML = `<option value="${AUTO}">Auto-match clinic</option><option value="${NO_CLINIC}">No clinic</option>${clinicOptions}`;
  els.filterRep.innerHTML = `<option value="all">All reps</option>${repOptions}`;
  els.filterBrand.innerHTML = `<option value="all">All brands</option>${brandOptions}`;
  els.filterClinic.innerHTML = `<option value="all">All clinics</option>${clinicOptions}`;
  els.viewFilter.innerHTML = `<option value="all">All uploads</option>${state.reports
    .map((report) => `<option value="${report.id}">${report.name}</option>`)
    .join("")}`;

  restoreSelect(els.repSelect, current.repSelect, state.reps[0].id);
  restoreSelect(els.clinicRep, current.clinicRep, state.reps[0].id);
  restoreSelect(els.brandRep, current.brandRep, state.reps[0].id);
  restoreSelect(els.brandSelect, current.brandSelect, AUTO);
  restoreSelect(els.clinicSelect, current.clinicSelect, AUTO);
  restoreSelect(els.filterRep, current.filterRep, "all");
  restoreSelect(els.filterBrand, current.filterBrand, "all");
  restoreSelect(els.filterClinic, current.filterClinic, "all");
  restoreSelect(els.viewFilter, current.viewFilter, "all");
  els.brandNoRep.checked = current.brandNoRep;
  els.clinicNoRep.checked = current.clinicNoRep;
  els.brandRep.disabled = els.brandNoRep.checked;
  els.clinicRep.disabled = els.clinicNoRep.checked;
}

function renderLists() {
  els.repList.innerHTML = state.reps
    .map(
      (rep) =>
        `<span class="pill">${escapeHtml(rep.name)} · ${number(rep.rate)}% <button data-delete-rep="${rep.id}" type="button" aria-label="Delete ${escapeHtml(rep.name)}">×</button></span>`,
    )
    .join("");

  els.brandList.innerHTML = state.brands
    .map((brand) => `<span class="pill">${escapeHtml(brand.name)} · ${escapeHtml(getRep(brand.repId).name)} <button data-delete-brand="${brand.id}" type="button" aria-label="Delete ${escapeHtml(brand.name)}">×</button></span>`)
    .join("");

  els.clinicList.innerHTML = state.clinics
    .map((clinic) => {
      const rep = getRep(clinic.repId);
      return `<span class="pill">${escapeHtml(clinic.name)} · ${escapeHtml(rep.name)} <button data-delete-clinic="${clinic.id}" type="button" aria-label="Delete ${escapeHtml(clinic.name)}">×</button></span>`;
    })
    .join("");
}

function renderMetrics(rows) {
  const revenue = sum(rows, "revenue");
  const shipping = sum(rows, "shipping");
  const commission = commissionForRows(rows);
  els.totalRevenue.textContent = money(revenue);
  els.totalShipping.textContent = money(shipping);
  els.netRevenue.textContent = money(revenue - shipping);
  els.totalCommission.textContent = money(commission);
  els.totalQuantity.textContent = number(sum(rows, "quantity"));
  els.totalReplacements.textContent = String(rows.filter((row) => row.isReplacement).length);
}

function renderTables(rows) {
  const brandRows = groupRows(rows.filter((row) => row.brandId !== NO_BRAND), (row) => getBrand(row.brandId).name).sort((a, b) => b.revenue - a.revenue);
  els.brandTable.innerHTML = brandRows.length
    ? brandRows
        .map(
          (item) => `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td class="number">${number(item.quantity)}</td>
            <td class="number">${money(item.revenue)}</td>
            <td class="number">${money(item.shipping)}</td>
            <td class="number">${item.replacements}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td class="empty" colspan="5">Upload a report to see brand metrics.</td></tr>`;

  const clinicRows = groupRows(rows.filter((row) => row.clinicId !== NO_CLINIC), (row) => getClinic(row.clinicId).name).sort((a, b) => b.revenue - a.revenue);
  els.clinicTable.innerHTML = clinicRows.length
    ? clinicRows
        .map((item) => {
          return `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td>Clinic</td>
            <td class="number">${number(item.quantity)}</td>
            <td class="number">${money(item.revenue)}</td>
            <td class="number">${money(item.shipping)}</td>
            <td class="number">${item.replacements}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td class="empty" colspan="6">Upload a report to see clinic metrics.</td></tr>`;

  const repRows = groupRows(rows, (row) => getRep(row.repId).name)
    .filter((item) => item.rows.some((row) => row.repId))
    .map((item) => ({ ...item, commission: commissionForRows(item.rows), rate: getRep(item.rows[0]?.repId)?.rate || 0 }))
    .sort((a, b) => b.commission - a.commission);

  els.repTable.innerHTML = repRows.length
    ? repRows
        .map(
          (item) => `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td class="number">${number(item.rate)}%</td>
            <td class="number">${money(item.revenue)}</td>
            <td class="number">${money(item.commission)}</td>
            <td class="number">${money(item.shipping)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td class="empty" colspan="5">Upload a report to see rep metrics.</td></tr>`;

  const drugRows = groupRows(rows, (row) => {
    const account = row.brandId !== NO_BRAND ? getBrand(row.brandId).name : getClinic(row.clinicId).name || row.practiceName;
    const accountType = row.brandId !== NO_BRAND ? "Brand" : "Clinic";
    return `${row.drugName}|||${accountType}|||${account}|||${getRep(row.repId).name}`;
  })
    .sort((a, b) => b.revenue - a.revenue);

  els.drugTable.innerHTML = drugRows.length
    ? drugRows
        .map((item) => {
          const [drug, accountType, account, rep] = item.name.split("|||");
          return `<tr>
            <td>${escapeHtml(drug)}</td>
            <td>${accountType === "Brand" ? escapeHtml(account) : "No brand"}</td>
            <td>${accountType === "Clinic" ? escapeHtml(account) : "No clinic"}</td>
            <td>${escapeHtml(rep)}</td>
            <td class="number">${number(item.quantity)}</td>
            <td class="number">${money(item.revenue)}</td>
            <td class="number">${money(item.shipping)}</td>
            <td class="number">${item.replacements}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td class="empty" colspan="8">Upload a report to see drug-level metrics.</td></tr>`;

  els.historyTable.innerHTML = state.reports.length
    ? state.reports
        .map((report) => {
          const revenue = sum(report.rows, "revenue");
          const shipping = sum(report.rows, "shipping");
          return `<tr>
            <td>${escapeHtml(report.name)}</td>
            <td>${escapeHtml(report.startDate)} to ${escapeHtml(report.endDate)}</td>
            <td>${escapeHtml(getBrand(report.brandId).name)}</td>
            <td>${escapeHtml(getClinic(report.clinicId).name)}</td>
            <td>${escapeHtml(getRep(report.repId).name)}</td>
            <td class="number">${money(revenue)}</td>
            <td class="number">${money(shipping)}</td>
            <td class="number">${money(commissionForRows(report.rows))}</td>
            <td class="number">${report.rows.length}</td>
            <td><button class="small danger" data-delete-report="${report.id}" type="button">Remove</button></td>
          </tr>`;
        })
        .join("")
    : `<tr><td class="empty" colspan="10">No report history yet.</td></tr>`;
}

function resizeCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = canvas.clientHeight * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  return { ctx, width: rect.width, height: canvas.clientHeight };
}

function fitText(ctx, text, maxWidth) {
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let trimmed = value;
  while (trimmed.length > 3 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function drawBarChart(canvas, items, valueKey, color) {
  const chartItems = items.slice(0, 12);
  canvas.style.height = `${Math.max(260, chartItems.length * 38 + 44)}px`;
  const { ctx, width, height } = resizeCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const max = Math.max(...chartItems.map((item) => item[valueKey]), 1);
  const left = Math.min(180, Math.max(108, width * 0.34));
  const right = 14;
  const top = 18;
  const rowHeight = Math.max(32, (height - top - 18) / Math.max(chartItems.length, 1));

  ctx.font = "12px system-ui, sans-serif";
  ctx.textBaseline = "middle";

  if (!chartItems.length) {
    ctx.fillStyle = "#64717e";
    ctx.fillText("No data yet", 16, 32);
    return;
  }

  chartItems.forEach((item, index) => {
    const y = top + index * rowHeight + rowHeight / 2;
    const label = fitText(ctx, item.name, left - 12);
    const valueLabel = compactMoney(item[valueKey]);
    const valueWidth = ctx.measureText(valueLabel).width;
    const barArea = Math.max(80, width - left - right - valueWidth - 12);
    const barWidth = Math.max(3, (barArea * item[valueKey]) / max);
    ctx.fillStyle = "#64717e";
    ctx.fillText(label, 0, y);
    ctx.fillStyle = color;
    ctx.fillRect(left, y - 10, barWidth, 20);

    const outsideX = left + barWidth + 8;
    if (outsideX + valueWidth <= width - right) {
      ctx.fillStyle = "#182027";
      ctx.fillText(valueLabel, outsideX, y);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "right";
      ctx.fillText(valueLabel, left + barWidth - 6, y);
      ctx.textAlign = "left";
    }
  });
}

function renderCharts(rows) {
  const brandItems = groupRows(rows.filter((row) => row.brandId !== NO_BRAND), (row) => getBrand(row.brandId).name).sort((a, b) => b.revenue - a.revenue);
  const clinicItems = groupRows(rows.filter((row) => row.clinicId !== NO_CLINIC), (row) => getClinic(row.clinicId).name).sort((a, b) => b.revenue - a.revenue);
  const repItems = groupRows(rows.filter((row) => row.repId), (row) => getRep(row.repId).name)
    .map((item) => ({ ...item, commission: commissionForRows(item.rows) }))
    .sort((a, b) => b.commission - a.commission);

  els.brandChartNote.textContent = brandItems.length > 12 ? `Top 12 of ${brandItems.length}` : `${brandItems.length} shown`;
  els.clinicChartNote.textContent = clinicItems.length > 12 ? `Top 12 of ${clinicItems.length}` : `${clinicItems.length} shown`;
  els.repChartNote.textContent = repItems.length > 12 ? `Top 12 of ${repItems.length}` : `${repItems.length} shown`;
  drawBarChart(els.brandChart, brandItems, "revenue", "#287a74");
  drawBarChart(els.clinicChart, clinicItems, "revenue", "#486fa7");
  drawBarChart(els.repChart, repItems, "commission", "#b98516");
}

function render() {
  renderOptions();
  renderLists();
  const rows = rowsForFilters();
  renderMetrics(rows);
  renderTables(rows);
  renderCharts(rows);
  saveState();
}

function addReport({ name, startDate, endDate, brandId, clinicId, repId, rows }) {
  const selectedBrand = brandId !== AUTO && brandId !== NO_BRAND ? getBrand(brandId) : null;
  const selectedClinic = clinicId !== AUTO && clinicId !== NO_CLINIC ? getClinic(clinicId) : null;
  const startingBrandId = selectedBrand?.id || NO_BRAND;
  const startingClinicId = selectedClinic?.id || NO_CLINIC;
  const startingRepId = selectedBrand ? selectedBrand.repId : selectedClinic ? selectedClinic.repId : repId;
  const report = { id: crypto.randomUUID(), name, startDate, endDate, brandId: startingBrandId, clinicId: startingClinicId, repId: startingRepId, rows: [] };
  report.rows = normalizeRows(rows, report);
  report.rows.forEach((row) => {
    const brand = selectedBrand || (brandId === AUTO ? matchBrandByPractice(row.practiceName) : null);
    const clinic = selectedClinic || (clinicId === AUTO ? matchClinicByPractice(row.practiceName) : null);

    if (selectedBrand) {
      row.brandId = selectedBrand.id;
      row.clinicId = NO_CLINIC;
      row.repId = selectedBrand.repId;
    } else if (selectedClinic || clinic) {
      const account = selectedClinic || clinic;
      row.brandId = NO_BRAND;
      row.clinicId = account.id;
      row.repId = account.repId;
    } else if (brand) {
      row.brandId = brand.id;
      row.clinicId = NO_CLINIC;
      row.repId = brand.repId;
    } else {
      row.brandId = selectedBrand?.id || NO_BRAND;
      row.clinicId = selectedClinic?.id || NO_CLINIC;
      row.repId = selectedBrand ? selectedBrand.repId : selectedClinic ? selectedClinic.repId : repId;
    }
  });
  const firstRow = report.rows[0];
  report.clinicId = firstRow?.clinicId || startingClinicId;
  report.brandId = firstRow?.brandId || startingBrandId;
  report.repId = firstRow?.repId || startingRepId;
  state.reports.push(report);
}

els.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = els.fileInput.files[0];
  if (!file) return;

  try {
    const rows = await readFile(file);
    addReport({
      name: els.reportName.value.trim() || file.name,
      startDate: els.startDate.value,
      endDate: els.endDate.value,
      brandId: els.brandSelect.value,
      clinicId: els.clinicSelect.value,
      repId: els.repSelect.value,
      rows,
    });
    els.uploadStatus.textContent = `Imported ${rows.length} rows from ${file.name}.`;
    els.uploadForm.reset();
    render();
    if (cloudReady) await saveCloudState();
  } catch (error) {
    els.uploadStatus.textContent = error.message;
  }
});

els.repForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.repName.value.trim();
  if (!name) return;
  state.reps.push({ id: crypto.randomUUID(), name, rate: parseAmount(els.repRate.value) });
  els.repForm.reset();
  render();
});

els.brandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.brandName.value.trim();
  if (!name) {
    els.brandStatus.textContent = "Enter a brand name first.";
    return;
  }
  state.brands.push({ id: crypto.randomUUID(), name, repId: els.brandNoRep.checked ? null : els.brandRep.value });
  els.brandStatus.textContent = `Added brand ${name}${els.brandNoRep.checked ? " without a sales rep" : ""}.`;
  els.brandForm.reset();
  render();
});

els.clinicForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.clinicName.value.trim();
  if (!name) {
    els.clinicStatus.textContent = "Enter a clinic name first.";
    return;
  }
  state.clinics.push({ id: crypto.randomUUID(), name, repId: els.clinicNoRep.checked ? null : els.clinicRep.value });
  els.clinicStatus.textContent = `Added clinic ${name}${els.clinicNoRep.checked ? " without a sales rep" : ""}.`;
  els.clinicForm.reset();
  render();
});

document.addEventListener("click", (event) => {
  const repId = event.target.dataset?.deleteRep;
  const brandId = event.target.dataset?.deleteBrand;
  const clinicId = event.target.dataset?.deleteClinic;
  const reportId = event.target.dataset?.deleteReport;

  if (reportId) {
    const report = state.reports.find((item) => item.id === reportId);
    if (!report) return;

    if (!confirmProtectedDelete(report.name)) return;

    state.reports = state.reports.filter((item) => item.id !== reportId);
    if (els.viewFilter.value === reportId) els.viewFilter.value = "all";
    render();
    return;
  }

  if (repId && state.reps.length > 1) {
    state.reps = state.reps.filter((rep) => rep.id !== repId);
    state.clinics.forEach((clinic) => {
      if (clinic.repId === repId) clinic.repId = state.reps[0].id;
    });
    state.reports.forEach((report) => {
      if (report.repId === repId) report.repId = state.reps[0].id;
      report.rows.forEach((row) => {
        if (row.repId === repId) row.repId = state.reps[0].id;
      });
    });
  }

  if (brandId && state.brands.length > 1) {
    const brand = state.brands.find((item) => item.id === brandId);
    if (!brand || !confirmProtectedDelete(brand.name)) return;

    state.brands = state.brands.filter((brand) => brand.id !== brandId);
    state.reports.forEach((report) => {
      if (report.brandId === brandId) report.brandId = NO_BRAND;
      report.rows.forEach((row) => {
        if (row.brandId === brandId) row.brandId = NO_BRAND;
      });
    });
  }

  if (clinicId && state.clinics.length > 1) {
    const clinic = state.clinics.find((item) => item.id === clinicId);
    if (!clinic || !confirmProtectedDelete(clinic.name)) return;

    state.clinics = state.clinics.filter((clinic) => clinic.id !== clinicId);
    state.reports.forEach((report) => {
      if (report.clinicId === clinicId) {
        report.clinicId = NO_CLINIC;
        report.repId = state.clinics[0].repId;
      }
      report.rows.forEach((row) => {
        if (row.clinicId === clinicId) {
          row.clinicId = NO_CLINIC;
          row.repId = state.clinics[0].repId;
        }
      });
    });
  }

  if (repId || brandId || clinicId) render();
});

els.brandNoRep.addEventListener("input", () => {
  els.brandRep.disabled = els.brandNoRep.checked;
});

els.clinicNoRep.addEventListener("input", () => {
  els.clinicRep.disabled = els.clinicNoRep.checked;
});

els.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!configuredForSupabase()) {
    els.authStatus.textContent = "Supabase is not configured yet.";
    return;
  }

  supabaseClient = supabaseClient || window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
  els.authStatus.textContent = "Signing in...";
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: els.authEmail.value.trim(),
    password: els.authPassword.value,
  });

  if (error) {
    els.authStatus.textContent = error.message;
    return;
  }

  els.authPassword.value = "";
  await refreshAuthState();
});

els.signOutBtn.addEventListener("click", async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  cloudReady = false;
  setSyncStatus("Cloud signed out");
  els.authStatus.textContent = "Signed out. Local browser data is still available on this device.";
});

els.refreshCloudBtn.addEventListener("click", forceCloudRefresh);

[els.viewFilter, els.filterStart, els.filterEnd, els.filterBrand, els.filterClinic, els.filterRep].forEach((input) => {
  input.addEventListener("input", render);
});

els.clinicSelect.addEventListener("input", () => {
  if (els.clinicSelect.value === AUTO) {
    return;
  }
  const clinic = getClinic(els.clinicSelect.value);
  if (clinic) {
    els.brandSelect.value = NO_BRAND;
    els.repSelect.value = clinic.repId;
  }
});

els.brandSelect.addEventListener("input", () => {
  if (els.brandSelect.value === AUTO) return;
  const brand = getBrand(els.brandSelect.value);
  if (brand) {
    els.clinicSelect.value = NO_CLINIC;
    els.repSelect.value = brand.repId;
  }
});

els.sampleBtn.addEventListener("click", () => {
  const roseRep = state.reps.find((rep) => rep.name === "Rose Rep") || { id: crypto.randomUUID(), name: "Rose Rep", rate: 10 };
  if (!state.reps.some((rep) => rep.id === roseRep.id)) state.reps.push(roseRep);

  const roseBrand =
    state.brands.find((brand) => brand.name === "Rose") ||
    { id: crypto.randomUUID(), name: "Rose", repId: roseRep.id };
  if (!state.brands.some((brand) => brand.id === roseBrand.id)) state.brands.push(roseBrand);

  const roseClinic =
    state.clinics.find((clinic) => clinic.name === "Rose MedSpa and Wellness") ||
    { id: crypto.randomUUID(), name: "Rose MedSpa and Wellness", repId: roseRep.id };
  if (!state.clinics.some((clinic) => clinic.id === roseClinic.id)) state.clinics.push(roseClinic);

  addReport({
    name: "ROSE REPORT 4.20.26-4.26.26",
    startDate: "2026-04-20",
    endDate: "2026-04-26",
    brandId: AUTO,
    clinicId: AUTO,
    repId: roseRep.id,
    rows: parseCsv(sampleCsv),
  });
  render();
});

window.addEventListener("resize", render);
render();
refreshAuthState();

const STORE_KEY = "pharmacy-sales-dashboard-v1";

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

const state = loadState();

const els = {
  uploadForm: document.querySelector("#uploadForm"),
  repForm: document.querySelector("#repForm"),
  brandForm: document.querySelector("#brandForm"),
  reportName: document.querySelector("#reportName"),
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
  brandSelect: document.querySelector("#brandSelect"),
  repSelect: document.querySelector("#repSelect"),
  fileInput: document.querySelector("#fileInput"),
  uploadStatus: document.querySelector("#uploadStatus"),
  repName: document.querySelector("#repName"),
  repRate: document.querySelector("#repRate"),
  repList: document.querySelector("#repList"),
  brandName: document.querySelector("#brandName"),
  brandRep: document.querySelector("#brandRep"),
  brandList: document.querySelector("#brandList"),
  viewFilter: document.querySelector("#viewFilter"),
  filterStart: document.querySelector("#filterStart"),
  filterEnd: document.querySelector("#filterEnd"),
  filterBrand: document.querySelector("#filterBrand"),
  filterRep: document.querySelector("#filterRep"),
  totalRevenue: document.querySelector("#totalRevenue"),
  totalShipping: document.querySelector("#totalShipping"),
  netRevenue: document.querySelector("#netRevenue"),
  totalCommission: document.querySelector("#totalCommission"),
  totalQuantity: document.querySelector("#totalQuantity"),
  totalReplacements: document.querySelector("#totalReplacements"),
  brandChart: document.querySelector("#brandChart"),
  repChart: document.querySelector("#repChart"),
  brandChartNote: document.querySelector("#brandChartNote"),
  repChartNote: document.querySelector("#repChartNote"),
  brandTable: document.querySelector("#brandTable"),
  repTable: document.querySelector("#repTable"),
  drugTable: document.querySelector("#drugTable"),
  historyTable: document.querySelector("#historyTable"),
  sampleBtn: document.querySelector("#sampleBtn"),
  clearBtn: document.querySelector("#clearBtn"),
};

function loadState() {
  const fallback = {
    reps: [{ id: crypto.randomUUID(), name: "Unassigned", rate: 0 }],
    brands: [{ id: crypto.randomUUID(), name: "Unassigned", repId: null }],
    reports: [],
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!parsed || !Array.isArray(parsed.reports)) return fallback;
    return {
      reps: parsed.reps?.length ? parsed.reps : fallback.reps,
      brands: parsed.brands?.length ? parsed.brands : fallback.brands,
      reports: parsed.reports,
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
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
  return rows.map((row) => {
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

    return {
      id: crypto.randomUUID(),
      reportId: report.id,
      reportName: report.name,
      startDate: report.startDate,
      endDate: report.endDate,
      brandId: report.brandId,
      repId: report.repId,
      practiceName: String(row[practiceKey] || "").trim() || "Unknown clinic",
      quantity: parseAmount(row[quantityKey]),
      drugName: String(row[drugKey] || "").trim() || "Unknown drug",
      revenue: parseAmount(row[priceKey]),
      shipping: parseAmount(row[shippingKey]),
      replacementText,
      isReplacement: replacementText.length > 0,
      trackingNumber: String(row[trackingKey] || "").trim(),
    };
  });
}

function getRep(id) {
  return state.reps.find((rep) => rep.id === id) || state.reps[0];
}

function getBrand(id) {
  return state.brands.find((brand) => brand.id === id) || state.brands[0];
}

function rowsForFilters() {
  const reportId = els.viewFilter.value;
  const start = els.filterStart.value;
  const end = els.filterEnd.value;
  const brandId = els.filterBrand.value;
  const repId = els.filterRep.value;

  return state.reports.flatMap((report) => report.rows).filter((row) => {
    if (reportId !== "all" && row.reportId !== reportId) return false;
    if (start && row.endDate < start) return false;
    if (end && row.startDate > end) return false;
    if (brandId !== "all" && row.brandId !== brandId) return false;
    if (repId !== "all" && row.repId !== repId) return false;
    return true;
  });
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function commissionForRows(rows) {
  return rows.reduce((total, row) => {
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

function renderOptions() {
  const repOptions = state.reps
    .map((rep) => `<option value="${rep.id}">${escapeHtml(rep.name)} (${number(rep.rate)}%)</option>`)
    .join("");
  const brandOptions = state.brands.map((brand) => `<option value="${brand.id}">${escapeHtml(brand.name)}</option>`).join("");

  els.repSelect.innerHTML = repOptions;
  els.brandRep.innerHTML = repOptions;
  els.brandSelect.innerHTML = brandOptions;
  els.filterRep.innerHTML = `<option value="all">All reps</option>${repOptions}`;
  els.filterBrand.innerHTML = `<option value="all">All brands</option>${brandOptions}`;
  els.viewFilter.innerHTML = `<option value="all">All uploads</option>${state.reports
    .map((report) => `<option value="${report.id}">${report.name}</option>`)
    .join("")}`;
}

function renderLists() {
  els.repList.innerHTML = state.reps
    .map(
      (rep) =>
        `<span class="pill">${escapeHtml(rep.name)} · ${number(rep.rate)}% <button data-delete-rep="${rep.id}" type="button" aria-label="Delete ${escapeHtml(rep.name)}">×</button></span>`,
    )
    .join("");

  els.brandList.innerHTML = state.brands
    .map((brand) => {
      const rep = getRep(brand.repId);
      return `<span class="pill">${escapeHtml(brand.name)} · ${escapeHtml(rep?.name || "Unassigned")} <button data-delete-brand="${brand.id}" type="button" aria-label="Delete ${escapeHtml(brand.name)}">×</button></span>`;
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
  const brandRows = groupRows(rows, (row) => getBrand(row.brandId).name).sort((a, b) => b.revenue - a.revenue);
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

  const repRows = groupRows(rows, (row) => getRep(row.repId).name)
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

  const drugRows = groupRows(rows, (row) => `${row.drugName}|||${getBrand(row.brandId).name}|||${getRep(row.repId).name}`)
    .sort((a, b) => b.revenue - a.revenue);

  els.drugTable.innerHTML = drugRows.length
    ? drugRows
        .map((item) => {
          const [drug, brand, rep] = item.name.split("|||");
          return `<tr>
            <td>${escapeHtml(drug)}</td>
            <td>${escapeHtml(brand)}</td>
            <td>${escapeHtml(rep)}</td>
            <td class="number">${number(item.quantity)}</td>
            <td class="number">${money(item.revenue)}</td>
            <td class="number">${money(item.shipping)}</td>
            <td class="number">${item.replacements}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td class="empty" colspan="7">Upload a report to see drug-level metrics.</td></tr>`;

  els.historyTable.innerHTML = state.reports.length
    ? state.reports
        .map((report) => {
          const revenue = sum(report.rows, "revenue");
          const shipping = sum(report.rows, "shipping");
          return `<tr>
            <td>${escapeHtml(report.name)}</td>
            <td>${escapeHtml(report.startDate)} to ${escapeHtml(report.endDate)}</td>
            <td>${escapeHtml(getBrand(report.brandId).name)}</td>
            <td>${escapeHtml(getRep(report.repId).name)}</td>
            <td class="number">${money(revenue)}</td>
            <td class="number">${money(shipping)}</td>
            <td class="number">${money(commissionForRows(report.rows))}</td>
            <td class="number">${report.rows.length}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td class="empty" colspan="8">No report history yet.</td></tr>`;
}

function resizeCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = Number(canvas.getAttribute("height")) * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  return { ctx, width: rect.width, height: Number(canvas.getAttribute("height")) };
}

function drawBarChart(canvas, items, valueKey, color) {
  const { ctx, width, height } = resizeCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const chartItems = items.slice(0, 8);
  const max = Math.max(...chartItems.map((item) => item[valueKey]), 1);
  const left = 116;
  const right = 16;
  const top = 14;
  const rowHeight = (height - top - 22) / Math.max(chartItems.length, 1);

  ctx.font = "12px system-ui, sans-serif";
  ctx.textBaseline = "middle";

  if (!chartItems.length) {
    ctx.fillStyle = "#64717e";
    ctx.fillText("No data yet", 16, 32);
    return;
  }

  chartItems.forEach((item, index) => {
    const y = top + index * rowHeight + rowHeight / 2;
    const barWidth = ((width - left - right) * item[valueKey]) / max;
    ctx.fillStyle = "#64717e";
    ctx.fillText(item.name.slice(0, 18), 0, y);
    ctx.fillStyle = color;
    ctx.fillRect(left, y - 10, barWidth, 20);
    ctx.fillStyle = "#182027";
    ctx.fillText(money(item[valueKey]), left + barWidth + 8, y);
  });
}

function renderCharts(rows) {
  const brandItems = groupRows(rows, (row) => getBrand(row.brandId).name).sort((a, b) => b.revenue - a.revenue);
  const repItems = groupRows(rows, (row) => getRep(row.repId).name)
    .map((item) => ({ ...item, commission: commissionForRows(item.rows) }))
    .sort((a, b) => b.commission - a.commission);

  els.brandChartNote.textContent = `${brandItems.length} shown`;
  els.repChartNote.textContent = `${repItems.length} shown`;
  drawBarChart(els.brandChart, brandItems, "revenue", "#287a74");
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

function addReport({ name, startDate, endDate, brandId, repId, rows }) {
  const report = { id: crypto.randomUUID(), name, startDate, endDate, brandId, repId, rows: [] };
  report.rows = normalizeRows(rows, report);
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
      repId: els.repSelect.value,
      rows,
    });
    els.uploadStatus.textContent = `Imported ${rows.length} rows from ${file.name}.`;
    els.uploadForm.reset();
    render();
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
  if (!name) return;
  state.brands.push({ id: crypto.randomUUID(), name, repId: els.brandRep.value });
  els.brandForm.reset();
  render();
});

document.addEventListener("click", (event) => {
  const repId = event.target.dataset?.deleteRep;
  const brandId = event.target.dataset?.deleteBrand;

  if (repId && state.reps.length > 1) {
    state.reps = state.reps.filter((rep) => rep.id !== repId);
    state.reports.forEach((report) => {
      if (report.repId === repId) report.repId = state.reps[0].id;
      report.rows.forEach((row) => {
        if (row.repId === repId) row.repId = state.reps[0].id;
      });
    });
  }

  if (brandId && state.brands.length > 1) {
    state.brands = state.brands.filter((brand) => brand.id !== brandId);
    state.reports.forEach((report) => {
      if (report.brandId === brandId) report.brandId = state.brands[0].id;
      report.rows.forEach((row) => {
        if (row.brandId === brandId) row.brandId = state.brands[0].id;
      });
    });
  }

  if (repId || brandId) render();
});

[els.viewFilter, els.filterStart, els.filterEnd, els.filterBrand, els.filterRep].forEach((input) => {
  input.addEventListener("input", render);
});

els.brandSelect.addEventListener("input", () => {
  const brand = getBrand(els.brandSelect.value);
  if (brand?.repId) els.repSelect.value = brand.repId;
});

els.sampleBtn.addEventListener("click", () => {
  const roseRep = state.reps.find((rep) => rep.name === "Rose Rep") || { id: crypto.randomUUID(), name: "Rose Rep", rate: 10 };
  if (!state.reps.some((rep) => rep.id === roseRep.id)) state.reps.push(roseRep);

  const roseBrand =
    state.brands.find((brand) => brand.name === "Rose MedSpa and Wellness") ||
    { id: crypto.randomUUID(), name: "Rose MedSpa and Wellness", repId: roseRep.id };
  if (!state.brands.some((brand) => brand.id === roseBrand.id)) state.brands.push(roseBrand);

  addReport({
    name: "ROSE REPORT 4.20.26-4.26.26",
    startDate: "2026-04-20",
    endDate: "2026-04-26",
    brandId: roseBrand.id,
    repId: roseRep.id,
    rows: parseCsv(sampleCsv),
  });
  render();
});

els.clearBtn.addEventListener("click", () => {
  if (!confirm("Clear all saved dashboard data?")) return;
  localStorage.removeItem(STORE_KEY);
  window.location.reload();
});

window.addEventListener("resize", render);
render();

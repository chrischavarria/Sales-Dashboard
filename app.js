const STORE_KEY = "pharmacy-sales-dashboard-v1";
const AUTO = "auto";
const NO_BRAND = "none";
const NO_CLINIC = "none";
const CLOUD_ROW_ID = "main";
const CLOUD_CHUNK_SIZE = 180000;
const DELETE_REPORT_PASSWORD = "2727Baseline!";
const SKU_BATCH_GRAMS = 100;
const EXPIRY_WARNING_DAYS = 30;

const DEFAULT_COGS_ASSUMPTIONS = {
  rxLaborRate: 28,
  contractLaborRate: 30,
  indirectLaborRate: 0.6,
  monthlyRent: 6513,
  monthlyUtilities: 5005,
  monthlyDepreciation: 1200,
  monthlyMarketing: 5200,
  monthlySoftware: 30291,
  monthlyOther: 60000,
  rxOverheadUnits: 53333,
  contractOverheadUnits: 53333,
  wasteFactor: 0.01,
  qaRx: 0,
  qaContract: 0,
  packagingRx: 0,
  packagingContract: 9.36,
  marginFloor: 0.4,
};

const COGS_ASSUMPTION_ROWS = [
  ["rxLaborRate", "Direct Labor - Rx", "$/hr", "Avg wage incl. benefits for compounding tech - Rx"],
  ["contractLaborRate", "Direct Labor - Contract", "$/hr", "Avg wage incl. benefits for compounding tech - Contract"],
  ["indirectLaborRate", "Indirect Labor Rate", "% of direct labor", "Supervisors, QA, admin as % of direct labor"],
  ["monthlyRent", "Overhead - Monthly Rent", "$", "Facility rent"],
  ["monthlyUtilities", "Overhead - Monthly Utilities", "$", "Electricity, water, HVAC"],
  ["monthlyDepreciation", "Overhead - Monthly Depreciation", "$", "Equipment depreciation"],
  ["monthlyMarketing", "Overhead - Monthly Marketing", "$", "Marketing spend"],
  ["monthlySoftware", "Overhead - Monthly Software/License", "$", "Pharmacy software and licenses"],
  ["monthlyOther", "Overhead - Other Monthly", "$", "Miscellaneous overhead"],
  ["rxOverheadUnits", "Overhead Allocation - Rx Units/Month", "units", "Expected Rx prescriptions per month"],
  ["contractOverheadUnits", "Overhead Allocation - Contract Units/Month", "units", "Expected contract units per month"],
  ["wasteFactor", "Waste / Spoilage Factor", "%", "Material waste as % of material cost"],
  ["qaRx", "QA / Testing Cost per Batch - Rx", "$", "Lab testing per Rx prescription"],
  ["qaContract", "QA / Testing Cost per Batch - Contract", "$", "Lab testing per contract unit"],
  ["packagingRx", "Packaging Cost per Unit - Rx", "$", "Labels, bags, vials for Rx"],
  ["packagingContract", "Packaging Cost per Unit - Contract", "$", "Labels, bags, vials for contract"],
  ["marginFloor", "Target Margin Floor", "%", "Flags modeled profitability below this gross margin"],
];

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
const builderState = {
  apis: new Set(),
  materials: new Set(),
  apiQuantities: new Map(),
};
const expandedSkus = new Set();
const profitabilityState = {
  apis: new Set(),
  materials: new Set(),
  apiQuantities: new Map(),
  result: null,
};

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
  brandTrendChart: document.querySelector("#brandTrendChart"),
  brandChartNote: document.querySelector("#brandChartNote"),
  clinicChartNote: document.querySelector("#clinicChartNote"),
  repChartNote: document.querySelector("#repChartNote"),
  brandTrendNote: document.querySelector("#brandTrendNote"),
  brandTrendTable: document.querySelector("#brandTrendTable"),
  previousMonthHeader: document.querySelector("#previousMonthHeader"),
  currentMonthHeader: document.querySelector("#currentMonthHeader"),
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
  apiCostForm: document.querySelector("#apiCostForm"),
  apiCostFile: document.querySelector("#apiCostFile"),
  apiCostStatus: document.querySelector("#apiCostStatus"),
  apiCostTable: document.querySelector("#apiCostTable"),
  pricingWorkbookForm: document.querySelector("#pricingWorkbookForm"),
  pricingWorkbookFile: document.querySelector("#pricingWorkbookFile"),
  pricingWorkbookStatus: document.querySelector("#pricingWorkbookStatus"),
  manualApiForm: document.querySelector("#manualApiForm"),
  manualApiName: document.querySelector("#manualApiName"),
  manualApiUnit: document.querySelector("#manualApiUnit"),
  manualApiCost: document.querySelector("#manualApiCost"),
  manualApiStatus: document.querySelector("#manualApiStatus"),
  skuCostForm: document.querySelector("#skuCostForm"),
  skuCostFile: document.querySelector("#skuCostFile"),
  skuCostStatus: document.querySelector("#skuCostStatus"),
  skuCostTable: document.querySelector("#skuCostTable"),
  manualSkuForm: document.querySelector("#manualSkuForm"),
  manualSkuFormula: document.querySelector("#manualSkuFormula"),
  manualSkuTotal: document.querySelector("#manualSkuTotal"),
  manualSkuUnitCost: document.querySelector("#manualSkuUnitCost"),
  manualSkuStatus: document.querySelector("#manualSkuStatus"),
  materialCostForm: document.querySelector("#materialCostForm"),
  materialCostFile: document.querySelector("#materialCostFile"),
  materialCostStatus: document.querySelector("#materialCostStatus"),
  materialCostTable: document.querySelector("#materialCostTable"),
  manualMaterialForm: document.querySelector("#manualMaterialForm"),
  manualMaterialName: document.querySelector("#manualMaterialName"),
  manualMaterialCategory: document.querySelector("#manualMaterialCategory"),
  manualMaterialUnit: document.querySelector("#manualMaterialUnit"),
  manualMaterialCost: document.querySelector("#manualMaterialCost"),
  manualMaterialStatus: document.querySelector("#manualMaterialStatus"),
  builderApiTotal: document.querySelector("#builderApiTotal"),
  builderMaterialTotal: document.querySelector("#builderMaterialTotal"),
  builderGrandTotal: document.querySelector("#builderGrandTotal"),
  builderSelections: document.querySelector("#builderSelections"),
  builderProfitForm: document.querySelector("#builderProfitForm"),
  builderProfitStream: document.querySelector("#builderProfitStream"),
  builderProfitQuantity: document.querySelector("#builderProfitQuantity"),
  builderProfitRevenue: document.querySelector("#builderProfitRevenue"),
  builderProfitLaborHours: document.querySelector("#builderProfitLaborHours"),
  clearBuilderBtn: document.querySelector("#clearBuilderBtn"),
  materialBuilderApiTotal: document.querySelector("#materialBuilderApiTotal"),
  materialBuilderMaterialTotal: document.querySelector("#materialBuilderMaterialTotal"),
  materialBuilderGrandTotal: document.querySelector("#materialBuilderGrandTotal"),
  materialBuilderSelections: document.querySelector("#materialBuilderSelections"),
  materialBuilderProfitForm: document.querySelector("#materialBuilderProfitForm"),
  materialBuilderProfitStream: document.querySelector("#materialBuilderProfitStream"),
  materialBuilderProfitQuantity: document.querySelector("#materialBuilderProfitQuantity"),
  materialBuilderProfitRevenue: document.querySelector("#materialBuilderProfitRevenue"),
  materialBuilderProfitLaborHours: document.querySelector("#materialBuilderProfitLaborHours"),
  materialClearBuilderBtn: document.querySelector("#materialClearBuilderBtn"),
  cogsWorkbookForm: document.querySelector("#cogsWorkbookForm"),
  cogsWorkbookFile: document.querySelector("#cogsWorkbookFile"),
  cogsWorkbookStatus: document.querySelector("#cogsWorkbookStatus"),
  cogsAssumptionsForm: document.querySelector("#cogsAssumptionsForm"),
  cogsAssumptionFields: document.querySelector("#cogsAssumptionFields"),
  cogsAssumptionsStatus: document.querySelector("#cogsAssumptionsStatus"),
  cogsAssumptionsTable: document.querySelector("#cogsAssumptionsTable"),
  cogsRxTable: document.querySelector("#cogsRxTable"),
  cogsContractTable: document.querySelector("#cogsContractTable"),
  profitabilityForm: document.querySelector("#profitabilityForm"),
  profitabilityStream: document.querySelector("#profitabilityStream"),
  profitabilitySku: document.querySelector("#profitabilitySku"),
  profitabilityQuantity: document.querySelector("#profitabilityQuantity"),
  profitabilityRevenue: document.querySelector("#profitabilityRevenue"),
  profitabilityLaborHours: document.querySelector("#profitabilityLaborHours"),
  profitabilityMarginFloor: document.querySelector("#profitabilityMarginFloor"),
  profitabilityApi: document.querySelector("#profitabilityApi"),
  profitabilityAddApi: document.querySelector("#profitabilityAddApi"),
  profitabilityMaterial: document.querySelector("#profitabilityMaterial"),
  profitabilityAddMaterial: document.querySelector("#profitabilityAddMaterial"),
  profitabilityStatus: document.querySelector("#profitabilityStatus"),
  profitabilitySelections: document.querySelector("#profitabilitySelections"),
  profitRevenue: document.querySelector("#profitRevenue"),
  profitCogs: document.querySelector("#profitCogs"),
  profitGrossProfit: document.querySelector("#profitGrossProfit"),
  profitGrossMargin: document.querySelector("#profitGrossMargin"),
  profitBreakdownTable: document.querySelector("#profitBreakdownTable"),
};

function loadState(sourceState) {
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
    apiCosts: [],
    skuCosts: [],
    materialCosts: [],
    cogs: {
      assumptions: { ...DEFAULT_COGS_ASSUMPTIONS },
      inventory: [],
      skuRegistry: [],
      rxPrescriptions: [],
      contractOrders: [],
      importedAt: null,
    },
  };

  try {
    const parsed = sourceState || JSON.parse(localStorage.getItem(STORE_KEY));
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
      apiCosts: Array.isArray(parsed.apiCosts) ? parsed.apiCosts : [],
      skuCosts: Array.isArray(parsed.skuCosts) ? parsed.skuCosts : [],
      materialCosts: Array.isArray(parsed.materialCosts) ? parsed.materialCosts : [],
      cogs: {
        assumptions: { ...DEFAULT_COGS_ASSUMPTIONS, ...(parsed.cogs?.assumptions || {}) },
        inventory: Array.isArray(parsed.cogs?.inventory) ? parsed.cogs.inventory : [],
        skuRegistry: Array.isArray(parsed.cogs?.skuRegistry) ? parsed.cogs.skuRegistry : [],
        rxPrescriptions: Array.isArray(parsed.cogs?.rxPrescriptions) ? parsed.cogs.rxPrescriptions : [],
        contractOrders: Array.isArray(parsed.cogs?.contractOrders) ? parsed.cogs.contractOrders : [],
        importedAt: parsed.cogs?.importedAt || null,
      },
    };
  } catch {
    return fallback;
  }
}

function localStateSnapshot() {
  return JSON.parse(JSON.stringify(state));
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (error) {
    if (!cloudReady) {
      setSyncStatus("Local storage full");
      return;
    }
    setSyncStatus("Local cache full; cloud save pending");
  }
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

function setLocked(isLocked) {
  document.body.classList.toggle("locked", isLocked);
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

function chunkText(text, size) {
  const chunks = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks.length ? chunks : [""];
}

async function saveCloudState() {
  if (!supabaseClient || !cloudReady) return;
  setSyncStatus("Cloud saving...");
  const serialized = JSON.stringify(localStateSnapshot());
  const chunks = chunkText(serialized, CLOUD_CHUNK_SIZE);
  const updatedAt = new Date().toISOString();
  const payload = chunks.map((chunk, index) => ({
    id: CLOUD_ROW_ID,
    chunk_index: index,
    chunk_text: chunk,
    updated_at: updatedAt,
  }));

  const { error: upsertError } = await supabaseClient.from("dashboard_state_chunks").upsert(payload);
  if (upsertError) throw upsertError;

  const { error: deleteError } = await supabaseClient
    .from("dashboard_state_chunks")
    .delete()
    .eq("id", CLOUD_ROW_ID)
    .gte("chunk_index", chunks.length);
  if (deleteError) throw deleteError;

  const { error: pointerError } = await supabaseClient
    .from("dashboard_state")
    .upsert({ id: CLOUD_ROW_ID, payload: { chunked: true, chunks: chunks.length }, updated_at: updatedAt });
  if (pointerError) throw pointerError;

  setSyncStatus(`Cloud synced ${syncTimeLabel()}`);
}

async function loadCloudState() {
  const { data: chunkData, error: chunkError } = await supabaseClient
    .from("dashboard_state_chunks")
    .select("chunk_index, chunk_text")
    .eq("id", CLOUD_ROW_ID)
    .order("chunk_index", { ascending: true });

  if (!chunkError && chunkData?.length) {
    const payload = JSON.parse(chunkData.map((chunk) => chunk.chunk_text).join(""));
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(payload));
    } catch {
      setSyncStatus("Local cache full; using cloud data");
    }
    state = loadState(payload);
    return;
  }

  const { data, error } = await supabaseClient.from("dashboard_state").select("payload").eq("id", CLOUD_ROW_ID).maybeSingle();
  if (error) throw error;

  if (data?.payload) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data.payload));
    } catch {
      setSyncStatus("Local cache full; using cloud data");
    }
    state = loadState(data.payload);
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

async function requireCloudReady(statusElement) {
  if (!configuredForSupabase()) return true;

  supabaseClient = supabaseClient || window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
  const { data } = await supabaseClient.auth.getSession();

  if (!data?.session) {
    cloudReady = false;
    setSyncStatus("Cloud signed out");
    statusElement.textContent = "Sign in under Cloud Access before making changes.";
    return false;
  }

  cloudReady = true;
  return true;
}

async function refreshAuthState() {
  if (!configuredForSupabase()) {
    setLocked(true);
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
    setLocked(true);
    els.authMode.textContent = "Sign in";
    els.authStatus.textContent = "Sign in to use shared cloud data.";
    setSyncStatus("Cloud signed out");
    return;
  }

  cloudReady = true;
  setLocked(false);
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

function amountInputValue(value) {
  const amount = parseAmount(value);
  return Number.isFinite(amount) ? String(Number(amount.toFixed(4))) : "0";
}

function percent(value) {
  if (value === Infinity) return "New";
  if (!Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, style: "percent" }).format(value);
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

function parseDateValue(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && window.XLSX?.SSF) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10);
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((date.getTime() - localToday.getTime()) / 86400000);
}

function textValue(row, names, fallback = "") {
  const key = findColumn(row, names);
  return String(row[key] || "").trim() || fallback;
}

function amountValue(row, names) {
  const key = findColumn(row, names);
  return parseAmount(row[key]);
}

function rowText(row, names, fallback = "") {
  return textValue(row, names, fallback);
}

function rowAmount(row, names) {
  return amountValue(row, names);
}

function rowValue(row, names) {
  const key = findColumn(row, names);
  return row[key];
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
  const sheets = await readWorkbook(file);
  return Object.values(sheets)[0] || [];
}

async function readWorkbook(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "csv") {
    return { Sheet1: parseCsv(await file.text()) };
  }

  if (!window.XLSX) {
    throw new Error("Excel support is still loading. Try again in a moment, or upload CSV.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  return Object.fromEntries(
    workbook.SheetNames.map((sheetName) => [
      sheetName,
      XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" }),
    ]),
  );
}

async function readWorkbookRaw(file) {
  if (!window.XLSX) {
    throw new Error("Excel support is still loading. Try again in a moment.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return Object.fromEntries(
    workbook.SheetNames.map((sheetName) => [
      sheetName,
      XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true }),
    ]),
  );
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

function monthKey(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  if (key === "Unknown") return "Unknown";
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
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
    profitabilitySku: els.profitabilitySku?.value,
    profitabilityApi: els.profitabilityApi?.value,
    profitabilityMaterial: els.profitabilityMaterial?.value,
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
  if (els.profitabilitySku) {
    const skuOptions = skuSummaryRows()
      .sort((a, b) => a.formula.localeCompare(b.formula))
      .map((sku) => `<option value="${escapeHtml(sku.formula)}">${escapeHtml(sku.formula)} (${money(sku.costPerGram || sku.unitCost)}/gm)</option>`)
      .join("");
    const apiOptions = state.apiCosts
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((api) => `<option value="${api.id}">${escapeHtml(api.name)} (${money(api.cost)})</option>`)
      .join("");
    const materialOptions = state.materialCosts
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((material) => `<option value="${material.id}">${escapeHtml(material.name)} (${money(material.cost)})</option>`)
      .join("");
    els.profitabilitySku.innerHTML = `<option value="">No SKU selected</option>${skuOptions}`;
    els.profitabilityApi.innerHTML = apiOptions || `<option value="">No APIs saved</option>`;
    els.profitabilityMaterial.innerHTML = materialOptions || `<option value="">No materials saved</option>`;
  }

  restoreSelect(els.repSelect, current.repSelect, state.reps[0].id);
  restoreSelect(els.clinicRep, current.clinicRep, state.reps[0].id);
  restoreSelect(els.brandRep, current.brandRep, state.reps[0].id);
  restoreSelect(els.brandSelect, current.brandSelect, AUTO);
  restoreSelect(els.clinicSelect, current.clinicSelect, AUTO);
  restoreSelect(els.filterRep, current.filterRep, "all");
  restoreSelect(els.filterBrand, current.filterBrand, "all");
  restoreSelect(els.filterClinic, current.filterClinic, "all");
  restoreSelect(els.viewFilter, current.viewFilter, "all");
  if (els.profitabilitySku) {
    restoreSelect(els.profitabilitySku, current.profitabilitySku, "");
    restoreSelect(els.profitabilityApi, current.profitabilityApi, els.profitabilityApi.options[0]?.value || "");
    restoreSelect(els.profitabilityMaterial, current.profitabilityMaterial, els.profitabilityMaterial.options[0]?.value || "");
  }
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
    ctx.fillStyle = "#837f78";
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
    ctx.fillStyle = "#837f78";
    ctx.fillText(label, 0, y);
    ctx.fillStyle = color;
    ctx.fillRect(left, y - 10, barWidth, 20);

    const outsideX = left + barWidth + 8;
    if (outsideX + valueWidth <= width - right) {
      ctx.fillStyle = "#211f54";
      ctx.fillText(valueLabel, outsideX, y);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "right";
      ctx.fillText(valueLabel, left + barWidth - 6, y);
      ctx.textAlign = "left";
    }
  });
}

function drawTrendChart(canvas, months, brandSeries) {
  canvas.style.height = "320px";
  const { ctx, width, height } = resizeCanvas(canvas);
  ctx.clearRect(0, 0, width, height);

  const chartBrands = brandSeries.slice(0, 6);
  const left = 48;
  const right = 18;
  const top = 20;
  const bottom = 54;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const max = Math.max(...chartBrands.flatMap((brand) => months.map((month) => brand.months[month] || 0)), 1);
  const colors = ["#4a3aff", "#6b9071", "#211f54", "#9b91ff", "#a7c796", "#5b5890"];

  ctx.font = "12px system-ui, sans-serif";
  ctx.textBaseline = "middle";

  if (!months.length || !chartBrands.length) {
    ctx.fillStyle = "#837f78";
    ctx.fillText("No brand trend data yet", 16, 32);
    return;
  }

  ctx.strokeStyle = "#ddd6c9";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, top + chartHeight);
  ctx.lineTo(left + chartWidth, top + chartHeight);
  ctx.stroke();

  months.forEach((month, index) => {
    const x = left + (chartWidth * index) / Math.max(months.length - 1, 1);
    ctx.fillStyle = "#837f78";
    ctx.textAlign = "center";
    ctx.fillText(monthLabel(month), x, top + chartHeight + 22);
  });
  ctx.textAlign = "left";

  chartBrands.forEach((brand, brandIndex) => {
    ctx.strokeStyle = colors[brandIndex % colors.length];
    ctx.fillStyle = colors[brandIndex % colors.length];
    ctx.lineWidth = 2;
    ctx.beginPath();

    months.forEach((month, monthIndex) => {
      const x = left + (chartWidth * monthIndex) / Math.max(months.length - 1, 1);
      const y = top + chartHeight - ((brand.months[month] || 0) / max) * chartHeight;
      if (monthIndex === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    months.forEach((month, monthIndex) => {
      const x = left + (chartWidth * monthIndex) / Math.max(months.length - 1, 1);
      const y = top + chartHeight - ((brand.months[month] || 0) / max) * chartHeight;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const legendX = left + (brandIndex % 2) * Math.max(160, chartWidth / 2);
    const legendY = 14 + Math.floor(brandIndex / 2) * 18;
    ctx.fillRect(legendX, legendY - 5, 10, 10);
    ctx.fillStyle = "#211f54";
    ctx.fillText(fitText(ctx, brand.name, 130), legendX + 15, legendY);
  });
}

function renderBrandTrend(rows) {
  const brandRows = rows.filter((row) => row.brandId !== NO_BRAND);
  const monthSet = new Set(brandRows.map((row) => monthKey(row.startDate)));
  const months = [...monthSet].filter((month) => month !== "Unknown").sort().slice(-6);
  const currentMonth = months[months.length - 1];
  const previousMonth = months[months.length - 2];
  const brandMap = new Map();

  brandRows.forEach((row) => {
    const month = monthKey(row.startDate);
    if (month === "Unknown") return;
    const brand = getBrand(row.brandId).name;
    if (!brandMap.has(brand)) brandMap.set(brand, { name: brand, months: {}, total: 0 });
    const item = brandMap.get(brand);
    item.months[month] = (item.months[month] || 0) + row.revenue;
    item.total += row.revenue;
  });

  const brandSeries = [...brandMap.values()].sort((a, b) => b.total - a.total);
  drawTrendChart(els.brandTrendChart, months, brandSeries);

  els.previousMonthHeader.textContent = previousMonth ? monthLabel(previousMonth) : "Previous Month";
  els.currentMonthHeader.textContent = currentMonth ? monthLabel(currentMonth) : "Current Month";
  els.brandTrendNote.textContent = months.length ? `${monthLabel(months[0])} to ${monthLabel(months[months.length - 1])}` : "Month over month";

  els.brandTrendTable.innerHTML =
    currentMonth && brandSeries.length
      ? brandSeries
          .map((brand) => {
            const previous = previousMonth ? brand.months[previousMonth] || 0 : 0;
            const current = brand.months[currentMonth] || 0;
            const change = current - previous;
            const changePct = previous ? change / previous : current ? Infinity : 0;
            return `<tr>
              <td>${escapeHtml(brand.name)}</td>
              <td class="number">${money(previous)}</td>
              <td class="number">${money(current)}</td>
              <td class="number">${money(change)}</td>
              <td class="number">${percent(changePct)}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td class="empty" colspan="5">Upload brand reports across multiple months to see trends.</td></tr>`;
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
  drawBarChart(els.brandChart, brandItems, "revenue", "#4a3aff");
  drawBarChart(els.clinicChart, clinicItems, "revenue", "#6b9071");
  drawBarChart(els.repChart, repItems, "commission", "#211f54");
  renderBrandTrend(rows);
}

function renderCostTables() {
  els.apiCostTable.innerHTML = state.apiCosts.length
    ? state.apiCosts
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => `<tr>
          <td>${escapeHtml(item.name)}</td>
          <td class="number">${money(item.cost)}</td>
          <td>${escapeHtml(item.unit || "unit")}</td>
          <td><button class="small ghost" data-add-api="${item.id}" type="button">Add</button></td>
        </tr>`)
        .join("")
    : `<tr><td class="empty" colspan="4">Upload API cost data to build ingredient pricing.</td></tr>`;

  const skuRows = skuSummaryRows();
  els.skuCostTable.innerHTML = skuRows.length
    ? skuRows
        .slice()
        .sort((a, b) => a.formula.localeCompare(b.formula))
        .map((item) => {
          const key = normalizeKey(item.formula);
          const isExpanded = expandedSkus.has(key);
          const ingredients = Array.isArray(item.ingredients) ? item.ingredients : [];
          const detailRows = ingredients.length
            ? ingredients
                .map((ingredient) => `<tr>
                  <td>${escapeHtml(ingredient.api || "")}</td>
                  <td class="number">${number(ingredient.quantity)}</td>
                  <td>${escapeHtml(ingredient.units || "")}</td>
                  <td class="number">${money(ingredient.total)}</td>
                  <td class="number">${money(ingredient.unitCost)}</td>
                </tr>`)
                .join("")
            : `<tr><td class="empty" colspan="5">No ingredient detail saved for this SKU.</td></tr>`;
          return `<tr>
          <td>
            <button class="link-toggle" data-toggle-sku="${key}" type="button" aria-expanded="${isExpanded}">
              <span>${isExpanded ? "v" : ">"}</span>
              ${escapeHtml(item.formula || "")}
            </button>
          </td>
          <td class="number">${money(item.total)}</td>
          <td class="number">${money(item.unitCost)}</td>
          <td class="number">${money(item.costPerGram)}</td>
        </tr>
        ${isExpanded ? `<tr class="sku-detail-row">
          <td colspan="4">
            <div class="sku-detail">
              <table>
                <thead>
                  <tr>
                    <th>API / Ingredient</th>
                    <th class="number">Quantity</th>
                    <th>Units</th>
                    <th class="number">Total Cost</th>
                    <th class="number">Unit Cost</th>
                  </tr>
                </thead>
                <tbody>${detailRows}</tbody>
              </table>
            </div>
          </td>
        </tr>` : ""}`;
        })
        .join("")
    : `<tr><td class="empty" colspan="4">Upload SKU cost data to see complete formula costs.</td></tr>`;

  els.materialCostTable.innerHTML = state.materialCosts.length
    ? state.materialCosts
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => `<tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.category || "Material")}</td>
          <td class="number">${money(item.cost)}</td>
          <td>${escapeHtml(item.unit || "unit")}</td>
          <td><button class="small ghost" data-add-material="${item.id}" type="button">Add</button></td>
        </tr>`)
        .join("")
    : `<tr><td class="empty" colspan="5">Upload material cost data to include supplies in compound pricing.</td></tr>`;
}

function renderBuilder() {
  const apis = selectedApis();
  const materials = selectedMaterials();
  const batchGrams = builderBatchQuantity();
  const apiTotal = sumApiIngredientCosts(apis, builderState.apiQuantities, batchGrams);
  const materialTotal = sum(materials, "cost");
  const items = [
    ...apis.map((item) => ({ ...item, kind: "API", removeAttr: "data-remove-api", unitCost: parseAmount(item.cost), cost: apiIngredientCost(item, builderState.apiQuantities, batchGrams) })),
    ...materials.map((item) => ({ ...item, kind: "Material", removeAttr: "data-remove-material", cost: parseAmount(item.cost) })),
  ];

  els.builderApiTotal.textContent = money(apiTotal);
  els.builderMaterialTotal.textContent = money(materialTotal);
  els.builderGrandTotal.textContent = money(apiTotal + materialTotal);
  els.materialBuilderApiTotal.textContent = money(apiTotal);
  els.materialBuilderMaterialTotal.textContent = money(materialTotal);
  els.materialBuilderGrandTotal.textContent = money(apiTotal + materialTotal);
  const selectionHtml = items.length
    ? items
        .map((item) => `<div class="builder-item">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.kind)} · ${escapeHtml(item.unit || "unit")}${item.kind === "API" ? ` · ${money(item.unitCost)} per unit` : ""}</span>
          </div>
          ${item.kind === "API" ? `<label class="builder-quantity">
            Qty per 100gm
            <input data-builder-api-qty="${item.id}" type="number" min="0" step="0.0001" value="${amountInputValue(builderApiQuantity(item.id))}">
          </label>` : "<span></span>"}
          <span>${money(item.cost)}</span>
          <button class="small danger" ${item.removeAttr}="${item.id}" type="button">Remove</button>
        </div>`)
        .join("")
    : `<div class="empty">Click API ingredients and materials to build a compound cost.</div>`;
  els.builderSelections.innerHTML = selectionHtml;
  els.materialBuilderSelections.innerHTML = selectionHtml;
}

function renderPricing() {
  renderCostTables();
  renderBuilder();
}

function renderCogs() {
  const rxRows = state.cogs?.rxPrescriptions || [];
  const contractRows = state.cogs?.contractOrders || [];
  const assumptions = state.cogs?.assumptions || DEFAULT_COGS_ASSUMPTIONS;

  if (els.cogsAssumptionFields) {
    els.cogsAssumptionFields.innerHTML = COGS_ASSUMPTION_ROWS.map(([key, label, unit]) => `<label>
      ${escapeHtml(label)}
      <input data-assumption="${key}" data-unit="${escapeHtml(unit)}" type="number" step="0.0001" value="${assumptionInputValue(key, assumptions[key])}">
      <span>${escapeHtml(unit)}</span>
    </label>`).join("");
  }

  if (els.cogsAssumptionsTable) {
    els.cogsAssumptionsTable.innerHTML = COGS_ASSUMPTION_ROWS.map(([key, label, unit, notes]) => `<tr>
      <td>${escapeHtml(label)}</td>
      <td class="number">${unit === "%" ? percent(assumptions[key]) : number(assumptions[key])}</td>
      <td>${escapeHtml(unit)}</td>
      <td>${escapeHtml(notes)}</td>
    </tr>`).join("");
  }

  if (els.profitabilityMarginFloor && !parseAmount(els.profitabilityMarginFloor.value)) {
    els.profitabilityMarginFloor.value = amountInputValue((assumptions.marginFloor ?? DEFAULT_COGS_ASSUMPTIONS.marginFloor) * 100);
  }

  renderProfitabilityBuilder();

  els.cogsRxTable.innerHTML = rxRows.length
    ? rxRows.map((row) => `<tr>
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.skuId)}</td>
        <td class="number">${money(row.revenue)}</td>
        <td class="number">${money(row.totalCogs)}</td>
        <td class="number">${money(row.grossProfit)}</td>
        <td class="number">${percent(row.grossMargin)}</td>
      </tr>`).join("")
    : `<tr><td class="empty" colspan="7">Rx profitability rows will appear after import.</td></tr>`;

  els.cogsContractTable.innerHTML = contractRows.length
    ? contractRows.map((row) => `<tr>
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.client)}</td>
        <td>${escapeHtml(row.skuId)}</td>
        <td class="number">${money(row.revenue)}</td>
        <td class="number">${money(row.totalCogs)}</td>
        <td class="number">${percent(row.grossMargin)}</td>
      </tr>`).join("")
    : `<tr><td class="empty" colspan="7">Contract profitability rows will appear after import.</td></tr>`;
}

function statusClass(status) {
  const key = normalizeKey(status);
  if (key.includes("expired")) return "danger";
  if (key.includes("expiring")) return "warning";
  if (key.includes("reorder")) return "warning";
  return "ok";
}

function assumptionInputValue(key, value) {
  if (key === "indirectLaborRate" || key === "wasteFactor" || key === "marginFloor") return Number(value || 0) * 100;
  return Number(value || 0);
}

function normalizeAssumptionInput(key, value) {
  const amount = parseAmount(value);
  if (key === "indirectLaborRate" || key === "wasteFactor" || key === "marginFloor") return amount / 100;
  return amount;
}

function selectedProfitApis() {
  return state.apiCosts.filter((item) => profitabilityState.apis.has(item.id));
}

function selectedProfitMaterials() {
  return state.materialCosts.filter((item) => profitabilityState.materials.has(item.id));
}

function selectedProfitSku() {
  const formula = els.profitabilitySku?.value || "";
  return skuSummaryRows().find((item) => normalizeKey(item.formula) === normalizeKey(formula)) || null;
}

function profitabilityMarginFloor() {
  const inputValue = parseAmount(els.profitabilityMarginFloor?.value);
  const assumptionValue = state.cogs?.assumptions?.marginFloor ?? DEFAULT_COGS_ASSUMPTIONS.marginFloor;
  return inputValue ? inputValue / 100 : assumptionValue;
}

function calculateProfitabilityScenario() {
  const assumptions = state.cogs?.assumptions || DEFAULT_COGS_ASSUMPTIONS;
  const stream = els.profitabilityStream?.value || "rx";
  const quantity = parseAmount(els.profitabilityQuantity?.value);
  const price = parseAmount(els.profitabilityRevenue?.value);
  const revenue = stream === "contract" ? quantity * price : price;
  const laborHours = parseAmount(els.profitabilityLaborHours?.value);
  const sku = selectedProfitSku();
  const extraApis = selectedProfitApis();
  const extraMaterials = selectedProfitMaterials();
  const skuUnitCost = parseAmount(sku?.costPerGram || sku?.unitCost);
  const apiCost = sumApiIngredientCosts(extraApis, profitabilityState.apiQuantities, quantity);
  const directMaterials = quantity * skuUnitCost + apiCost + sum(extraMaterials, "cost");
  const directLabor = laborHours * (stream === "contract" ? assumptions.contractLaborRate : assumptions.rxLaborRate);
  const indirectLabor = directLabor * assumptions.indirectLaborRate;
  const qaCost = stream === "contract" ? quantity * assumptions.qaContract : assumptions.qaRx;
  const packaging = stream === "contract" ? quantity * assumptions.packagingContract : assumptions.packagingRx;
  const overheadBase = cogsOverheadTotal(assumptions);
  const overhead = stream === "contract"
    ? quantity * overheadBase / (assumptions.contractOverheadUnits || 1)
    : overheadBase / (assumptions.rxOverheadUnits || 1);
  const waste = directMaterials * assumptions.wasteFactor;
  const totalCogs = directMaterials + directLabor + indirectLabor + qaCost + packaging + overhead + waste;
  const grossProfit = revenue - totalCogs;
  const grossMargin = revenue ? grossProfit / revenue : 0;
  const marginFloor = profitabilityMarginFloor();
  return {
    stream,
    sku,
    quantity,
    price,
    revenue,
    directMaterials,
    directLabor,
    indirectLabor,
    qaCost,
    packaging,
    overhead,
    waste,
    totalCogs,
    grossProfit,
    grossMargin,
    marginFloor,
    marginStatus: revenue ? (grossMargin >= marginFloor ? "MARGIN OK" : "BELOW FLOOR") : "NO PRICE",
  };
}

function renderProfitabilityBuilder() {
  if (!els.profitRevenue) return;
  const result = profitabilityState.result || calculateProfitabilityScenario();
  els.profitRevenue.textContent = money(result.revenue);
  els.profitCogs.textContent = money(result.totalCogs);
  els.profitGrossProfit.textContent = money(result.grossProfit);
  els.profitGrossMargin.textContent = percent(result.grossMargin);
  els.profitGrossMargin.closest(".metric")?.classList.toggle("danger-metric", result.marginStatus === "BELOW FLOOR");
  els.profitGrossProfit.closest(".metric")?.classList.toggle("danger-metric", result.grossProfit < 0);
  if (els.profitabilityStatus) {
    const streamLabel = result.stream === "contract" ? "Contract" : "Rx";
    els.profitabilityStatus.textContent = result.marginStatus === "NO PRICE"
      ? "Enter a selling price to check the margin floor."
      : `${streamLabel} ${result.marginStatus}: ${percent(result.grossMargin)} margin vs ${percent(result.marginFloor)} floor.`;
    els.profitabilityStatus.classList.toggle("danger-text", result.marginStatus === "BELOW FLOOR");
  }

  const selectedItems = [
    ...(result.sku ? [{ id: "sku", name: result.sku.formula, kind: "SKU", cost: result.quantity * parseAmount(result.sku.costPerGram || result.sku.unitCost), unit: "grams" }] : []),
    ...selectedProfitApis().map((item) => ({
      ...item,
      kind: "API",
      removeAttr: "data-remove-profit-api",
      unitCost: parseAmount(item.cost),
      cost: apiIngredientCost(item, profitabilityState.apiQuantities, result.quantity),
    })),
    ...selectedProfitMaterials().map((item) => ({ ...item, kind: "Material", removeAttr: "data-remove-profit-material", cost: parseAmount(item.cost) })),
  ];
  els.profitabilitySelections.innerHTML = selectedItems.length
    ? selectedItems.map((item) => `<div class="builder-item">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.kind)} · ${escapeHtml(item.unit || "unit")}${item.kind === "API" ? ` · ${money(item.unitCost)} per unit` : ""}</span>
        </div>
        ${item.kind === "API" ? `<label class="builder-quantity">
          Qty per 100gm
          <input data-profit-api-qty="${item.id}" type="number" min="0" step="0.0001" value="${amountInputValue(profitApiQuantity(item.id))}">
        </label>` : "<span></span>"}
        <span>${money(item.cost)}</span>
        ${item.removeAttr ? `<button class="small danger" ${item.removeAttr}="${item.id}" type="button">Remove</button>` : "<span></span>"}
      </div>`).join("")
    : `<div class="empty">Select a SKU or add APIs/materials to model profitability.</div>`;

  const rows = [
    ["Direct Materials", result.directMaterials],
    ["Direct Labor", result.directLabor],
    ["Indirect Labor", result.indirectLabor],
    ["QA / Testing", result.qaCost],
    ["Packaging", result.packaging],
    ["Overhead", result.overhead],
    ["Waste / Spoilage", result.waste],
  ];
  els.profitBreakdownTable.innerHTML = rows.map(([label, amount]) => `<tr>
    <td>${escapeHtml(label)}</td>
    <td class="number">${money(amount)}</td>
  </tr>`).join("");
}

function render() {
  renderOptions();
  renderLists();
  const rows = rowsForFilters();
  renderMetrics(rows);
  renderTables(rows);
  renderCharts(rows);
  renderPricing();
  renderCogs();
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

function normalizeApiCosts(rows) {
  return rows.flatMap((row) => {
    const name = textValue(row, ["API", "API Name", "Ingredient", "Ingredient Name", "Drug", "Drug Name", "Item", "Name"]);
    const cost = amountValue(row, ["Cost", "API Cost", "Price", "Unit Cost", "Ingredient Cost"]);
    if (!name || !cost) return [];
    return [{
      id: crypto.randomUUID(),
      name,
      cost,
      unit: textValue(row, ["Units", "Unit", "UOM", "Measure", "Per"], "unit"),
      notes: textValue(row, ["Notes", "Description"]),
    }];
  });
}

function normalizeSkuCosts(rows) {
  return rows.flatMap((row) => {
    const formula = textValue(row, ["SKU", "SKU Name", "Formula", "Formula Name", "Product", "Name"]);
    const total = amountValue(row, ["Total", "Totals", "Cost", "SKU Cost", "Formula Cost", "Price"]);
    const unitCost = amountValue(row, ["Unit Cost", "Cost Per Unit"]);
    const costPerGram = amountValue(row, ["Cost Per Gram", "Cost / Gram", "Per Gram"]) || total / SKU_BATCH_GRAMS;
    if (!formula || (!total && !unitCost)) return [];
    return [{
      id: crypto.randomUUID(),
      formula,
      total,
      unitCost,
      costPerGram,
      ingredients: [],
    }];
  });
}

function normalizeFormulaSheet(rows) {
  const formulas = new Map();
  let currentFormula = "";

  function ensureFormula(name) {
    const formula = String(name || "").trim();
    if (!formula) return null;
    const key = normalizeKey(formula);
    if (!formulas.has(key)) {
      formulas.set(key, {
        id: crypto.randomUUID(),
        formula,
        total: 0,
        unitCost: 0,
        costPerGram: 0,
        ingredients: [],
      });
    }
    return formulas.get(key);
  }

  rows.forEach((row) => {
    const keys = Object.keys(row);
    const values = Object.values(row);
    const first = String(values[0] || "").trim();
    const second = String(values[1] || "").trim();
    const third = String(values[2] || "").trim();
    const fourth = values[3];
    const fifth = values[4];

    if (!first) return;

    if (!currentFormula && normalizeKey(keys[1]) === "qty") {
      currentFormula = String(keys[0] || "").trim();
      ensureFormula(currentFormula);
    }

    if (normalizeKey(second) === "qty") {
      currentFormula = first;
      ensureFormula(currentFormula);
      return;
    }

    if (!second && !third && !fourth && !fifth) {
      currentFormula = first;
      ensureFormula(currentFormula);
      return;
    }

    if (!currentFormula) return;

    const total = parseAmount(fourth);
    const unitCost = parseAmount(fifth);
    const quantity = parseAmount(second);
    if (!total && !unitCost) return;

    const record = ensureFormula(currentFormula);
    record.total += total;
    record.unitCost += unitCost;
    record.ingredients.push({
      api: first,
      quantity,
      units: third,
      total,
      unitCost,
    });
  });

  return [...formulas.values()]
    .filter((record) => record.total || record.unitCost)
    .map((record) => ({
      ...record,
      costPerGram: record.total / SKU_BATCH_GRAMS,
    }));
}

function normalizeMaterialCosts(rows) {
  return rows.flatMap((row) => {
    const name = textValue(row, ["Material", "Material Name", "Supply", "Item", "Name", "Type"]);
    const cost = amountValue(row, ["Cost", "Material Cost", "Price", "Unit Cost"]);
    if (!name || !cost) return [];
    return [{
      id: crypto.randomUUID(),
      name,
      category: textValue(row, ["Category", "Type", "Group"], "Material"),
      cost,
      unit: textValue(row, ["Unit", "UOM", "Measure", "Per"], "unit"),
      notes: textValue(row, ["Notes", "Description"]),
    }];
  });
}

function upsertCosts(collection, records) {
  const byName = new Map(state[collection].map((item) => [normalizeKey(item.name), item]));
  records.forEach((record) => {
    const key = normalizeKey(record.name);
    if (byName.has(key)) {
      Object.assign(byName.get(key), record, { id: byName.get(key).id });
    } else {
      state[collection].push(record);
    }
  });
}

function upsertSkuCosts(records) {
  records.forEach((record) => {
    const key = normalizeKey(record.formula);
    const existing = state.skuCosts.find((item) => normalizeKey(item.formula) === key);
    state.skuCosts = state.skuCosts.filter((item) => normalizeKey(item.formula) !== key);
    state.skuCosts.push({ ...record, id: existing?.id || record.id });
  });
}

function skuSummaryRows() {
  const byFormula = new Map();
  state.skuCosts.forEach((item) => {
    const formula = String(item.formula || "").trim();
    if (!formula) return;
    const key = normalizeKey(formula);
    if (!byFormula.has(key)) {
      byFormula.set(key, { formula, total: 0, unitCost: 0, costPerGram: 0, ingredients: [] });
    }
    const record = byFormula.get(key);
    record.total += parseAmount(item.total);
    record.unitCost += parseAmount(item.unitCost);
    record.costPerGram += parseAmount(item.costPerGram);
    if (Array.isArray(item.ingredients) && item.ingredients.length) {
      record.ingredients.push(...item.ingredients);
    } else if (item.api) {
      record.ingredients.push({
        api: item.api,
        quantity: parseAmount(item.quantity),
        units: item.units || "",
        total: parseAmount(item.total),
        unitCost: parseAmount(item.unitCost),
      });
    }
  });
  return [...byFormula.values()].map((record) => ({
    ...record,
    costPerGram: record.costPerGram || record.total / SKU_BATCH_GRAMS,
  }));
}

function sheetRows(rawRows, marker) {
  const headerIndex = rawRows.findIndex((row) => row.some((cell) => normalizeKey(cell) === normalizeKey(marker)));
  if (headerIndex < 0) return [];
  const headers = rawRows[headerIndex].map((header) => String(header || "").replace(/\s+/g, " ").trim());
  return rawRows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header || `Column ${index + 1}`, row[index] ?? ""])));
}

function assumptionFromLabel(label) {
  const key = normalizeKey(label);
  if (key.includes("directlaborrx")) return "rxLaborRate";
  if (key.includes("directlaborcontract")) return "contractLaborRate";
  if (key.includes("indirectlabor")) return "indirectLaborRate";
  if (key.includes("monthlyrent")) return "monthlyRent";
  if (key.includes("monthlyutilities")) return "monthlyUtilities";
  if (key.includes("monthlydepreciation")) return "monthlyDepreciation";
  if (key.includes("monthlymarketing")) return "monthlyMarketing";
  if (key.includes("software") || key.includes("license")) return "monthlySoftware";
  if (key.includes("othermonthly")) return "monthlyOther";
  if (key.includes("rxunits")) return "rxOverheadUnits";
  if (key.includes("contractunits")) return "contractOverheadUnits";
  if (key.includes("waste")) return "wasteFactor";
  if (key.includes("testingcostperbatchrx")) return "qaRx";
  if (key.includes("testingcostperbatchcontract")) return "qaContract";
  if (key.includes("packagingcostperunitrx")) return "packagingRx";
  if (key.includes("packagingcostperunitcontract")) return "packagingContract";
  if (key.includes("marginfloor") || key.includes("targetmargin")) return "marginFloor";
  return "";
}

function normalizeCogsAssumptions(rawRows) {
  const assumptions = { ...DEFAULT_COGS_ASSUMPTIONS };
  rawRows.forEach((row) => {
    const key = assumptionFromLabel(row[0]);
    if (key) assumptions[key] = parseAmount(row[1]);
  });
  return assumptions;
}

function materialStatus(item) {
  if (item.daysToExpiry !== null && item.daysToExpiry < 0) return "Expired";
  if (item.daysToExpiry !== null && item.daysToExpiry <= EXPIRY_WARNING_DAYS) return "Expiring soon";
  if (item.qtyOnHand <= item.reorderPoint) return "Reorder";
  return "OK";
}

function normalizeCogsInventoryItem(item) {
  const normalized = {
    id: String(item.id || crypto.randomUUID()).trim(),
    name: String(item.name || "").trim(),
    type: String(item.type || "").trim(),
    unit: String(item.unit || "").trim(),
    qtyOnHand: parseAmount(item.qtyOnHand),
    reorderPoint: parseAmount(item.reorderPoint),
    unitCost: parseAmount(item.unitCost),
    vendor: String(item.vendor || "").trim(),
    lotNumber: String(item.lotNumber || "").trim(),
    expiryDate: item.expiryDate || "",
  };
  normalized.daysToExpiry = daysUntil(normalized.expiryDate);
  normalized.totalValue = normalized.qtyOnHand * normalized.unitCost;
  normalized.status = materialStatus(normalized);
  return normalized;
}

function normalizeCogsInventory(rawRows) {
  return sheetRows(rawRows, "Material ID").map((row) => {
    const expiryDate = parseDateValue(rowValue(row, ["BUD (Expiry Date)", "BUD / Expiry Date", "Expiry Date"]));
    return normalizeCogsInventoryItem({
      id: rowText(row, ["Material ID"], crypto.randomUUID()),
      name: rowText(row, ["Material Name"]),
      type: rowText(row, ["Type"]),
      unit: rowText(row, ["UoM", "UOM", "Unit"]),
      qtyOnHand: rowAmount(row, ["Qty On Hand", "Quantity On Hand"]),
      reorderPoint: rowAmount(row, ["Reorder Point"]),
      unitCost: rowAmount(row, ["Unit Cost ($)", "Unit Cost"]),
      vendor: rowText(row, ["Vendor"]),
      lotNumber: rowText(row, ["Lot Number"]),
      expiryDate,
    });
  }).filter((item) => item.id && item.name);
}

function buildCogsSku(record, inventory) {
  const inventoryById = new Map(inventory.map((item) => [normalizeKey(item.id), item]));
  const ingredients = (record.ingredients || []).flatMap((ingredient) => {
    const materialId = String(ingredient.materialId || "").trim();
    const quantity = parseAmount(ingredient.quantity);
    if (!materialId || !quantity) return [];
    const material = inventoryById.get(normalizeKey(materialId));
    const cost = quantity * (material?.unitCost || 0);
    return [{
      materialId,
      materialName: material?.name || materialId,
      quantity,
      unit: material?.unit || "",
      unitCost: material?.unitCost || 0,
      cost,
    }];
  });
  const calculatedBatchCost = sum(ingredients, "cost");
  const batchCost = calculatedBatchCost || parseAmount(record.batchCost);
  const unitsPerBatch = parseAmount(record.unitsPerBatch);
  const unitCost = unitsPerBatch ? batchCost / unitsPerBatch : parseAmount(record.unitCost);
  return {
    id: String(record.id || "").trim(),
    productName: String(record.productName || "").trim(),
    type: String(record.type || "").trim(),
    dosageForm: String(record.dosageForm || "").trim(),
    batchSize: parseAmount(record.batchSize),
    batchUnit: String(record.batchUnit || "").trim(),
    ingredients,
    batchCost,
    unitsPerBatch,
    unitCost,
  };
}

function normalizeCogsSkuRegistry(rawRows, inventory) {
  return sheetRows(rawRows, "SKU ID").map((row) => {
    const ingredients = [];
    for (let index = 1; index <= 9; index += 1) {
      const materialId = rowText(row, [`Ing ${index} Mat ID`]);
      const quantity = rowAmount(row, [`Ing ${index} Qty`]);
      if (!materialId || !quantity) continue;
      ingredients.push({
        materialId,
        quantity,
      });
    }
    return buildCogsSku({
      id: rowText(row, ["SKU ID"]),
      productName: rowText(row, ["Product Name"]),
      type: rowText(row, ["Type (Rx/Contract)", "Type"]),
      dosageForm: rowText(row, ["Dosage Form"]),
      batchSize: rowAmount(row, ["Batch Size"]),
      batchUnit: rowText(row, ["Batch UoM", "Batch UOM"]),
      ingredients,
      batchCost: rowAmount(row, ["Mat Cost per Batch ($)", "Material Cost per Batch"]),
      unitsPerBatch: rowAmount(row, ["Units per Batch"]),
      unitCost: rowAmount(row, ["Mat Cost per Unit ($)", "Material Cost per Unit"]),
    }, inventory);
  }).filter((item) => item.id && item.productName);
}

function cogsOverheadTotal(assumptions) {
  return assumptions.monthlyRent + assumptions.monthlyUtilities + assumptions.monthlyDepreciation + assumptions.monthlyMarketing + assumptions.monthlySoftware + assumptions.monthlyOther;
}

function calculateRxCogs(row, sku, assumptions) {
  const quantity = parseAmount(row["Qty Dispensed"]);
  const revenue = parseAmount(row["Selling Price ($)"]);
  const laborHours = parseAmount(row["DL Hours"]);
  const materialCost = quantity * (sku?.unitCost || 0);
  const directLabor = laborHours * assumptions.rxLaborRate;
  const indirectLabor = directLabor * assumptions.indirectLaborRate;
  const qaCost = sku ? assumptions.qaRx : 0;
  const packaging = sku ? assumptions.packagingRx : 0;
  const overhead = sku ? cogsOverheadTotal(assumptions) / (assumptions.rxOverheadUnits || 1) : 0;
  const waste = materialCost * assumptions.wasteFactor;
  const totalCogs = materialCost + directLabor + indirectLabor + qaCost + packaging + overhead + waste;
  const grossProfit = revenue - totalCogs;
  return { quantity, revenue, laborHours, materialCost, directLabor, indirectLabor, qaCost, packaging, overhead, waste, totalCogs, grossProfit, grossMargin: revenue ? grossProfit / revenue : 0 };
}

function calculateContractCogs(row, sku, assumptions) {
  const units = parseAmount(row["Units Ordered"]);
  const unitPrice = parseAmount(row["Unit Price ($)"]);
  const laborHours = parseAmount(row["DL Hours (Total)"]);
  const revenue = units * unitPrice;
  const materialCost = units * (sku?.unitCost || 0);
  const directLabor = laborHours * assumptions.contractLaborRate;
  const indirectLabor = directLabor * assumptions.indirectLaborRate;
  const qaCost = sku ? units * assumptions.qaContract : 0;
  const packaging = sku ? units * assumptions.packagingContract : 0;
  const overhead = sku ? units * cogsOverheadTotal(assumptions) / (assumptions.contractOverheadUnits || 1) : 0;
  const waste = materialCost * assumptions.wasteFactor;
  const totalCogs = materialCost + directLabor + indirectLabor + qaCost + packaging + overhead + waste;
  const grossProfit = revenue - totalCogs;
  return { units, unitPrice, laborHours, revenue, materialCost, directLabor, indirectLabor, qaCost, packaging, overhead, waste, totalCogs, grossProfit, grossMargin: revenue ? grossProfit / revenue : 0 };
}

function preferProvidedCogs(row, calculated) {
  const provided = {
    materialCost: amountValue(row, ["Mat Cost ($)", "Material Cost"]),
    directLabor: amountValue(row, ["DL Cost ($)", "Direct Labor"]),
    indirectLabor: amountValue(row, ["Indirect Labor ($)", "Indirect Labor"]),
    qaCost: amountValue(row, ["QA Cost ($)", "QA Cost"]),
    packaging: amountValue(row, ["Pkg Cost ($)", "Packaging"]),
    overhead: amountValue(row, ["Overhead ($)", "Overhead per Unit ($)", "Overhead"]),
    waste: amountValue(row, ["Waste ($)", "Waste"]),
    totalCogs: amountValue(row, ["Total COGS ($)", "Total COGS"]),
    grossProfit: amountValue(row, ["Gross Profit ($)", "Gross Profit"]),
    grossMargin: amountValue(row, ["Gross Margin %", "Gross Margin"]),
  };
  const next = { ...calculated };
  Object.entries(provided).forEach(([key, value]) => {
    if (value) next[key] = value;
  });
  if (!provided.grossProfit && next.revenue) next.grossProfit = next.revenue - next.totalCogs;
  if (!provided.grossMargin && next.revenue) next.grossMargin = next.grossProfit / next.revenue;
  return next;
}

function normalizeCogsRx(rawRows, skuRegistry, assumptions) {
  const skuById = new Map(skuRegistry.map((sku) => [normalizeKey(sku.id), sku]));
  return sheetRows(rawRows, "Rx #").flatMap((row) => {
    const rxNumber = String(row["Rx #"] || "").trim();
    const skuId = String(row["SKU ID"] || "").trim();
    const revenue = parseAmount(row["Selling Price ($)"]);
    if (!rxNumber || !skuId || !revenue) return [];
    const sku = skuById.get(normalizeKey(skuId));
    return [{
      id: rxNumber,
      date: parseDateValue(row.Date),
      skuId,
      productName: sku?.productName || String(row["Product Name"] || "").trim(),
      ...preferProvidedCogs(row, calculateRxCogs(row, sku, assumptions)),
    }];
  });
}

function normalizeCogsContracts(rawRows, skuRegistry, assumptions) {
  const skuById = new Map(skuRegistry.map((sku) => [normalizeKey(sku.id), sku]));
  return sheetRows(rawRows, "Order #").flatMap((row) => {
    const orderNumber = String(row["Order #"] || "").trim();
    const skuId = String(row["SKU ID"] || "").trim();
    if (!orderNumber || !skuId || !parseAmount(row["Units Ordered"])) return [];
    const sku = skuById.get(normalizeKey(skuId));
    return [{
      id: orderNumber,
      date: parseDateValue(row.Date),
      client: String(row["Client / Facility"] || "").trim(),
      skuId,
      productName: sku?.productName || String(row["Product Name"] || "").trim(),
      ...preferProvidedCogs(row, calculateContractCogs(row, sku, assumptions)),
    }];
  });
}

function normalizeCogsWorkbook(sheets) {
  const assumptions = normalizeCogsAssumptions(findSheet(sheets, ["Assumptions"]));
  const inventory = normalizeCogsInventory(findSheet(sheets, ["Material Inventory"]));
  const skuRegistry = normalizeCogsSkuRegistry(findSheet(sheets, ["SKU Registry"]), inventory);
  const rxPrescriptions = normalizeCogsRx(findSheet(sheets, ["Rx Prescriptions"]), skuRegistry, assumptions);
  const contractOrders = normalizeCogsContracts(findSheet(sheets, ["Contract Orders"]), skuRegistry, assumptions);
  return { assumptions, inventory, skuRegistry, rxPrescriptions, contractOrders, importedAt: new Date().toISOString() };
}

function recalculateCogs() {
  const assumptions = state.cogs?.assumptions || { ...DEFAULT_COGS_ASSUMPTIONS };
  const inventory = (state.cogs?.inventory || []).map(normalizeCogsInventoryItem);
  const skuRegistry = (state.cogs?.skuRegistry || []).map((sku) => buildCogsSku(sku, inventory)).filter((sku) => sku.id && sku.productName);
  const skuById = new Map(skuRegistry.map((sku) => [normalizeKey(sku.id), sku]));
  const rxPrescriptions = (state.cogs?.rxPrescriptions || []).map((row) => {
    const sku = skuById.get(normalizeKey(row.skuId));
    return {
      ...row,
      productName: sku?.productName || row.productName || "",
      ...calculateRxCogs({ "Qty Dispensed": row.quantity, "Selling Price ($)": row.revenue, "DL Hours": row.laborHours }, sku, assumptions),
    };
  });
  const contractOrders = (state.cogs?.contractOrders || []).map((row) => {
    const sku = skuById.get(normalizeKey(row.skuId));
    return {
      ...row,
      productName: sku?.productName || row.productName || "",
      ...calculateContractCogs({ "Units Ordered": row.units, "Unit Price ($)": row.unitPrice, "DL Hours (Total)": row.laborHours }, sku, assumptions),
    };
  });
  state.cogs = { ...(state.cogs || {}), assumptions, inventory, skuRegistry, rxPrescriptions, contractOrders };
  syncCogsToPricing(state.cogs);
}

function cogsSummary() {
  const rx = state.cogs?.rxPrescriptions || [];
  const contracts = state.cogs?.contractOrders || [];
  const inventory = state.cogs?.inventory || [];
  const rxTotals = totalCogsRows(rx);
  const contractTotals = totalCogsRows(contracts);
  const totalRevenue = rxTotals.revenue + contractTotals.revenue;
  const totalCogs = rxTotals.totalCogs + contractTotals.totalCogs;
  const grossProfit = totalRevenue - totalCogs;
  const inventoryValue = sum(inventory, "totalValue");
  const expiryRisk = sum(inventory.filter((item) => item.daysToExpiry !== null && item.daysToExpiry <= EXPIRY_WARNING_DAYS), "totalValue");
  return { rxTotals, contractTotals, totalRevenue, totalCogs, grossProfit, grossMargin: totalRevenue ? grossProfit / totalRevenue : 0, inventoryValue, expiryRisk };
}

function totalCogsRows(rows) {
  return {
    revenue: sum(rows, "revenue"),
    materialCost: sum(rows, "materialCost"),
    directLabor: sum(rows, "directLabor"),
    indirectLabor: sum(rows, "indirectLabor"),
    qaCost: sum(rows, "qaCost"),
    packaging: sum(rows, "packaging"),
    overhead: sum(rows, "overhead"),
    waste: sum(rows, "waste"),
    totalCogs: sum(rows, "totalCogs"),
    grossProfit: sum(rows, "grossProfit"),
  };
}

function findSheet(sheets, candidates) {
  const entries = Object.entries(sheets);
  return entries.find(([name]) => candidates.some((candidate) => normalizeKey(name) === normalizeKey(candidate)))?.[1] || [];
}

function selectedApis() {
  return state.apiCosts.filter((item) => builderState.apis.has(item.id));
}

function selectedMaterials() {
  return state.materialCosts.filter((item) => builderState.materials.has(item.id));
}

function builderBatchQuantity() {
  return parseAmount(els.builderProfitQuantity?.value || els.materialBuilderProfitQuantity?.value) || SKU_BATCH_GRAMS;
}

function builderApiQuantity(id) {
  return parseAmount(builderState.apiQuantities.get(id) ?? 1);
}

function profitApiQuantity(id) {
  return parseAmount(profitabilityState.apiQuantities.get(id) ?? builderState.apiQuantities.get(id) ?? 1);
}

function apiIngredientCost(item, quantityMap, batchGrams) {
  const perHundredGrams = parseAmount(quantityMap.get(item.id) ?? 1);
  return parseAmount(item.cost) * perHundredGrams * (parseAmount(batchGrams) || 0) / SKU_BATCH_GRAMS;
}

function sumApiIngredientCosts(items, quantityMap, batchGrams) {
  return items.reduce((total, item) => total + apiIngredientCost(item, quantityMap, batchGrams), 0);
}

function activateTab(target) {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === target);
  });
  document.querySelectorAll(".tab-view").forEach((view) => {
    view.classList.toggle("active", view.dataset.tabView === target);
  });
  document.body.classList.toggle("home-active", target === "home");
}

function builderProfitFields(source) {
  const prefix = source === "material" ? "materialBuilderProfit" : "builderProfit";
  return {
    stream: els[`${prefix}Stream`],
    quantity: els[`${prefix}Quantity`],
    revenue: els[`${prefix}Revenue`],
    laborHours: els[`${prefix}LaborHours`],
  };
}

function syncBuilderProfitFields(source) {
  const activeFields = builderProfitFields(source);
  const mirrorFields = builderProfitFields(source === "material" ? "api" : "material");
  Object.keys(activeFields).forEach((key) => {
    if (activeFields[key] && mirrorFields[key]) mirrorFields[key].value = activeFields[key].value;
  });
}

function sendBuilderToProfitability(source) {
  syncBuilderProfitFields(source);
  const fields = builderProfitFields(source);
  profitabilityState.apis = new Set(builderState.apis);
  profitabilityState.materials = new Set(builderState.materials);
  profitabilityState.apiQuantities = new Map(builderState.apiQuantities);
  profitabilityState.result = null;

  if (els.profitabilitySku) els.profitabilitySku.value = "";
  if (els.profitabilityStream && fields.stream) els.profitabilityStream.value = fields.stream.value || "rx";
  if (els.profitabilityQuantity && fields.quantity) els.profitabilityQuantity.value = fields.quantity.value || "1";
  if (els.profitabilityRevenue && fields.revenue) els.profitabilityRevenue.value = fields.revenue.value || "";
  if (els.profitabilityLaborHours && fields.laborHours) els.profitabilityLaborHours.value = fields.laborHours.value || "0";

  profitabilityState.result = calculateProfitabilityScenario();
  renderProfitabilityBuilder();
  activateTab("profitability");
}

async function importCostFile({ file, normalizer, collection, statusEl, label }) {
  if (!file) {
    statusEl.textContent = `Choose a ${label} file first.`;
    return;
  }
  if (!(await requireCloudReady(statusEl))) return;

  const rows = await readFile(file);
  const records = normalizer(rows);
  upsertCosts(collection, records);
  statusEl.textContent = `Imported ${records.length} ${label} records.`;
  render();
  if (cloudReady) await saveCloudState();
}

async function importApiCostFile(file) {
  if (!file) {
    els.apiCostStatus.textContent = "Choose an API cost file first.";
    return;
  }
  if (!(await requireCloudReady(els.apiCostStatus))) return;

  const sheets = await readWorkbook(file);
  const apiRows = findSheet(sheets, ["DRUGS", "Drugs", "API", "API Cost"]) || Object.values(sheets)[0] || [];
  const formulaRows = findSheet(sheets, ["FORMULAS", "Formulas", "SKU", "SKU Cost"]);
  const materialRows = findSheet(sheets, ["Sheet3", "Materials", "Material Cost"]);
  const records = normalizeApiCosts(apiRows);
  upsertCosts("apiCosts", records);
  const skuRecords = formulaRows?.length ? normalizeFormulaSheet(formulaRows) : [];
  const materialRecords = materialRows?.length ? normalizeMaterialCosts(materialRows) : [];
  if (skuRecords.length) upsertSkuCosts(skuRecords);
  if (materialRecords.length) upsertCosts("materialCosts", materialRecords);
  els.apiCostStatus.textContent = skuRecords.length || materialRecords.length
    ? `Imported ${records.length} APIs, ${skuRecords.length} SKUs, and ${materialRecords.length} materials.`
    : `Imported ${records.length} API cost records.`;
  render();
  if (cloudReady) await saveCloudState();
}

async function importPricingWorkbook(file) {
  if (!file) {
    els.pricingWorkbookStatus.textContent = "Choose a pricing workbook first.";
    return;
  }
  if (!(await requireCloudReady(els.pricingWorkbookStatus))) return;

  const sheets = await readWorkbook(file);
  const apiRows = findSheet(sheets, ["DRUGS", "Drugs", "API", "API Cost"]);
  const formulaRows = findSheet(sheets, ["FORMULAS", "Formulas", "SKU", "SKU Cost"]);
  const materialRows = findSheet(sheets, ["Sheet3", "Materials", "Material Cost"]);
  const apiRecords = normalizeApiCosts(apiRows);
  const skuRecords = normalizeFormulaSheet(formulaRows);
  const materialRecords = normalizeMaterialCosts(materialRows);

  upsertCosts("apiCosts", apiRecords);
  upsertSkuCosts(skuRecords);
  upsertCosts("materialCosts", materialRecords);

  els.pricingWorkbookStatus.textContent = `Imported ${apiRecords.length} APIs, ${skuRecords.length} SKUs, and ${materialRecords.length} materials.`;
  render();
  if (cloudReady) await saveCloudState();
}

function syncCogsToPricing(cogs) {
  upsertCosts("materialCosts", cogs.inventory.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    category: item.type || "Material",
    cost: item.unitCost,
    unit: item.unit || "unit",
    notes: [item.id, item.vendor, item.lotNumber].filter(Boolean).join(" | "),
  })));

  upsertSkuCosts(cogs.skuRegistry.map((sku) => ({
    id: crypto.randomUUID(),
    formula: sku.id,
    total: sku.batchCost,
    unitCost: sku.unitCost,
    costPerGram: sku.batchUnit && normalizeKey(sku.batchUnit).includes("g") ? sku.batchCost / (sku.batchSize || SKU_BATCH_GRAMS) : sku.unitCost,
    ingredients: sku.ingredients.map((ingredient) => ({
      api: ingredient.materialName,
      quantity: ingredient.quantity,
      units: ingredient.unit,
      total: ingredient.cost,
      unitCost: ingredient.unitCost,
    })),
  })));
}

function upsertById(collection, record) {
  const key = normalizeKey(record.id);
  state.cogs[collection] = (state.cogs[collection] || []).filter((item) => normalizeKey(item.id) !== key);
  state.cogs[collection].push(record);
}

function parseSkuIngredientLines(text) {
  return String(text || "").split(/\n+/).flatMap((line) => {
    const [materialId, quantity] = line.split(",").map((part) => part.trim());
    if (!materialId || !parseAmount(quantity)) return [];
    return [{ materialId, quantity: parseAmount(quantity) }];
  });
}

async function finishCogsManualSave(statusEl, message) {
  recalculateCogs();
  statusEl.textContent = message;
  render();
  if (cloudReady) await saveCloudState();
}

async function importCogsWorkbook(file) {
  if (!file) {
    els.cogsWorkbookStatus.textContent = "Choose a COGS workbook first.";
    return;
  }
  if (!(await requireCloudReady(els.cogsWorkbookStatus))) return;

  const sheets = await readWorkbookRaw(file);
  const cogs = normalizeCogsWorkbook(sheets);
  state.cogs = cogs;
  syncCogsToPricing(cogs);
  els.cogsWorkbookStatus.textContent = `Imported ${cogs.inventory.length} materials, ${cogs.skuRegistry.length} SKUs, ${cogs.rxPrescriptions.length} Rx rows, and ${cogs.contractOrders.length} contract rows.`;
  render();
  if (cloudReady) await saveCloudState();
}

els.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = els.fileInput.files[0];
  if (!file) return;

  try {
    if (!(await requireCloudReady(els.uploadStatus))) return;
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
    render();
    if (cloudReady) {
      await saveCloudState();
      els.uploadStatus.textContent = `Imported ${rows.length} rows from ${file.name} and saved to cloud.`;
    } else {
      els.uploadStatus.textContent = `Imported ${rows.length} rows from ${file.name}.`;
    }
    els.uploadForm.reset();
  } catch (error) {
    els.uploadStatus.textContent = `Import failed: ${error.message}`;
  }
});

els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files[0];
  if (!file) return;
  els.reportName.value = file.name.replace(/\.(csv|xlsx|xls)$/i, "");
});

els.repForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.repName.value.trim();
  if (!name) return;
  if (!(await requireCloudReady(els.authStatus))) return;
  state.reps.push({ id: crypto.randomUUID(), name, rate: parseAmount(els.repRate.value) });
  els.repForm.reset();
  render();
});

els.brandForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.brandName.value.trim();
  if (!name) {
    els.brandStatus.textContent = "Enter a brand name first.";
    return;
  }
  if (!(await requireCloudReady(els.brandStatus))) return;
  state.brands.push({ id: crypto.randomUUID(), name, repId: els.brandNoRep.checked ? null : els.brandRep.value });
  els.brandStatus.textContent = `Added brand ${name}${els.brandNoRep.checked ? " without a sales rep" : ""}.`;
  els.brandForm.reset();
  render();
});

els.clinicForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.clinicName.value.trim();
  if (!name) {
    els.clinicStatus.textContent = "Enter a clinic name first.";
    return;
  }
  if (!(await requireCloudReady(els.clinicStatus))) return;
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
  const addApiId = event.target.dataset?.addApi;
  const addMaterialId = event.target.dataset?.addMaterial;
  const removeApiId = event.target.dataset?.removeApi;
  const removeMaterialId = event.target.dataset?.removeMaterial;
  const toggleSkuId = event.target.closest("[data-toggle-sku]")?.dataset?.toggleSku;
  const removeProfitApiId = event.target.dataset?.removeProfitApi;
  const removeProfitMaterialId = event.target.dataset?.removeProfitMaterial;

  if (toggleSkuId) {
    if (expandedSkus.has(toggleSkuId)) {
      expandedSkus.delete(toggleSkuId);
    } else {
      expandedSkus.add(toggleSkuId);
    }
    renderCostTables();
    return;
  }

  if (removeProfitApiId) {
    profitabilityState.apis.delete(removeProfitApiId);
    profitabilityState.apiQuantities.delete(removeProfitApiId);
    profitabilityState.result = calculateProfitabilityScenario();
    renderProfitabilityBuilder();
    return;
  }

  if (removeProfitMaterialId) {
    profitabilityState.materials.delete(removeProfitMaterialId);
    profitabilityState.result = calculateProfitabilityScenario();
    renderProfitabilityBuilder();
    return;
  }

  if (addApiId) {
    builderState.apis.add(addApiId);
    if (!builderState.apiQuantities.has(addApiId)) builderState.apiQuantities.set(addApiId, 1);
    renderBuilder();
    return;
  }

  if (addMaterialId) {
    builderState.materials.add(addMaterialId);
    renderBuilder();
    return;
  }

  if (removeApiId) {
    builderState.apis.delete(removeApiId);
    builderState.apiQuantities.delete(removeApiId);
    renderBuilder();
    return;
  }

  if (removeMaterialId) {
    builderState.materials.delete(removeMaterialId);
    renderBuilder();
    return;
  }

  if (reportId) {
    const report = state.reports.find((item) => item.id === reportId);
    if (!report) return;

    if (!confirmProtectedDelete(report.name)) return;

    if (!cloudReady && configuredForSupabase()) {
      setSyncStatus("Cloud signed out");
      alert("Sign in under Cloud Access before removing a report.");
      return;
    }

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
    if (!cloudReady && configuredForSupabase()) {
      setSyncStatus("Cloud signed out");
      alert("Sign in under Cloud Access before removing a brand.");
      return;
    }

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
    if (!cloudReady && configuredForSupabase()) {
      setSyncStatus("Cloud signed out");
      alert("Sign in under Cloud Access before removing a clinic.");
      return;
    }

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
  setLocked(true);
  setSyncStatus("Cloud signed out");
  els.authStatus.textContent = "Signed out. Local browser data is still available on this device.";
});

els.refreshCloudBtn.addEventListener("click", forceCloudRefresh);

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
  });
});

els.apiCostForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await importApiCostFile(els.apiCostFile.files[0]);
    els.apiCostFile.value = "";
  } catch (error) {
    els.apiCostStatus.textContent = `API import failed: ${error.message}`;
  }
});

document.addEventListener("change", (event) => {
  const builderApiId = event.target.dataset?.builderApiQty;
  const profitApiId = event.target.dataset?.profitApiQty;

  if (builderApiId) {
    builderState.apiQuantities.set(builderApiId, parseAmount(event.target.value));
    renderBuilder();
    return;
  }

  if (profitApiId) {
    profitabilityState.apiQuantities.set(profitApiId, parseAmount(event.target.value));
    profitabilityState.result = calculateProfitabilityScenario();
    renderProfitabilityBuilder();
  }
});

els.pricingWorkbookForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await importPricingWorkbook(els.pricingWorkbookFile.files[0]);
    els.pricingWorkbookFile.value = "";
  } catch (error) {
    els.pricingWorkbookStatus.textContent = `Pricing workbook import failed: ${error.message}`;
  }
});

els.cogsWorkbookForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await importCogsWorkbook(els.cogsWorkbookFile.files[0]);
    els.cogsWorkbookFile.value = "";
  } catch (error) {
    els.cogsWorkbookStatus.textContent = `COGS import failed: ${error.message}`;
  }
});

els.cogsAssumptionsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await requireCloudReady(els.cogsAssumptionsStatus))) return;
  els.cogsAssumptionFields.querySelectorAll("[data-assumption]").forEach((input) => {
    state.cogs.assumptions[input.dataset.assumption] = normalizeAssumptionInput(input.dataset.assumption, input.value);
  });
  await finishCogsManualSave(els.cogsAssumptionsStatus, "Saved assumptions and recalculated COGS.");
});

els.cogsInventoryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await requireCloudReady(els.cogsInventoryStatus))) return;
  const id = els.cogsMaterialId.value.trim();
  const name = els.cogsMaterialName.value.trim();
  if (!id || !name) {
    els.cogsInventoryStatus.textContent = "Enter a material ID and material name.";
    return;
  }
  upsertById("inventory", normalizeCogsInventoryItem({
    id,
    name,
    type: els.cogsMaterialType.value,
    unit: els.cogsMaterialUnit.value,
    qtyOnHand: els.cogsMaterialQty.value,
    reorderPoint: els.cogsMaterialReorder.value,
    unitCost: els.cogsMaterialUnitCost.value,
    vendor: els.cogsMaterialVendor.value,
    lotNumber: els.cogsMaterialLot.value,
    expiryDate: els.cogsMaterialExpiry.value,
  }));
  els.cogsInventoryForm.reset();
  await finishCogsManualSave(els.cogsInventoryStatus, `Saved material ${id}.`);
});

els.cogsSkuForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await requireCloudReady(els.cogsSkuStatus))) return;
  const id = els.cogsSkuId.value.trim();
  const productName = els.cogsSkuProduct.value.trim();
  const ingredients = parseSkuIngredientLines(els.cogsSkuIngredients.value);
  if (!id || !productName || !ingredients.length) {
    els.cogsSkuStatus.textContent = "Enter SKU ID, product name, and at least one ingredient line.";
    return;
  }
  upsertById("skuRegistry", buildCogsSku({
    id,
    productName,
    type: els.cogsSkuType.value,
    dosageForm: els.cogsSkuDosage.value,
    batchSize: els.cogsSkuBatchSize.value,
    batchUnit: els.cogsSkuBatchUnit.value,
    unitsPerBatch: els.cogsSkuUnitsPerBatch.value,
    ingredients,
  }, state.cogs.inventory || []));
  els.cogsSkuForm.reset();
  await finishCogsManualSave(els.cogsSkuStatus, `Saved SKU ${id}.`);
});

els.cogsRxForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await requireCloudReady(els.cogsRxStatus))) return;
  const id = els.cogsRxId.value.trim();
  const skuId = els.cogsRxSku.value.trim();
  if (!id || !skuId) {
    els.cogsRxStatus.textContent = "Enter an Rx number and SKU ID.";
    return;
  }
  const sku = state.cogs.skuRegistry.find((item) => normalizeKey(item.id) === normalizeKey(skuId));
  upsertById("rxPrescriptions", {
    id,
    date: els.cogsRxDate.value,
    skuId,
    productName: sku?.productName || "",
    ...calculateRxCogs({ "Qty Dispensed": els.cogsRxQty.value, "Selling Price ($)": els.cogsRxRevenue.value, "DL Hours": els.cogsRxLaborHours.value }, sku, state.cogs.assumptions),
  });
  els.cogsRxForm.reset();
  await finishCogsManualSave(els.cogsRxStatus, `Saved Rx ${id}.`);
});

els.cogsContractForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await requireCloudReady(els.cogsContractStatus))) return;
  const id = els.cogsContractId.value.trim();
  const skuId = els.cogsContractSku.value.trim();
  if (!id || !skuId) {
    els.cogsContractStatus.textContent = "Enter an order number and SKU ID.";
    return;
  }
  const sku = state.cogs.skuRegistry.find((item) => normalizeKey(item.id) === normalizeKey(skuId));
  upsertById("contractOrders", {
    id,
    date: els.cogsContractDate.value,
    client: els.cogsContractClient.value.trim(),
    skuId,
    productName: sku?.productName || "",
    ...calculateContractCogs({ "Units Ordered": els.cogsContractUnits.value, "Unit Price ($)": els.cogsContractUnitPrice.value, "DL Hours (Total)": els.cogsContractLaborHours.value }, sku, state.cogs.assumptions),
  });
  els.cogsContractForm.reset();
  await finishCogsManualSave(els.cogsContractStatus, `Saved contract ${id}.`);
});

els.profitabilityAddApi?.addEventListener("click", () => {
  const id = els.profitabilityApi.value;
  if (id) {
    profitabilityState.apis.add(id);
    if (!profitabilityState.apiQuantities.has(id)) profitabilityState.apiQuantities.set(id, builderState.apiQuantities.get(id) ?? 1);
  }
  profitabilityState.result = calculateProfitabilityScenario();
  renderProfitabilityBuilder();
});

els.profitabilityAddMaterial?.addEventListener("click", () => {
  const id = els.profitabilityMaterial.value;
  if (id) profitabilityState.materials.add(id);
  profitabilityState.result = calculateProfitabilityScenario();
  renderProfitabilityBuilder();
});

els.profitabilityForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  profitabilityState.result = calculateProfitabilityScenario();
  els.profitabilityStatus.textContent = `Calculated ${els.profitabilityStream.value === "contract" ? "contract" : "Rx"} profitability.`;
  renderProfitabilityBuilder();
});

[
  els.profitabilityStream,
  els.profitabilitySku,
  els.profitabilityQuantity,
  els.profitabilityRevenue,
  els.profitabilityLaborHours,
  els.profitabilityMarginFloor,
].forEach((input) => {
  input?.addEventListener("input", () => {
    profitabilityState.result = calculateProfitabilityScenario();
    renderProfitabilityBuilder();
  });
});

els.builderProfitForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  sendBuilderToProfitability("api");
});

els.materialBuilderProfitForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  sendBuilderToProfitability("material");
});

[els.builderProfitStream, els.builderProfitQuantity, els.builderProfitRevenue, els.builderProfitLaborHours].forEach((input) => {
  input?.addEventListener("input", () => {
    syncBuilderProfitFields("api");
    if (input === els.builderProfitQuantity) renderBuilder();
  });
});

[
  els.materialBuilderProfitStream,
  els.materialBuilderProfitQuantity,
  els.materialBuilderProfitRevenue,
  els.materialBuilderProfitLaborHours,
].forEach((input) => {
  input?.addEventListener("input", () => {
    syncBuilderProfitFields("material");
    if (input === els.materialBuilderProfitQuantity) renderBuilder();
  });
});

els.manualApiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await requireCloudReady(els.manualApiStatus))) return;
  const name = els.manualApiName.value.trim();
  const cost = parseAmount(els.manualApiCost.value);
  if (!name || !cost) {
    els.manualApiStatus.textContent = "Enter an API name and unit cost.";
    return;
  }
  upsertCosts("apiCosts", [{
    id: crypto.randomUUID(),
    name,
    cost,
    unit: els.manualApiUnit.value.trim() || "unit",
    notes: "",
  }]);
  els.manualApiStatus.textContent = `Saved API ${name}.`;
  els.manualApiForm.reset();
  render();
  if (cloudReady) await saveCloudState();
});

els.skuCostForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const file = els.skuCostFile.files[0];
    if (!file) {
      els.skuCostStatus.textContent = "Choose a SKU cost file first.";
      return;
    }
    if (!(await requireCloudReady(els.skuCostStatus))) return;
    const rows = await readFile(file);
    const records = normalizeSkuCosts(rows);
    upsertSkuCosts(records);
    els.skuCostStatus.textContent = `Imported ${records.length} SKU cost records.`;
    render();
    if (cloudReady) await saveCloudState();
    els.skuCostFile.value = "";
  } catch (error) {
    els.skuCostStatus.textContent = `SKU import failed: ${error.message}`;
  }
});

els.manualSkuForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await requireCloudReady(els.manualSkuStatus))) return;
  const formula = els.manualSkuFormula.value.trim();
  const total = parseAmount(els.manualSkuTotal.value);
  const unitCost = parseAmount(els.manualSkuUnitCost.value);
  if (!formula || (!total && !unitCost)) {
    els.manualSkuStatus.textContent = "Enter SKU and either total or unit cost.";
    return;
  }
  upsertSkuCosts([{
    id: crypto.randomUUID(),
    formula,
    total,
    unitCost,
    costPerGram: total / SKU_BATCH_GRAMS,
    ingredients: [],
  }]);
  els.manualSkuStatus.textContent = `Saved SKU ${formula}.`;
  els.manualSkuForm.reset();
  render();
  if (cloudReady) await saveCloudState();
});

els.materialCostForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await importCostFile({
      file: els.materialCostFile.files[0],
      normalizer: normalizeMaterialCosts,
      collection: "materialCosts",
      statusEl: els.materialCostStatus,
      label: "material cost",
    });
    els.materialCostFile.value = "";
  } catch (error) {
    els.materialCostStatus.textContent = `Material import failed: ${error.message}`;
  }
});

els.manualMaterialForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await requireCloudReady(els.manualMaterialStatus))) return;
  const name = els.manualMaterialName.value.trim();
  const cost = parseAmount(els.manualMaterialCost.value);
  if (!name || !cost) {
    els.manualMaterialStatus.textContent = "Enter a material name and cost.";
    return;
  }
  upsertCosts("materialCosts", [{
    id: crypto.randomUUID(),
    name,
    category: els.manualMaterialCategory.value.trim() || "Material",
    unit: els.manualMaterialUnit.value.trim() || "unit",
    cost,
    notes: "",
  }]);
  els.manualMaterialStatus.textContent = `Saved material ${name}.`;
  els.manualMaterialForm.reset();
  render();
  if (cloudReady) await saveCloudState();
});

els.clearBuilderBtn.addEventListener("click", () => {
  builderState.apis.clear();
  builderState.materials.clear();
  builderState.apiQuantities.clear();
  renderBuilder();
});

els.materialClearBuilderBtn.addEventListener("click", () => {
  builderState.apis.clear();
  builderState.materials.clear();
  builderState.apiQuantities.clear();
  renderBuilder();
});

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

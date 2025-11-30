console.log('Common Investor v11 Loaded');
// ===== Utilities =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const toast = (msg, duration = 1700) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), duration) };

function fmtAbbrFullHtml(v) {
  if (!isFinite(v) || v <= 0) return '–';
  const abs = Math.abs(v);
  const full = Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let abbr;
  if (abs >= 1_000_000_000_000) abbr = (v / 1_000_000_000_000).toFixed(2) + 'T';
  else if (abs >= 1_000_000_000) abbr = (v / 1_000_000_000).toFixed(2) + 'B';
  else if (abs >= 1_000_000) abbr = (v / 1_000_000).toFixed(2) + 'M';
  else abbr = Number(v).toFixed(2);
  return `<div class="val-abbr">${abbr}</div>\n<div class="val-full">${full}</div>`;
}
const fmtMB = (v) => {
  if (!isFinite(v)) return '–';
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000_000) return (v / 1_000_000_000_000).toFixed(2) + "T";
  if (abs >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  return Number(v).toFixed(2);
};
const clean = (s) => (s || '').toString().trim().toUpperCase().replace(/[$,%\s,]/g, '');
function parseValueCurrent(typedStr, dropdownSuffix) {
  // Clean but don't convert case yet
  let typed = (typedStr || '').toString().trim().replace(/[$,%\s,]/g, '');
  // Get last character and check case-insensitive
  const lastChar = typed.slice(-1).toUpperCase();
  const endsT = lastChar === 'T';
  const endsB = lastChar === 'B';
  const endsM = lastChar === 'M';

  let num = typed;
  if (endsT || endsB || endsM) num = typed.slice(0, -1);

  let final = dropdownSuffix || (endsT ? 'T' : endsB ? 'B' : endsM ? 'M' : '');
  let mult = 1;
  if (final.toUpperCase() === 'M') mult = 1_000_000;
  if (final.toUpperCase() === 'B') mult = 1_000_000_000;
  if (final.toUpperCase() === 'T') mult = 1_000_000_000_000;

  const n = parseFloat(num) || 0;
  return n * mult;
}
function parseValue(valueStr, suffix = '') {
  if (!valueStr) return 0;

  // Clean the value but preserve case
  let v = (valueStr || '').toString().trim().replace(/[$,%\s,]/g, '');
  let mult = 1;

  // Get the last character and check case-insensitive
  const unit = v.slice(-1).toUpperCase();
  if (unit === 'T' || unit === 'B' || unit === 'M') {
    // If unit is in the value, use it
    if (unit === 'T') mult = 1_000_000_000_000;
    else if (unit === 'B') mult = 1_000_000_000;
    else if (unit === 'M') mult = 1_000_000;
    v = v.slice(0, -1);
  } else if (suffix) {
    // Use provided suffix if no unit in value
    const suffixUnit = suffix.toUpperCase();
    if (suffixUnit === 'T') mult = 1_000_000_000_000;
    else if (suffixUnit === 'B') mult = 1_000_000_000;
    else if (suffixUnit === 'M') mult = 1_000_000;
  }

  const n = parseFloat(v);
  return isNaN(n) ? 0 : n * mult;
}
const parseMargin = (s) => { if (!s) return 0; const n = parseFloat(clean(s)); return isNaN(n) ? 0 : n / 100 };

// ===== Constants =====
const TRENDING_POOL = [
  'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN',
  'GOOGL', 'META', 'AMD', 'PLTR', 'COIN',
  'NFLX', 'DIS', 'JPM', 'V', 'WMT',
  'PG', 'XOM', 'CVX', 'KO', 'PEP',
  'COST', 'HD', 'MCD', 'NKE', 'SBUX',
  'INTC', 'CSCO', 'CRM', 'ADBE', 'ORCL',
  'IBM', 'QCOM', 'TXN', 'HON', 'UNH'
];
let realCalculatedStocks = []; // Placeholder for real backend data

// ===== Elements =====
const stock = $('#stock'), stockList = $('#stockList');
const dateEl = $('#date'), revenue = $('#revenue'), revSuf = $('#revenueSuffix');
const shares = $('#shares'), shSuf = $('#sharesSuffix');
const pe = $('#pe'), pm = $('#profitMargin'), price = $('#price');
// Support both desktop (earningsValue/epsValue) and mobile (earnings/eps) IDs
const earnings = document.getElementById('earningsValue') || document.getElementById('earnings');
const eps = document.getElementById('epsValue') || document.getElementById('eps');
const mv = $('#marketValue');
const summaryCard = document.querySelector('.mobile-summary');
const summaryMarket = $('#summaryMarketValue');
const summaryFuturePrice = $('#summaryFuturePrice');
const summaryFutureMarket = $('#summaryFutureMarketValue');
const summarySPFlag = $('#summarySPFlag');
const companyBanner = $('#companyBanner');
const futureCard = $('#futureCard');
const futureResults = $('#futureResults');
const mobileHeader = document.querySelector('.mobile-header');
const mobileBanner = document.querySelector('.mobile-company-banner');

const mobileTabs = $$('.mobile-tab');
const mobilePanels = $$('.step-panel');
const mobileCalcBtn = $('#mobileCalculateBtn');
const mobileSaveBtn = $('#mobileSaveBtn');
const mobileResetBtn = $('#mobileResetBtn');

// Tab Elements (Moved to top to prevent ReferenceError)
const tabProjections = document.getElementById('tabProjections');
const tabInsights = document.getElementById('tabInsights');
const tabHub = document.getElementById('tabHub');
const projectionsTab = document.getElementById('projectionsTab');
const insightsTab = document.getElementById('insightsTab');
const hubTab = document.getElementById('hubContent');

const saveToHubBtn = document.getElementById('saveToHubBtn');

function updateCompanyBanner() {
  if (!companyBanner) return;
  const value = (stock?.value || '').trim();
  const hasValue = value.length > 0;
  companyBanner.textContent = hasValue ? value : 'Add a company';
  companyBanner.classList.toggle('is-empty', !hasValue);
  companyBanner.classList.toggle('show', hasValue);
}

function updateActiveCompany() {
  updateCompanyBanner();
}

let summaryRevealed = false;
function revealSummary() {
  if (summaryRevealed) return;
  summaryRevealed = true;
  if (summaryCard) {
    summaryCard.classList.add('is-visible');
    summaryCard.removeAttribute('hidden');
    const help = summaryCard.querySelector('.help');
    if (help) help.textContent = 'Latest snapshot based on your inputs.';
  }
}

const frMode = $('#futureRevenueMode');
const frLabel = $('#futureRevenueControlsLabel');
const frAbsC = $('#futureRevenueAbsoluteContainer'), frAbs = $('#futureRevenueAbsolute'), frSuf = $('#futureRevenueSuffix');
const frPctC = $('#futureRevenuePercentageContainer'), frPct = $('#futureRevenuePercent'), frDir = $('#futureRevenueDirection');
const frCagrC = $('#futureRevenueCompoundedContainer'), frCagr = $('#futureRevenueCompounded'), frCagrDir = $('#futureRevenueCompoundedDirection');
const frLabelDual = $('#futureRevenueControlsLabelDual');
const frAbsCDual = $('#futureRevenueAbsoluteContainerDual');
const frPctCDual = $('#futureRevenuePercentageContainerDual');
const frCagrCDual = $('#futureRevenueCompoundedContainerDual');

const fsMode = $('#futureSharesMode');
const fsLabel = $('#futureSharesControlsLabel');
const fsAbsC = $('#futureSharesInputContainer'), fsAbs = $('#futureShares'), fsSuf = $('#futureSharesSuffix');
const fsPctC = $('#futureSharesPercentageContainer'), fsPct = $('#futureSharesPercent'), fsDir = $('#futureSharesDirection');
const fsCagrC = $('#futureSharesCompoundedContainer'), fsCagr = $('#futureSharesCompounded'), fsCagrDir = $('#futureSharesCompoundedDirection');
const fsLabelDual = $('#futureSharesControlsLabelDual');
const fsAbsCDual = $('#futureSharesInputContainerDual');
const fsPctCDual = $('#futureSharesPercentageContainerDual');
const fsCagrCDual = $('#futureSharesCompoundedContainerDual');

const fPE = $('#futurePE'), fPM = $('#futureProfitMargin');
const fRev = $('#futureRevenueValue'), fShOut = $('#futureSharesValue'), fEarn = $('#futureEarnings'), fEPS = $('#futureEPS'), fPrice = $('#futureStockPrice'), fMV = $('#futureMarketValue');
const spComp = $('#spComparison'), spTarget = $('#spTargetInfo');
const flags = $('#outcomeFlags');
let futureAutoEnabled = false; // only auto-run future after user explicitly calculates once
let lastFutureCalc = null;
let dualCaseEnabled = false;

// Case toggle + dual inputs
const caseModeBtn = $('#caseModeBtn');
const dualCaseResults = $('#dualCaseResults');
const singleCaseResults = $('#singleCaseResults');

const frAbsBase = $('#futureRevenueAbsoluteBase');
const frAbsBull = $('#futureRevenueAbsoluteBull');
const frSufBase = $('#futureRevenueSuffixBase');
const frSufBull = $('#futureRevenueSuffixBull');
const frPctBase = $('#futureRevenuePercentBase');
const frPctBull = $('#futureRevenuePercentBull');
const frDirBase = $('#futureRevenueDirectionBase');
const frDirBull = $('#futureRevenueDirectionBull');
const frCagrBase = $('#futureRevenueCompoundedBase');
const frCagrBull = $('#futureRevenueCompoundedBull');
const frCagrDirBase = $('#futureRevenueCompoundedDirectionBase');
const frCagrDirBull = $('#futureRevenueCompoundedDirectionBull');

const fsAbsBase = $('#futureSharesBase');
const fsAbsBull = $('#futureSharesBull');
const fsSufBase = $('#futureSharesSuffixBase');
const fsSufBull = $('#futureSharesSuffixBull');
const fsPctBase = $('#futureSharesPercentBase');
const fsPctBull = $('#futureSharesPercentBull');
const fsDirBase = $('#futureSharesDirectionBase');
const fsDirBull = $('#futureSharesDirectionBull');
const fsCagrBase = $('#futureSharesCompoundedBase');
const fsCagrBull = $('#futureSharesCompoundedBull');
const fsCagrDirBase = $('#futureSharesCompoundedDirectionBase');
const fsCagrDirBull = $('#futureSharesCompoundedDirectionBull');

const fPEBase = $('#futurePEBase');
const fPEBull = $('#futurePEBull');
const fPMBase = $('#futureProfitMarginBase');
const fPMBull = $('#futureProfitMarginBull');

const fPriceBase = $('#futureStockPriceBase');
const fPriceBull = $('#futureStockPriceBull');
const fRevBase = $('#futureRevenueValueBase');
const fRevBull = $('#futureRevenueValueBull');
const fShOutBase = $('#futureSharesValueBase');
const fShOutBull = $('#futureSharesValueBull');
const fEarnBase = $('#futureEarningsBase');
const fEarnBull = $('#futureEarningsBull');
const fEPSBase = $('#futureEPSBase');
const fEPSBull = $('#futureEPSBull');
const fMVBase = $('#futureMarketValueBase');
const fMVBull = $('#futureMarketValueBull');

const clearBtn = document.getElementById('clearAllBtn') || document.getElementById('clearBtn');
const saveBtn = $('#saveBtn');
const clearBtn2 = document.getElementById('clearAllBtn2');
const saveBtn2 = $('#saveBtn2');
const shareBtn = $('#shareBtn');
const calcCurrentBtn = $('#calcCurrentBtn');
const calcFutureBtn = $('#calcFutureBtn');
const themeSelect = $('#themeSelect');

const suffixDialog = $('#suffixDialog');
const suffixBody = $('#suffixDialogBody');
const suffixConfirm = $('#suffixConfirmBtn');

// ===== Date =====
function updateDate() { const d = new Date(); dateEl.value = d.toLocaleDateString() }
updateDate();

// ===== Autocomplete (lightweight) =====
let allStocks = [];
let _stocksLoadingPromise = null;
// Try several reasonable paths so hosting environments (and case-sensitivity) are covered.
// Try several reasonable paths so hosting environments (and case-sensitivity) are covered.
const STOCK_SOURCES = []; // Empty to skip checking for missing stocks.json and rely on sp500.json immediately

// visible notice element under the stock input to inform about loading issues
const stocksNotice = (() => {
  try {
    const el = document.createElement('div');
    el.id = 'stocksNotice';
    el.style.fontSize = '13px';
    el.style.color = 'var(--muted)';
    el.style.marginTop = '6px';
    el.style.display = 'none';
    const acContainer = stock?.parentElement;
    if (acContainer) acContainer.appendChild(el);
    return el;
  } catch (e) { return null; }
})();

async function ensureStocksLoaded() {
  if (allStocks.length) return allStocks;
  if (_stocksLoadingPromise) return _stocksLoadingPromise;

  _stocksLoadingPromise = (async () => {
    for (const url of STOCK_SOURCES) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          console.warn(`stocks.json fetch returned ${res.status} for ${url}`);
          continue;
        }
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          allStocks = data;
          window.__allStocks = allStocks;
          if (stocksNotice) { stocksNotice.style.display = 'none'; stocksNotice.textContent = ''; }
          return allStocks;
        }
      } catch (err) {
        console.error(`Failed to load ${url}:`, err);
      }
    }

    // Inline fallback: allow embedding <script type="application/json" data-role="stocks">[…]</script>
    const inline = document.querySelector('script[type="application/json"][data-role="stocks"]');
    if (inline?.textContent?.trim()) {
      try {
        const parsed = JSON.parse(inline.textContent);
        if (Array.isArray(parsed) && parsed.length) {
          allStocks = parsed;
          window.__allStocks = allStocks;
          return allStocks;
        }
      } catch (err) {
        console.error('Failed to parse inline stocks JSON:', err);
      }
    }

    console.warn('Stocks dataset unavailable — autocomplete will fall back to popular list.');
    if (stocksNotice) {
      stocksNotice.style.display = 'none';
      stocksNotice.textContent = '';
    }
    // As a final fallback, populate from bundled sp500.json if available
    await loadSp500Data();
    if (!allStocks.length && mergedStocks && typeof mergedStocks === 'object') {
      Object.entries(mergedStocks).forEach(([symbol, v]) => {
        allStocks.push({ symbol, name: v?.name || symbol });
      });
    }
    return allStocks;
  })();

  try {
    return await _stocksLoadingPromise;
  } finally {
    _stocksLoadingPromise = null;
  }
}

// Embedded Mock Data for Prototype (avoids CORS issues with file://)
const mockStocks = {
  "AAPL": {
    name: "Apple Inc.",
    revenue: 383930000000, // 383.93B
    shares: 15550000000,   // 15.55B
    pe: 28.5,
    profitMargin: 25.3,
    price: 189.50,
    history: [
      { year: '2020', revenue: 274.5 },
      { year: '2021', revenue: 365.8 },
      { year: '2022', revenue: 394.3 },
      { year: '2023', revenue: 383.3 },
      { year: '2024', revenue: 391.0 },
      { year: 'TTM', revenue: 416.2 }
    ]
  },
  "MSFT": {
    name: "Microsoft Corporation",
    revenue: 227580000000, // 227.58B
    shares: 7430000000,    // 7.43B
    pe: 36.2,
    profitMargin: 35.1,
    price: 420.15,
    history: [
      { year: '2020', revenue: 143.0 },
      { year: '2021', revenue: 168.1 },
      { year: '2022', revenue: 198.3 },
      { year: '2023', revenue: 211.9 },
      { year: '2024', revenue: 261.8 },
      { year: 'TTM', revenue: 293.8 }
    ]
  },
  "GOOGL": {
    name: "Alphabet Inc.",
    revenue: 307390000000, // 307.39B
    shares: 12460000000,   // 12.46B
    pe: 26.8,
    profitMargin: 24.0,
    price: 175.30,
    history: [
      { year: '2020', revenue: 182.5 },
      { year: '2021', revenue: 257.6 },
      { year: '2022', revenue: 282.8 },
      { year: '2023', revenue: 307.4 },
      { year: '2024', revenue: 350.0 },
      { year: 'TTM', revenue: 385.5 }
    ]
  },
  "AMZN": {
    name: "Amazon.com Inc.",
    revenue: 574780000000, // 574.78B
    shares: 10390000000,   // 10.39B
    pe: 51.4,
    profitMargin: 6.4,
    price: 185.10,
    history: [
      { year: '2020', revenue: 386.1 },
      { year: '2021', revenue: 469.8 },
      { year: '2022', revenue: 514.0 },
      { year: '2023', revenue: 574.8 },
      { year: '2024', revenue: 638.0 },
      { year: 'TTM', revenue: 691.3 }
    ]
  },
  "TSLA": {
    name: "Tesla Inc.",
    revenue: 96770000000,  // 96.77B
    shares: 3180000000,    // 3.18B
    pe: 45.2,
    profitMargin: 15.5,
    price: 178.90,
    history: [
      { year: '2020', revenue: 31.5 },
      { year: '2021', revenue: 53.8 },
      { year: '2022', revenue: 81.5 },
      { year: '2023', revenue: 96.8 },
      { year: '2024', revenue: 97.7 },
      { year: 'TTM', revenue: 95.6 }
    ]
  },
  "META": {
    name: "Meta Platforms Inc.",
    revenue: 134900000000, // 134.90B
    shares: 2540000000,    // 2.54B
    pe: 27.9,
    profitMargin: 33.2,
    price: 475.20,
    // 5 Years + TTM (Total 6 data points)
    // Order: Oldest -> Newest (TTM is last)
    // Timeline: 2020, 2021, 2022, 2023, 2024, TTM
    history: [
      { year: '2020', revenue: 86.0, earnings: 29.1, eps: 10.09, fcf: 23.6, margin: 33.9, shares: 2.86, pe: 30.5, roe: 25.4, revGrowth: 21.6, earnGrowth: 57.7 },
      { year: '2021', revenue: 117.9, earnings: 39.4, eps: 13.77, fcf: 39.1, margin: 33.4, shares: 2.76, pe: 24.2, roe: 29.1, revGrowth: 37.2, earnGrowth: 35.1 },
      { year: '2022', revenue: 116.6, earnings: 23.2, eps: 8.59, fcf: 19.0, margin: 19.9, shares: 2.66, pe: 12.4, roe: 18.5, revGrowth: -1.1, earnGrowth: -41.1 },
      { year: '2023', revenue: 134.9, earnings: 39.1, eps: 14.87, fcf: 43.8, margin: 29.0, shares: 2.56, pe: 22.1, roe: 28.0, revGrowth: 15.7, earnGrowth: 68.5 },
      { year: '2024', revenue: 164.5, earnings: 45.8, eps: 17.35, fcf: 49.5, margin: 30.6, shares: 2.54, pe: 27.9, roe: 31.2, revGrowth: 10.8, earnGrowth: 17.1 },
      { year: 'TTM', revenue: 189.5, earnings: 50.1, eps: 19.20, fcf: 52.0, margin: 31.5, shares: 2.53, pe: 28.5, roe: 32.5, revGrowth: 15.2, earnGrowth: 9.4 }
    ]
  },
  "GOOG": {
    symbol: "GOOG",
    name: "Alphabet Inc.",
    price: 173.55,
    history: [
      { year: '2020', revenue: 182.5, earnings: 40.3, eps: 2.96, fcf: 42.8, margin: 22.1, shares: 13.6, pe: 30.1, roe: 19.0, revGrowth: 12.8, earnGrowth: 17.3 },
      { year: '2021', revenue: 257.6, earnings: 76.0, eps: 5.61, fcf: 67.0, margin: 29.5, shares: 13.3, pe: 25.4, roe: 32.1, revGrowth: 41.2, earnGrowth: 88.8 },
      { year: '2022', revenue: 282.8, earnings: 60.0, eps: 4.56, fcf: 60.0, margin: 21.2, shares: 12.9, pe: 18.9, roe: 23.6, revGrowth: 9.8, earnGrowth: -21.1 },
      { year: '2023', revenue: 307.4, earnings: 73.8, eps: 5.80, fcf: 69.5, margin: 24.0, shares: 12.6, pe: 24.5, roe: 27.4, revGrowth: 8.7, earnGrowth: 23.0 },
      { year: '2024', revenue: 340.1, earnings: 88.2, eps: 7.15, fcf: 75.2, margin: 25.9, shares: 12.4, pe: 22.8, roe: 29.8, revGrowth: 10.6, earnGrowth: 19.5 },
      { year: 'TTM', revenue: 365.2, earnings: 95.5, eps: 7.85, fcf: 82.1, margin: 26.1, shares: 12.3, pe: 22.1, roe: 31.5, revGrowth: 11.2, earnGrowth: 12.3 }
    ]
  },
  "AMZN": {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    price: 185.60,
    history: [
      { year: '2020', revenue: 386.1, earnings: 21.3, eps: 2.09, fcf: 31.0, margin: 5.5, shares: 10.2, pe: 94.1, roe: 27.4, revGrowth: 37.6, earnGrowth: 84.1 },
      { year: '2021', revenue: 469.8, earnings: 33.4, eps: 3.24, fcf: -9.1, margin: 7.1, shares: 10.3, pe: 50.5, roe: 28.8, revGrowth: 21.7, earnGrowth: 56.4 },
      { year: '2022', revenue: 514.0, earnings: -2.7, eps: -0.27, fcf: -11.6, margin: -0.5, shares: 10.4, pe: -100, roe: -1.9, revGrowth: 9.4, earnGrowth: -108.1 },
      { year: '2023', revenue: 574.8, earnings: 30.4, eps: 2.90, fcf: 36.8, margin: 5.3, shares: 10.5, pe: 55.2, roe: 19.0, revGrowth: 11.8, earnGrowth: 1215.0 },
      { year: '2024', revenue: 630.5, earnings: 48.5, eps: 4.65, fcf: 45.2, margin: 7.7, shares: 10.6, pe: 42.1, roe: 22.5, revGrowth: 9.7, earnGrowth: 59.5 },
      { year: 'TTM', revenue: 655.2, earnings: 55.1, eps: 5.25, fcf: 50.1, margin: 8.4, shares: 10.6, pe: 35.4, roe: 24.1, revGrowth: 10.2, earnGrowth: 13.6 }
    ]
  },
  "NVDA": {
    name: "NVIDIA Corporation",
    revenue: 60920000000,  // 60.92B
    shares: 2470000000,    // 2.47B
    pe: 75.5,
    profitMargin: 48.9,
    price: 950.05,
    history: [
      { year: '2020', revenue: 10.9 },
      { year: '2021', revenue: 16.7 },
      { year: '2022', revenue: 26.9 },
      { year: '2023', revenue: 27.0 },
      { year: '2024', revenue: 60.9 },
      { year: 'TTM', revenue: 187.1 }
    ]
  },
  "BRK.B": {
    name: "Berkshire Hathaway Inc.",
    revenue: 364480000000, // 364.48B
    shares: 1440000000,    // 1.44B (Class B equivalent approx)
    pe: 12.1,
    profitMargin: 18.5,
    price: 410.50,
    history: [
      { year: '2020', revenue: 245.5 },
      { year: '2021', revenue: 276.1 },
      { year: '2022', revenue: 302.1 },
      { year: '2023', revenue: 364.5 },
      { year: '2024', revenue: 371.4 },
      { year: 'TTM', revenue: 372.1 }
    ]
  },
  "JNJ": {
    name: "Johnson & Johnson",
    revenue: 85160000000,  // 85.16B
    shares: 2410000000,    // 2.41B
    pe: 20.4,
    profitMargin: 16.2,
    price: 148.20,
    history: [
      { year: '2020', revenue: 82.6 },
      { year: '2021', revenue: 93.8 },
      { year: '2022', revenue: 94.9 },
      { year: '2023', revenue: 85.2 },
      { year: '2024', revenue: 86.5 },
      { year: 'TTM', revenue: 87.1 }
    ]
  },
  "V": {
    name: "Visa Inc.",
    revenue: 32650000000,  // 32.65B
    shares: 2050000000,    // 2.05B
    pe: 31.8,
    profitMargin: 52.1,
    price: 278.45,
    history: [
      { year: '2020', revenue: 21.8 },
      { year: '2021', revenue: 24.1 },
      { year: '2022', revenue: 29.3 },
      { year: '2023', revenue: 32.7 },
      { year: '2024', revenue: 35.9 },
      { year: 'TTM', revenue: 40.0 }
    ]
  }
};

// Merge-in external datasets (e.g., sp500.json) when available
let mergedStocks = { ...mockStocks };
let sp500Loaded = false;
let sp500WarningShown = false;
async function loadSp500Data() {
  if (sp500Loaded) return mergedStocks;
  sp500Loaded = true;
  try {
    // Prefer inline global data if present to avoid fetch/CORS issues on file://
    let data = window.__sp500Data;
    if (!data) {
      const res = await fetch('sp500.json', { cache: 'no-store' });
      if (res.ok) {
        data = await res.json();
      }
    }
    if (data && typeof data === 'object') {
      mergedStocks = { ...mergedStocks, ...data };
      if (Array.isArray(allStocks)) {
        const existing = new Set(allStocks.map((s) => s.symbol));
        Object.entries(data).forEach(([symbol, v]) => {
          const name = v?.name || symbol;
          if (!existing.has(symbol)) {
            allStocks.push({ symbol, name });
          }
        });
      }
    } else if (!sp500WarningShown) {
      toast('SP500 data unavailable; using built-in defaults.', 2600);
      sp500WarningShown = true;
    }
  } catch (err) {
    console.warn('sp500 load failed', err);
    if (!sp500WarningShown) {
      toast('SP500 data failed to load; using built-in defaults.', 2600);
      sp500WarningShown = true;
    }
  }
  return mergedStocks;
}

// kick off loading immediately; fine if it fails, the input handler will retry
ensureStocksLoaded();
const popular = ["Microsoft", "Apple", "Amazon", "Alphabet (Google)", "Tesla", "Meta (Facebook)", "NVIDIA", "Berkshire Hathaway", "Johnson & Johnson", "Visa", "Walmart", "JPMorgan Chase", "Exxon Mobil", "Mastercard", "Procter & Gamble", "Disney", "Bank of America", "Home Depot", "Intel", "Cisco", "Pfizer", "Coca-Cola", "PepsiCo", "Netflix", "Comcast", "Adobe", "AT&T", "Verizon", "IBM", "Salesforce"];

// ===== Premium Logic =====
let isPremium = localStorage.getItem('isPremium') === 'true';
let isAutoCalcEnabled = false; // Default to false (Premium only)
const loginModal = document.getElementById('loginModal');
const premiumBtn = document.getElementById('premiumBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const backToChoiceBtn = document.getElementById('backToChoiceBtn');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const userProfile = document.getElementById('userProfile');
const logoutBtn = document.getElementById('logoutBtn');

// Initial State Check
if (isPremium) {
  enablePremiumMode();
}

if (premiumBtn) {
  premiumBtn.addEventListener('click', () => {
    if (typeof gtag === 'function') {
      gtag('event', 'premium_click', { 'event_category': 'conversion' });
    }
    // Reset view
    document.getElementById('authChoice').style.display = 'block';
    document.getElementById('loginFormView').style.display = 'none';
    loginModal.showModal();
  });
}

if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => loginModal.close());
}

if (showLoginBtn) {
  showLoginBtn.addEventListener('click', () => {
    document.getElementById('authChoice').style.display = 'none';
    document.getElementById('loginFormView').style.display = 'block';
  });
}

if (backToChoiceBtn) {
  backToChoiceBtn.addEventListener('click', () => {
    document.getElementById('loginFormView').style.display = 'none';
    document.getElementById('authChoice').style.display = 'block';
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    loginError.style.display = 'none';

    try {
      const res = await fetch('/.netlify/functions/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        const data = await res.json();
        isPremium = true;
        localStorage.setItem('isPremium', 'true');
        localStorage.setItem('username', data.username);
        enablePremiumMode();
        loginModal.close();
        toast(`Welcome back, ${data.username}!`, 3000);
      } else {
        loginError.textContent = 'Invalid username or password';
        loginError.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
      loginError.textContent = 'Login failed. Please try again.';
      loginError.style.display = 'block';
    }
  });
}

// Global Logout Function (attached via HTML onclick)
window.handleLogout = function () {
  console.log('Global logout triggered');
  // 1. Clear State
  isPremium = false;
  localStorage.removeItem('isPremium');
  localStorage.removeItem('username');

  // 2. Update UI
  disablePremiumMode();

  // 3. Force Reload
  window.location.reload();
};

// Remove old listener logic if present (cleanup)
if (logoutBtn) {
  // We are using onclick in HTML now, so no need for addEventListener here
  // But just in case, let's keep the element reference valid
}



// Auto-fill logic (merged local + sp500.json if present)
async function tryAutoFill(symbol) {
  console.log('tryAutoFill called with:', symbol);
  if (!isPremium) {
    console.log('tryAutoFill aborted: Not premium');
    toast('Auto-fill is a Premium feature. Please enter values manually.');
    return;
  }
  if (!symbol) return;
  const sym = symbol.toUpperCase();

  // Show loading state
  toast(`Searching for ${sym}...`, 2000);

  // --- Dynamic Fetch (Proxy) ---
  // Try to fetch full data from our secure proxy (FMP)
  let proxyData = null;
  try {
    const res = await fetch(`/.netlify/functions/quote?symbol=${sym}`);
    if (res.ok) {
      proxyData = await res.json();
      console.log('Proxy data received:', proxyData);
    } else {
      console.warn('Proxy fetch failed, falling back to static data.');
    }
  } catch (err) {
    console.warn('Proxy error:', err);
    if (window.location.protocol === 'file:') {
      toast('Cannot fetch data locally. Please deploy to Netlify.', 4000);
    }
  }

  // --- Fallback (Static) ---
  await loadSp500Data();
  const staticData = mergedStocks[sym];

  // Decide which data to use
  const data = proxyData || staticData;

  if (!data) {
    console.error('tryAutoFill: No data found for', sym);
    toast(`No data found for ${sym}`, 2000);
    return;
  }

  // Populate UI
  // Note: Proxy returns raw numbers for top-level, Billions for history
  // Static returns raw for top-level, Billions for history
  // So they are compatible.

  const ttmEntry = Array.isArray(data.history)
    ? data.history.find((h) => (h.year || '').toString().toUpperCase() === 'TTM')
    : null;

  // Use TTM if available, otherwise latest history, otherwise top-level
  const latestHistory = data.history && data.history.length > 0 ? data.history[data.history.length - 1] : null;

  const ttmRevenue = ttmEntry ? parseFloat(ttmEntry.revenue) : NaN;
  const latestRevenue = latestHistory ? parseFloat(latestHistory.revenue) : NaN;
  const fallbackRevenue = parseFloat(data.revenue); // Raw

  // Logic: If history revenue is small (< 1000), it's likely Billions. If top level is huge, it's raw.
  // We want Billions for the input field.
  let revenueBillions = 0;
  if (Number.isFinite(ttmRevenue)) revenueBillions = ttmRevenue; // History is already Billions
  else if (Number.isFinite(latestRevenue)) revenueBillions = latestRevenue; // History is already Billions
  else if (Number.isFinite(fallbackRevenue)) revenueBillions = fallbackRevenue / 1e9; // Top level is Raw

  revenue.value = revenueBillions.toFixed(2);
  revSuf.value = 'B';

  // Shares: Proxy returns Raw. Static returns Raw.
  shares.value = (data.shares / 1e9).toFixed(2);
  shSuf.value = 'B';

  pe.value = data.pe ? parseFloat(data.pe).toFixed(2) : '';
  pm.value = data.profitMargin ? parseFloat(data.profitMargin).toFixed(2) : '';
  price.value = data.price ? parseFloat(data.price).toFixed(2) : '';

  calculateCurrent();
  toast(`Auto-filled data for ${data.name || sym}`, 2000);

  if (data.history && isPremium) {
    renderHistoryChart(data.name || sym, data.history);
    // Also update Insights charts if they are visible or just in case user switches tab
    if (typeof renderInsightsCharts === 'function') {
      renderInsightsCharts(data);
    }
  }
}

let historyChartInstance = null;
const barValueLabelsPlugin = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#e5e7eb';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.font = '12px "Inter", system-ui, -apple-system, sans-serif';

    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      meta.data.forEach((bar, idx) => {
        const val = dataset.data[idx];
        if (val == null || !isFinite(val)) return;
        const text = `${Number(val).toFixed(1)}B`;
        let y = bar.y - 8;
        if (y < chart.chartArea.top + 16) y = chart.chartArea.top + 16; // keep labels visible above lines/titles
        ctx.strokeText(text, bar.x, y);
        ctx.fillText(text, bar.x, y);
      });
    });

    ctx.restore();
  }
};

function renderHistoryChart(name, historyData) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded; skipping history chart render.');
    return;
  }
  const ctx = document.getElementById('historyChart');
  const container = document.getElementById('historyChartContainer');

  if (!ctx || !container) return;

  container.style.display = 'block';

  if (historyChartInstance) {
    historyChartInstance.destroy();
  }

  // Reverse history for display (TTM -> Oldest)
  // Create a copy to avoid mutating the original mock data in place if called multiple times
  const history = [...historyData].reverse();

  const labels = history.map(d => d.year);
  const data = history.map(d => d.revenue);

  historyChartInstance = new Chart(ctx, {
    type: 'bar',
    plugins: [barValueLabelsPlugin],
    data: {
      labels: labels,
      datasets: [{
        label: 'Revenue (Billions)',
        data: data,
        backgroundColor: '#FDB931',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${name} - Historical Revenue`,
          color: '#e5e7eb',
          font: { size: 14 }
        },
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(75, 85, 99, 0.2)' },
          ticks: { color: '#9ca3af' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        }
      }
    }
  });

  // Helper to create chart config
  const createConfig = (label, data, color) => ({
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // 1. Revenue
  const ctxRev = document.getElementById('chartRevenue');
  if (ctxRev) {
    if (insightsCharts.revenue) insightsCharts.revenue.destroy();
    insightsCharts.revenue = new Chart(ctxRev, createConfig('Revenue', history.map(h => h.revenue), 'rgba(54, 162, 235, 0.6)'));
  }

  // 2. Revenue Growth
  const ctxRevG = document.getElementById('chartRevenueGrowth');
  if (ctxRevG) {
    if (insightsCharts.revGrowth) insightsCharts.revGrowth.destroy();
    insightsCharts.revGrowth = new Chart(ctxRevG, createConfig('Revenue Growth %', history.map(h => h.revGrowth), 'rgba(75, 192, 192, 0.6)'));
  }

  // 3. Earnings
  const ctxEarn = document.getElementById('chartEarnings');
  if (ctxEarn) {
    if (insightsCharts.earnings) insightsCharts.earnings.destroy();
    insightsCharts.earnings = new Chart(ctxEarn, createConfig('Earnings', history.map(h => h.earnings), 'rgba(153, 102, 255, 0.6)'));
  }

  // 4. Earnings Growth
  const ctxEarnG = document.getElementById('chartEarningsGrowth');
  if (ctxEarnG) {
    if (insightsCharts.earnGrowth) insightsCharts.earnGrowth.destroy();
    insightsCharts.earnGrowth = new Chart(ctxEarnG, createConfig('Earnings Growth %', history.map(h => h.earnGrowth), 'rgba(255, 159, 64, 0.6)'));
  }

  // 5. EPS
  const ctxEPS = document.getElementById('chartEPS');
  if (ctxEPS) {
    if (insightsCharts.eps) insightsCharts.eps.destroy();
    insightsCharts.eps = new Chart(ctxEPS, createConfig('EPS', history.map(h => h.eps), 'rgba(255, 205, 86, 0.6)'));
  }

  // 6. FCF
  const ctxFCF = document.getElementById('chartFCF');
  if (ctxFCF) {
    if (insightsCharts.fcf) insightsCharts.fcf.destroy();
    insightsCharts.fcf = new Chart(ctxFCF, createConfig('Free Cash Flow', history.map(h => h.fcf), 'rgba(201, 203, 207, 0.6)'));
  }

  // 7. Margin
  const ctxMargin = document.getElementById('chartMargin');
  if (ctxMargin) {
    if (insightsCharts.margin) insightsCharts.margin.destroy();
    insightsCharts.margin = new Chart(ctxMargin, createConfig('Net Margin %', history.map(h => h.margin), 'rgba(255, 99, 132, 0.6)'));
  }

  // 8. Shares
  const ctxShares = document.getElementById('chartShares');
  if (ctxShares) {
    if (insightsCharts.shares) insightsCharts.shares.destroy();
    insightsCharts.shares = new Chart(ctxShares, createConfig('Shares Outstanding', history.map(h => h.shares), 'rgba(54, 162, 235, 0.6)'));
  }

  // 9. PE
  const ctxPE = document.getElementById('chartPE');
  if (ctxPE) {
    if (insightsCharts.pe) insightsCharts.pe.destroy();
    insightsCharts.pe = new Chart(ctxPE, createConfig('P/E Ratio', history.map(h => h.pe), 'rgba(153, 102, 255, 0.6)'));
  }

  // 10. ROE
  const ctxROE = document.getElementById('chartROE');
  if (ctxROE) {
    if (insightsCharts.roe) insightsCharts.roe.destroy();
    insightsCharts.roe = new Chart(ctxROE, createConfig('ROE %', history.map(h => h.roe), 'rgba(255, 159, 64, 0.6)'));
  }
}

// Save to Hub Logic
// const saveToHubBtn ... defined at top
const saveDeviceBtn = document.getElementById('saveDeviceBtn');
const saveOptionsDialog = document.getElementById('saveOptionsDialog');
const savePdfBtn = document.getElementById('savePdfBtn');
const saveTxtBtn = document.getElementById('saveTxtBtn');
const saveExcelBtn = document.getElementById('saveExcelBtn');

// Open Save Options
if (saveDeviceBtn) {
  saveDeviceBtn.addEventListener('click', () => {
    saveOptionsDialog.showModal();
  });
}
// Also hook up the first save button to the same dialog for consistency
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    saveOptionsDialog.showModal();
  });
}

// Format Handlers
if (savePdfBtn) {
  savePdfBtn.addEventListener('click', () => {
    saveOptionsDialog.close();
    window.print(); // Simple PDF export via print
  });
}

if (saveTxtBtn) {
  saveTxtBtn.addEventListener('click', () => {
    saveOptionsDialog.close();
    saveResultsAsText();
  });
}

if (saveExcelBtn) {
  saveExcelBtn.addEventListener('click', () => {
    saveOptionsDialog.close();
    saveResultsAsCSV();
  });
}

if (saveToHubBtn) {
  saveToHubBtn.addEventListener('click', () => {
    if (typeof gtag === 'function') {
      gtag('event', 'save_to_hub', { 'event_category': 'engagement', 'event_label': stock.value || 'Unknown' });
    }
    try {
      const ticker = stock.value || 'Unknown';
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Capture all inputs
      let revGrowth = 0;
      if (frMode.value === 'absolute') revGrowth = parseFloat(frAbs.value) || 0;
      else if (frMode.value === 'percentage') revGrowth = parseFloat(frPct.value) || 0;
      else if (frMode.value === 'compounded') revGrowth = parseFloat(frCagr.value) || 0;

      let sharesChange = 0;
      if (fsMode.value === 'absolute') sharesChange = parseFloat(fsAbs.value) || 0;
      else if (fsMode.value === 'percentage') sharesChange = parseFloat(fsPct.value) || 0;
      else if (fsMode.value === 'compounded') sharesChange = parseFloat(fsCagr.value) || 0;

      const inputs = {
        revenue: parseFloat(revenue.value) || 0,
        shares: parseFloat(shares.value) || 0,

        // Future Inputs
        futureRevenueMode: frMode.value,
        futureRevenueGrowth: revGrowth,
        // Note: For Bull case, we need to handle similar logic if we want to support it fully. 
        // For now, let's assume single case or just capture the base values if dual is not active.
        // If dual is active, we should capture base/bull specific inputs.
        // But to keep it simple and working for the main case:

        futureMargin: parseFloat(document.getElementById('futureProfitMargin').value) || 0,

        // FCF Margin (if it exists, check ID)
        futureFCFMargin: parseFloat(document.getElementById('futureFCFMargin')?.value) || 0,

        futureSharesMode: fsMode.value,
        futureSharesChange: sharesChange,

        futurePE: parseFloat(document.getElementById('futurePE').value) || 0,

        futurePE: parseFloat(document.getElementById('futurePE').value) || 0
      };

      // Capture Snapshot Data
      const curPriceVal = parseFloat(price.value) || 0;
      const futPriceText = document.getElementById('futureStockPrice')?.textContent || '0';
      const futPriceVal = parseFloat(futPriceText.replace(/[$,]/g, '')) || 0;

      // Calculate Upside and CAGR
      let upside = 0;
      let cagr = 0;
      if (curPriceVal > 0 && futPriceVal > 0) {
        upside = ((futPriceVal / curPriceVal) - 1) * 100;
        cagr = (Math.pow(futPriceVal / curPriceVal, 1 / 5) - 1) * 100;
      }

      // Calculate Net Income manually if missing
      let netIncomeVal = document.getElementById('earningsValue')?.textContent || '-';
      if (netIncomeVal === '-' || netIncomeVal === '$0' || netIncomeVal === '$0.00') {
        const revVal = parseFloat(revenue.value) || 0;
        // Check variables: 'pm' is defined as document.getElementById('profitMargin')?
        // I need to check if 'pm' variable exists or use document.getElementById('profitMargin')
        const marginVal = parseFloat(document.getElementById('profitMargin')?.value) || 0;
        if (revVal > 0 && marginVal > 0) {
          const ni = revVal * (marginVal / 100);
          netIncomeVal = '$' + ni.toFixed(2) + (document.getElementById('revenueSuffix').value || '');
        }
      }

      const currentMetrics = {
        price: curPriceVal > 0 ? '$' + curPriceVal.toFixed(2) : '-',
        pe: pe.value || '-',
        revenue: revenue.value ? '$' + revenue.value + (document.getElementById('revenueSuffix').value || '') : '-',
        netIncome: netIncomeVal
      };

      const results = {
        futurePrice: futPriceVal > 0 ? '$' + futPriceVal.toFixed(2) : '-',
        upside: upside !== 0 ? upside.toFixed(1) + '%' : '-',
        cagr: cagr !== 0 ? cagr.toFixed(1) + '%' : '-'
      };

      // Save to localStorage
      const newItem = { ticker, date, timestamp: Date.now(), inputs, currentMetrics, results };
      const savedItems = JSON.parse(localStorage.getItem('savedHubItems') || '[]');
      savedItems.unshift(newItem);
      localStorage.setItem('savedHubItems', JSON.stringify(savedItems));

      toast('Analysis saved to My Hub!', 3000);

      renderSavedItems(); // Ensure list is updated immediately
    } catch (e) {
      console.error('Save failed:', e);
      toast('Error saving: ' + e.message, 4000);
    }
  });
}

function renderSavedItems() {
  const savedList = document.getElementById('hubSavedList');
  if (!savedList) return;

  const savedItems = JSON.parse(localStorage.getItem('savedHubItems') || '[]');

  if (savedItems.length === 0) {
    savedList.innerHTML = '<div class="empty-state">No saved items yet.</div>';
    return;
  }

  savedList.innerHTML = '';
  savedItems.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'saved-item';
    div.innerHTML = `
      <div class="saved-header" style="display:flex; justify-content:space-between; align-items:center; padding:12px; cursor:pointer">
        <div style="flex:1">
          <span style="font-weight:600; font-size:1.1em">${item.ticker} Analysis</span>
          <span class="date" style="margin-left:8px; opacity:0.7; font-size:0.9em">${item.date}</span>
        </div>
        <button class="btn ghost sm delete-btn" style="padding:4px 8px; color:var(--muted); border:none" aria-label="Delete">×</button>
      </div>
      
      <div class="saved-details" style="display:none; padding:0 16px 16px 16px; border-top:1px solid var(--border)">
        <!-- Section 1: Snapshot at Time -->
        <div style="margin-bottom:16px">
            <h4 style="margin:12px 0 8px; font-size:0.9em; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8">Snapshot at Time</h4>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap:8px; font-size:0.9em">
                <div><div style="opacity:0.6">Price</div><div>${item.currentMetrics?.price || '-'}</div></div>
                <div><div style="opacity:0.6">P/E</div><div>${item.currentMetrics?.pe || '-'}</div></div>
                <div><div style="opacity:0.6">Revenue</div><div>${item.currentMetrics?.revenue || '-'}</div></div>
                <div><div style="opacity:0.6">Net Income</div><div>${item.currentMetrics?.netIncome || '-'}</div></div>
            </div>
        </div>

        <!-- Section 2: Your Thesis -->
        <div style="margin-bottom:16px">
            <h4 style="margin:12px 0 8px; font-size:0.9em; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8">Your Thesis</h4>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap:8px; font-size:0.9em">
                <div><div style="opacity:0.6">Rev Growth</div><div>${item.inputs?.futureRevenueGrowth || 0}%</div></div>
                <div><div style="opacity:0.6">Profit Margin</div><div>${item.inputs?.futureMargin || 0}%</div></div>
                <div><div style="opacity:0.6">Shares Chg</div><div>${item.inputs?.futureSharesChange || 0}%</div></div>
                <div><div style="opacity:0.6">Terminal P/E</div><div>${item.inputs?.futurePE || 0}</div></div>
            </div>
        </div>

        <!-- Section 3: The Outcome -->
        <div>
            <h4 style="margin:12px 0 8px; font-size:0.9em; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8; color:var(--accent)">The Outcome</h4>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap:8px; font-size:1.1em; font-weight:600">
                <div><div style="font-size:0.7em; opacity:0.6; font-weight:400">Future Price</div><div>${item.results?.futurePrice || '-'}</div></div>
                <div><div style="font-size:0.7em; opacity:0.6; font-weight:400">Upside</div><div style="color:var(--success)">${item.results?.upside || '-'}</div></div>
                <div><div style="font-size:0.7em; opacity:0.6; font-weight:400">CAGR</div><div style="color:var(--success)">${item.results?.cagr || '-'}</div></div>
            </div>
        </div>
      </div>
    `;

    // Toggle details on click
    const header = div.querySelector('.saved-header');
    const details = div.querySelector('.saved-details');

    header.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn')) return;
      const isHidden = details.style.display === 'none';
      details.style.display = isHidden ? 'block' : 'none';
      div.style.background = isHidden ? 'var(--surface-2)' : ''; // Highlight when expanded
    });

    // Delete logic
    const delBtn = div.querySelector('.delete-btn');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent loading
      if (confirm(`Delete ${item.ticker} analysis?`)) {
        savedItems.splice(index, 1);
        localStorage.setItem('savedHubItems', JSON.stringify(savedItems));
        renderSavedItems(); // Re-render
        toast('Item deleted.', 2000);
      }
    });

    savedList.appendChild(div);
  });
}

function saveResultsAsText() {
  const text = `Common Investor Analysis
Date: ${new Date().toLocaleDateString()}
Stock: ${stock.value || 'N/A'}
Price: ${price.value}
Revenue: ${revenue.value} ${revSuf.value}

Future Projections (5Y):
Stock Price: ${document.getElementById('futureStockPrice').textContent}
Revenue: ${document.getElementById('futureRevenueValue').textContent}
Shares: ${document.getElementById('futureSharesValue')?.textContent || '–'}
Earnings: ${document.getElementById('futureEarnings').textContent}
`;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Analysis_${stock.value || 'Stock'}.txt`;
  a.click();
}

function saveResultsAsCSV() {
  const rows = [
    ['Metric', 'Value'],
    ['Stock', stock.value || 'N/A'],
    ['Date', new Date().toLocaleDateString()],
    ['Current Price', price.value],
    ['Future Price', document.getElementById('futureStockPrice').textContent],
    ['Future Revenue', document.getElementById('futureRevenueValue').textContent],
    ['Future Shares', document.getElementById('futureSharesValue')?.textContent || '–']
  ];

  let csvContent = "data:text/csv;charset=utf-8,"
    + rows.map(e => e.join(",")).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Analysis_${stock.value || 'Stock'}.csv`);
  document.body.appendChild(link);
  link.click();
}

function enablePremiumMode() {
  document.documentElement.classList.add('premium-mode');

  // Explicitly set styles (Redundancy for robustness)
  if (premiumBtn) premiumBtn.style.display = 'none';
  if (userProfile) {
    userProfile.style.display = 'flex';
    const storedUser = localStorage.getItem('username');
    if (storedUser) {
      const nameSpan = userProfile.querySelector('.user-name');
      if (nameSpan) nameSpan.textContent = storedUser;
    }
  }

  if (caseModeBtn) caseModeBtn.style.display = 'inline-flex';

  const autoCalcBtn = document.getElementById('autoCalcBtn');
  if (autoCalcBtn) autoCalcBtn.style.display = 'block';

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.style.display = 'inline-block';

  if (saveToHubBtn) saveToHubBtn.style.display = 'inline-block';

  // Persist Premium State
  localStorage.setItem('isPremium', 'true');
  isAutoCalcEnabled = true;

  // Re-render components that depend on premium state
  renderCommunityTop10();
}

function disablePremiumMode() {
  document.documentElement.classList.remove('premium-mode');

  // Explicitly revert styles
  if (premiumBtn) premiumBtn.style.display = 'block';
  if (userProfile) userProfile.style.display = 'none';

  switchTab('projections');

  const autoCalcBtn = document.getElementById('autoCalcBtn');
  if (autoCalcBtn) autoCalcBtn.style.display = 'none';

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.style.display = 'none';

  if (saveToHubBtn) saveToHubBtn.style.display = 'none';
  if (caseModeBtn) caseModeBtn.style.display = 'none';
  setDualCase(false);

  // Hide charts
  const histContainer = document.getElementById('historyChartContainer');
  if (histContainer) histContainer.style.display = 'none';
  const growthContainer = document.getElementById('chartContainer');
  if (growthContainer) growthContainer.style.display = 'none';

  // Clear Premium State
  localStorage.removeItem('isPremium');
  isAutoCalcEnabled = false;

  // Re-render components
  renderCommunityTop10();

  // Revert to Dark Mode (default)
  applyTheme('dark');
}

// Auto-fill logic

let acIndex = -1; // currently highlighted suggestion index
function suggestions(q) {
  if (!q) return [];
  const raw = q.toString().trim();
  if (!raw) return [];
  const l = raw.toUpperCase();
  const tokens = l.split(/\s+/).filter(Boolean);

  // helper: match tokens against company name by word-prefixes in sequence
  const nameMatchesTokens = (tokens, nameUpper) => {
    const words = nameUpper.split(/\s+/).filter(Boolean);
    // try matching tokens to consecutive words starting at any position
    for (let start = 0; start < words.length; start++) {
      let ok = true;
      for (let t = 0; t < tokens.length; t++) {
        const w = words[start + t];
        if (!w || !w.startsWith(tokens[t])) { ok = false; break; }
      }
      if (ok) return true;
    }
    // also try matching against the full name without spaces (useful for joined names)
    const joined = nameUpper.replace(/\s+/g, '');
    if (joined.startsWith(tokens.join(''))) return true;
    return false;
  };

  const matches = [];
  if (allStocks?.length) {
    // First pass: prioritize symbol prefix matches and name prefix / word-prefix matches
    for (const s of allStocks) {
      const sym = (s.symbol || '').toUpperCase();
      const name = (s.name || '').toUpperCase();

      // Symbol: if tokens combined (no spaces) match the symbol prefix
      const combined = tokens.join('');
      if (combined && sym.startsWith(combined)) { matches.push({ symbol: s.symbol, name: s.name, score: 100 }); continue; }

      // If single token and symbol startsWith that token, match
      if (tokens.length === 1 && sym.startsWith(tokens[0])) { matches.push({ symbol: s.symbol, name: s.name, score: 90 }); continue; }

      // Name: check if the full name starts with the raw input or name word-prefixes match tokens
      if (name.startsWith(l) || nameMatchesTokens(tokens, name)) { matches.push({ symbol: s.symbol, name: s.name, score: 80 }); continue; }
    }

    // If we found none, relax to includes matching (symbol or name contains the typed text)
    if (matches.length === 0) {
      for (const s of allStocks) {
        const sym = (s.symbol || '').toUpperCase();
        const name = (s.name || '').toUpperCase();
        if (sym.includes(l) || name.includes(l)) matches.push({ symbol: s.symbol, name: s.name, score: 50 });
      }
    }

    // Final fallback: small fuzzy distance on names
    if (matches.length === 0) {
      const sset = new Set();
      for (const s of allStocks) {
        const name = (s.name || '').toUpperCase();
        const dist = editDistance(l, name);
        if (dist <= 3 && !sset.has(s.name)) { sset.add(s.name); matches.push({ symbol: s.symbol, name: s.name, score: 10 }); }
      }
    }
  } else {
    // fallback to popular list (search by name)
    const l2 = l.toLowerCase();
    for (const p of popular) {
      if (p.toLowerCase().includes(l2)) {
        let sym = '';
        // Map popular names to symbols for the prototype
        if (p === 'Apple') sym = 'AAPL';
        else if (p === 'Microsoft') sym = 'MSFT';
        else if (p === 'Amazon') sym = 'AMZN';
        else if (p === 'Alphabet (Google)') sym = 'GOOGL';
        else if (p === 'Tesla') sym = 'TSLA';
        else if (p === 'Meta (Facebook)') sym = 'META';
        else if (p === 'NVIDIA') sym = 'NVDA';
        else if (p === 'Berkshire Hathaway') sym = 'BRK.B';
        else if (p === 'Johnson & Johnson') sym = 'JNJ';
        else if (p === 'Visa') sym = 'V';

        matches.push({ symbol: sym, name: p, score: 40 });
      }
    }
  }
  // Limit, de-duplicate and sort by score (higher first), then symbol/name
  matches.sort((a, b) => (b.score || 0) - (a.score || 0) || (a.symbol || '').localeCompare(b.symbol || '') || (a.name || '').localeCompare(b.name || ''));
  const uniq = [];
  const seen = new Set();
  for (const m of matches) { const k = (m.symbol || '') + "|" + (m.name || ''); if (!seen.has(k)) { seen.add(k); uniq.push({ symbol: m.symbol, name: m.name }); } if (uniq.length >= 12) break; }
  return uniq;
}
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i; for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
  }
  return dp[a.length][b.length];
}
function renderAC(inputEl = stock, listEl = stockList, onSelect = null) {
  const val = inputEl.value;
  const list = suggestions(val);
  acIndex = -1;
  inputEl.setAttribute('aria-expanded', String(list.length > 0 || val.trim().length > 0));
  listEl.innerHTML = '';
  listEl.classList.toggle('show', list.length > 0 || val.trim().length > 0);

  // Always offer to search for the exact term if user typed something
  if (val.trim().length > 0) {
    const term = val.trim().toUpperCase();
    // Check if exact match already exists at top
    const exactMatch = list.length > 0 && list[0].symbol === term;

    if (!exactMatch) {
      const div = document.createElement('div');
      div.className = 'ac-item';
      div.innerHTML = `<strong>Search for "${term}"</strong>`;
      div.setAttribute('role', 'option');
      div.dataset.symbol = term;
      div.addEventListener('mousedown', () => {
        inputEl.value = term;
        listEl.classList.remove('show');
        if (onSelect) {
          onSelect(term);
        } else {
          // Default behavior (Main Calculator)
          const si = document.getElementById('stockInsights'); if (si) si.value = term;
          updateActiveCompany();
          tryAutoFill(term);
        }
      });
      // Prepend to list
      listEl.prepend(div);
    }
  }

  list.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'ac-item';
    div.innerHTML = `<strong>${item.symbol}</strong> &mdash; <span class="ac-name">${item.name}</span>`;
    div.setAttribute('role', 'option'); div.id = 'opt-' + i; div.dataset.symbol = item.symbol;
    div.addEventListener('mousedown', () => {
      inputEl.value = item.symbol || item.name;
      listEl.classList.remove('show');
      if (onSelect) {
        onSelect(item.symbol);
      } else {
        // Default behavior (Main Calculator)
        const si = document.getElementById('stockInsights'); if (si) si.value = inputEl.value;
        updateActiveCompany();
        if (item.symbol) tryAutoFill(item.symbol);
      }
    });
    listEl.appendChild(div);
  });

  // Re-index all children for keyboard nav
  Array.from(listEl.children).forEach((child, idx) => {
    child.addEventListener('mouseover', () => setACIndex(idx)); // Note: setACIndex might need refactoring too if it relies on global vars, but for now it's visual.
  });
}
stock.addEventListener('input', async (e) => {
  // Try to ensure the stock list is loaded; if it fails we keep using the fallback list.
  if (!allStocks.length) await ensureStocksLoaded();
  renderAC(stock, stockList);
  updateActiveCompany();
});
stock.addEventListener('blur', () => setTimeout(() => stockList.classList.remove('show'), 150));

// keyboard navigation: ArrowUp / ArrowDown / Enter
stock.addEventListener('keydown', (e) => {
  const items = Array.from(stockList.querySelectorAll('.ac-item'));

  // Allow Enter to proceed even if no items (for custom stocks)
  if (!items.length && e.key !== 'Enter') return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (items.length) setACIndex(Math.min(items.length - 1, acIndex + 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (items.length) setACIndex(Math.max(0, acIndex - 1));
  } else if (e.key === 'Enter') {
    // 1. If an item is explicitly selected via keys
    if (acIndex > -1 && items[acIndex]) {
      const sel = items[acIndex];
      stock.value = sel.dataset.symbol || sel.textContent;
      const si = document.getElementById('stockInsights'); if (si) si.value = stock.value;
      updateActiveCompany();
      if (sel.dataset.symbol) tryAutoFill(sel.dataset.symbol);
    }
    // 2. If no item selected but list has items, default to first (existing behavior)
    else if (items.length > 0) {
      const first = items[0];
      stock.value = first.dataset.symbol || first.textContent;
      const si = document.getElementById('stockInsights'); if (si) si.value = stock.value;
      updateActiveCompany();
      if (first.dataset.symbol) tryAutoFill(first.dataset.symbol);
    }
    // 3. If list is empty (custom stock like SOFI), use typed value
    else {
      const val = stock.value.trim();
      if (val) {
        updateActiveCompany();
        tryAutoFill(val);
      }
    }

    stockList.classList.remove('show');
    // allow form submission if any, so don't preventDefault unless you need to
    // e.preventDefault(); // Optional: prevent form submit if inside form
  }
});

function setACIndex(idx) {
  const items = Array.from(stockList.querySelectorAll('.ac-item'));
  items.forEach((it, i) => it.classList.toggle('selected', i === idx));
  acIndex = idx;
}

// ===== Mode toggles =====
function toggleRevMode() {
  const m = frMode.value;
  if (frLabel) {
    let text = 'Projection Input';
    if (m === 'absolute') text = 'Projection Input: Absolute Value';
    else if (m === 'percentage') text = 'Projection Input: Percent Change';
    else if (m === 'compounded') text = 'Projection Input: Revenue CAGR';
    frLabel.textContent = text;
  }
  if (frLabelDual) {
    let text = 'Projection Input (Base/Bull)';
    if (m === 'absolute') text = 'Projection Input (Base/Bull): Absolute';
    else if (m === 'percentage') text = 'Projection Input (Base/Bull): Percent Change';
    else if (m === 'compounded') text = 'Projection Input (Base/Bull): Revenue CAGR';
    frLabelDual.textContent = text;
  }
  // show via empty string so CSS controls the display type (flex/grid)
  frAbsC.style.display = (!dualCaseEnabled && m === 'absolute') ? '' : 'none';
  frPctC.style.display = (!dualCaseEnabled && m === 'percentage') ? '' : 'none';
  frCagrC.style.display = (!dualCaseEnabled && m === 'compounded') ? '' : 'none';
  if (frAbsCDual) frAbsCDual.style.display = (dualCaseEnabled && m === 'absolute') ? '' : 'none';
  if (frPctCDual) frPctCDual.style.display = (dualCaseEnabled && m === 'percentage') ? '' : 'none';
  if (frCagrCDual) frCagrCDual.style.display = (dualCaseEnabled && m === 'compounded') ? '' : 'none';
}
function toggleSharesMode() {
  const m = fsMode.value;
  if (fsLabel) {
    const text = (m === 'absolute')
      ? 'Projection Input: Absolute Value'
      : m === 'percentage'
        ? 'Projection Input: Percent Change'
        : 'Projection Input: Shares CAGR';
    fsLabel.textContent = text;
  }
  fsAbsC.style.display = (!dualCaseEnabled && m === 'absolute') ? '' : 'none';
  fsPctC.style.display = (!dualCaseEnabled && m === 'percentage') ? '' : 'none';
  fsCagrC.style.display = (!dualCaseEnabled && m === 'compounded') ? '' : 'none';
  if (fsLabelDual) {
    const text = (m === 'absolute')
      ? 'Shares Input (Base/Bull): Absolute'
      : m === 'percentage'
        ? 'Shares Input (Base/Bull): Percent Change'
        : 'Shares Input (Base/Bull): Shares CAGR';
    fsLabelDual.textContent = text;
  }
  if (fsAbsCDual) fsAbsCDual.style.display = (dualCaseEnabled && m === 'absolute') ? '' : 'none';
  if (fsPctCDual) fsPctCDual.style.display = (dualCaseEnabled && m === 'percentage') ? '' : 'none';
  if (fsCagrCDual) fsCagrCDual.style.display = (dualCaseEnabled && m === 'compounded') ? '' : 'none';
}
frMode.addEventListener('change', toggleRevMode); toggleRevMode();
fsMode.addEventListener('change', toggleSharesMode); toggleSharesMode();

// ===== Dual-case helpers =====
function gatePremiumDual() {
  if (isPremium) return true;
  if (loginModal?.showModal) {
    loginModal.showModal();
    loginModal.style.display = 'flex';
  }
  toast('Base/Bull mode is a Premium feature.');
  return false;
}

function copySinglesToDual() {
  // Copy Single -> Base
  if (frAbsBase) frAbsBase.value = frAbs?.value || '';
  if (frSufBase) frSufBase.value = frSuf?.value || '';
  if (frPctBase) frPctBase.value = frPct?.value || '';
  if (frDirBase) frDirBase.value = frDir?.value || 'increase';
  if (frCagrBase) frCagrBase.value = frCagr?.value || '';
  if (frCagrDirBase) frCagrDirBase.value = frCagrDir?.value || 'increase';

  if (fsAbsBase) fsAbsBase.value = fsAbs?.value || '';
  if (fsSufBase) fsSufBase.value = fsSuf?.value || '';
  if (fsPctBase) fsPctBase.value = fsPct?.value || '';
  if (fsDirBase) fsDirBase.value = fsDir?.value || 'increase';
  if (fsCagrBase) fsCagrBase.value = fsCagr?.value || '';
  if (fsCagrDirBase) fsCagrDirBase.value = fsCagrDir?.value || 'increase';

  if (fPEBase) fPEBase.value = fPE?.value || '';
  if (fPMBase) fPMBase.value = fPM?.value || '';

  // Clear Bull fields (or set defaults)
  if (frAbsBull) frAbsBull.value = '';
  if (frSufBull) frSufBull.value = '';
  if (frPctBull) frPctBull.value = '';
  if (frDirBull) frDirBull.value = 'increase';
  if (frCagrBull) frCagrBull.value = '';
  if (frCagrDirBull) frCagrDirBull.value = 'increase';

  if (fsAbsBull) fsAbsBull.value = '';
  if (fsSufBull) fsSufBull.value = '';
  if (fsPctBull) fsPctBull.value = '';
  if (fsDirBull) fsDirBull.value = 'increase';
  if (fsCagrBull) fsCagrBull.value = '';
  if (fsCagrDirBull) fsCagrDirBull.value = 'increase';

  if (fPEBull) fPEBull.value = '';
  if (fPMBull) fPMBull.value = '';
}

function setDualCase(enabled) {
  dualCaseEnabled = Boolean(enabled);
  document.body.dataset.dualCase = dualCaseEnabled ? 'true' : 'false';
  const singles = $$('.single-case-block');
  const duals = $$('.dual-case-block');
  singles.forEach(el => { el.style.display = dualCaseEnabled ? 'none' : ''; });
  duals.forEach(el => { el.style.display = dualCaseEnabled ? '' : 'none'; });

  const revSingle = $('#futureRevenueControls');
  const revDual = $('#futureRevenueControlsDual');
  const shSingle = $('#futureSharesControls');
  const shDual = $('#futureSharesControlsDual');
  if (revSingle) revSingle.style.display = dualCaseEnabled ? 'none' : '';
  if (revDual) revDual.style.display = dualCaseEnabled ? 'block' : 'none';
  if (shSingle) shSingle.style.display = dualCaseEnabled ? 'none' : '';
  if (shDual) shDual.style.display = dualCaseEnabled ? 'block' : 'none';

  if (singleCaseResults) singleCaseResults.style.display = dualCaseEnabled ? 'none' : '';
  if (dualCaseResults) dualCaseResults.style.display = dualCaseEnabled ? 'table' : 'none';

  if (caseModeBtn) caseModeBtn.textContent = dualCaseEnabled ? 'Base + Bull: On' : '🐂 / 🛡 Base + Bull';
  if (dualCaseEnabled) copySinglesToDual();
  toggleRevMode();
  toggleSharesMode();
  calculateFuture();

  // Update Smart Dropdowns based on new mode
  if (typeof updateAllSmartDropdowns === 'function') {
    updateAllSmartDropdowns();
  }
}

// ===== Calculations =====
function calculateCurrent() {
  try {
    const rev = parseValueCurrent(revenue.value, revSuf.value);
    const sh = parseValueCurrent(shares.value, shSuf.value);
    const m = parseMargin(pm.value);
    const p = parseFloat(price.value) || 0;

    const earn = rev * m;
    const _eps = sh ? earn / sh : 0;

    const formattedEarn = isFinite(earn) ? fmtAbbrFullHtml(earn) : '–';
    if (earnings) earnings.innerHTML = formattedEarn;

    if (eps) eps.textContent = isFinite(_eps) ? _eps.toFixed(2) : '–';

    const market = (sh > 0 && p > 0) ? sh * p : 0;
    const formattedMarket = market > 0 ? fmtAbbrFullHtml(market) : '–';
    if (mv) mv.innerHTML = formattedMarket;
    if (summaryMarket) summaryMarket.textContent = market > 0 ? '$' + fmtMB(market) : '–';

    // Only auto-run future calc after the user has explicitly calculated once
    if (typeof isAutoCalcEnabled !== 'undefined' && isAutoCalcEnabled) {
      calculateFuture();
    }
  } catch (err) {
    console.error('calculateCurrent error:', err);
    alert('Error in calculateCurrent: ' + err.message);
  }
}

function calculateFuture(isManual = false) {
  // Premium Guard: Only allow if Premium OR Manual (which has its own check)
  if (!isManual) {
    if (!isPremium || !isAutoCalcEnabled) return;
  }

  // Mandatory Name Check
  if (!stock.value.trim()) {
    if (isManual) {
      alert('Please enter a Company Name or Ticker to proceed.');
      stock.focus();
    }
    return;
  }

  const pickEl = (singleEl, baseEl, bullEl, caseKey) => {
    if (!dualCaseEnabled || caseKey === 'single') return singleEl;
    return caseKey === 'base' ? baseEl : bullEl;
  };

  // Re-calculate these values first
  const curRev = parseValueCurrent(revenue.value, revSuf.value);
  const curSh = parseValueCurrent(shares.value, shSuf.value);
  const curPrice = parseFloat(price.value) || 0;
  const marginCurrent = parseMargin(pm.value);
  const peCurrent = parseFloat(pe.value);
  const mode = frMode.value;
  const sm = fsMode.value;

  const caseKeys = dualCaseEnabled ? ['base', 'bull'] : ['single'];
  const caseOutputs = {
    single: { price: fPrice, rev: fRev, shares: fShOut, earn: fEarn, eps: fEPS, mv: fMV },
    base: { price: fPriceBase, rev: fRevBase, shares: fShOutBase, earn: fEarnBase, eps: fEPSBase, mv: fMVBase },
    bull: { price: fPriceBull, rev: fRevBull, shares: fShOutBull, earn: fEarnBull, eps: fEPSBull, mv: fMVBull }
  };

  const results = {};

  for (const key of caseKeys) {
    // Check if Future Revenue input has value
    let hasInput = false;
    if (mode === 'absolute') {
      const el = pickEl(frAbs, frAbsBase, frAbsBull, key);
      if (el && el.value.trim() !== '') hasInput = true;
    } else if (mode === 'percentage') {
      const el = pickEl(frPct, frPctBase, frPctBull, key);
      if (el && el.value.trim() !== '') hasInput = true;
    } else if (mode === 'compounded') {
      const el = pickEl(frCagr, frCagrBase, frCagrBull, key);
      if (el && el.value.trim() !== '') hasInput = true;
    }

    if (!hasInput) {
      // Clear results for this case
      results[key] = {
        price: '–', rev: '–', shares: '–', earn: '–', eps: '–', mv: '–'
      };
      continue;
    }

    // Revenue
    let futRev = 0;
    if (mode === 'absolute') {
      const el = pickEl(frAbs, frAbsBase, frAbsBull, key);
      const sufEl = pickEl(frSuf, frSufBase, frSufBull, key);
      futRev = parseValueCurrent(el?.value, sufEl?.value);
    } else if (mode === 'percentage') {
      const pctEl = pickEl(frPct, frPctBase, frPctBull, key);
      const dirEl = pickEl(frDir, frDirBase, frDirBull, key);
      const pct = parseFloat(pctEl?.value);
      if (!isNaN(pct) && curRev > 0) {
        futRev = (dirEl?.value === 'increase') ? curRev * (1 + pct / 100) : curRev * (1 - pct / 100);
      }
    } else if (mode === 'compounded') {
      const cagrEl = pickEl(frCagr, frCagrBase, frCagrBull, key);
      const dirEl = pickEl(frCagrDir, frCagrDirBase, frCagrDirBull, key);
      const r = parseFloat(cagrEl?.value);
      if (!isNaN(r) && curRev > 0) {
        futRev = (dirEl?.value === 'increase') ? curRev * Math.pow(1 + r / 100, 5) : curRev * Math.pow(1 - r / 100, 5);
      }
    }
    if (curRev > 0 && futRev <= 0) futRev = curRev;

    // Shares
    let futSh = 0;
    if (sm === 'absolute') {
      const el = pickEl(fsAbs, fsAbsBase, fsAbsBull, key);
      const sufEl = pickEl(fsSuf, fsSufBase, fsSufBull, key);
      futSh = parseValueCurrent(el?.value, sufEl?.value);
    } else if (sm === 'percentage') {
      const pctEl = pickEl(fsPct, fsPctBase, fsPctBull, key);
      const dirEl = pickEl(fsDir, fsDirBase, fsDirBull, key);
      const pct = parseFloat(pctEl?.value);
      if (!isNaN(pct) && curSh > 0) {
        futSh = (dirEl?.value === 'increase') ? curSh * (1 + pct / 100) : curSh * (1 - pct / 100);
      }
    } else if (sm === 'compounded') {
      const cagrEl = pickEl(fsCagr, fsCagrBase, fsCagrBull, key);
      const dirEl = pickEl(fsCagrDir, fsCagrDirBase, fsCagrDirBull, key);
      const r = parseFloat(cagrEl?.value);
      if (!isNaN(r) && curSh > 0) {
        const years = 5;
        const factor = Math.pow(1 + (dirEl?.value === 'increase' ? 1 : -1) * r / 100, years);
        futSh = curSh * factor;
      }
    }
    if (!isFinite(futSh)) futSh = 0;
    if (curSh > 0 && futSh <= 0) futSh = curSh;

    // P/E & margin
    const peInput = pickEl(fPE, fPEBase, fPEBull, key);
    let peF = parseFloat(peInput?.value);
    if (!(isFinite(peF) && peF > 0)) {
      peF = (isFinite(peCurrent) && peCurrent > 0) ? peCurrent : NaN;
    }

    const pmInput = pickEl(fPM, fPMBase, fPMBull, key);
    const pmF = parseFloat(pmInput?.value);
    const margin = (isFinite(pmF) && pmF > 0) ? pmF / 100 : marginCurrent;

    let futEarn = 0, futEPS = 0, futPrice = 0;
    if (futRev > 0 && margin > 0) futEarn = futRev * margin;
    if (futSh > 0) futEPS = futEarn / futSh;
    if (!isNaN(peF) && futEPS) futPrice = futEPS * peF;

    const futMV = (futSh > 0 && futPrice > 0) ? futSh * futPrice : 0;

    results[key] = { futRev, futSh, futEarn, futEPS, futPrice, futMV, marginUsed: margin, peUsed: peF, curPrice };

    // Update per-case UI
    const out = caseOutputs[key];
    if (out?.price) out.price.textContent = futPrice > 0 ? '$' + futPrice.toFixed(2) : '–';
    if (out?.price) out.price?.classList?.toggle('success', futPrice > 0);
    if (out?.rev) out.rev.innerHTML = futRev > 0 ? fmtAbbrFullHtml(futRev) : '–';
    if (out?.shares) out.shares.innerHTML = futSh > 0 ? fmtAbbrFullHtml(futSh) : '–';
    if (out?.earn) out.earn.innerHTML = futEarn > 0 ? fmtAbbrFullHtml(futEarn) : '–';
    if (out?.eps) out.eps.textContent = futEPS > 0 ? futEPS.toFixed(2) : '–';
    if (out?.mv) out.mv.innerHTML = futMV > 0 ? fmtAbbrFullHtml(futMV) : '–';
  }

  const primaryKey = dualCaseEnabled ? 'base' : 'single';
  const primary = results[primaryKey] || {};

  // Update summary card and single outputs with primary case
  if (caseOutputs.single?.price) caseOutputs.single.price.textContent = primary.futPrice > 0 ? '$' + primary.futPrice.toFixed(2) : '–';
  if (caseOutputs.single?.rev) caseOutputs.single.rev.innerHTML = primary.futRev > 0 ? fmtAbbrFullHtml(primary.futRev) : '–';
  if (caseOutputs.single?.shares) caseOutputs.single.shares.innerHTML = primary.futSh > 0 ? fmtAbbrFullHtml(primary.futSh) : '–';
  if (caseOutputs.single?.earn) caseOutputs.single.earn.innerHTML = primary.futEarn > 0 ? fmtAbbrFullHtml(primary.futEarn) : '–';
  if (caseOutputs.single?.eps) caseOutputs.single.eps.textContent = primary.futEPS > 0 ? primary.futEPS.toFixed(2) : '–';
  if (caseOutputs.single?.mv) caseOutputs.single.mv.innerHTML = primary.futMV > 0 ? fmtAbbrFullHtml(primary.futMV) : '–';

  if (summaryFuturePrice) summaryFuturePrice.textContent = primary.futPrice > 0 ? '$' + primary.futPrice.toFixed(2) : '–';
  if (summaryFutureMarket) summaryFutureMarket.textContent = primary.futMV > 0 ? '$' + fmtMB(primary.futMV) : '–';

  // Collect warnings for missing inputs so we can show helpful flags instead of throwing
  const warnings = [];
  if (!(primary.futPrice > 0)) {
    warnings.push('Add revenue, profit margin, P/E, and share count to compute a future stock price.');
  }
  if (!(curPrice > 0)) {
    warnings.push('Enter today’s share price to compare against the S&P 500.');
  }

  // S&P compare + 2x (S&P = +50% over 5y) + buy targets (based on primary/base)
  spComp.textContent = ''; spTarget.innerHTML = ''; if (flags) flags.innerHTML = '';
  if (curPrice > 0 && primary.futPrice > 0) {
    const SP_FACTOR = 1.5;
    const TWO_X = 2;

    const beatsSP = (primary.futPrice >= curPrice * SP_FACTOR);
    const hits2x = (primary.futPrice >= curPrice * TWO_X);

    const buyToBeatSP = primary.futPrice / SP_FACTOR;
    const buyFor2x = primary.futPrice / TWO_X;

    spTarget.innerHTML =
      `Price target to beat S&P 500: <strong>$${buyToBeatSP.toFixed(2)}</strong><br>` +
      `Price target for 2× return: <strong>$${buyFor2x.toFixed(2)}</strong>`;

    const overallMultiple = primary.futPrice / curPrice;
    const overallPctGain = (overallMultiple - 1) * 100;
    const vsSpxMultiple = overallMultiple / SP_FACTOR;

    spComp.textContent = beatsSP ? 'Beating S&P 500' : 'Not beating S&P 500';

    if (summarySPFlag) {
      summarySPFlag.classList.remove('is-good', 'is-bad', 'is-warn');
      if (beatsSP && hits2x) {
        summarySPFlag.textContent = '🚀 Crushing the S&P pace';
        summarySPFlag.classList.add('is-good');
      } else if (beatsSP && !hits2x) {
        summarySPFlag.textContent = '✅ Ahead of the S&P pace';
        summarySPFlag.classList.add('is-warn');
      } else {
        summarySPFlag.textContent = '🛑 Below the S&P pace';
        summarySPFlag.classList.add('is-bad');
      }
    }

    // Outcome Flags
    const outcomeFlags = $('#outcomeFlags');
    if (outcomeFlags) {
      if (dualCaseEnabled) {
        // Dual Case: Show two columns
        const baseHTML = getOutcomeHTML(results.base, curPrice, 'Base Case');
        const bullHTML = getOutcomeHTML(results.bull, curPrice, 'Bull Case');

        outcomeFlags.innerHTML = `
          <div class="dual-outcome-grid">
            <div class="dual-outcome-col">
              <h4>Base Case</h4>
              ${baseHTML}
            </div>
            <div class="dual-outcome-col">
              <h4>Bull Case</h4>
              ${bullHTML}
            </div>
          </div>
        `;
      } else {
        // Single Case: Show standard flags
        outcomeFlags.innerHTML = getOutcomeHTML(results.single, curPrice);
      }
    }
  } else {
    if (flags) {
      const extra = [];
      if (warnings.length) {
        warnings.forEach(msg => {
          extra.push(`<div class="flag warn">${msg}</div>`);
        });
      }
      flags.innerHTML = extra.join('');
    }
    if (warnings.length) {
      spComp.textContent = 'Add missing inputs to complete the projection';
      spTarget.innerHTML = '';
    }
    if (!(curPrice > 0)) {
      spComp.textContent = 'Price needed for S&P comparison';
      spTarget.innerHTML = '';
    }
  }

  // Render Chart if Premium (using primary case)
  if (isPremium && primary.futPrice > 0 && curPrice > 0) {
    renderGrowthChart(curPrice, primary.futPrice);
  }

  lastFutureCalc = primary;
  return primary;
}

function getOutcomeHTML(res, curPrice, label) {
  if (!res || !(res.futPrice > 0) || !(curPrice > 0)) return '';

  const SP_FACTOR = 1.5;
  const TWO_X = 2;

  const beatsSP = (res.futPrice >= curPrice * SP_FACTOR);
  const hits2x = (res.futPrice >= curPrice * TWO_X);

  const buyToBeatSP = res.futPrice / SP_FACTOR;
  const buyFor2x = res.futPrice / TWO_X;

  const overallMultiple = res.futPrice / curPrice;
  const overallPctGain = (overallMultiple - 1) * 100;
  const vsSpxMultiple = overallMultiple / SP_FACTOR;

  if (beatsSP && hits2x) {
    return `<div class="flag good">🚀 Crushing the S&P’s 5-year pace — your <strong>return</strong> is about <strong>${overallMultiple.toFixed(2)}×</strong> from today (≈ <strong>${overallPctGain.toFixed(1)}%</strong>), and roughly <strong>${vsSpxMultiple.toFixed(2)}×</strong> the S&P’s <strong>return</strong>.</div>`;
  } else if (beatsSP && !hits2x) {
    return `<div class="flag good">✅ You’re ahead of the S&P 500’s 5-year pace — your <strong>return</strong> is ~<strong>${overallMultiple.toFixed(2)}×</strong> from today (≈ <strong>${overallPctGain.toFixed(1)}%</strong>), ~<strong>${vsSpxMultiple.toFixed(2)}×</strong> the S&P’s <strong>return</strong>.</div>` +
      `<div class="flag warn">⚠️ Not at 2× yet — buy at or below <strong>$${buyFor2x.toFixed(2)}</strong> to lock a 2× <strong>return</strong>.</div>`;
  } else {
    return `<div class="flag bad">🛑 Not beating the S&P 500 and not reaching a 2× <strong>return</strong>.</div>` +
      `<div class="flag bad">Targets: ≤ <strong>$${buyToBeatSP.toFixed(2)}</strong> to beat S&P; ≤ <strong>$${buyFor2x.toFixed(2)}</strong> for a 2× <strong>return</strong>.</div>`;
  }
}

let growthChartInstance = null;

function renderGrowthChart(currentPrice, futurePrice) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded; skipping growth chart render.');
    return;
  }
  const ctx = document.getElementById('growthChart');
  const container = document.getElementById('chartContainer');

  if (!ctx || !container) return;

  container.style.display = 'block';

  // Calculate CAGR for the stock
  const years = 5;
  const stockCAGR = (Math.pow(futurePrice / currentPrice, 1 / years) - 1);

  // S&P 500 Assumption: 10% annual growth
  const spCAGR = 0.10;

  // Generate data points
  const labels = ['Year 0', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
  const stockData = [];
  const spData = [];

  for (let i = 0; i <= years; i++) {
    stockData.push(currentPrice * Math.pow(1 + stockCAGR, i));
    spData.push(currentPrice * Math.pow(1 + spCAGR, i));
  }

  const companyLabel = (stock?.value || 'Your Stock').trim() || 'Your Stock';
  const spBeats = spData[spData.length - 1] > stockData[stockData.length - 1];
  const spLineColor = spBeats ? '#ef4444' /* red if S&P return is higher */ : '#22c55e'; /* green if lower */

  if (growthChartInstance) {
    growthChartInstance.destroy();
  }

  Chart.defaults.color = '#9ca3af';
  Chart.defaults.font.family = 'system-ui';

  growthChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: companyLabel,
          data: stockData,
          borderColor: '#FFD700', // Gold
          backgroundColor: 'rgba(255, 215, 0, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          pointBackgroundColor: '#FFD700',
          fill: true
        },
        {
          label: 'S&P 500 (10% Benchmark)',
          data: spData,
          borderColor: spLineColor,
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          labels: {
            color: '#e5e7eb',
            font: { size: 14, weight: 'bold' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.9)',
          titleColor: '#FFD700',
          bodyColor: '#fff',
          padding: 12,
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
              }
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          grid: {
            color: 'rgba(75, 85, 99, 0.2)'
          },
          ticks: {
            callback: function (value) {
              return '$' + value;
            }
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// ===== Validation (Suffix) =====
function validateSuffixes(next) {
  const clean = (s) => (s || '').toString().trim().replace(/[$,%\s,]/g, '');
  const hasUnit = (value) => /[MBT]$/i.test(value);
  const hasDropdown = (sel) => !!sel && sel.selectedIndex >= 0; // treat any selection (including “none”) as explicit

  const revTyped = clean(revenue.value);
  const shTyped = clean(shares.value);
  const frTyped = clean(frAbs.value);
  const fsTyped = clean(fsAbs.value);

  const revMissing = Boolean(revTyped && !hasUnit(revTyped) && !hasDropdown(revSuf));
  const shMissing = Boolean(shTyped && !hasUnit(shTyped) && !hasDropdown(shSuf));
  const frMissing = Boolean(frMode.value === 'absolute' && frTyped && !hasUnit(frTyped) && !hasDropdown(frSuf));
  const fsMissing = Boolean(fsMode.value === 'absolute' && fsTyped && !hasUnit(fsTyped) && !hasDropdown(fsSuf));

  if (!revMissing && !shMissing && !frMissing && !fsMissing) return next();

  suffixDialog.dataset.pendingCallback = next;
  suffixBody.innerHTML = '';
  toast('Please select units for each value', 3000);

  const createRow = (label, field, value) => {
    const wrapper = document.createElement('div');
    wrapper.style.margin = '12px 0';
    wrapper.innerHTML = `
      <label style="display:block; margin-bottom:8px; font-weight:500">${label}</label>
      <select data-field="${field}" class="suffix" required style="width:100%; padding:8px">
        <option value="" selected disabled>Select unit (required)</option>
        <option value="M">Millions (M)</option>
        <option value="B">Billions (B)</option>
        <option value="T">Trillions (T)</option>
        <option value="none">None</option>
      </select>
      <p class="help" style="margin-top:4px">Current value: ${value || '—'}</p>
    `;
    suffixBody.appendChild(wrapper);
  };

  if (revMissing) createRow('Revenue (TTM)', 'revenue', revTyped);
  if (shMissing) createRow('Outstanding Shares', 'shares', shTyped);
  if (frMissing) createRow('Future Revenue', 'futureRevenue', frTyped);
  if (fsMissing) createRow('Future Shares', 'futureShares', fsTyped);

  suffixDialog.showModal();
  const confirmBtn = $('#suffixConfirmBtn');
  const cancelBtn = $('#suffixCancelBtn');

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      suffixDialog.close();
    };
  }

  confirmBtn.onclick = () => {
    const selects = suffixBody.querySelectorAll('select');
    const allSelected = Array.from(selects).every(sel => sel.value !== '');
    if (!allSelected) {
      toast('Please select units for all values', 2000);
      return;
    }

    selects.forEach(sel => {
      const f = sel.dataset.field;
      const normalized = sel.value === 'none' ? '' : sel.value;
      if (f === 'revenue' && revSuf) revSuf.value = normalized;
      else if (f === 'shares' && shSuf) shSuf.value = normalized;
      else if (f === 'futureRevenue' && frSuf) frSuf.value = normalized;
      else if (f === 'futureShares' && fsSuf) fsSuf.value = normalized;
    });
    suffixDialog.close();
    next();
  };
}

// ===== Shareable link (no calc storage) =====
function getState() {
  return {
    stock: stock.value,
    date: dateEl.value,
    revenue: revenue.value,
    revSuf: revSuf?.value || '',
    shares: shares.value,
    shSuf: shSuf?.value || '',
    pe: pe.value,
    pm: pm.value,
    price: price.value,
    frMode: frMode.value,
    frAbs: frAbs?.value || '',
    frSuf: frSuf?.value || '',
    frPct: frPct?.value || '',
    frDir: frDir?.value || '',
    frCagr: frCagr?.value || '',
    frCagrDir: frCagrDir?.value || '',
    fsMode: fsMode.value,
    fsAbs: fsAbs?.value || '',
    fsSuf: fsSuf?.value || '',
    fsPct: fsPct?.value || '',
    fsDir: fsDir?.value || '',
    fsCagr: fsCagr?.value || '',
    fsCagrDir: fsCagrDir?.value || '',
    fPE: fPE.value,
    fPM: fPM.value
  }
}
function applyState(s) {
  if (!s) return;
  stock.value = s.stock || '';
  dateEl.value = s.date || dateEl.value;

  revenue.value = s.revenue || '';
  if (revSuf) revSuf.value = s.revSuf || '';

  shares.value = s.shares || '';
  if (shSuf) shSuf.value = s.shSuf || '';

  pe.value = s.pe ? parseFloat(s.pe).toFixed(2) : '';
  pm.value = s.pm ? parseFloat(s.pm).toFixed(2) : '';
  price.value = s.price ? parseFloat(s.price).toFixed(2) : '';

  frMode.value = s.frMode || 'absolute';
  if (frAbs) frAbs.value = s.frAbs || '';
  if (frSuf) frSuf.value = s.frSuf || '';
  if (frPct) frPct.value = s.frPct || '';
  if (frDir) frDir.value = s.frDir || 'increase';
  if (frCagr) frCagr.value = s.frCagr || '';
  if (frCagrDir) frCagrDir.value = s.frCagrDir || 'increase';

  fsMode.value = s.fsMode || 'absolute';
  if (fsAbs) fsAbs.value = s.fsAbs || '';
  if (fsSuf) fsSuf.value = s.fsSuf || '';
  if (fsPct) fsPct.value = s.fsPct || '';
  if (fsDir) fsDir.value = s.fsDir || 'increase';
  if (fsCagr) fsCagr.value = s.fsCagr || '';
  if (fsCagrDir) fsCagrDir.value = s.fsCagrDir || 'increase';

  fPE.value = s.fPE || '';
  fPM.value = s.fPM || '';
  toggleRevMode(); toggleSharesMode();
  updateActiveCompany();
}
function encodeState() { return btoa(unescape(encodeURIComponent(JSON.stringify(getState())))) }
function decodeState(s) { try { return JSON.parse(decodeURIComponent(escape(atob(s)))) } catch { return null } }
const SHARE_FIELDS = [
  { field: 'stock', key: 'c' },
  { field: 'date', key: 'd' },
  { field: 'revenue', key: 'rv' },
  { field: 'revSuf', key: 'rvs' },
  { field: 'shares', key: 'sh' },
  { field: 'shSuf', key: 'shs' },
  { field: 'pe', key: 'pe' },
  { field: 'pm', key: 'pm' },
  { field: 'price', key: 'pp' },
  { field: 'frMode', key: 'frm', defaultValue: 'absolute' },
  { field: 'frAbs', key: 'fra' },
  { field: 'frSuf', key: 'fras' },
  { field: 'frPct', key: 'frp' },
  { field: 'frDir', key: 'frd', defaultValue: 'increase' },
  { field: 'frCagr', key: 'frc' },
  { field: 'frCagrDir', key: 'frcd', defaultValue: 'increase' },
  { field: 'fsMode', key: 'fsm', defaultValue: 'absolute' },
  { field: 'fsAbs', key: 'fsa' },
  { field: 'fsSuf', key: 'fsas' },
  { field: 'fsPct', key: 'fsp' },
  { field: 'fsDir', key: 'fsd', defaultValue: 'increase' },
  { field: 'fsCagr', key: 'fsc' },
  { field: 'fsCagrDir', key: 'fscd', defaultValue: 'increase' },
  { field: 'fPE', key: 'fpe' },
  { field: 'fPM', key: 'fpm' }
];
function stateToSearchParams(state) {
  const params = new URLSearchParams();
  SHARE_FIELDS.forEach(({ field, key, defaultValue }) => {
    const raw = state[field];
    if (raw === undefined || raw === null) return;
    if (typeof raw === 'string') {
      if (raw.trim() === '') return;
      if (defaultValue !== undefined && raw === defaultValue) return;
      params.set(key, raw);
      return;
    }
    if (defaultValue !== undefined && raw === defaultValue) return;
    params.set(key, raw);
  });
  return params;
}
function stateFromSearchParams(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const state = {}; let has = false;
  SHARE_FIELDS.forEach(({ field, key }) => {
    if (params.has(key)) {
      state[field] = params.get(key);
      has = true;
    }
  });
  return has ? state : null;
}
const SHARE_BASE = 'https://commoninvestor.net/';
function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) resolve(); else reject(new Error('execCommand failed'));
    } catch (err) {
      document.body.removeChild(textarea);
      reject(err);
    }
  });
}
function requireCompany(next) {
  if (!stock || !stock.value || !stock.value.trim()) {
    alert('Please enter a company name or ticker before calculating.');
    try { stock?.focus(); } catch { }
    return;
  }
  next();
}
function buildShareURL(params) {
  const file = document.body?.classList?.contains('mobile') ? 'index-mobile.html' : 'index.html';
  const url = new URL(file, SHARE_BASE);
  const query = params.toString();
  url.search = query ? query : '';
  return url.toString();
}
function shareLink() {
  const params = stateToSearchParams(getState());
  const shareURL = buildShareURL(params);
  const copyDirect = () => copyToClipboard(shareURL)
    .then(() => toast('Link copied ✅'))
    .catch(() => {
      try {
        const manual = prompt('Copy this link', shareURL);
        if (manual !== null) toast('Link ready to copy');
      } catch { }
    });
  try {
    if (navigator.share && (typeof navigator.canShare !== 'function' || navigator.canShare({ url: shareURL }))) {
      navigator.share({
        title: 'Common Investor snapshot',
        text: 'View this Common Investor scenario.',
        url: shareURL
      })
        .then(() => copyDirect())
        .catch(copyDirect);
    } else {
      copyDirect();
    }
  } catch {
    copyDirect();
  }
}
function applySharedState(s) {
  if (!s) return false;
  applyState(s);
  calculateCurrent();
  calculateFuture();
  revealSummary();
  toast('Loaded from link');
  return true;
}
function maybeLoadFromQuery() {
  const state = stateFromSearchParams(window.location.search);
  if (!state) return false;
  return applySharedState(state);
}
function maybeLoadFromHash() {
  if (location.hash.length > 1) {
    const s = decodeState(location.hash.slice(1));
    if (applySharedState(s)) return true;
  }
  return false;
}

// Smart Dropdowns
let updateAllSmartDropdowns = () => { }; // Exposed for mode switching

function initSmartDropdowns() {
  const unitIds = [
    'futureRevenueSuffix', 'futureRevenueSuffixBase', 'futureRevenueSuffixBull',
    'futureSharesSuffix', 'futureSharesSuffixBase', 'futureSharesSuffixBull'
  ];
  const dirIds = [
    'futureRevenueDirection', 'futureRevenueDirectionBase', 'futureRevenueDirectionBull',
    'futureRevenueCompoundedDirection', 'futureRevenueCompoundedDirectionBase', 'futureRevenueCompoundedDirectionBull',
    'futureSharesDirection', 'futureSharesDirectionBase', 'futureSharesDirectionBull',
    'futureSharesCompoundedDirection', 'futureSharesCompoundedDirectionBase', 'futureSharesCompoundedDirectionBull'
  ];

  const unitMap = {
    'Millions': 'M',
    'Billions': 'B',
    'Trillions': 'T',
    '(None)': ''
  };

  const dirMap = {
    'increase': '🟢 ↑',
    'decrease': '🔴 ↓'
  };

  // Helper to reset options to full text
  const resetOptions = (select) => {
    Array.from(select.options).forEach(opt => {
      if (opt.dataset.originalText) {
        opt.textContent = opt.dataset.originalText;
      }
    });
    select.style.color = ''; // Reset color
  };

  // Helper to apply smart text/color
  const applySmart = (select, type) => {
    // ONLY apply smart features if Dual Case is enabled
    if (!dualCaseEnabled) {
      resetOptions(select);
      return;
    }

    const opt = select.options[select.selectedIndex];
    if (!opt) return;

    // Save original text if not saved
    if (!opt.dataset.originalText) {
      opt.dataset.originalText = opt.textContent;
    }

    if (type === 'unit') {
      const short = unitMap[opt.dataset.originalText] !== undefined ? unitMap[opt.dataset.originalText] : opt.textContent;
      opt.textContent = short;
    } else if (type === 'dir') {
      const val = opt.value; // 'increase' or 'decrease'
      const short = dirMap[val] || opt.textContent;
      opt.textContent = short;

      // Apply color to the select element
      if (val === 'increase') select.style.color = '#4ade80'; // Green
      else if (val === 'decrease') select.style.color = '#f87171'; // Red
    }
  };

  // Initialize Units
  unitIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // Save all original texts first
    Array.from(el.options).forEach(opt => opt.dataset.originalText = opt.textContent);

    el.addEventListener('focus', () => resetOptions(el));
    el.addEventListener('mousedown', () => resetOptions(el)); // For immediate click
    el.addEventListener('blur', () => applySmart(el, 'unit'));
    el.addEventListener('change', () => {
      resetOptions(el); // Reset others
      el.blur(); // Force blur to apply smart text immediately
    });
  });

  // Initialize Directions
  dirIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // Save all original texts first
    Array.from(el.options).forEach(opt => opt.dataset.originalText = opt.textContent);

    el.addEventListener('focus', () => resetOptions(el));
    el.addEventListener('mousedown', () => resetOptions(el));
    el.addEventListener('blur', () => applySmart(el, 'dir'));
    el.addEventListener('change', () => {
      resetOptions(el);
      el.blur();
    });
  });

  // Define global updater
  updateAllSmartDropdowns = () => {
    unitIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) applySmart(el, 'unit');
    });
    dirIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) applySmart(el, 'dir');
    });
  };
}

// Theme preference
const THEME_KEY = 'sp-forecaster-theme';
function applyTheme(mode) {
  if (mode === 'system') { document.documentElement.style.colorScheme = ''; delete document.documentElement.dataset.theme; }
  else if (mode === 'light') { document.documentElement.style.colorScheme = 'light'; document.documentElement.dataset.theme = 'light'; }
  else if (mode === 'dark') { document.documentElement.style.colorScheme = 'dark'; document.documentElement.dataset.theme = 'dark'; }

  // Only save preference if premium
  if (isPremium) {
    localStorage.setItem(THEME_KEY, mode);
  }
  themeSelect.value = mode;
}
function initTheme() {
  // Default to dark for everyone
  let saved = 'dark';

  // If premium, try to load saved preference
  if (isPremium) {
    saved = localStorage.getItem(THEME_KEY) || 'dark';
  }

  applyTheme(saved);
}

const resetApp = () => {
  const clean = window.location.href.split('#')[0].split('?')[0];
  try {
    if (history.replaceState) {
      history.replaceState(null, '', clean);
      location.reload();
      return;
    }
  } catch { }
  window.location.href = clean;
};

// Auto-Calc State
// Moved to top

// ---------------------------------------------------------
// 2. Event Listeners
// ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Restore Premium State
  if (localStorage.getItem('isPremium') === 'true') {
    isPremium = true;
    enablePremiumMode();
  }

  try { initTheme(); } catch (e) { console.error(e); }
  try { initTheme(); } catch (e) { console.error(e); }
  try { initSmartDropdowns(); } catch (e) { console.error(e); }

  // Enforce Auto-Calc Visibility & Toggle
  const autoCalcBtn = document.getElementById('autoCalcBtn');
  if (autoCalcBtn) {
    // Visibility Check
    if (isPremium) autoCalcBtn.style.display = 'block';
    else autoCalcBtn.style.display = 'none';

    // Toggle Listener
    autoCalcBtn.addEventListener('click', () => {
      isAutoCalcEnabled = !isAutoCalcEnabled;
      if (isAutoCalcEnabled) {
        autoCalcBtn.textContent = '⚡️ Auto-Calc: ON';
        autoCalcBtn.classList.remove('ghost');
        calculateFuture(); // Trigger immediate calc
      } else {
        autoCalcBtn.textContent = 'zzz Auto-Calc: OFF';
        autoCalcBtn.classList.add('ghost');
      }
    });
  }

  // Calculate button always works
  const calcBtn = document.getElementById('calcFutureBtn');
  if (calcBtn) calcBtn.addEventListener('click', calculateFuture);

  // Inputs: only auto-calc if enabled
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(el => {
    if (el.id === 'themeSelect' || el.id.includes('dock') || el.closest('.premium-sidebar')) return;
    el.addEventListener('input', () => {
      if (isAutoCalcEnabled) calculateFuture();
    });
  });
});

// Wire up
if (clearBtn) clearBtn.addEventListener('click', resetApp);
if (clearBtn2) clearBtn2.addEventListener('click', resetApp);
// calcCurrentBtn removed
if (saveBtn) saveBtn.addEventListener('click', saveTxt);
if (saveBtn2) saveBtn2.addEventListener('click', saveTxt);
if (shareBtn) shareBtn.addEventListener('click', shareLink);
if (themeSelect) themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));



// Dual-case toggle (Premium)
if (caseModeBtn) {
  caseModeBtn.addEventListener('click', () => {
    if (!gatePremiumDual()) return;
    setDualCase(!dualCaseEnabled);
  });
}

if (calcFutureBtn) {
  const shouldAutoScrollFuture = false;
  const ensureFutureCardBottomVisible = () => {
    if (!futureCard) return;
    requestAnimationFrame(() => {
      const rect = futureCard.getBoundingClientRect();
      const viewBottom = window.scrollY + window.innerHeight - 12; // small margin
      const cardBottom = window.scrollY + rect.bottom;
      if (cardBottom > viewBottom) {
        const target = cardBottom - window.innerHeight + 12;
        const prefersReduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        window.scrollTo({ top: Math.max(0, target), behavior: prefersReduce ? 'auto' : 'smooth' });
      }
    });
  };
  const scrollToFutureResults = () => {
    if (!shouldAutoScrollFuture) return;
    const targetEl = futureCard;
    if (!targetEl) return;
    const prefersReduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const behavior = prefersReduce ? 'auto' : 'smooth';
    const stickyOffset = () => {
      let offset = 0;
      if (document.body?.classList?.contains('mobile')) {
        offset += mobileHeader?.offsetHeight || 0;
        offset += mobileBanner?.offsetHeight || 0;
        const safe = parseFloat(getComputedStyle(document.body).getPropertyValue('--mobile-viewport-offset') || '0');
        if (!Number.isNaN(safe)) offset += safe;
        offset += 72;
      }
      return offset;
    };
    requestAnimationFrame(() => {
      const rect = targetEl.getBoundingClientRect();
      const target = Math.max(0, rect.top + window.scrollY - stickyOffset());
      window.scrollTo({ top: target, behavior });
    });
  };
  calcFutureBtn.addEventListener('click', () => {
    // Premium Check
    if (!isPremium) {
      showLoginModal();
      return;
    }

    if (typeof gtag === 'function') {
      gtag('event', 'calculate_projection', { 'event_category': 'engagement', 'event_label': stock.value || 'Unknown' });
    }
    futureAutoEnabled = true;
    revealSummary();
    calculateCurrent();
    calculateFuture(true); // Manual trigger
    scrollToFutureResults();
    ensureFutureCardBottomVisible();
    toast('Calculated ✅');
  });
}

const deb = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } };
[revenue, shares, pe, pm, price, revSuf, shSuf].forEach(el => el.addEventListener('input', deb(calculateCurrent)));

// Future Calculator Auto-Calc
const futureInputs = [
  frMode, frAbs, frSuf, frPct, frDir, frCagr, frCagrDir,
  frAbsBase, frAbsBull, frSufBase, frSufBull,
  frPctBase, frPctBull, frDirBase, frDirBull,
  frCagrBase, frCagrBull, frCagrDirBase, frCagrDirBull,
  fsMode, fsAbs, fsSuf, fsPct, fsDir, fsCagr, fsCagrDir,
  fsAbsBase, fsAbsBull, fsSufBase, fsSufBull,
  fsPctBase, fsPctBull, fsDirBase, fsDirBull,
  fsCagrBase, fsCagrBull, fsCagrDirBase, fsCagrDirBull,
  fPE, fPM, fPEBase, fPEBull, fPMBase, fPMBull
];
futureInputs.forEach(el => {
  if (el) {
    el.addEventListener('input', () => { if (isAutoCalcEnabled) calculateFuture(); });
    el.addEventListener('change', () => { if (isAutoCalcEnabled) calculateFuture(); });
  }
});

// Global function for the button to call directly
window.runFutureCalculation = function () {
  try {
    futureAutoEnabled = true;
    revealSummary();
    calculateCurrent();
    calculateFuture();
    toast('Calculated Future Projections ✅');
  } catch (e) {
    console.error(e);
    alert('Error running calculation: ' + e.message);
  }
};

// Removed calcCurrentBtn listener as the button is gone

let activeMobileStep = mobilePanels.length
  ? (mobilePanels.find(panel => panel.classList.contains('is-active'))?.dataset.step || 'current')
  : 'current';

if (mobilePanels.length) {
  const updateMobileActions = () => {
    if (mobileCalcBtn) {
      const isCurrent = activeMobileStep === 'current';
      mobileCalcBtn.textContent = isCurrent ? 'Calculate current' : 'Calculate future';
      mobileCalcBtn.setAttribute('aria-label', isCurrent ? 'Calculate current metrics' : 'Calculate future projections');
    }
  };

  const setMobileStep = (step, { scroll = false } = {}) => {
    if (!step || activeMobileStep === step) {
      updateMobileActions();
      return;
    }
    activeMobileStep = step;
    document.body.dataset.activeStep = step;

    mobileTabs.forEach(btn => {
      const isActive = btn.dataset.step === step;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    mobilePanels.forEach(panel => {
      const isActive = panel.dataset.step === step;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });

    updateMobileActions();

    if (scroll) {
      const activePanel = mobilePanels.find(panel => panel.dataset.step === step);
      if (activePanel) {
        const tabHeight = mobileTabs.length ? (mobileTabs[0].offsetHeight || 0) : 0;
        const offset = tabHeight + 36;
        const target = activePanel.getBoundingClientRect().top + window.scrollY - offset;
        const nextTop = target > 0 ? target : 0;
        if (Math.abs(window.scrollY - nextTop) > 8) {
          window.scrollTo({ top: nextTop, behavior: 'auto' });
        }
      }
    }
  };

  setMobileStep(activeMobileStep, { scroll: false });

  mobileTabs.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const shouldScroll = window.scrollY > 140;
      setMobileStep(btn.dataset.step, { scroll: shouldScroll });
    });
    btn.addEventListener('keydown', (evt) => {
      if (evt.key === 'ArrowRight' || evt.key === 'ArrowLeft') {
        evt.preventDefault();
        const dir = evt.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (idx + dir + mobileTabs.length) % mobileTabs.length;
        mobileTabs[nextIndex].focus();
        setMobileStep(mobileTabs[nextIndex].dataset.step, { scroll: false });
      }
    });
  });

  if (mobileCalcBtn) {
    mobileCalcBtn.addEventListener('click', () => {
      // Premium Check
      if (!isPremium) {
        showLoginModal();
        return;
      }
      if (activeMobileStep === 'current') calcCurrentBtn?.click();
      else calculateFuture(true);
    });
  }
  if (mobileSaveBtn) {
    mobileSaveBtn.addEventListener('click', () => {
      saveBtn?.click();
    });
  }
  if (mobileResetBtn) {
    mobileResetBtn.addEventListener('click', () => {
      clearBtn?.click();
    });
  }
}

// Maintain pinned tab bar + avoid iOS visual viewport offsets hiding it
if (document.body?.classList?.contains('mobile')) {
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  const originalViewportContent = viewportMeta?.getAttribute('content') || 'width=device-width, initial-scale=1';
  let viewportRestoreTimer = null;

  const lockViewportScale = () => {
    if (!viewportMeta) return;
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  };

  const restoreViewportScale = () => {
    if (!viewportMeta) return;
    viewportMeta.setAttribute('content', originalViewportContent);
  };

  const updateViewportOffset = () => {
    const vv = window.visualViewport;
    if (!vv) {
      document.body.style.setProperty('--mobile-viewport-offset', '0px');
      return;
    }
    const offset = Math.max(0, vv.offsetTop || 0);
    document.body.style.setProperty('--mobile-viewport-offset', `${offset}px`);
  };

  updateViewportOffset();

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewportOffset, { passive: true });
    window.visualViewport.addEventListener('scroll', updateViewportOffset, { passive: true });
  }

  window.addEventListener('orientationchange', () => {
    // allow the viewport to settle before recomputing
    setTimeout(() => {
      updateViewportOffset();
      restoreViewportScale();
    }, 120);
  });

  document.addEventListener('focusin', (event) => {
    if (event.target instanceof HTMLElement && event.target.matches('input, select, textarea')) {
      clearTimeout(viewportRestoreTimer);
      lockViewportScale();
      setTimeout(updateViewportOffset, 60);
    }
  });
  document.addEventListener('focusout', (event) => {
    if (event.target instanceof HTMLElement && event.target.matches('input, select, textarea')) {
      clearTimeout(viewportRestoreTimer);
      viewportRestoreTimer = setTimeout(() => {
        restoreViewportScale();
        updateViewportOffset();
      }, 150);
    }
  });
}

function saveTxt() {
  const s = getState();
  let content =
    `Stock Price Forecaster Calculation\n===============================\n` +
    `Date: ${s.date}\nCompany: ${s.stock || ''}\n\n` +
    `Current Metrics:\n- Revenue (TTM): ${s.revenue}${s.revSuf ? ` (${s.revSuf})` : ''}\n` +
    `- Outstanding Shares: ${s.shares}${s.shSuf ? ` (${s.shSuf})` : ''}\n- P/E Ratio: ${s.pe}\n- Profit Margin: ${s.pm}\n- Price per Share: ${s.price}\n- Earnings: ${earnings.textContent}\n- EPS: ${eps.textContent}\n- Market Value: $${mv.textContent}\n\n` +
    `Future Projections (5 Years):\n- Future Revenue Mode: ${s.frMode}\n` +
    (s.frMode === 'absolute'
      ? `  - Future Revenue: ${s.frAbs}${s.frSuf ? ` (${s.frSuf})` : ''}\n`
      : s.frMode === 'percentage'
        ? `  - Future Revenue %: ${s.frPct} (${s.frDir})\n`
        : `  - CAGR %: ${s.frCagr} (${s.frCagrDir})\n`) +
    `- Future Shares Mode: ${s.fsMode}\n` +
    (s.fsMode === 'absolute'
      ? `  - Future Shares: ${s.fsAbs}${s.fsSuf ? ` (${s.fsSuf})` : ''}\n`
      : s.fsMode === 'percentage'
        ? `  - Future Shares %: ${s.fsPct} (${s.fsDir})\n`
        : `  - Shares CAGR %: ${s.fsCagr} (${s.fsCagrDir})\n`) +
    `- Projected Future P/E: ${s.fPE}\n- Projected Future Profit Margin: ${s.fPM}\n\n` +
    `Computed Outputs:\n- Future Revenue: ${fRev.textContent}\n- Future Shares: ${fShOut ? fShOut.textContent : '–'}\n- Future Earnings: ${fEarn.textContent}\n- Future EPS: ${fEPS.textContent}\n- Future Stock Price: ${fPrice.textContent}\n- Future Market Value: $${fMV.textContent}\n\n`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'calculation.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function init() {
  // Preload extended dataset if available
  loadSp500Data();
  const loaded = maybeLoadFromQuery() || maybeLoadFromHash();
  if (!loaded) calculateCurrent();
  initTheme();
  updateActiveCompany();

  // Re-enable transitions after initial layout

}

// Tab Elements (Moved to top)
// const tabProjections ... defined at top
// const tabInsights ... defined at top
// const tabHub ... defined at top
// const projectionsTab ... defined at top
// const insightsTab ... defined at top
// const hubTab ... defined at top

// Sidebar elements removed (handled earlier)
// const premiumSidebar = null;
// const sidebarToggle = null;
// const closeSidebar = null;

// Tab Event Listeners
if (tabProjections) tabProjections.addEventListener('click', () => switchTab('projections'));
if (tabInsights) tabInsights.addEventListener('click', () => {
  if (typeof gtag === 'function') {
    gtag('event', 'view_insights', { 'event_category': 'navigation', 'event_label': stock.value || 'Unknown' });
  }
  switchTab('insights');
});
if (tabHub) tabHub.addEventListener('click', () => switchTab('hub'));

// Helper for Locked View
function renderLockedView(container) {
  if (!container) return;
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; text-align: center; padding: 20px;">
      <div style="font-size: 3rem; margin-bottom: 16px;">🔒</div>
      <h2 style="margin-bottom: 8px;">Premium Feature</h2>
      <p style="color: var(--muted); margin-bottom: 24px; max-width: 400px;">
        Unlock advanced insights, unlimited history, and your personal research hub.
      </p>
      <button class="btn primary special-btn" onclick="document.getElementById('loginModal').showModal()">
        💎 Unlock Premium
      </button>
    </div>
  `;
}

function switchTab(tabName) {
  // Reset all
  [tabProjections, tabInsights, tabHub].forEach(el => el && el.classList.remove('active'));
  [projectionsTab, insightsTab, hubTab].forEach(el => el && el.classList.remove('active'));
  // Clear inline display style that might persist
  if (hubTab) hubTab.style.display = '';

  if (tabName === 'projections') {
    if (tabProjections) tabProjections.classList.add('active');
    if (projectionsTab) projectionsTab.classList.add('active');
  } else if (tabName === 'insights') {
    if (tabInsights) tabInsights.classList.add('active');
    if (insightsTab) insightsTab.classList.add('active');

    // Check Premium
    if (!isPremium) {
      renderLockedView(insightsTab);
      return;
    }

    // Render charts if stock selected
    const symbol = stock.value.toUpperCase();
    if (symbol && mockStocks[symbol]) {
      renderInsightsCharts(mockStocks[symbol]);
    } else if (symbol === 'META' || !symbol) {
      renderInsightsCharts(mockStocks['META']);
    }
  } else if (tabName === 'hub') {
    if (tabHub) tabHub.classList.add('active');
    if (hubTab) hubTab.classList.add('active');

    // Check Premium
    if (!isPremium) {
      renderLockedView(hubTab);
      return;
    }

    // Render/Update Hub content
    renderSavedItems();
    renderCommunityTop10();
  }
}

// --- Community Top 10 Logic ---

function getCommunityTop10() {
  // 1. Start with Real Data (if any)
  let list = [...realCalculatedStocks];

  // 2. Fill remaining slots with Trending Data (Weighted)
  if (list.length < 10) {
    // Anchors: Stocks that are almost always in the top 10 (Simulating 30-day dominance)
    const ANCHORS = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN'];

    // Rotators: The rest of the pool (Simulating hourly activity)
    const ROTATORS = TRENDING_POOL.filter(t => !ANCHORS.includes(t));

    // Seeded Shuffle based on Hour
    const hourBucket = Math.floor(Date.now() / (1000 * 60 * 60));
    const seededRandom = (seed) => {
      let x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // Always include most Anchors (e.g., 4 or 5) to maintain "30-day" feel
    // We shuffle anchors too so their order changes
    let shuffledAnchors = [...ANCHORS];
    for (let i = shuffledAnchors.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(hourBucket + i) * (i + 1));
      [shuffledAnchors[i], shuffledAnchors[j]] = [shuffledAnchors[j], shuffledAnchors[i]];
    }

    // Add Anchors first
    for (const ticker of shuffledAnchors) {
      if (list.length >= 10) break;
      if (!list.includes(ticker)) list.push(ticker);
    }

    // Shuffle Rotators
    let shuffledRotators = [...ROTATORS];
    for (let i = shuffledRotators.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(hourBucket + i + 100) * (i + 1)); // Offset seed
      [shuffledRotators[i], shuffledRotators[j]] = [shuffledRotators[j], shuffledRotators[i]];
    }

    // Fill the rest
    for (const ticker of shuffledRotators) {
      if (list.length >= 10) break;
      if (!list.includes(ticker)) list.push(ticker);
    }
  }

  return list.slice(0, 10);
}

function renderCommunityTop10() {
  const listEl = document.getElementById('communityList');
  const listElInsights = document.getElementById('communityListInsights');
  const listElProjections = document.getElementById('communityListProjections');

  // Helper to render list into an element
  const renderList = (container) => {
    if (!container) return;
    container.innerHTML = '';

    // Premium Check
    if (!isPremium) {
      container.innerHTML = `
        <div style="text-align:center; padding: 24px 12px;">
          <div style="font-size: 2rem; margin-bottom: 12px;">🔒</div>
          <h4 style="margin: 0 0 8px 0; color: var(--text);">Premium Feature</h4>
          <p style="margin: 0 0 16px 0; color: var(--muted); font-size: 0.9rem;">
            Unlock Premium to see what the community is tracking.
          </p>
          <button class="btn primary special-btn" onclick="const m=document.getElementById('loginModal'); m.showModal(); m.style.display='flex'">
            Unlock Now
          </button>
        </div>
      `;
      return;
    }

    const dynamicList = getCommunityTop10();
    dynamicList.forEach((symbol, index) => {
      const data = window.__sp500Data ? window.__sp500Data[symbol] : null;
      const div = document.createElement('div');
      div.className = 'saved-item'; // Reuse saved-item style for consistency

      const leftDiv = document.createElement('div');
      leftDiv.style.display = 'flex';
      leftDiv.style.gap = '12px';
      leftDiv.style.alignItems = 'center';

      const rankSpan = document.createElement('span');
      rankSpan.textContent = `#${index + 1}`;
      rankSpan.style.color = 'var(--muted)';
      rankSpan.style.fontSize = '0.9rem';
      rankSpan.style.width = '24px';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = symbol;
      nameSpan.style.fontWeight = '600';

      leftDiv.appendChild(rankSpan);
      leftDiv.appendChild(nameSpan);

      const rightDiv = document.createElement('div');
      if (data) {
        const priceSpan = document.createElement('span');
        priceSpan.textContent = `$${data.price.toFixed(2)}`;
        priceSpan.style.color = 'var(--muted)';
        priceSpan.style.fontSize = '0.9rem';
        rightDiv.appendChild(priceSpan);
      }

      div.appendChild(leftDiv);
      div.appendChild(rightDiv);

      container.appendChild(div);
    });
  };

  renderList(listEl);
  renderList(listElInsights);
  renderList(listElProjections);
}

// Event Delegation for Community List
const communityList = document.getElementById('communityList');
if (communityList) {
  communityList.addEventListener('click', (e) => {
    const item = e.target.closest('.saved-item');
    if (!item) return;

    // Extract symbol
    const symbolSpan = item.querySelector('span:nth-child(2)'); // inside leftDiv
    // Actually structure is: item > leftDiv > [rank, symbol]
    // So we need to find the symbol span. 
    // Let's be safer: find the span that has font-weight 600
    const symbol = item.innerText.split('\n')[0].split('#')[1]?.trim()?.split(' ')[1] || item.querySelector('span:nth-child(2)')?.textContent;
    // Wait, the structure is:
    // div.saved-item
    //   div (flex)
    //     span (rank)
    //     span (symbol)

    const leftDiv = item.firstElementChild;
    if (!leftDiv) return;
    const symSpan = leftDiv.children[1];
    if (!symSpan) return;

    switchTab('projections');
    tryAutoFill(symSpan.textContent).catch(err => console.error('tryAutoFill failed:', err));
  });
}

// Event Delegation for Projections Community List
const communityListProjections = document.getElementById('communityListProjections');
if (communityListProjections) {
  communityListProjections.addEventListener('click', (e) => {
    const item = e.target.closest('.saved-item');
    if (!item) return;

    const leftDiv = item.firstElementChild;
    if (!leftDiv) return;
    const symSpan = leftDiv.children[1];
    if (!symSpan) return;

    tryAutoFill(symSpan.textContent);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Event Delegation for Insights Community List
const communityListInsights = document.getElementById('communityListInsights');
if (communityListInsights) {
  communityListInsights.addEventListener('click', (e) => {
    const item = e.target.closest('.saved-item');
    if (!item) return;

    const symbolSpan = item.querySelector('span:nth-child(2)');
    if (!symbolSpan) return;

    const symbol = symbolSpan.textContent;
    if (!symbol) return;

    // Load charts for Insights
    stock.value = symbol;
    renderInsightsCharts(mockStocks[symbol] || mockStocks['META']);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Initialize Hub on load
document.addEventListener('DOMContentLoaded', () => {
  renderCommunityTop10();
});
const stockInsights = document.getElementById('stockInsights');
const stockListInsights = document.getElementById('stockListInsights');

// Sync Inputs (One-way: Main -> Insights)
if (stock && stockInsights) {
  stock.addEventListener('input', (e) => {
    // When main calculator input changes, update insights input
    stockInsights.value = e.target.value;
    // Also trigger chart update if it's a valid stock in mock data
    // Note: We might want to wait for selection, but user asked for "pre-selected" behavior.
    // If they type, we just mirror text. Real update happens on selection/autofill.
  });

  // REMOVED: stockInsights listener that updated stock (User requested one-way sync)
}

// Initialize Autocomplete for Insights
if (stockInsights && stockListInsights) {
  stockInsights.addEventListener('input', async (e) => {
    if (!allStocks.length) await ensureStocksLoaded();
    // Pass a custom onSelect that calls tryAutoFill
    renderAC(stockInsights, stockListInsights, (symbol) => {
      stockInsights.value = symbol;
      tryAutoFill(symbol);
    });
  });

  stockInsights.addEventListener('blur', () => setTimeout(() => stockListInsights.classList.remove('show'), 150));

  stockInsights.addEventListener('keydown', (e) => {
    const items = Array.from(stockListInsights.querySelectorAll('.ac-item'));

    // Allow Enter to proceed even if no items (for custom stocks)
    if (!items.length && e.key !== 'Enter') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) {
        // We need a separate index for insights or reuse a local one?
        // renderAC uses global acIndex. Let's rely on the fact that only one list is open at a time.
        // But renderAC resets acIndex = -1.
        // We need to implement setACIndex equivalent for insights list.
        // Actually, let's just reuse the logic but target stockListInsights.
        let nextIndex = acIndex + 1;
        if (nextIndex >= items.length) nextIndex = items.length - 1;
        highlightItem(items, nextIndex);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) {
        let nextIndex = acIndex - 1;
        if (nextIndex < 0) nextIndex = 0;
        highlightItem(items, nextIndex);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (acIndex >= 0 && items[acIndex]) {
        // Simulate click on active item
        const evt = new Event('mousedown');
        items[acIndex].dispatchEvent(evt);
      } else {
        // No item selected, search for typed value
        stockListInsights.classList.remove('show');
        tryAutoFill(stockInsights.value.trim().toUpperCase());
      }
    } else if (e.key === 'Escape') {
      stockListInsights.classList.remove('show');
    }
  });

  // Helper to highlight item in insights list (reusing global acIndex is risky if we don't reset it)
  // But renderAC resets it.
  function highlightItem(items, index) {
    items.forEach(i => i.classList.remove('active'));
    acIndex = index;
    if (items[acIndex]) {
      items[acIndex].classList.add('active');
      items[acIndex].scrollIntoView({ block: 'nearest' });
    }
  }
}



// Chart Instances
let insightsCharts = {};

function renderInsightsCharts(stockData) {
  if (!stockData || !stockData.history) return;

  // Reverse history for display (TTM -> Oldest)
  // Create a copy to avoid mutating the original mock data in place if called multiple times
  const h = [...stockData.history].reverse();

  const labels = h.map(d => d.year);

  // Helper to create/update chart
  const updateChart = (id, label, dataKey, color, formatType = 'currency') => {
    const ctx = document.getElementById(id);
    if (!ctx) return;

    const data = h.map(d => d[dataKey] || 0);

    if (insightsCharts[id]) {
      insightsCharts[id].destroy();
    }

    const isAllZero = data.every(v => v === 0);

    insightsCharts[id] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: label,
          data: data,
          backgroundColor: isAllZero ? 'transparent' : color,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: !isAllZero,
            callbacks: {
              label: (context) => {
                let val = context.raw;
                if (typeof val === 'number') {
                  val = val.toFixed(2);
                }
                if (formatType === 'percent') return val + '%';
                if (formatType === 'currency') return '$' + val;
                return val;
              }
            }
          },
          // Custom plugin for empty state
          emptyState: {
            id: 'emptyState',
            afterDraw(chart) {
              if (isAllZero) {
                const { ctx, chartArea: { left, top, width, height } } = chart;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(128, 128, 128, 0.4)';
                ctx.font = 'italic 13px "Inter", sans-serif';
                ctx.fillText('Data Unavailable (Local Mode)', left + width / 2, top + height / 2);
                ctx.restore();
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(128, 128, 128, 0.1)' },
            ticks: {
              callback: (value) => {
                if (typeof value === 'number') {
                  value = value.toFixed(2);
                }
                if (formatType === 'percent') return value + '%';
                if (formatType === 'currency') return '$' + value;
                return value;
              }
            }
          },
          x: { grid: { display: false } }
        }
      },
      plugins: [{
        id: 'emptyState',
        afterDraw(chart) {
          if (isAllZero) {
            const { ctx, chartArea: { left, top, width, height } } = chart;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(128, 128, 128, 0.4)';
            ctx.font = 'italic 13px "Inter", sans-serif';
            ctx.fillText('Data Unavailable (Local Mode)', left + width / 2, top + height / 2);
            ctx.restore();
          }
        }
      }]
    });
  };

  // 1. Revenue
  updateChart('chartRevenue', 'Revenue ($B)', 'revenue', '#2563eb', 'currency');
  // 2. Revenue Growth
  updateChart('chartRevenueGrowth', 'Growth (%)', 'revGrowth', '#3b82f6', 'percent');
  // 3. Earnings
  updateChart('chartEarnings', 'Earnings ($B)', 'earnings', '#10b981', 'currency');
  // 4. Earnings Growth
  updateChart('chartEarningsGrowth', 'Growth (%)', 'earnGrowth', '#34d399', 'percent');
  // 5. EPS
  updateChart('chartEPS', 'EPS ($)', 'eps', '#f59e0b', 'currency');
  // 6. FCF
  updateChart('chartFCF', 'FCF ($B)', 'fcf', '#8b5cf6', 'currency');
  // 7. Margin
  updateChart('chartMargin', 'Margin (%)', 'margin', '#ec4899', 'percent');
  // 8. Shares
  updateChart('chartShares', 'Shares (B)', 'shares', '#6366f1', 'number');
  // 9. PE
  updateChart('chartPE', 'P/E', 'pe', '#f43f5e', 'number');
  // 10. ROE
  updateChart('chartROE', 'ROE (%)', 'roe', '#14b8a6', 'percent');
}

init();

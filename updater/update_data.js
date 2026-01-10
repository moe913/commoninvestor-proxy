const fs = require('fs');
const yahooFinance = require('yahoo-finance2').default;

const path = require('path');

const DATA_FILE = path.join(__dirname, '../sp500.json');

async function updateData() {
    console.log('Reading current data...');
    let data;
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        data = JSON.parse(raw);
    } catch (err) {
        console.error('Error reading sp500.json:', err.message);
        return;
    }

    const symbols = Object.keys(data);
    console.log(`Found ${symbols.length} companies to update.`);

    let updatedCount = 0;
    let errorCount = 0;

    // Helper to safe-get values
    const getVal = (v) => (v !== undefined && v !== null ? v : 0);
    const toB = (v) => parseFloat((getVal(v) / 1e9).toFixed(2)); // Billions

    for (const symbol of symbols) {
        try {
            // Handle special cases for Yahoo Finance symbols (e.g., BRK.B -> BRK-B)
            const querySymbol = symbol.replace('.', '-');

            // Fetch more detailed data using quoteSummary
            const fetchWithRetry = async (sym, retries = 3) => {
                try {
                    return await yahooFinance.quoteSummary(sym, {
                        modules: [
                            'price',
                            'summaryDetail',
                            'financialData',
                            'defaultKeyStatistics',
                            'incomeStatementHistory',
                            'cashflowStatementHistory',
                            'balanceSheetHistory'
                        ]
                    });
                } catch (err) {
                    if (retries > 0 && (err.message.includes('Too Many Requests') || err.message.includes('Unexpected token') || err.message.includes('HTTP 429'))) {
                        console.warn(`[${sym}] Rate limit hit, retrying in 5s... (${retries} left)`);
                        await new Promise(r => setTimeout(r, 5000 + Math.random() * 2000));
                        return fetchWithRetry(sym, retries - 1);
                    }
                    throw err;
                }
            };

            const result = await fetchWithRetry(querySymbol);

            if (result) {
                const entry = data[symbol];
                const priceMod = result.price;
                const summary = result.summaryDetail;
                const financials = result.financialData;
                const stats = result.defaultKeyStatistics;

                // History Modules
                const incomeHistory = result.incomeStatementHistory?.incomeStatementHistory || [];
                const cashflowHistory = result.cashflowStatementHistory?.cashflowStatements || [];
                const balanceHistory = result.balanceSheetHistory?.balanceSheetStatements || [];


                // 1. Update Snapshot Metrics
                if (priceMod && priceMod.regularMarketPrice) {
                    entry.price = priceMod.regularMarketPrice;
                }
                if (summary && summary.trailingPE) {
                    entry.pe = parseFloat(summary.trailingPE.toFixed(2));
                }
                if (stats && stats.sharesOutstanding) {
                    entry.shares = stats.sharesOutstanding;
                }
                if (financials && financials.profitMargins) {
                    entry.profitMargin = parseFloat((financials.profitMargins * 100).toFixed(1));
                }
                if (financials && financials.totalRevenue) {
                    entry.revenue = financials.totalRevenue;
                }

                // 2. Build Historical Data
                // Map by year (using endDate)
                const historyMap = new Map();

                // Helper to get or create year entry
                const getYearEntry = (dateObj) => {
                    const date = new Date(dateObj);
                    const year = date.getFullYear().toString();
                    if (!historyMap.has(year)) {
                        historyMap.set(year, { year, revenue: 0 });
                    }
                    return historyMap.get(year);
                };

                // Populate from Income Statement (Revenue, Net Income, EPS)
                incomeHistory.forEach(item => {
                    if (!item.endDate) return;
                    const h = getYearEntry(item.endDate);
                    h.revenue = toB(item.totalRevenue);
                    h.earnings = toB(item.netIncome);
                    h.eps = parseFloat(getVal(item.epsDiluted || item.epsBasic).toFixed(2));
                });

                // Populate from Cash Flow (FCF)
                cashflowHistory.forEach(item => {
                    if (!item.endDate) return;
                    const h = getYearEntry(item.endDate);
                    // FCF = Operating Cash Flow - CapEx
                    const ocf = getVal(item.totalCashFromOperatingActivities);
                    const capex = getVal(item.capitalExpenditures);
                    h.fcf = toB(ocf + capex); // CapEx is usually negative in Yahoo
                });

                // Populate from Balance Sheet (Shares, Equity for ROE)
                balanceHistory.forEach(item => {
                    if (!item.endDate) return;
                    const h = getYearEntry(item.endDate);
                    // Yahoo sometimes puts shares in different fields or we derived it.
                    // Let's rely on Income Statement EPS vs NetIncome for shares if missing,
                    // but Balance Sheet usually has 'commonStockSharesOutstanding' (not always reliable in history).
                    // Ideally: Net Income / EPS = Shares

                    // ROE Calculation: Net Income / Total Stockholder Equity
                    const equity = getVal(item.totalStockholderEquity);
                    if (h.earnings && equity) {
                        // Net Income is in Billions in our 'h' object, convert back to raw for accurate calc or use billions for both
                        // h.earnings is Billions. equity is raw.
                        // Let's use raw val from income statement if we can map it, but we lost raw.
                        // Recalculate roughly:
                        h.roe = parseFloat(((h.earnings * 1e9) / equity * 100).toFixed(1));
                    }
                });

                // Post-process derived metrics for each year
                const historyList = Array.from(historyMap.values()).sort((a, b) => a.year.localeCompare(b.year));

                historyList.forEach(h => {
                    // Margin
                    if (h.revenue > 0 && h.earnings) {
                        h.margin = parseFloat(((h.earnings / h.revenue) * 100).toFixed(1));
                    }
                    // Shares (Derived: Earnings Billions * 1e9 / EPS)
                    if (h.earnings && h.eps && h.eps !== 0) {
                        h.shares = parseFloat(((h.earnings * 1e9 / h.eps) / 1e9).toFixed(2)); // In Billions
                    }
                    // P/E (We don't have historical price easily, skip or leave 0)
                    h.pe = 0;
                });

                // Calculate Growth Rates (Year over Year)
                for (let i = 1; i < historyList.length; i++) {
                    const cur = historyList[i];
                    const prev = historyList[i - 1];

                    if (prev.revenue > 0) {
                        cur.revGrowth = parseFloat(((cur.revenue - prev.revenue) / prev.revenue * 100).toFixed(1));
                    }
                    if (prev.earnings && prev.earnings !== 0) {
                        cur.earnGrowth = parseFloat(((cur.earnings - prev.earnings) / Math.abs(prev.earnings) * 100).toFixed(1));
                    }
                }

                // 3. Add TTM Entry
                // We use current snapshot data for TTM
                const ttm = {
                    year: 'TTM',
                    revenue: toB(entry.revenue),
                    earnings: 0, // Need to fetch TTM derived or raw
                    eps: parseFloat(getVal(result.defaultKeyStatistics?.trailingEps).toFixed(2)),
                    fcf: parseFloat((getVal(result.financialData?.freeCashflow) / 1e9).toFixed(2)), // Yahoo provides FCF TTM
                    margin: entry.profitMargin,
                    shares: parseFloat((getVal(entry.shares) / 1e9).toFixed(2)),
                    pe: entry.pe,
                    roe: parseFloat((getVal(result.financialData?.returnOnEquity) * 100).toFixed(1))
                };

                // Calculate TTM Earnings from EPS * Shares if missing
                if (ttm.eps && ttm.shares) {
                    ttm.earnings = parseFloat((ttm.eps * ttm.shares).toFixed(2));
                }

                // Growth vs last year (Approximate)
                const lastYear = historyList[historyList.length - 1];
                if (lastYear) {
                    if (lastYear.revenue > 0) {
                        ttm.revGrowth = parseFloat(((ttm.revenue - lastYear.revenue) / lastYear.revenue * 100).toFixed(1));
                    }
                    if (lastYear.earnings && lastYear.earnings !== 0) {
                        ttm.earnGrowth = parseFloat(((ttm.earnings - lastYear.earnings) / Math.abs(lastYear.earnings) * 100).toFixed(1));
                    }
                }

                historyList.push(ttm);
                entry.history = historyList;

                console.log(`[${symbol}] Updated -> Price: ${entry.price}, Rev: ${ttm.revenue}B, EPS: ${ttm.eps}, History Len: ${historyList.length}`);
                updatedCount++;
            } else {
                console.warn(`[${symbol}] No data found.`);
            }
        } catch (err) {
            console.error(`[${symbol}] Failed to fetch data:`, err.message);
            errorCount++;
        }

        // Small delay to be polite to the API
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('Writing updated data to file...');
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    // Also write to sp500-data.js for local file:// access (bypasses CORS)
    const jsContent = `window.__sp500Data = ${JSON.stringify(data, null, 2)};`;
    fs.writeFileSync(path.join(__dirname, '../sp500-data.js'), jsContent);
    console.log('Created sp500-data.js for local app usage.');

    console.log(`Done! Updated ${updatedCount} companies. Errors: ${errorCount}`);
}

updateData();

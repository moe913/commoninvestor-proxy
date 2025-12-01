const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=3600');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: "Symbol parameter is required" });
    }

    try {
        // Fetch Quote (Price, PE, etc.)
        const quote = await yahooFinance.quote(symbol);

        // Fetch History (Financials)
        const summary = await yahooFinance.quoteSummary(symbol, { modules: ['incomeStatementHistory', 'incomeStatementHistoryQuarterly', 'defaultKeyStatistics', 'financialData', 'earnings', 'cashflowStatementHistory', 'balanceSheetHistory'] });

        let incomeHistory = summary.incomeStatementHistory?.incomeStatementHistory || [];
        const quarterlyIncome = summary.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
        const stats = summary.defaultKeyStatistics || {};
        const finData = summary.financialData || {};
        const earningsChart = summary.earnings?.financialsChart?.yearly || [];
        const quarterlyEarningsChart = summary.earnings?.financialsChart?.quarterly || [];
        const cashflowHistory = summary.cashflowStatementHistory?.cashflowStatements || [];

        // Fallback: If standard income history is empty, use earnings chart data
        // Helper to get or create year entry
        const combinedHistory = new Map();
        const currentYear = new Date().getFullYear();

        const isValidYear = (year) => {
            const y = parseInt(year);
            // Filter out 1970 (null dates), pre-2000, and future/current years (only completed years)
            return y && y > 2000 && y < currentYear;
        };

        const getYearEntry = (year) => {
            if (!combinedHistory.has(year)) {
                combinedHistory.set(year, {
                    year: year,
                    revenue: 0,
                    earnings: 0,
                    margin: 0,
                    revGrowth: 0,
                    earnGrowth: 0,
                    eps: 0,
                    fcf: 0,
                    roe: 0,
                    shares: 0,
                    pe: 0
                });
            }
            return combinedHistory.get(year);
        };

        // 1. Process Income History
        if (incomeHistory.length > 0) {
            incomeHistory.forEach(item => {
                const year = item.endDate ? new Date(item.endDate).getFullYear().toString() : '';
                if (isValidYear(year)) {
                    const entry = getYearEntry(year);
                    entry.revenue = (item.totalRevenue || 0) / 1e9;
                    entry.earnings = (item.netIncome || 0) / 1e9;
                    entry.shares = (item.dilutedAverageShares || item.basicAverageShares || 0) / 1e9;
                    if (entry.revenue) entry.margin = (entry.earnings / entry.revenue) * 100;
                }
            });
        }

        // 2. Process Earnings Chart (Fallback for revenue/earnings)
        if (earningsChart.length > 0) {
            earningsChart.forEach(item => {
                const year = item.date ? item.date.toString() : '';
                if (isValidYear(year)) {
                    const entry = getYearEntry(year);
                    // Only overwrite if 0 (don't overwrite better data from income statement)
                    if (entry.revenue === 0) entry.revenue = (item.revenue || 0) / 1e9;
                    if (entry.earnings === 0) entry.earnings = (item.earnings || 0) / 1e9;
                    if (entry.revenue && entry.margin === 0) entry.margin = (entry.earnings / entry.revenue) * 100;
                }
            });
        }

        // 3. Process Cashflow History (for FCF if needed, though usually calculated later)
        if (cashflowHistory.length > 0) {
            cashflowHistory.forEach(item => {
                const year = item.endDate ? new Date(item.endDate).getFullYear().toString() : '';
                if (isValidYear(year)) {
                    const entry = getYearEntry(year);
                    // If earnings still 0, try netIncome from cashflow
                    if (entry.earnings === 0) entry.earnings = (item.netIncome || 0) / 1e9;
                }
            });
        }

        // 4. Process Fundamentals (Equity, FCF, Shares)
        let fundamentals = [];
        try {
            const fundResult = await yahooFinance.fundamentalsTimeSeries(symbol, { period1: '2019-01-01', module: 'all' });
            fundamentals = fundResult;
        } catch (e) {
            if (e.result) fundamentals = e.result;
        }

        const fundamentalsMap = new Map();
        fundamentals.forEach(item => {
            const year = item.date ? new Date(item.date).getFullYear().toString() : '';
            if (isValidYear(year)) {
                const equity = item.commonStockEquity || item.stockholdersEquity || item.totalStockholderEquity || 0;
                const fcf = item.freeCashFlow || 0;
                const shares = item.dilutedAverageShares || item.basicAverageShares || item.ordinarySharesNumber || item.shareIssued || 0;

                fundamentalsMap.set(year, { equity, fcf, shares });

                const entry = getYearEntry(year);
                if (entry.shares === 0 && shares > 0) entry.shares = shares / 1e9;
                if (entry.fcf === 0 && fcf) entry.fcf = fcf / 1e9;

                // Calculate ROE if we have earnings and equity
                if (entry.earnings && equity) {
                    entry.roe = (entry.earnings / (equity / 1e9)) * 100;
                }
            }
        });

        // Convert Map to Array and Sort
        let history = Array.from(combinedHistory.values()).sort((a, b) => parseInt(a.year) - parseInt(b.year));

        // Post-processing loop
        for (let i = 0; i < history.length; i++) {
            const cur = history[i];
            const prev = i > 0 ? history[i - 1] : null;

            if (prev && prev.revenue > 0) {
                cur.revGrowth = ((cur.revenue - prev.revenue) / prev.revenue) * 100;
            }
            if (prev && prev.earnings > 0) {
                cur.earnGrowth = ((cur.earnings - prev.earnings) / Math.abs(prev.earnings)) * 100;
            }

            if (!cur.eps && cur.shares > 0) {
                cur.eps = cur.earnings / cur.shares;
            }

            if (!cur.margin && cur.revenue > 0) {
                cur.margin = (cur.earnings / cur.revenue) * 100;
            }

            // Try to fill remaining gaps from fundamentals map if not already done
            if (fundamentalsMap.has(cur.year)) {
                const fundData = fundamentalsMap.get(cur.year);
                // ROE might need recalculation if earnings changed
                if (!cur.roe && cur.earnings && fundData.equity) {
                    cur.roe = (cur.earnings / (fundData.equity / 1e9)) * 100;
                }
                // FCF might be missing
                if (!cur.fcf && fundData.fcf) {
                    cur.fcf = fundData.fcf / 1e9;
                }
            }

            if (!cur.pe && quote.trailingPE) {
                cur.pe = quote.trailingPE;
            }
        }

        const sharesB = (stats.sharesOutstanding || 0) / 1e9;
        const ttmRevenue = finData.totalRevenue || 0;
        const ttmMargin = finData.profitMargins || 0;
        const ttmEarnings = ttmRevenue * ttmMargin;
        const ttmNetIncome = finData.netIncomeToCommon || ttmEarnings;

        if (ttmRevenue > 0 || ttmNetIncome > 0) {
            let ttmRevGrowth = 0;
            let ttmEarnGrowth = 0;

            const calcAvgGrowth = (data, revKey, earnKey) => {
                if (!data || data.length < 5) return { r: 0, e: 0 };
                const sorted = [...data].sort((a, b) => {
                    const da = a.endDate || a.date;
                    const db = b.endDate || b.date;
                    return new Date(da) - new Date(db);
                });

                let rGrowthSum = 0;
                let eGrowthSum = 0;
                let count = 0;

                for (let i = sorted.length - 1; i >= 4 && count < 4; i--) {
                    const cur = sorted[i];
                    const prev = sorted[i - 4];
                    const curRev = cur[revKey] || cur.revenue || 0;
                    const prevRev = prev[revKey] || prev.revenue || 0;
                    const curEarn = cur[earnKey] || cur.earnings || cur.netIncome || 0;
                    const prevEarn = prev[earnKey] || prev.earnings || prev.netIncome || 0;

                    if (prevRev > 0) {
                        rGrowthSum += ((curRev - prevRev) / prevRev);
                    }
                    if (Math.abs(prevEarn) > 0) {
                        eGrowthSum += ((curEarn - prevEarn) / Math.abs(prevEarn));
                    }
                    count++;
                }

                return {
                    r: count > 0 ? (rGrowthSum / count) * 100 : 0,
                    e: count > 0 ? (eGrowthSum / count) * 100 : 0
                };
            };

            let growth = calcAvgGrowth(quarterlyIncome, 'totalRevenue', 'netIncome');
            if (growth.r === 0 && growth.e === 0 && quarterlyEarningsChart.length > 0) {
                growth = calcAvgGrowth(quarterlyEarningsChart, 'revenue', 'earnings');
            }

            ttmRevGrowth = growth.r;
            ttmEarnGrowth = growth.e;

            const lastYear = history[history.length - 1];
            if (ttmRevGrowth === 0 && lastYear && lastYear.revenue > 0) {
                ttmRevGrowth = ((ttmRevenue / 1e9 - lastYear.revenue) / lastYear.revenue) * 100;
            }
            if (ttmEarnGrowth === 0 && lastYear && Math.abs(lastYear.earnings) > 0) {
                ttmEarnGrowth = ((ttmNetIncome / 1e9 - lastYear.earnings) / Math.abs(lastYear.earnings)) * 100;
            }

            history.push({
                year: 'TTM',
                revenue: ttmRevenue / 1e9,
                earnings: ttmNetIncome / 1e9,
                margin: ttmMargin * 100,
                revGrowth: ttmRevGrowth,
                earnGrowth: ttmEarnGrowth,
                eps: 0,
                fcf: 0,
                roe: 0,
                shares: sharesB
            });
        }

        const balanceSheetMap = new Map();
        const balanceSheets = summary.balanceSheetHistory?.balanceSheetStatements || [];
        balanceSheets.forEach(item => {
            const year = item.endDate ? new Date(item.endDate).getFullYear().toString() : '';
            if (year) balanceSheetMap.set(year, item.totalStockholderEquity || 0);
        });

        const cashflowMap = new Map();
        cashflowHistory.forEach(item => {
            const year = item.endDate ? new Date(item.endDate).getFullYear().toString() : '';
            if (year) {
                const opCash = item.totalCashFromOperatingActivities || item.operatingCashflow || 0;
                const capex = item.capitalExpenditures || 0;
                cashflowMap.set(year, opCash + capex);
            }
        });

        const ttmEntry = history.find(h => h.year === 'TTM');
        if (ttmEntry) {
            if (!ttmEntry.roe && summary.financialData && summary.financialData.returnOnEquity) {
                ttmEntry.roe = summary.financialData.returnOnEquity * 100;
            }
            if (!ttmEntry.fcf && summary.financialData && summary.financialData.freeCashflow) {
                ttmEntry.fcf = summary.financialData.freeCashflow / 1e9;
            }
            ttmEntry.pe = quote.trailingPE || 0;
        }

        const result = {
            symbol: symbol.toUpperCase(),
            name: quote.longName || quote.shortName || symbol,
            price: quote.regularMarketPrice || 0,
            revenue: finData.totalRevenue || 0,
            shares: stats.sharesOutstanding || 0,
            pe: quote.trailingPE || 0,
            profitMargin: finData.profitMargins ? (finData.profitMargins * 100) : 0,
            history: history
        };

        res.status(200).json(result);

    } catch (error) {
        res.status(500).json({ error: "Failed to fetch Yahoo data", details: error.message });
    }
};

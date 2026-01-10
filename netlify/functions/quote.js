const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

exports.handler = async function (event, context) {
    const symbol = event.queryStringParameters.symbol;

    if (!symbol) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Symbol parameter is required" })
        };
    }

    try {
        // Fetch Quote (Price, PE, etc.)
        const quote = await yahooFinance.quote(symbol);

        // Fetch History (Financials)
        // We need annual income statements for the graphs.
        // yahoo-finance2 'quoteSummary' with 'incomeStatementHistory' module gives this.
        // Added 'incomeStatementHistoryQuarterly' for TTM growth calculation
        const summary = await yahooFinance.quoteSummary(symbol, { modules: ['incomeStatementHistory', 'incomeStatementHistoryQuarterly', 'defaultKeyStatistics', 'financialData', 'earnings', 'cashflowStatementHistory', 'balanceSheetHistory'] });

        let incomeHistory = summary.incomeStatementHistory?.incomeStatementHistory || [];
        const quarterlyIncome = summary.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
        const stats = summary.defaultKeyStatistics || {};
        const finData = summary.financialData || {};
        const earningsChart = summary.earnings?.financialsChart?.yearly || [];
        const quarterlyEarningsChart = summary.earnings?.financialsChart?.quarterly || [];
        const cashflowHistory = summary.cashflowStatementHistory?.cashflowStatements || [];

        // Fallback: If standard income history is empty, use earnings chart data
        let history = [];
        if (incomeHistory.length > 0) {
            history = incomeHistory.map(item => {
                const rev = item.totalRevenue || 0;
                const earn = item.netIncome || 0;
                // Try to get historical shares
                const histShares = item.dilutedAverageShares || item.basicAverageShares || 0;

                return {
                    year: item.endDate ? new Date(item.endDate).getFullYear().toString() : 'N/A',
                    revenue: rev / 1e9,
                    earnings: earn / 1e9,
                    margin: rev ? (earn / rev) * 100 : 0,
                    // Add placeholders for other metrics to match frontend expectations
                    revGrowth: 0, // Will calculate below
                    earnGrowth: 0, // Will calculate below
                    eps: 0, // Will approximate
                    fcf: 0, // Need cashflow module for this
                    roe: 0, // Need balance sheet for this
                    shares: histShares / 1e9 // Billions
                };
            }).reverse();
        } else if (earningsChart.length > 0) {
            // Use earnings chart as fallback
            history = earningsChart.map(item => {
                const rev = item.revenue || 0;
                const earn = item.earnings || 0;
                return {
                    year: item.date ? item.date.toString() : 'N/A',
                    revenue: rev / 1e9,
                    earnings: earn / 1e9,
                    margin: rev ? (earn / rev) * 100 : 0,
                    revGrowth: 0,
                    earnGrowth: 0,
                    eps: 0,
                    fcf: 0,
                    roe: 0,
                    shares: 0 // Will fallback to current
                };
            });
        } else if (cashflowHistory.length > 0) {
            // Last resort: Cashflow statement
            history = cashflowHistory.map(item => {
                const earn = item.netIncome || 0;
                return {
                    year: item.endDate ? new Date(item.endDate).getFullYear().toString() : 'N/A',
                    revenue: 0,
                    earnings: earn / 1e9,
                    margin: 0,
                    revGrowth: 0,
                    earnGrowth: 0,
                    eps: 0,
                    fcf: 0,
                    roe: 0,
                    shares: 0 // Will fallback to current
                };
            }).reverse();
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

        // Helper to safe-get values and convert to billions
        const getVal = (v) => (v !== undefined && v !== null ? v : 0);
        const toB = (v) => parseFloat((getVal(v) / 1e9).toFixed(2));

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
            const ocf = getVal(item.totalCashFromOperatingActivities || item.operatingCashflow);
            const capex = getVal(item.capitalExpenditures);
            h.fcf = toB(ocf + capex); // CapEx is usually negative in Yahoo API
        });

        // Populate from Balance Sheet (Shares, Equity for ROE)
        const balanceHistory = summary.balanceSheetHistory?.balanceSheetStatements || [];
        balanceHistory.forEach(item => {
            if (!item.endDate) return;
            const h = getYearEntry(item.endDate);

            // ROE Calculation: Net Income / Total Stockholder Equity
            const equity = getVal(item.totalStockholderEquity || item.stockholdersEquity);

            // Re-calculate ROE using raw(ish) numbers if possible for precision, or approximate from billions
            if (h.earnings && equity) {
                // h.earnings is in Billions. equity is raw.
                h.roe = parseFloat(((h.earnings * 1e9) / equity * 100).toFixed(1));
            }
        });

        // Post-process derived metrics for each year
        let historyList = Array.from(historyMap.values()).sort((a, b) => a.year.localeCompare(b.year));

        historyList.forEach(h => {
            // Margin
            if (h.revenue > 0 && h.earnings) {
                h.margin = parseFloat(((h.earnings / h.revenue) * 100).toFixed(1));
            }
            // Shares (Derived: Earnings Billions * 1e9 / EPS)
            if (h.earnings && h.eps && h.eps !== 0) {
                h.shares = parseFloat(((h.earnings * 1e9 / h.eps) / 1e9).toFixed(2)); // In Billions
            }
            // Fallback Shares from stats if derived is weird? No, derived is usually consistent with EPS reported.
            if (!h.shares && sharesB > 0) h.shares = parseFloat(sharesB.toFixed(2));

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
        const ttm = {
            year: 'TTM',
            revenue: toB(finData.totalRevenue || ttmRevenue),
            earnings: 0,
            eps: parseFloat(getVal(stats.trailingEps).toFixed(2)),
            fcf: parseFloat((getVal(finData.freeCashflow) / 1e9).toFixed(2)),
            margin: finData.profitMargins ? parseFloat((finData.profitMargins * 100).toFixed(1)) : 0,
            shares: parseFloat(sharesB.toFixed(2)),
            pe: quote.trailingPE ? parseFloat(quote.trailingPE.toFixed(2)) : 0,
            roe: parseFloat((getVal(finData.returnOnEquity) * 100).toFixed(1))
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
        history = historyList;

        const result = {
            symbol: symbol.toUpperCase(),
            name: quote.longName || quote.shortName || symbol,
            price: quote.regularMarketPrice || 0,
            revenue: finData.totalRevenue || 0, // Raw
            shares: stats.sharesOutstanding || 0, // Raw
            pe: quote.trailingPE || 0,
            profitMargin: finData.profitMargins ? (finData.profitMargins * 100) : 0,
            history: history
        };

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Cache-Control": "public, s-maxage=3600, max-age=3600" // Cache for 1 hour to save Netlify credits
            },
            body: JSON.stringify(result)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to fetch Yahoo data", details: error.message })
        };
    }
};

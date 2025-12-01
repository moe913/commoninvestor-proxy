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

        // Post-process history to calculate growth and approximations
        const sharesB = (stats.sharesOutstanding || 0) / 1e9;

        // Add TTM entry if we have data
        // finData usually contains TTM values
        const ttmRevenue = finData.totalRevenue || 0;
        const ttmMargin = finData.profitMargins || 0; // ratio
        const ttmEarnings = ttmRevenue * ttmMargin; // Estimate earnings from margin if netIncome not explicit, or use netIncomeToCommon if available
        // actually finData.netIncomeToCommon is usually TTM net income
        const ttmNetIncome = finData.netIncomeToCommon || ttmEarnings;

        if (ttmRevenue > 0 || ttmNetIncome > 0) {
            // Calculate TTM Growth (Average of last 4 quarters YoY growth)
            let ttmRevGrowth = 0;
            let ttmEarnGrowth = 0;

            // Helper to calculate average growth from quarterly data
            const calcAvgGrowth = (data, revKey, earnKey) => {
                if (!data || data.length < 5) return { r: 0, e: 0 };
                // Sort by date ascending
                const sorted = [...data].sort((a, b) => {
                    const da = a.endDate || a.date;
                    const db = b.endDate || b.date;
                    return new Date(da) - new Date(db);
                });

                let rGrowthSum = 0;
                let eGrowthSum = 0;
                let count = 0;

                // We need at least 5 quarters to calculate YoY for the most recent one?
                // Actually, to calculate average of last 4, we need 8 quarters.
                // Yahoo usually returns 4-5.
                // If we have 5, we can calculate YoY for the last 1.
                // If we have 4, we can't calculate YoY for any.
                // Fallback: If we can't do average of 4, do whatever we can (e.g. average of last 1 or 2).

                // Let's try to calculate YoY for as many of the last 4 quarters as possible.
                // i starts at sorted.length - 1 (most recent).
                // We look back 4 quarters (i-4) to compare.

                for (let i = sorted.length - 1; i >= 4 && count < 4; i--) {
                    const cur = sorted[i];
                    const prev = sorted[i - 4]; // 4 quarters ago = 1 year ago

                    const curRev = cur[revKey] || cur.revenue || 0;
                    const prevRev = prev[revKey] || prev.revenue || 0;

                    const curEarn = cur[earnKey] || cur.earnings || cur.netIncome || 0;
                    const prevEarn = prev[earnKey] || prev.earnings || prev.netIncome || 0;

                    if (prevRev > 0) {
                        rGrowthSum += ((curRev - prevRev) / prevRev);
                        // We count this quarter for revenue
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

            // Try using incomeStatementHistoryQuarterly
            let growth = calcAvgGrowth(quarterlyIncome, 'totalRevenue', 'netIncome');

            // If that failed (returns 0), try earningsChart.quarterly which might have more history
            if (growth.r === 0 && growth.e === 0 && quarterlyEarningsChart.length > 0) {
                growth = calcAvgGrowth(quarterlyEarningsChart, 'revenue', 'earnings');
            }

            ttmRevGrowth = growth.r;
            ttmEarnGrowth = growth.e;

            // Fallback: If still 0, compare TTM vs Last Full Year (better than nothing)
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
                shares: sharesB // Use current shares for TTM
            });
        }

        // Map Balance Sheet for ROE
        const balanceSheetMap = new Map();
        const balanceSheets = summary.balanceSheetHistory?.balanceSheetStatements || [];
        balanceSheets.forEach(item => {
            console.log('BS Item:', JSON.stringify(item));
            const year = item.endDate ? new Date(item.endDate).getFullYear().toString() : '';
            if (year) balanceSheetMap.set(year, item.totalStockholderEquity || 0);
        });

        // Map Cashflow for FCF
        const cashflowMap = new Map();
        // cashflowHistory is already declared above, so we reuse it.
        if (cashflowHistory.length > 0) console.log('CF Item Keys:', Object.keys(cashflowHistory[0]));

        cashflowHistory.forEach(item => {
            const year = item.endDate ? new Date(item.endDate).getFullYear().toString() : '';
            if (year) {
                const opCash = item.totalCashFromOperatingActivities || item.operatingCashflow || 0;
                const capex = item.capitalExpenditures || 0;
                cashflowMap.set(year, opCash + capex); // Capex is usually negative
            }
        });

        // Fetch Fundamentals Time Series (Fallback for missing history)
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
            if (year) {
                fundamentalsMap.set(year, {
                    equity: item.commonStockEquity || item.stockholdersEquity || item.totalStockholderEquity || 0,
                    fcf: item.freeCashFlow || 0
                });
            }
        });

        for (let i = 0; i < history.length; i++) {
            const cur = history[i];
            const prev = i > 0 ? history[i - 1] : null;

            // Growth
            if (prev && prev.revenue > 0) {
                cur.revGrowth = ((cur.revenue - prev.revenue) / prev.revenue) * 100;
            }
            if (prev && prev.earnings > 0) {
                cur.earnGrowth = ((cur.earnings - prev.earnings) / Math.abs(prev.earnings)) * 100;
            }

            // Fallback for shares if missing
            if (!cur.shares && sharesB > 0) {
                cur.shares = sharesB;
            }

            // EPS Approximation
            if (!cur.eps && cur.shares > 0) {
                cur.eps = cur.earnings / cur.shares;
            }

            // Margin Fallback
            if (!cur.margin && cur.revenue > 0) {
                cur.margin = (cur.earnings / cur.revenue) * 100;
            }

            // ROE (Earnings / Equity)
            let equity = balanceSheetMap.get(cur.year);
            if (!equity && fundamentalsMap.has(cur.year)) {
                equity = fundamentalsMap.get(cur.year).equity;
            }

            if (equity) {
                cur.roe = (cur.earnings / (equity / 1e9)) * 100;
            }

            // FCF
            let fcf = cashflowMap.get(cur.year);
            if (!fcf && fundamentalsMap.has(cur.year)) {
                fcf = fundamentalsMap.get(cur.year).fcf;
            }

            if (fcf) {
                cur.fcf = fcf / 1e9;
            }

            // PE (Use current PE as fallback for history to show *something*)
            if (!cur.pe && quote.trailingPE) {
                cur.pe = quote.trailingPE;
            }
        }

        // TTM Specifics
        const ttmEntry = history.find(h => h.year === 'TTM');
        if (ttmEntry) {
            // Fallback to financialData for TTM ROE/FCF if calculation failed
            if (!ttmEntry.roe && summary.financialData && summary.financialData.returnOnEquity) {
                ttmEntry.roe = summary.financialData.returnOnEquity * 100;
            }
            if (!ttmEntry.fcf && summary.financialData && summary.financialData.freeCashflow) {
                ttmEntry.fcf = summary.financialData.freeCashflow / 1e9;
            }
        }
        if (ttmEntry) {
            ttmEntry.pe = quote.trailingPE || 0;
            // TTM ROE/FCF could be approximated if we had TTM balance sheet/cashflow
            // For now, let's leave them as 0 or carry forward last year's? 
            // Better to leave 0 than guess.
        }

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

const yahooFinance = require('yahoo-finance2').default;

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
        // Added 'earnings', 'cashflowStatementHistory', 'balanceSheetHistory' as fallbacks.
        const summary = await yahooFinance.quoteSummary(symbol, { modules: ['incomeStatementHistory', 'defaultKeyStatistics', 'financialData', 'earnings', 'cashflowStatementHistory', 'balanceSheetHistory'] });

        let incomeHistory = summary.incomeStatementHistory?.incomeStatementHistory || [];
        const stats = summary.defaultKeyStatistics || {};
        const finData = summary.financialData || {};
        const earningsChart = summary.earnings?.financialsChart?.yearly || [];
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
            history.push({
                year: 'TTM',
                revenue: ttmRevenue / 1e9,
                earnings: ttmNetIncome / 1e9,
                margin: ttmMargin * 100,
                revGrowth: 0,
                earnGrowth: 0,
                eps: 0,
                fcf: 0,
                roe: 0,
                shares: sharesB // Use current shares for TTM
            });
        }

        for (let i = 0; i < history.length; i++) {
            const cur = history[i];
            const prev = i > 0 ? history[i - 1] : null;

            // Growth
            if (prev && prev.revenue > 0) {
                cur.revGrowth = ((cur.revenue - prev.revenue) / prev.revenue) * 100;
            }
            if (prev && prev.earnings > 0) { // Simple growth, handle negative base carefully? standard formula
                // If prev was negative, growth formula is tricky. Let's keep simple:
                cur.earnGrowth = ((cur.earnings - prev.earnings) / Math.abs(prev.earnings)) * 100;
            }

            // EPS Approximation (using current shares as fallback for historical)
            if (sharesB > 0) {
                cur.eps = cur.earnings / sharesB;
            }

            // Fallback for shares if missing in history
            if (!cur.shares && sharesB > 0) {
                cur.shares = sharesB;
            }

            // FCF & ROE - hard to get without full history of other modules aligned by year.
            // For now, leave as 0 or try to map if we have the data.
            // Let's just ensure the keys exist so the frontend doesn't crash.
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
                "Access-Control-Allow-Headers": "Content-Type"
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

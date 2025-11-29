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
                return {
                    year: item.endDate ? new Date(item.endDate).getFullYear().toString() : 'N/A',
                    revenue: rev / 1e9,
                    earnings: earn / 1e9,
                    margin: rev ? (earn / rev) * 100 : 0,
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
                };
            });
        } else if (cashflowHistory.length > 0) {
            // Last resort: Cashflow statement (Net Income is usually there)
            // Revenue might be missing or called something else, but let's try.
            // Actually cashflow usually starts with Net Income.
            // We might not get Revenue here, so margin will be 0.
            history = cashflowHistory.map(item => {
                const earn = item.netIncome || 0;
                return {
                    year: item.endDate ? new Date(item.endDate).getFullYear().toString() : 'N/A',
                    revenue: 0, // Missing in cashflow usually
                    earnings: earn / 1e9,
                    margin: 0,
                };
            }).reverse();
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

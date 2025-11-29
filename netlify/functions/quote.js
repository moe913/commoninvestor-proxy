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
        // Added 'earnings' module as fallback for stocks like SOFI that might miss standard income history.
        const summary = await yahooFinance.quoteSummary(symbol, { modules: ['incomeStatementHistory', 'defaultKeyStatistics', 'financialData', 'earnings'] });

        let incomeHistory = summary.incomeStatementHistory?.incomeStatementHistory || [];
        const stats = summary.defaultKeyStatistics || {};
        const finData = summary.financialData || {};
        const earningsChart = summary.earnings?.financialsChart?.yearly || [];

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
                    year: item.date ? item.date.toString() : 'N/A', // 'date' is usually the year (e.g. 2023)
                    revenue: rev / 1e9,
                    earnings: earn / 1e9,
                    margin: rev ? (earn / rev) * 100 : 0,
                };
            });
            // Earnings chart is usually Oldest -> Newest, so no reverse needed? 
            // Actually Yahoo usually sends Oldest -> Newest for charts. 
            // Let's check: if first item year < last item year, it's Oldest -> Newest.
            // Our frontend expects Oldest -> Newest.
            // incomeHistory was Newest -> Oldest, so we reversed it.
            // earningsChart is usually Oldest -> Newest. We'll keep it as is.
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

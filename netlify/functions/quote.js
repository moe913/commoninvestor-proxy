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
        const summary = await yahooFinance.quoteSummary(symbol, { modules: ['incomeStatementHistory', 'defaultKeyStatistics', 'financialData'] });

        const incomeHistory = summary.incomeStatementHistory?.incomeStatementHistory || [];
        const stats = summary.defaultKeyStatistics || {};
        const finData = summary.financialData || {};

        // Map Yahoo data to our expected format
        // Yahoo returns numbers in raw format (e.g. 383930000000)
        // Our frontend expects Billions for history (e.g. 383.93)

        const history = incomeHistory.map(item => {
            const rev = item.totalRevenue || 0;
            const earn = item.netIncome || 0;

            return {
                year: item.endDate ? new Date(item.endDate).getFullYear().toString() : 'N/A',
                revenue: rev / 1e9,
                earnings: earn / 1e9,
                // Calculate margin
                margin: rev ? (earn / rev) * 100 : 0,
                // Yahoo doesn't always give historical shares/EPS in this specific module easily without more calls.
                // We'll stick to Revenue/Earnings/Margin for the main graphs which are the most important.
                // We can approximate EPS if needed or fetch 'earnings' module.
            };
        }).reverse(); // Yahoo gives Newest -> Oldest. We want Oldest -> Newest.

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

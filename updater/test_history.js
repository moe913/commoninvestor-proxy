const yahooFinance = require('yahoo-finance2').default;

async function testHistory() {
    const symbol = 'AAPL';
    try {
        console.log(`Fetching data for ${symbol}...`);

        // Try different modules that might contain historical data
        const result = await yahooFinance.quoteSummary(symbol, {
            modules: ['incomeStatementHistory', 'earnings']
        });

        console.log('Result keys:', Object.keys(result));

        if (result.incomeStatementHistory) {
            console.log('\nIncome Statement History:');
            result.incomeStatementHistory.incomeStatementHistory.forEach(item => {
                console.log(`Date: ${item.endDate}, Revenue: ${item.totalRevenue}`);
            });
        }

        if (result.earnings) {
            console.log('\nEarnings History:');
            if (result.earnings.financialsChart && result.earnings.financialsChart.yearly) {
                result.earnings.financialsChart.yearly.forEach(item => {
                    console.log(`Year: ${item.date}, Revenue: ${item.revenue}`);
                });
            }
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

testHistory();

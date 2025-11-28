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

    for (const symbol of symbols) {
        try {
            // Handle special cases for Yahoo Finance symbols (e.g., BRK.B -> BRK-B)
            const querySymbol = symbol.replace('.', '-');

            // Fetch more detailed data using quoteSummary
            // modules: price (for price), summaryDetail (for PE, marketCap), financialData (for revenue, margins), earnings (for history)
            const result = await yahooFinance.quoteSummary(querySymbol, {
                modules: ['price', 'summaryDetail', 'financialData', 'defaultKeyStatistics', 'earnings']
            });

            if (result) {
                const entry = data[symbol];
                const priceMod = result.price;
                const summary = result.summaryDetail;
                const financials = result.financialData;
                const stats = result.defaultKeyStatistics;
                const earnings = result.earnings;

                // 1. Update Price
                if (priceMod && priceMod.regularMarketPrice) {
                    entry.price = priceMod.regularMarketPrice;
                }

                // 2. Update P/E
                if (summary && summary.trailingPE) {
                    entry.pe = parseFloat(summary.trailingPE.toFixed(2));
                }

                // 3. Update Shares Outstanding
                if (stats && stats.sharesOutstanding) {
                    entry.shares = stats.sharesOutstanding;
                }

                // 4. Update Profit Margin (Yahoo gives 0.25 for 25%, we want 25.0)
                if (financials && financials.profitMargins) {
                    entry.profitMargin = parseFloat((financials.profitMargins * 100).toFixed(1));
                }

                // 5. Update Revenue (TTM)
                if (financials && financials.totalRevenue) {
                    entry.revenue = financials.totalRevenue;
                }

                // 6. Update Historical Revenue
                if (earnings && earnings.financialsChart && earnings.financialsChart.yearly) {
                    entry.history = earnings.financialsChart.yearly.map(item => ({
                        year: item.date.toString(),
                        revenue: parseFloat((item.revenue / 1e9).toFixed(1))
                    }));

                    // Add TTM entry if we have current revenue
                    if (entry.revenue) {
                        entry.history.push({
                            year: 'TTM',
                            revenue: parseFloat((entry.revenue / 1e9).toFixed(1))
                        });
                    }
                }

                console.log(`[${symbol}] Updated -> Price: ${entry.price}, P/E: ${entry.pe}, Margin: ${entry.profitMargin}%, Rev: ${(entry.revenue / 1e9).toFixed(1)}B`);
                updatedCount++;
            } else {
                console.warn(`[${symbol}] No data found.`);
            }
        } catch (err) {
            console.error(`[${symbol}] Failed to fetch data:`, err.message);
            errorCount++;
        }

        // Small delay to be polite to the API
        await new Promise(r => setTimeout(r, 200));
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

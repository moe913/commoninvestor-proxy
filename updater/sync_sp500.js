const fs = require('fs');
const https = require('https');

const path = require('path');

const DATA_FILE = path.join(__dirname, '../sp500.json');
const CSV_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv';

console.log('Fetching latest S&P 500 list...');

https.get(CSV_URL, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            // Parse CSV
            const lines = data.split('\n');
            const headers = lines[0].split(',');
            const symbolIdx = headers.findIndex(h => h.trim() === 'Symbol');
            const nameIdx = headers.findIndex(h => h.trim() === 'Security');

            if (symbolIdx === -1 || nameIdx === -1) {
                throw new Error('Could not find Symbol or Security columns in CSV');
            }

            const currentTickers = new Set();
            const tickerMap = new Map();

            // Skip header, process lines
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Handle quoted fields (simple CSV parser)
                // This regex splits by comma but ignores commas inside quotes
                const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);

                if (parts && parts[symbolIdx]) {
                    let symbol = parts[symbolIdx].replace(/^"|"$/g, '');
                    let name = parts[nameIdx] ? parts[nameIdx].replace(/^"|"$/g, '') : symbol;

                    // Yahoo Finance often uses '-' instead of '.' for tickers like BRK.B -> BRK-B
                    // But our existing file uses BRK.B. Let's stick to the CSV format but maybe normalize if needed.
                    // The user's file has BRK.B. The CSV has BRK.B usually.

                    currentTickers.add(symbol);
                    tickerMap.set(symbol, name);
                }
            }

            console.log(`Fetched ${currentTickers.size} active tickers.`);

            // Read local file
            let localData = {};
            if (fs.existsSync(DATA_FILE)) {
                localData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            }

            const localTickers = Object.keys(localData);
            let added = 0;
            let removed = 0;

            // 1. Remove delisted companies
            for (const symbol of localTickers) {
                if (!currentTickers.has(symbol)) {
                    console.log(`[REMOVE] ${symbol} is no longer in S&P 500.`);
                    delete localData[symbol];
                    removed++;
                }
            }

            // 2. Add new companies
            const today = new Date().toISOString().split('T')[0];
            for (const symbol of currentTickers) {
                if (!localData[symbol]) {
                    console.log(`[ADD] ${symbol} added to list.`);
                    localData[symbol] = {
                        name: tickerMap.get(symbol),
                        revenue: 0,
                        shares: 0,
                        pe: 0,
                        profitMargin: 0,
                        price: 0,
                        addedDate: today, // Track when we added it
                        history: []
                    };
                    added++;
                }
            }

            // Save
            fs.writeFileSync(DATA_FILE, JSON.stringify(localData, null, 2));
            console.log(`\nSync Complete!`);
            console.log(`Added: ${added}`);
            console.log(`Removed: ${removed}`);
            console.log(`Total Companies: ${Object.keys(localData).length}`);
            console.log(`\nRun 'npm run update' to fetch data for new companies.`);

        } catch (err) {
            console.error('Error processing CSV:', err.message);
        }
    });
}).on('error', (err) => {
    console.error('Error fetching CSV:', err.message);
});

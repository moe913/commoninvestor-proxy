const fs = require('fs');
const path = require('path');

const OUT_FILE = path.join(__dirname, '../global-tickers.js');
const DATA_DIR = path.join(__dirname, 'data');

function parseSP500() {
    console.log('Parsing S&P 500...');
    const html = fs.readFileSync(path.join(DATA_DIR, 'sp500.html'), 'utf8');
    const matches = [];

    // Regex for row: <td><a ...>SYMBOL</a></td> <td><a ...>Name</a></td>
    // Simplified regex approach
    const rowRegex = /<tr>\s*<td><a[^>]*>([A-Z\.]+)<\/a>\s*<\/td>\s*<td><a[^>]*>(.+?)<\/a>/g;
    let m;
    while ((m = rowRegex.exec(html)) !== null) {
        matches.push({
            s: m[1], // Symbol
            n: m[2].replace(/&amp;/g, '&'), // Name
            e: 'US'
        });
    }
    console.log(`Found ${matches.length} S&P 500 stocks.`);
    return matches;
}

function parseIndia() {
    console.log('Parsing India NSE...');
    try {
        const raw = fs.readFileSync(path.join(DATA_DIR, 'india_nse.json'), 'utf8');
        const data = JSON.parse(raw);
        // Format: { "Name": "SYMBOL" }
        const matches = Object.entries(data).map(([name, sym]) => ({
            s: `${sym}.NS`,
            n: name,
            e: 'NSE'
        }));
        console.log(`Found ${matches.length} India stocks.`);
        return matches;
    } catch (e) {
        console.error('Failed to parse India list:', e.message);
        return [];
    }
}

function parseShanghai() {
    console.log('Parsing Shanghai...');
    try {
        const raw = fs.readFileSync(path.join(DATA_DIR, 'shanghai_test.json'), 'utf8');
        // Check if raw is JSON or array
        // The head showed a list of objects but comma separated? It looked like `[{...},...]`
        // Let's assume standard JSON
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
            const matches = data.map(d => ({
                s: `${d.symbol}.SS`, // Add .SS suffix
                n: d.engName || d.zhName,
                e: 'SHA'
            }));
            console.log(`Found ${matches.length} Shanghai stocks.`);
            return matches;
        }
    } catch (e) {
        // Maybe it's contained in a property
        try {
            const raw = fs.readFileSync(path.join(DATA_DIR, 'shanghai_test.json'), 'utf8');
            // heuristic cleanup if needed?
            const data = JSON.parse(raw);
            if (data.data) { // common wrapper
                return data.data.map(d => ({ s: d.symbol, n: d.name, e: 'SHA' }));
            }
        } catch (e2) { }
        console.error('Failed to parse Shanghai list:', e.message);
    }
    return [];
}

function parseRussell2000() {
    console.log('Parsing Russell 2000...');
    try {
        const raw = fs.readFileSync(path.join(DATA_DIR, 'russell2000.csv'), 'utf8');
        const lines = raw.split('\n');
        const matches = [];
        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            // CSV: Ticker,Name - simple split by comma, but handle comma in name?
            // The file seems simple: A,A Company
            // Let's regex it to be safe: ^([^,]+),(.*)$
            const parts = line.match(/^([^,]+),(.*)$/);
            if (parts) {
                matches.push({
                    s: parts[1].trim().toUpperCase(),
                    n: parts[2].trim(),
                    e: 'US'
                });
            }
        }
        console.log(`Found ${matches.length} Russell 2000 stocks.`);
        return matches;
    } catch (e) {
        console.error('Failed to parse Russell 2000:', e.message);
        return [];
    }
}

const MANUAL_ADDITIONS = [
    { s: 'BABA', n: 'Alibaba Group', e: 'US' },
    { s: 'TCEHY', n: 'Tencent Holdings (ADR)', e: 'US' },
    { s: '0700.HK', n: 'Tencent Holdings', e: 'HK' },
    { s: 'JD', n: 'JD.com', e: 'US' },
    { s: 'PDD', n: 'PDD Holdings (Pinduoduo)', e: 'US' },
    { s: 'BIDU', n: 'Baidu', e: 'US' },
    { s: 'NIO', n: 'NIO Inc', e: 'US' },
    { s: 'TSM', n: 'Taiwan Semiconductor', e: 'US' },
    { s: 'RELIANCE.NS', n: 'Reliance Industries', e: 'NSE' }, // Ensure coverage
    { s: 'TCS.NS', n: 'Tata Consultancy Services', e: 'NSE' }
];

function run() {
    const sp500 = parseSP500();
    const india = parseIndia();
    const shanghai = parseShanghai();
    const russell = parseRussell2000();

    // Combine
    let all = [...MANUAL_ADDITIONS, ...sp500, ...russell, ...india, ...shanghai];

    // Deduplicate by symbol
    const seen = new Set();
    const unique = [];
    for (const item of all) {
        if (!seen.has(item.s)) {
            seen.add(item.s);
            unique.push(item);
        }
    }

    console.log(`Total unique tickers: ${unique.length}`);

    const content = `// Auto-generated detailed ticker list
const globalTickers = ${JSON.stringify(unique, null, 2)};

// Optimizing for search? No, just raw list is fine for client side filter ~4k items.
// Export for CommonJS and Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalTickers;
} else {
    window.globalTickers = globalTickers;
}
`;

    fs.writeFileSync(OUT_FILE, content);
    console.log(`Wrote to ${OUT_FILE}`);
}

run();

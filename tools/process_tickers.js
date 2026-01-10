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

function parseSEC() {
    console.log('Parsing SEC Tickers...');
    try {
        const raw = fs.readFileSync(path.join(DATA_DIR, 'sec_tickers.json'), 'utf8');
        const data = JSON.parse(raw);
        // Format: "0": { "cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc." }
        const matches = Object.values(data).map(d => ({
            s: d.ticker,
            n: d.title.replace(/(\w)(\w*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase()), // Title Case
            e: 'US'
        }));
        console.log(`Found ${matches.length} SEC stocks.`);
        return matches;
    } catch (e) {
        console.error('Failed to parse SEC list:', e.message);
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
    { s: 'RELIANCE.NS', n: 'Reliance Industries', e: 'NSE' },
    { s: 'TCS.NS', n: 'Tata Consultancy Services', e: 'NSE' }
];

function run() {
    // SEC covers SP500 and Russell, so we might not need separate SP500 parser effectively, 
    // but SP500 parser might likely have better names? 
    // Actually SEC has legal names "MICROSOFT CORP", sp500 parser gets "Microsoft".
    // Let's keep existing parsers but merge.

    const sp500 = parseSP500();
    const india = parseIndia();
    const shanghai = parseShanghai();
    const sec = parseSEC();

    // Combine - prioritize manually added, then SP500 (better names), then SEC (catch-all), then others
    let all = [...MANUAL_ADDITIONS, ...sp500, ...sec, ...india, ...shanghai];

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

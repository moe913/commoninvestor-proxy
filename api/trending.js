const { GITHUB_TOKEN } = process.env;
const REPO = 'moe913/commoninvestor-proxy';
const BRANCH = 'dev';
const FILE_PATH = 'calculations.json';

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, s-maxage=3600'); // Cache for 1 hour

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!GITHUB_TOKEN) {
        console.error('Missing GITHUB_TOKEN environment variable');
        return res.status(500).json({ error: 'Server Error: Missing GITHUB_TOKEN' });
    }

    try {
        const fileData = await fetchFileFromGitHub();
        if (!fileData) {
            // If file doesn't exist, return empty list (or fallback list)
            return res.status(200).json([]);
        }

        const allData = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));

        // Aggregation Logic
        const now = Date.now();
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const counts = {};

        Object.values(allData).forEach(userItems => {
            if (Array.isArray(userItems)) {
                userItems.forEach(item => {
                    // Check if date exists and is within 30 days
                    // item.date is usually string "Nov 25, 2025" or similar.
                    // We need to parse it.
                    let itemTime = 0;
                    if (item.date) {
                        itemTime = new Date(item.date).getTime();
                    }

                    // If parsing failed or no date, maybe we assume it's recent? 
                    // Or strictly filter. Let's strictly filter for "Community" quality.
                    // Actually, date formats change. 
                    // Let's rely on item.lastModified if available, else date string.
                    // If neither, skip.

                    // Fallback to strict date parsing
                    if (!itemTime || isNaN(itemTime)) {
                        // Attempt to fix simple formats if needed, but Date.parse covers most
                    }

                    if (itemTime && (now - itemTime < THIRTY_DAYS_MS)) {
                        let symbol = (item.ticker || item.companyName || '').toUpperCase().trim();
                        // Clean symbol logic (same as frontend basically)
                        if (symbol) {
                            counts[symbol] = (counts[symbol] || 0) + 1;
                        }
                    }
                });
            }
        });

        // Convert to array and sort
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1]) // Descending count
            .slice(0, 10) // Top 10
            .map(([symbol]) => symbol);

        return res.status(200).json(sorted);

    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Error fetching trending data: ' + e.message });
    }
};

async function fetchFileFromGitHub() {
    const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to fetch from GitHub (${res.status}): ${txt}`);
    }
    return await res.json();
}

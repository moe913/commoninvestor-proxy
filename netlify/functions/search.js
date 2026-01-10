const YahooFinance = require('yahoo-finance2').default;

// Spoof browser to avoid 429
const yahooFinance = new YahooFinance({
    fetchOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    }
});

// Cache headers for Vercel/Netlify
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' // Cache search results for 1 hour
};

exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const { q } = event.queryStringParameters || {};

    if (!q || q.trim().length < 1) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Query parameter "q" is required' })
        };
    }

    console.log(`[Search] Query: "${q}"`);

    // Retry logic for rate limits
    const searchWithRetry = async (query, retries = 2) => {
        try {
            // Yahoo's search API is lightweight usually
            return await yahooFinance.search(query, { quotesCount: 10, newsCount: 0 });
        } catch (err) {
            if (retries > 0 && (err.message.includes('Too Many Requests') || err.message.includes('429'))) {
                console.warn(`[${query}] Rate limit. Retrying...`);
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
                return searchWithRetry(query, retries - 1);
            }
            throw err;
        }
    };

    try {
        const result = await searchWithRetry(q);

        // Transform the results to be cleaner for the frontend
        const candidates = (result.quotes || [])
            .filter(quote => quote.isYahooFinance) // Filter out weird internal items if any
            .map(quote => ({
                symbol: quote.symbol,
                name: quote.shortname || quote.longname || quote.symbol,
                exchange: quote.exchange,
                score: quote.score // Quality score from Yahoo
            }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(candidates)
        };

    } catch (error) {
        console.error('Search error:', error);

        // Return structured error
        return {
            statusCode: 500, // Or 429 if it persisted
            headers,
            body: JSON.stringify({
                error: 'Failed to search stocks',
                details: error.message
            })
        };
    }
};

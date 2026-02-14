
const { GITHUB_TOKEN, GitHub_token } = process.env;
const token = GITHUB_TOKEN || GitHub_token;
const REPO = 'moe913/commoninvestor-proxy';
const BRANCH = 'main';
const FILE_PATH = 'calculations.json';

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'X-Data-Source');

    console.log('DEBUG: Token check - GITHUB_TOKEN:', !!GITHUB_TOKEN, 'GitHub_token:', !!GitHub_token, 'Final token:', !!token);

    // Debug access check
    if (req.query && req.query.debug === 'true') {
        let repoCheck = 'skipped';
        if (token) {
            try {
                const repoRes = await fetch('https://api.github.com/user/repos?per_page=5', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (repoRes.ok) {
                    const repos = await repoRes.json();
                    repoCheck = repos.map(r => r.full_name);
                } else {
                    repoCheck = `Failed: ${repoRes.status}`;
                }
            } catch (e) {
                repoCheck = `Error: ${e.message}`;
            }
        }
        return res.json({
            exists: !!token,
            length: token ? token.length : 0,
            preview: token ? token.substring(0, 4) + '...' : 'null',
            accessible_repos: repoCheck
        });
    }

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!token) {
        console.error('Missing GITHUB_TOKEN environment variable');
        return res.status(500).json({
            error: 'MISSING_TOKEN',
            message: 'Server Config Error: GITHUB_TOKEN is missing in Vercel Environment Variables.'
        });
    }

    const { method } = req;

    if (method === 'GET') {
        let username = req.query.username;
        if (!username) return res.status(400).send('Missing username');
        username = username.toLowerCase();

        try {
            let fileData = await fetchFileFromGitHub();
            let rawContent = null;

            if (fileData) {
                rawContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
                res.setHeader('X-Data-Source', 'cloud');
            } else {
                res.setHeader('X-Data-Source', 'empty-cloud');
            }

            if (!rawContent) return res.status(200).json({ lastModified: 0, items: [] });

            const allData = JSON.parse(rawContent);
            const matchingKeys = Object.keys(allData).filter(k => k.toLowerCase() === username.toLowerCase());

            let mergedItems = [];
            let maxLastModified = 0;

            matchingKeys.forEach(key => {
                let data = allData[key];
                if (Array.isArray(data)) {
                    data = { lastModified: 0, items: data };
                }
                if (data.items && Array.isArray(data.items)) {
                    mergedItems = mergedItems.concat(data.items);
                }
                if (data.lastModified > maxLastModified) {
                    maxLastModified = data.lastModified;
                }
            });

            const uniqueMap = new Map();
            mergedItems.forEach(item => {
                if (item.timestamp) uniqueMap.set(item.timestamp, item);
                else uniqueMap.set(JSON.stringify(item), item);
            });

            const finalItems = Array.from(uniqueMap.values()).sort((a, b) => b.timestamp - a.timestamp);

            const userData = {
                lastModified: maxLastModified,
                items: finalItems
            };

            return res.status(200).json(userData);
        } catch (e) {
            console.error(e);
            return res.status(500).send('Error fetching data: ' + e.message);
        }
    }

    if (method === 'POST') {
        try {
            let body = req.body;
            if (typeof body === 'string') {
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    console.warn('Failed to parse body as JSON:', e);
                }
            }

            const { username, data, calculations } = body || {};

            if (!username) return res.status(400).send('Missing username');
            const normalizedUser = username.toLowerCase();

            let payloadToSave = data;
            if (!payloadToSave && Array.isArray(calculations)) {
                payloadToSave = { lastModified: Date.now(), items: calculations };
            }

            if (!payloadToSave || !Array.isArray(payloadToSave.items)) {
                return res.status(400).send('Invalid input structure');
            }

            // Retry loop for 409 Conflict handling
            let attempts = 0;
            const maxAttempts = 3;
            let saved = false;
            let lastError = null;

            while (attempts < maxAttempts && !saved) {
                attempts++;
                try {
                    // 1. Fetch latest file state (Crucial for getting current SHA)
                    // Add timestamp to prevent Vercel/Fetch caching
                    const fileData = await fetchFileFromGitHub();
                    let allData = {};
                    let currentSha = null;

                    if (fileData) {
                        currentSha = fileData.sha;
                        try {
                            const contentStr = Buffer.from(fileData.content, 'base64').toString('utf-8');
                            allData = JSON.parse(contentStr);
                        } catch (parseErr) {
                            console.warn('Corrupt JSON in calculations.json, resetting.', parseErr);
                            allData = {};
                        }
                    }

                    // 2. Merge User Data
                    // We must retain existing data for other users, and update THIS user's data
                    allData[normalizedUser] = payloadToSave;

                    // 3. Prepare Content
                    const newContent = Buffer.from(JSON.stringify(allData, null, 2)).toString('base64');

                    // 4. Attempt Update
                    await updateFileInGitHub(newContent, currentSha, `Update calculations for ${username}`);

                    saved = true; // Success!

                } catch (err) {
                    lastError = err;
                    // Check if it's a 409 Conflict error
                    const isConflict = err.message.includes('409') || err.message.includes('does not match');

                    if (isConflict) {
                        console.warn(`Attempt ${attempts} failed with 409 Conflict. Retrying...`);
                        await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
                    } else {
                        // If it's NOT a conflict (e.g. 401, 500), throw immediately
                        throw err;
                    }
                }
            }

            if (!saved) {
                throw lastError || new Error('Failed to save after multiple attempts');
            }

            return res.status(200).json({ success: true, savedTimestamp: payloadToSave.lastModified });

        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: e.message, stack: e.stack });
        }
    }

    return res.status(405).send('Method Not Allowed');
};

async function fetchFileFromGitHub() {
    // Add cache-busting timestamp
    const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}&t=${Date.now()}`;
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to fetch from GitHub (${res.status}): ${txt}`);
    }
    return await res.json();
}

async function updateFileInGitHub(content, sha, message) {
    const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
    const body = {
        message,
        content,
        branch: BRANCH
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to update GitHub (${res.status}): ${txt}`);
    }
    return await res.json();
}


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

            const fileData = await fetchFileFromGitHub();
            let allData = {};
            let currentSha = null;

            if (fileData) {
                currentSha = fileData.sha;
                try {
                    allData = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
                } catch (parseErr) {
                    console.warn('Corrupt JSON in calculations.json, resetting.', parseErr);
                    allData = {};
                }
            }

            allData[normalizedUser] = payloadToSave;

            const newContent = Buffer.from(JSON.stringify(allData, null, 2)).toString('base64');
            await updateFileInGitHub(newContent, currentSha, `Update calculations for ${username}`);

            return res.status(200).json({ success: true, savedTimestamp: payloadToSave.lastModified });

        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: e.message, stack: e.stack });
        }
    }

    return res.status(405).send('Method Not Allowed');
};

async function fetchFileFromGitHub() {
    const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;
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

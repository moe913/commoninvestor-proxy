const { GITHUB_TOKEN } = process.env;
const REPO = 'moe913/commoninvestor-proxy';
const FILE_PATH = 'calculations.json';

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!GITHUB_TOKEN) {
        console.error('Missing GITHUB_TOKEN environment variable');
        return res.status(500).send('Server Error: Missing GITHUB_TOKEN');
    }

    const { method } = req;

    if (method === 'GET') {
        const username = req.query.username;
        if (!username) return res.status(400).send('Missing username');

        try {
            const fileData = await fetchFileFromGitHub();
            const allData = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
            const userData = allData[username] || [];

            return res.status(200).json(userData);
        } catch (e) {
            console.error(e);
            return res.status(500).send('Error fetching data');
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

            const { username, calculations } = body || {};

            if (!username || !Array.isArray(calculations)) {
                return res.status(400).send('Invalid input');
            }

            // 1. Fetch current file to get SHA (for atomic update)
            const fileData = await fetchFileFromGitHub();
            const currentSha = fileData.sha;
            const allData = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));

            // 2. Update user data
            allData[username] = calculations;

            // 3. Commit back
            const newContent = Buffer.from(JSON.stringify(allData, null, 2)).toString('base64');
            await updateFileInGitHub(newContent, currentSha, `Update calculations for ${username}`);

            return res.status(200).json({ success: true });

        } catch (e) {
            console.error(e);
            return res.status(500).send('Error saving data: ' + e.message);
        }
    }

    return res.status(405).send('Method Not Allowed');
};

async function fetchFileFromGitHub() {
    const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
    });
    if (!res.ok) throw new Error('Failed to fetch from GitHub');
    return await res.json();
}

async function updateFileInGitHub(content, sha, message) {
    const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            content,
            sha
        })
    });
    if (!res.ok) throw new Error('Failed to update GitHub');
    return await res.json();
}

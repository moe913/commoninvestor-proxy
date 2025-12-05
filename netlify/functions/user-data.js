const { GITHUB_TOKEN } = process.env;
const REPO = 'moe913/commoninvestor-proxy';
const FILE_PATH = 'calculations.json';

exports.handler = async (event) => {
    // 1. Auth Check (Basic)
    // In a real app, we'd verify a JWT. Here we trust the client sends the username
    // and we rely on the fact that this is a personal tool or low-risk app.
    // Ideally, we should check a session token.

    // For now, we will require a username in the query or body.

    const { httpMethod } = event;

    if (httpMethod === 'GET') {
        const username = event.queryStringParameters.username;
        if (!username) return { statusCode: 400, body: 'Missing username' };

        try {
            const fileData = await fetchFileFromGitHub();
            const allData = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
            const userData = allData[username] || [];

            return {
                statusCode: 200,
                body: JSON.stringify(userData)
            };
        } catch (e) {
            console.error(e);
            return { statusCode: 500, body: 'Error fetching data' };
        }
    }

    if (httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);
            const { username, calculations } = body;

            if (!username || !Array.isArray(calculations)) {
                return { statusCode: 400, body: 'Invalid input' };
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

            return { statusCode: 200, body: JSON.stringify({ success: true }) };

        } catch (e) {
            console.error(e);
            return { statusCode: 500, body: 'Error saving data' };
        }
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
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

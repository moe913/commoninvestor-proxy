exports.handler = async (event) => {
    const { ADMIN_PASSWORD, GITHUB_TOKEN } = process.env;
    const REPO = 'moe913/commoninvestor-proxy'; // Hardcoded for simplicity
    const FILE_PATH = 'users.json';

    // 1. Check Admin Password
    let providedPass;
    let body;

    if (event.httpMethod === 'GET') {
        providedPass = event.headers.authorization;
    } else {
        try {
            body = JSON.parse(event.body);
            providedPass = body.adminPassword;
        } catch (e) { return { statusCode: 400, body: 'Bad Request' }; }
    }

    if (providedPass !== ADMIN_PASSWORD) {
        return { statusCode: 403, body: 'Forbidden' };
    }

    // 2. Fetch current users
    const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
    const getRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
    });

    if (!getRes.ok) return { statusCode: 500, body: 'GitHub API Error' };

    const fileData = await getRes.json();
    const currentSha = fileData.sha;
    // Decode content (base64)
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    let users = JSON.parse(content);

    // 3. Handle Actions
    if (event.httpMethod === 'GET') {
        return { statusCode: 200, body: JSON.stringify(users) };
    }

    if (event.httpMethod === 'POST') {
        const { action, username, password } = body;

        if (action === 'add') {
            if (users.find(u => u.username === username)) {
                return { statusCode: 400, body: 'User already exists' };
            }
            users.push({ username, password });
        } else if (action === 'delete') {
            users = users.filter(u => u.username !== username);
        }

        // 4. Commit changes
        const newContent = Buffer.from(JSON.stringify(users, null, 2)).toString('base64');

        const putRes = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update users via Admin Panel (${action} ${username})`,
                content: newContent,
                sha: currentSha
            })
        });

        if (putRes.ok) {
            return { statusCode: 200, body: 'Success' };
        } else {
            const err = await putRes.text();
            return { statusCode: 500, body: 'Commit Failed: ' + err };
        }
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
};

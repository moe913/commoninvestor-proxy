module.exports = async (req, res) => {
    const { ADMIN_PASSWORD, GITHUB_TOKEN } = process.env;
    const REPO = 'moe913/commoninvestor-proxy';
    const FILE_PATH = 'users.json';

    // 1. Check Admin Password
    let providedPass;
    let body = req.body;

    if (req.method === 'GET') {
        providedPass = req.headers.authorization;
    } else {
        // Vercel parses body if JSON content type is sent, otherwise it might be text
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { }
        }
        providedPass = body?.adminPassword;
    }

    if (providedPass !== ADMIN_PASSWORD) {
        return res.status(403).send('Forbidden');
    }

    // 2. Fetch current users
    const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
    const getRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
    });

    if (!getRes.ok) return res.status(500).send('GitHub API Error');

    const fileData = await getRes.json();
    const currentSha = fileData.sha;
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    let users = JSON.parse(content);

    // 3. Handle Actions
    if (req.method === 'GET') {
        return res.status(200).json(users);
    }

    if (req.method === 'POST') {
        const { action, username, password } = body;

        if (action === 'add') {
            if (users.find(u => u.username === username)) {
                return res.status(400).send('User already exists');
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
            return res.status(200).send('Success');
        } else {
            const err = await putRes.text();
            return res.status(500).send('Commit Failed: ' + err);
        }
    }

    return res.status(405).send('Method Not Allowed');
};

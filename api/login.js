const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = process.env;
const path = require('path');
const fs = require('fs');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                console.warn('Failed to parse body as JSON:', e);
            }
        }
        const { username, password } = body || {};

        // Initialize with default user to ensure access even if file/GitHub fails
        let users = [{ username: 'moe', password: 'password123' }];

        // Strategy: Try GitHub API first (if token exists), otherwise fallback to local file
        if (process.env.GITHUB_TOKEN) {
            try {
                const url = `https://api.github.com/repos/moe913/commoninvestor-proxy/contents/users.json`;
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3.raw'
                    }
                });
                if (response.ok) {
                    const ghUsers = await response.json();
                    if (Array.isArray(ghUsers) && ghUsers.length > 0) {
                        users = ghUsers; // Override default if GitHub succeeds
                    }
                } else {
                    console.warn('GitHub fetch failed, falling back to local file/default');
                }
            } catch (e) {
                console.warn('GitHub fetch error:', e);
            }
        }

        // Fallback: Read local file if GitHub failed or no token (Local Dev)
        // Only try reading if we are still on default (or if we want to merge? Let's just stick to priority)
        // Actually, if GitHub failed, users is still [{moe...}].
        // Let's try to read local file to see if there are *more* users or updated users, 
        // but for Vercel deployment without GITHUB_TOKEN, local file is the main source.
        // But since file read is flaky on Vercel without config, let's trust the hardcode for now as a safety net.

        if (users.length === 1 && users[0].username === 'moe') {
            try {
                const localPath = path.resolve(__dirname, '../users.json');
                if (fs.existsSync(localPath)) {
                    const data = fs.readFileSync(localPath, 'utf8');
                    const localUsers = JSON.parse(data);
                    if (Array.isArray(localUsers) && localUsers.length > 0) {
                        users = localUsers;
                    }
                }
            } catch (e) {
                console.error('Local read failed:', e);
            }
        }

        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            return res.status(200).json({ success: true, username: user.username });
        } else {
            // Debugging: return what we received
            return res.status(401).json({
                error: 'Invalid credentials',
                receivedUsername: username,
                receivedPasswordLength: password ? password.length : 0,
                userCount: users.length
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server Error');
    }
};

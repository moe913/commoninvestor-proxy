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
        const { username, password } = req.body;

        let users = [];

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
                    users = await response.json();
                } else {
                    console.warn('GitHub fetch failed, falling back to local file');
                }
            } catch (e) {
                console.warn('GitHub fetch error:', e);
            }
        }

        // Fallback: Read local file if GitHub failed or no token (Local Dev)
        if (!users.length) {
            try {
                // Resolve path relative to this function file
                // In Vercel, the file structure might be flattened or different in lambda.
                // But for local dev and standard deployment, we try to find it.
                // Note: Vercel requires including files in config if they are outside function dir.
                // But let's try standard relative path.
                const localPath = path.resolve(__dirname, '../users.json');

                if (fs.existsSync(localPath)) {
                    const data = fs.readFileSync(localPath, 'utf8');
                    users = JSON.parse(data);
                } else {
                    // Ultimate fallback
                    users = [{ username: 'moe', password: 'password123' }];
                }
            } catch (e) {
                console.error('Local read failed:', e);
                users = [{ username: 'moe', password: 'password123' }];
            }
        }

        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            return res.status(200).json({ success: true, username: user.username });
        } else {
            return res.status(401).send('Invalid credentials');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server Error');
    }
};

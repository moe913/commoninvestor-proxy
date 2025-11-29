const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = process.env;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { username, password } = JSON.parse(event.body);

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
                const path = require('path');
                const fs = require('fs');
                const localPath = path.resolve(__dirname, '../../users.json');

                if (fs.existsSync(localPath)) {
                    const data = fs.readFileSync(localPath, 'utf8');
                    users = JSON.parse(data);
                } else {
                    // Ultimate fallback for immediate testing if file read fails
                    users = [{ username: 'moe', password: 'password123' }];
                }
            } catch (e) {
                console.error('Local read failed:', e);
                // Ultimate fallback
                users = [{ username: 'moe', password: 'password123' }];
            }
        }

        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, username: user.username })
            };
        } else {
            return { statusCode: 401, body: 'Invalid credentials' };
        }
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: 'Server Error' };
    }
};

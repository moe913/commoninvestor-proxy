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
                console.log('Attempting to read local users file at:', localPath);

                if (fs.existsSync(localPath)) {
                    const data = fs.readFileSync(localPath, 'utf8');
                    users = JSON.parse(data);
                    console.log('Successfully read local users.json. Count:', users.length);
                } else {
                    console.warn('Local users.json not found at:', localPath);
                    // Ultimate fallback for immediate testing if file read fails
                    users = [{ username: 'moe', password: 'password123' }];
                }
            } catch (e) {
                console.error('Local read failed:', e);
                // Ultimate fallback
                users = [{ username: 'moe', password: 'password123' }];
            }
        }

        console.log('Login attempt for:', username);
        console.log('Available users:', users.map(u => u.username)); // Log usernames only for security

        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            console.log('Login successful for:', username);
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, username: user.username })
            };
        } else {
            console.log('Login failed. Invalid credentials.');
            return { statusCode: 401, body: 'Invalid credentials' };
        }
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: 'Server Error' };
    }
};

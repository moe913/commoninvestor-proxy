const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = process.env;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { username, password } = JSON.parse(event.body);

        // Fetch users.json from GitHub (to ensure we have latest)
        // Note: In a real high-traffic app we'd cache this, but for this use case, fetching ensures consistency.
        // Or we can read local file if we trust deployment is up to date, but admin updates happen via API.
        // Let's fetch from GitHub API to be safe.

        // Actually, for login, reading the deployed file is faster. But if admin updates it, a redeploy is triggered?
        // If admin updates via API (commit), Netlify redeploys. So reading local file is fine!
        // BUT, redeploy takes time.
        // Let's fetch from GitHub API to get the *immediate* list.

        // Wait, if I use GitHub API, I need the token.
        // If I use local file, I rely on redeploy.
        // Let's use GitHub API for consistency.

        const url = `https://api.github.com/repos/moe913/commoninvestor-proxy/contents/users.json`;
        // Note: Hardcoding repo for now based on user info, or use env vars.
        // User path: /Users/mohammadmasood/Documents/GitHub/commoninvestor-proxy
        // Repo: moe913/commoninvestor-proxy

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch users.json');
            return { statusCode: 500, body: 'Auth Error' };
        }

        const users = await response.json();
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

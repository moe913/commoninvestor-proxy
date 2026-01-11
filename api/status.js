
const { GITHUB_TOKEN } = process.env;

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    const status = {
        env: process.env.NODE_ENV || 'development',
        hasToken: !!GITHUB_TOKEN,
        tokenLength: GITHUB_TOKEN ? GITHUB_TOKEN.length : 0,
        tokenPrefix: GITHUB_TOKEN ? GITHUB_TOKEN.substring(0, 4) + '...' : 'N/A',
        timestamp: new Date().toISOString()
    };

    // Optional: Try to fetch the repo to verify permissions
    if (GITHUB_TOKEN) {
        try {
            const res = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
            });
            status.githubAuthValidation = res.status;
            if (res.ok) {
                const data = await res.json();
                status.githubUser = data.login;
                status.scopes = res.headers.get('x-oauth-scopes');
            } else {
                status.githubError = await res.text();
            }
        } catch (e) {
            status.githubCheckError = e.message;
        }
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(status, null, 2)
    };
};

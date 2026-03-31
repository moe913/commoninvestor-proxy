module.exports = async (req, res) => {
    const { GITHUB_TOKEN } = process.env;
    let repoCheck = 'skipped';
    if (GITHUB_TOKEN) {
        try {
            const repoRes = await fetch('https://api.github.com/user/repos?per_page=5', {
                headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
            });
            if (repoRes.ok) {
                const repos = await repoRes.json();
                repoCheck = repos.map(r => r.full_name);
            } else {
                repoCheck = `Failed: ${repoRes.status}`;
            }
        } catch (e) {
            repoCheck = `Error: ${e.message}`;
        }
    }

    res.json({
        exists: !!GITHUB_TOKEN,
        length: GITHUB_TOKEN ? GITHUB_TOKEN.length : 0,
        preview: GITHUB_TOKEN ? GITHUB_TOKEN.substring(0, 4) + '...' : 'null',
        accessible_repos: repoCheck
    });
};

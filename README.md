# Common Investor Proxy

## Development Workflow (Staging vs Production)

We use a **Staging Environment** to test changes before they go live.

### How to make changes:
1.  **Always work on the `dev` branch**:
    ```bash
    git checkout dev
    ```
2.  **Make your changes** and test them locally (`npm run dev`).
3.  **Push to Staging**:
    ```bash
    git add .
    git commit -m "Description of changes"
    git push origin dev
    ```
    *This will update the Staging URL (check Vercel dashboard for the link).*

4.  **Deploy to Production**:
    Once you are satisfied with the staging site, merge `dev` into `main`:
    ```bash
    git checkout main
    git merge dev
    git push origin main
    git checkout dev  # Switch back to dev for next time
    ```

---

# Common Investor Data Updater

## 🚀 How to Update Data
To keep the S&P 500 data fresh, open your terminal (where you see `mohammadmasood@mohammads-mini ~ %`) and run these exact commands:

1.  **Navigate to the updater folder:**
    ```bash
    cd "Desktop/vscode/Premium Commoninvestor/updater"
    ```

2.  **Run the update:**
    ```bash
    npm run full-update
    ```

### What this does:
1.  **Syncs the List:** Automatically adds new S&P 500 companies and removes delisted ones.
2.  **Updates Data:** Fetches the latest Price, P/E, Revenue, Profit Margin, and Shares for all companies from Yahoo Finance.
3.  **Updates App:** Automatically updates `sp500.json` and `sp500-data.js` in the main folder.

---

## 🛠️ Other Commands (inside `updater/` folder)
-   `npm run sync`: Only syncs the company list (adds/removes tickers).
-   `npm run update`: Only updates financial data for existing tickers.

## ⚙️ Setup (One-time)
If you move this project to a new computer, run this command inside the `updater` folder:
```bash
cd updater
npm install
```
# commoninvestor-proxy

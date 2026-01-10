#!/bin/bash

# User Agent to bypass 403
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

echo "Downloading S&P 500..."
curl -s -L -A "$UA" "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies" -o tools/data/sp500.html

echo "Downloading India NSE..."
curl -s -L -A "$UA" "https://raw.githubusercontent.com/akashgiri/stocks-list/master/nse-listed-stocks.json" -o tools/data/india_nse.json

echo "Downloading Shanghai Connect (Jacktth)..."
# Attempting to guess the file or find a listing
curl -s -L -A "$UA" "https://raw.githubusercontent.com/jacktth/ga-hk_stock_info/main/shanghai-connect/date.json" -o tools/data/shanghai_test.json


# SEC Official List (All US Stocks)
echo "Downloading SEC Tickers..."
# SEC requires a user-agent with an email
curl -s -L -A "CommonInvestor/1.0 (admin@commoninvestor.net)" "https://www.sec.gov/files/company_tickers.json" -o tools/data/sec_tickers.json

echo "Done."

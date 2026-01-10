from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Enable CORS
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-type', 'application/json')
        # Cache control
        self.send_header('Cache-Control', 'public, s-maxage=3600, max-age=3600')
        self.end_headers()

        # Parse query params
        query = parse_qs(urlparse(self.path).query)
        symbol_param = query.get('symbol', [None])[0]

        if not symbol_param:
            self.wfile.write(json.dumps({'error': 'Symbol required'}).encode('utf-8'))
            return

        symbol = symbol_param.upper()

        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            # Use 'fast_info' for price if regular info is missing/slow? 
            # Regular info is safer for detailed stats.
            
            price = info.get('regularMarketPrice') or info.get('currentPrice') or 0
            short_name = info.get('shortName') or info.get('longName') or symbol
            shares_out = info.get('sharesOutstanding') or 0
            pe = info.get('trailingPE') or 0
            
            # Revenue (TTM)
            ttm_rev = info.get('totalRevenue') or 0
            ttm_net = info.get('netIncomeToCommon') or 0
            ttm_margin = (ttm_net / ttm_rev * 100) if ttm_rev else 0

            # Fetch Financials
            # yfinance returns DataFrames
            income_stmt = ticker.income_stmt
            balance_sheet = ticker.balance_sheet
            cash_flow = ticker.cashflow
            
            # Fallback to quarterly if annual is empty? 
            # Usually strict annual is better for the history chart
            
            history = []
            
            if not income_stmt.empty:
                # Columns are Timestamps. Convert to string years.
                # Columns might be sorted desc.
                
                # We need to transpose or iterate columns
                years = income_stmt.columns
                
                # Sort years ascending
                years = sorted(years)
                
                current_year = datetime.now().year
                
                processed_years = {} # Map year -> dict
                
                for date_col in years:
                    year_str = str(date_col.year)
                    if int(year_str) < 2000 or int(year_str) >= current_year:
                        continue # Skip current/future/ancient
                        
                    # Extract data
                    # yfinance row keys are like 'Total Revenue', 'Net Income' etc.
                    # Normalized keys: 'Total Revenue', 'Net Income', 'Basic Average Shares', 'Diluted Average Shares'
                    
                    try:
                        rev = income_stmt.loc['Total Revenue', date_col]
                    except:
                        try: rev = income_stmt.loc['TotalRevenue', date_col]
                        except: rev = 0
                        
                    try:
                        net_inc = income_stmt.loc['Net Income', date_col]
                    except: 
                        try: net_inc = income_stmt.loc['NetIncome', date_col]
                        except: 
                            try: net_inc = income_stmt.loc['Net Income Common Stockholders', date_col]
                            except: net_inc = 0
                    
                    try:
                        shares = income_stmt.loc['Diluted Average Shares', date_col]
                    except:
                        try: shares = income_stmt.loc['Basic Average Shares', date_col]
                        except: shares = 0

                    if np.isnan(rev): rev = 0
                    if np.isnan(net_inc): net_inc = 0
                    if np.isnan(shares): shares = 0
                    
                    entry = {
                        'year': year_str,
                        'revenue': rev / 1e9,
                        'earnings': net_inc / 1e9,
                        'shares': shares / 1e9,
                        'margin': 0,
                        'roe': 0,
                        'fcf': 0,
                        'pe': 0,
                        'revGrowth': 0,
                        'earnGrowth': 0,
                        'eps': 0
                    }
                    if rev: entry['margin'] = (net_inc / rev) * 100
                    if shares: entry['eps'] = net_inc / shares
                    
                    processed_years[year_str] = entry
                
                # Fill extra data (Equity, FCF)
                if not balance_sheet.empty:
                     for date_col in balance_sheet.columns:
                        year_str = str(date_col.year)
                        if year_str in processed_years:
                            try:
                                equity = balance_sheet.loc['Stockholders Equity', date_col]
                            except:
                                try: equity = balance_sheet.loc['Total Stockholder Equity', date_col]
                                except: equity = 0
                            
                            if not np.isnan(equity) and equity != 0:
                                entry = processed_years[year_str]
                                # ROE
                                if entry['earnings']:
                                    entry['roe'] = (entry['earnings'] * 1e9 / equity) * 100

                if not cash_flow.empty:
                    for date_col in cash_flow.columns:
                        year_str = str(date_col.year)
                        if year_str in processed_years:
                            try:
                                fcf = cash_flow.loc['Free Cash Flow', date_col]
                            except: fcf = 0
                            
                            if not np.isnan(fcf):
                                processed_years[year_str]['fcf'] = fcf / 1e9

                # Convert to list and sort
                history = sorted(processed_years.values(), key=lambda x: int(x['year']))
                
                # Calculate Growth
                for i in range(len(history)):
                    cur = history[i]
                    prev = history[i-1] if i > 0 else None
                    
                    if prev:
                        if prev['revenue'] > 0:
                            cur['revGrowth'] = ((cur['revenue'] - prev['revenue']) / prev['revenue']) * 100
                        if prev['earnings'] != 0:
                            cur['earnGrowth'] = ((cur['earnings'] - prev['earnings']) / abs(prev['earnings'])) * 100

            # Add TTM
            # Calculate TTM Growth (vs last fiscal year)
            ttm_rev_growth = 0
            ttm_earn_growth = 0
            if history:
                last_year = history[-1]
                if last_year['revenue'] > 0:
                    ttm_rev_growth = ((ttm_rev - (last_year['revenue'] * 1e9)) / (last_year['revenue'] * 1e9)) * 100
                if last_year['earnings'] != 0:
                    ttm_earn_growth = ((ttm_net - (last_year['earnings'] * 1e9)) / abs(last_year['earnings'] * 1e9)) * 100

            ttm_entry = {
                'year': 'TTM',
                'revenue': ttm_rev / 1e9,
                'earnings': ttm_net / 1e9,
                'margin': ttm_margin,
                'revGrowth': ttm_rev_growth,
                'earnGrowth': ttm_earn_growth,
                'eps': 0, # Frontend can calc or we can
                'fcf': 0, # Hard to get exact TTM FCF easily without quarterly summing
                'roe': 0,
                'shares': (shares_out / 1e9) if shares_out else 0,
                'pe': pe
            }
            if info.get('returnOnEquity'): ttm_entry['roe'] = info.get('returnOnEquity') * 100
            if info.get('freeCashflow'): ttm_entry['fcf'] = info.get('freeCashflow') / 1e9
            
            history.append(ttm_entry)

            result = {
                'symbol': symbol,
                'name': short_name,
                'price': price,
                'revenue': ttm_rev,
                'shares': shares_out,
                'pe': pe,
                'profitMargin': ttm_margin * 100, # index.js expects generic margin? JS was doing finData.profitMargins * 100. ttm_margin is percent.
                'history': history
            }
            # Adjust profitMargin to match JS expectation (if JS expected raw decimal or %)
            # JS: profitMargin: finData.profitMargins ? (finData.profitMargins * 100) : 0
            # My ttm_margin is % already. JS likely expects %. result['profitMargin'] = ...
            
            self.wfile.write(json.dumps(result).encode('utf-8'))

        except Exception as e:
            # Fallback/Error
            error_msg = str(e)
            print(f"Error fetching {symbol}: {error_msg}")
            
            # Return empty structure so UI opens
            empty_res = {
                'symbol': symbol,
                'name': symbol,
                'price': 0,
                'revenue': 0,
                'shares': 0,
                'pe': 0,
                'profitMargin': 0,
                'history': []
            }
            self.wfile.write(json.dumps(empty_res).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

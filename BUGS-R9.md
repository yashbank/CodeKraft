# BUGS-R9

Generated from test-results/r9.json: 7 failing, 252 passing.

## S1


## S2

- [r9-desktop] route `/legal/privacy` role `anonymous` width 1280: loads at 375/768/1280 - Error: 429 /api/auth/get-session | 429 /api/auth/get-session
- [r9-desktop] route `/legal/terms` role `anonymous` width 1280: loads at 375/768/1280 - Error: 429 /api/auth/get-session | 429 /api/auth/get-session
- [r9-desktop] route `/legal/refunds` role `anonymous` width 1280: loads at 375/768/1280 - Error: 429 /api/auth/get-session | 429 /api/auth/get-session
- [r9-desktop] route `/contact` role `customer` width 1280: public page loads at 375/768/1280 - Error: 429 /api/auth/get-session | 429 /api/auth/get-session
- [r9-desktop] route `/legal/privacy` role `customer` width 1280: public page loads at 375/768/1280 - Error: 429 /api/auth/get-session | 429 /api/auth/get-session
- [r9-desktop] route `/legal/terms` role `customer` width 1280: public page loads at 375/768/1280 - Error: 429 /api/auth/get-session | 429 /api/auth/get-session
- [r9-desktop] route `/account/orders/:orderNo` role `customer` width 1280: loads at 375/768/1280 - Error: /account/orders/R914-PENDING @375 status | expect(received).toBeLessThan(expected)

## S3


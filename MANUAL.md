# MANUAL - things only the human can do

- Local dev seed (`pnpm db:seed`) creates no orders/entitlements/quotes/leads/queries/chat conversations, so the order/quote/lead/query DETAIL screens and the checkout flow could not be fully exercised by the automated audit. Please manually click through: register as a new customer, buy a product (UPI manual flow), submit a payment reference, then in admin confirm the payment and check /orders/[id], /account/orders/[id], /account/purchases. Report anything broken.

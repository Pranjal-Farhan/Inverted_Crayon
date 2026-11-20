@AGENTS.md

## Working on the live store

Anything that changes the live store's data (uploading products, categories, and so on) goes through the real admin at https://invertedcrayon.vercel.app/admin, driven in a browser — never by writing to its database directly, so SKUs, stock history and cached pages stay correct. Run those sessions in the **Inverted Crayon** environment, the only one whose network can reach the live site.

Sign in with the dedicated, permanent staff account supplied as the environment variables `STORE_ADMIN_EMAIL` and `STORE_ADMIN_PASSWORD`. Read them from the environment only, and never print, log, screenshot, commit or paste them anywhere. If they are missing, stop and tell the owner; do not try other accounts. It is a STAFF account (Orders, Products, Inventory, Customers, Discounts, Size guides, Categories): it cannot set purchase cost or reach Finance, Settings or Team.

New products go in as **Draft** unless the owner says otherwise, and the owner publishes them after adding photos. A Draft has no public page (it 404s on the storefront), so it is reviewed in the admin.

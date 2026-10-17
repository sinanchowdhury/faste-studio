FASTE STUDIO website update bundle

Files:
- index.html: updated UI, dashboard charts, production target, Stock Overview page, Sellers page, seller selection in Sales and Withdrawals, and improved Stores search/edit controls.
- app.js: dashboard chart data, production target tracking, stock overview metrics, seller management CRUD, seller balance updates, and store editing/search logic.
- seller_management_migration.sql: required Supabase database changes.

Deployment steps:
1. Back up your current website files and database.
2. Open your Supabase project SQL Editor and run seller_management_migration.sql once.
3. Replace your deployed index.html and app.js with these updated files. Keep them in the same directory because index.html loads app.js by relative path.
4. Sign in, open Sellers, and add each seller before recording sales for that seller.

Important notes:
- Seller balance increases by the seller commission recorded on a sale and decreases when that seller is withdrawn from. Editing a seller lets you set the current balance directly.
- Withdrawal amounts greater than the displayed seller balance are blocked.
- The SQL migration adds a sellers table and seller_id references; it does not delete existing product, production, stock, sales, or store records. Existing historical sales/withdrawals are not automatically assigned to newly created seller records.
- Test in a backup/staging copy first. Database row-level security and policies should be reviewed against your Supabase project's existing policies before production use.

New production and stock features:
- Dashboard chart compares sets made and sets sold over the last six months.
- Set a production target on the dashboard to track sets made against your goal. The target is saved in this browser for the currently signed-in user.
- Stock Overview shows stock sets, pieces, estimated stock value, batch count, stock by product type, and the current stock table.
- Charts load from Chart.js CDN, so an internet connection is required for chart rendering.

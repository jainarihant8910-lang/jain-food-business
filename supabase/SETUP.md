# Connect the two private owner dashboards

## One-time setup

1. Create a Supabase project.
2. In **SQL Editor**, run `schema.sql`.
3. In **Authentication → Users**, create one email/password account for the Jain Tiffin owner and a different account for the Sudhasagar Ji owner. Keep public sign-ups disabled.
4. In SQL Editor, assign each account to its own business. Replace the UUIDs with the IDs shown in Authentication → Users:

   ```sql
   insert into public.store_admins (user_id, business)
   values
     ('TIFFIN-AUTH-USER-UUID', 'tiffin'),
     ('PRODUCTS-AUTH-USER-UUID', 'products');
   ```

   Do not use the same user UUID for both rows if the owners should have separate access.

5. Copy the project URL and public anon/publishable key from the Supabase API settings to `config.js`. Do not add a service-role key to website files.
6. Open `jain-admin.html` and `products-admin.html` to sign in to the respective dashboards.

## What owners can edit

Each owner can update their store heading and copy, storefront photo, homepage card, brand story section, and their menu or product catalogue. Photo uploads go to the `store-media` bucket in a business-specific folder. Each owner can also edit the shared homepage introduction and family story. Row-level security keeps the Jain Tiffin menu and Sudhasagar Ji product writes separate.

The public pages read available content and items. Only assigned owner accounts can write. The `website_content` table is seeded with starter copy; all photos shown before owners upload their own are explicitly temporary examples.

## Ordering

Add the verified business number in the shared homepage editor, with country code and digits only. You can also set `businessWhatsApp` in `config.js`. Customers see a drafted WhatsApp message, review it, and press Send themselves. Delivery charges and availability should be confirmed by the business.

If you previously applied an older schema, rerun the updated `schema.sql` in the SQL Editor so the brand-specific admin roles and website content table are created.


# Jain Family Foods

A shared homepage for two family businesses, with separate Jain Tiffin and Sudhasagar Ji storefronts.

## Pages

- `index.html` — the main page that leads customers to either storefront.
- `jain-tiffin.html` — current menu, scroll-controlled four-compartment tiffin animation, and meal enquiry form.
- `products.html` — product catalogue, pack options, cart, and WhatsApp checkout.
- `story.html` and `contact.html` — family story and customer enquiries.
- `jain-admin.html` — private Jain Tiffin editor.
- `products-admin.html` — private Sudhasagar Ji editor.
- `admin.html` — owner sign-in chooser.

The two owner sign-ins use separate Supabase accounts and database roles. Each can edit its own storefront, menu or products, and images. Either brand owner can edit the shared homepage and family story. Public visitors do not get write access.

## Photos and content

The visible food photographs are temporary examples from Unsplash and are labelled as examples. Replace them with your own food, product, packaging, kitchen or family-business photos. The admin pages can change hero photos, homepage card photos, family story photos, headings and text. Menu items and product details are edited separately in each brand's own dashboard.

No menu, product, price, delivery promise, location or contact detail has been invented. Add confirmed details before taking orders.

## Preview

Serve this folder over HTTP so the Three.js ES module can load. For example, run `python -m http.server 8000` in this folder and open `http://localhost:8000`.

## Secure owner editing

Follow [`supabase/SETUP.md`](supabase/SETUP.md). Create a Supabase project, run `supabase/schema.sql`, create a separate Auth user for each business, and assign the user UUID to `store_admins` with the correct `business` value (`tiffin` or `products`). Add the project URL and public anon/publishable key to `config.js`. The browser must never contain a service-role key.

Until Supabase is connected, the storefronts show the temporary photos and empty menus/catalogue, and the login pages explain what is missing. The admin scaffold is not live authentication until the Supabase project is configured.

## Before live orders

Enter the verified WhatsApp number in the shared homepage editor (country code plus digits only), or set `businessWhatsApp` in `config.js`. Add confirmed menu and product details in their dashboards. Customers review the drafted WhatsApp message and press Send themselves. Delivery is left for the business to confirm.


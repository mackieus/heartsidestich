# Heartside Stitch website

## Publish to GitHub Pages
1. Create a public GitHub repository.
2. Upload `index.html` and `heartside-logo.png` to its root.
3. Go to Settings → Pages → Deploy from a branch → main → /(root) → Save.
4. Visit the URL shown in GitHub Pages settings after deployment.

## Wholesale inquiries
The form is configured to prepare an email addressed to **heartsidestitch@gmail.com**. This is a **mailto form**: it opens the visitor’s configured email app, and the visitor must press Send. It does not submit automatically or store inquiries on a server. Some visitors without an email client may need to email the address directly. For reliable one-click form submissions, connect a form service such as Formspree or Netlify Forms and update the form handler.

## Products
Edit the `PRODUCTS` array in `index.html` to add real products, product images and Etsy URLs. Replace these with Shopify links later. The USA map uses D3 and US Atlas data loaded from a CDN, so it needs an internet connection.

## Branding
`heartside-logo.png` is the full-resolution logo you supplied. Keep this file next to `index.html`.

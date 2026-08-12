# In The Black: simple app setup

The toolkit is now a responsive web app and an installable PWA. That means one simple deployment serves desktop, phone, iPhone, and Android users without maintaining two codebases.

## Publish it

1. Connect this repository to Netlify (or drag the folder into Netlify Drop).
2. Keep the publish directory as the repository root and leave the build command blank.
3. Use your custom domain, such as `app.intheblackbudget.com`, or keep it on the main site.
4. Link customers to `/toolkit.html`.

The existing `netlify.toml` is already configured for a static deploy.

## How customers use it

- On desktop: open **Open web app** from the marketing page.
- On iPhone/iPad: open the toolkit in Safari, tap Share, then **Add to Home Screen**.
- On Android: open it in Chrome, then choose **Install app** or **Add to Home screen**.

The app works offline after its first load and saves editable cells locally on the user's device. No account or server is required for this first version.

## What to add later

If you need customers to use the same budget on multiple devices, add authentication and a hosted database (Supabase is a cost-conscious option). That is the main difference between this lightweight PWA and a full account-based app; the spreadsheet-style interface can remain the same.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Local development & build

Prerequisites: Node.js (LTS), npm.

Install dependencies and run locally:

```bash
npm install
npm run dev
```

Create an optimized production build:

```bash
npm run build
npm start
```

### Environment variables

Create a `.env.local` in the project root and set the following (examples shown in `.env.local` in this repo):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `OPENAI_API_KEY` (optional — used if you want OpenAI embeddings)
- `LOCAL_EMBEDDING_BASE_URL` (optional — local embedding server)
- `ANTHROPIC_API_KEY` (optional — used for Claude-powered flows)
- `CLAUDE_MODEL` (optional override for the Claude model)

After setting environment variables you can re-run the dev server.

### Populate the vector store

To seed Qdrant with example products (used by the demos):

```bash
npx tsx scripts/ingest-products.ts
```

This will insert sample products used by `/api/visualise`, `/api/search`, and other demos.

## Deploy

The app is compatible with Vercel (recommended) or other Node/Next.js hosts. To deploy on Vercel:

1. Create a new project and connect your GitHub repository.
2. Set the same environment variables listed above in the Vercel dashboard (Project Settings → Environment Variables).
3. Deploy. Vercel will run `npm run build` automatically.

Make sure your Qdrant and Supabase instances are reachable from the deployed environment.

## Grocery Buddy Chrome extension

This repository includes a simple Chrome extension that can help auto-fill carts on supported grocery sites (Blinkit, Zepto, Instamart, BigBasket).

### Load the extension in Chrome (developer flow)

1. Open `chrome://extensions/` in Chrome/Edge.
2. Enable **Developer mode** (toggle in top-right).
3. Click **Load unpacked** and select the `extension/` folder inside this repo.
4. Confirm any permission requests and pin the extension to the toolbar.

Files:

- [extension/manifest.json](extension/manifest.json#L1)
- [extension/content.js](extension/content.js#L1)
- [extension/popup.html](extension/popup.html#L1)

### Using the recipe → cart demo with the extension

1. Start your local app: `npm run dev` and open the demo: `http://localhost:3000/recipe-to-cart-demo`.
2. Paste a recipe URL and click **Fetch matched products**.
3. After matches appear you have three options:
	- **Open Blinkit (one tab, auto-fill)** — opens a single Blinkit tab with a `?products=` query; the extension will detect the URL parameter, store the pending list, and attempt to auto-fill the cart automatically.
	- **Open all Blinkit searches** — opens a search tab for each product (semi-automatic; you may need to confirm or click Add on each tab).
	- **Copy list for extension popup** — copies the product list to your clipboard. Click the extension icon, paste the list into the textarea, click **Save list**, then open Blinkit and press **Auto-fill cart** (floating button injected by the extension).

### Troubleshooting & tips

- If the floating **Auto-fill cart** button doesn't appear on the grocery site, make sure the extension is loaded, host permissions are allowed, and the domain is included in `manifest.json`.
- If automatic clicking fails, the site markup may have changed. Inspect the site's Add buttons and update selectors in `extension/content.js` (see `findSearchBox()` and `findAddButton()` functions).
- If `/api/visualise` returns an empty array, ensure you've ingested products into Qdrant (see **Populate the vector store** above).

## Final notes

This project is an experimental demo. The extension uses DOM heuristics to find search boxes and add buttons — it will likely need periodic selector updates to keep working with production grocery sites.


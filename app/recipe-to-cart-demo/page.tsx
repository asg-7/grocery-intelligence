"use client";

import React, { useState } from "react";

export default function RecipeToCartDemo() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchMatches() {
    setLoading(true);
    setError(null);
    setItems([]);
    try {
      const res = await fetch('/api/recipe-to-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(JSON.stringify(data));
      } else {
        setItems(data.items || []);
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function openBlinkitSearch(productName: string) {
    const searchUrl = `https://www.blinkit.com/search?q=${encodeURIComponent(productName)}`;
    window.open(searchUrl, '_blank');
  }

  function openBlinkitAllSearches() {
    for (const it of items) {
      const name = it.matched_product ?? it.parsed.item;
      window.open(`https://www.blinkit.com/search?q=${encodeURIComponent(name)}`, '_blank');
    }
  }

  function openBlinkitWithProductsParam() {
    const names = items.map(it => (it.matched_product ?? it.parsed.item));
    const joined = names.map(n => n.replace(/,/g, '')).join(',');
    const urlParam = encodeURIComponent(joined);
    const target = `https://www.blinkit.com/?products=${urlParam}`;
    window.open(target, '_blank');
  }

  async function copyListToClipboard() {
    const names = items.map(it => (it.matched_product ?? it.parsed.item));
    const text = names.join('\n');
    await navigator.clipboard.writeText(text);
    alert('Product list copied to clipboard. Open the extension popup and paste it.');
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Recipe → Cart Demo</h2>
      <p>Paste a recipe URL and click <strong>Fetch matched products</strong>.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input style={{ flex: 1, padding: 8 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/my-recipe" />
        <button onClick={fetchMatches} disabled={loading} style={{ padding: '8px 12px' }}>{loading ? 'Loading…' : 'Fetch matched products'}</button>
      </div>
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}

      {items.length > 0 && (
        <div>
          <h3>Matched products ({items.length})</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={openBlinkitAllSearches} style={{ padding: '6px 10px' }}>Open all Blinkit searches</button>
            <button onClick={openBlinkitWithProductsParam} style={{ padding: '6px 10px' }}>Open Blinkit (one tab, auto-fill)</button>
            <button onClick={copyListToClipboard} style={{ padding: '6px 10px' }}>Copy list for extension popup</button>
          </div>

          <ul>
            {items.map((it, idx) => (
              <li key={idx} style={{ marginBottom: 8 }}>
                <strong>{it.matched_product ?? it.parsed.item}</strong>
                <div style={{ fontSize: 13, color: '#666' }}>{it.parsed.item} — confidence: {it.confidence ?? 'n/a'}</div>
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => openBlinkitSearch(it.matched_product ?? it.parsed.item)} style={{ padding: '6px 8px' }}>Open Blinkit search</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

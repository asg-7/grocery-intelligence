"use client";

import React, { useEffect, useState } from "react";
import dynamic from 'next/dynamic';
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

type Point = { id: string | number; x: number; y: number; name?: string; category?: string; price?: number | null };

export default function MapPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/visualise');
        const data = await res.json();
        if (!res.ok) {
          setError(JSON.stringify(data));
        } else {
          setPoints(data.points || []);
        }
      } catch (err: any) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Loading map…</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>;

  // Group by category
  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const cat = p.category ?? 'Unknown';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(p);
  }

  const colorPalette = [
    '#2ca02c', '#1f77b4', '#ff7f0e', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
  ];

  const traces = Array.from(groups.entries()).map(([cat, pts], idx) => ({
    x: pts.map(p => p.x),
    y: pts.map(p => p.y),
    mode: 'markers',
    type: 'scattergl',
    name: cat,
    text: pts.map(p => `${p.name ?? 'Unknown'}${p.price ? ` — ₹${p.price}` : ''}`),
    hoverinfo: 'text',
    marker: { size: 8, color: colorPalette[idx % colorPalette.length] }
  }));

  const layout = {
    title: 'Product Semantic Map',
    height: 640,
    autosize: true,
    hovermode: 'closest',
  };

  return (
    <div style={{ padding: 8 }}>
      <h2>Semantic Product Map</h2>
      <div>
        <Plot data={traces as any} layout={layout as any} style={{ width: '100%' }} config={{ responsive: true }} />
      </div>
    </div>
  );
}

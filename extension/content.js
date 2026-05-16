// Grocery Buddy content script
(function () {
  console.log('Grocery Buddy content script loaded');

  function createButton() {
    if (document.getElementById('grocery-buddy-button')) return;
    const btn = document.createElement('button');
    btn.id = 'grocery-buddy-button';
    btn.textContent = 'Auto-fill cart';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 999999,
      padding: '10px 14px',
      background: '#ff6a00',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    });
    btn.addEventListener('click', startAutoFill);
    document.body.appendChild(btn);
  }

  function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async function findSearchBox() {
    const selectors = [
      'input[type="search"]',
      'input[placeholder*="Search"]',
      'input[placeholder*="search"]',
      'input[type="text"]',
      'input[name="q"]',
      'input[id*="search"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function findAddButton() {
    const selectors = [
      'button[aria-label*="Add"]',
      'button[aria-label*="add"]',
      'button[class*="add"]',
      'button[data-test*="add"]',
      'button[data-testid*="add"]',
      'button[title*="Add"]',
      'button[onclick*="add"]',
      'button'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const text = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
      if (text.includes('add') || text.includes('cart') || el.getAttribute('data-test') || el.className.toLowerCase().includes('add')) {
        return el;
      }
    }
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const b of buttons) {
      const t = (b.innerText || '').trim().toLowerCase();
      if (t === 'add' || t === 'add to cart' || t.includes('add')) return b;
    }
    return null;
  }

  async function doSearchAndAdd(product) {
    const searchBox = await findSearchBox();
    if (!searchBox) {
      console.warn('Grocery Buddy: no search box found for', product.name);
      return;
    }
    const eventInput = new Event('input', { bubbles: true });
    searchBox.focus();
    searchBox.value = product.name;
    searchBox.dispatchEvent(eventInput);
    searchBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(1500);
    const addBtn = findAddButton();
    if (addBtn) {
      addBtn.click();
      console.log('Grocery Buddy: clicked add for', product.name);
    } else {
      console.warn('Grocery Buddy: add button not found for', product.name);
    }
  }

  async function startAutoFill() {
    chrome.storage.local.get(['pendingCart'], async (data) => {
      const products = data.pendingCart || [];
      if (!products || products.length === 0) {
        alert('No pending cart found in extension storage. Open the extension popup to save a list.');
        return;
      }
      for (const p of products) {
        await doSearchAndAdd(p);
        await sleep(1000);
      }
      chrome.storage.local.remove('pendingCart', () => {
        console.log('Grocery Buddy: cleared pendingCart');
      });
      alert('Auto-fill finished (attempted). Check page for added items.');
    });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', createButton);
  } else {
    createButton();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pendingCart) {
      createButton();
    }
  });
})();

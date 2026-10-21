import { test, expect } from '@playwright/test';

const faults = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  faults.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(faults.get(page) ?? []).toEqual([]); });

const cssEditor = (page) => page.locator('.tabpanel-css textarea').first();
async function ready(page, path = '/grid/1/') {
  await page.goto(path);
  await expect(page.locator('.tabpanel-css .prism-live-source').first()).toBeAttached();
}
async function reset(page) {
  await page.locator('.reset').first().click();
  await page.locator('.reset-dialog[open] button[value=yes]').click();
  await expect(page.locator('.reset').first()).toBeDisabled();
}
async function stored(page, key) { return page.evaluate(key => localStorage.getItem(key), key); }

for (const route of ['/', '/grid/', '/flex/', '/subgrid/', '/defensive/', '/sda/', '/iframe/grid/1/', '/iframe/sda/1/']) {
  test(`no runtime errors: ${route}`, async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    if (route === '/') await page.goto(route); else await ready(page, route);
    expect(errors).toEqual([]);
  });
}

test('legacy standard solutions survive load, edit, reload and iframe', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('seeded')) {
      localStorage.setItem('ex:grid-01', JSON.stringify({ css: '.container {display:grid; gap:23px}', boxes: 5 }));
      localStorage.setItem('ex:flexbox-04a', JSON.stringify({ css: '.container {display:flex}', boxes: 4 }));
      localStorage.setItem('unrelated', 'preserve me'); localStorage.setItem('seeded', 'yes');
    }
  });
  await ready(page);
  await expect(cssEditor(page)).toHaveValue('.container {display:grid; gap:23px}');
  await expect(page.locator('.output .box')).toHaveCount(5);
  await cssEditor(page).fill('.container { display: grid; gap: 31px }');
  await page.goto('/iframe/grid/1/'); // pagehide must flush the pending save
  await expect(cssEditor(page)).toHaveValue('.container { display: grid; gap: 31px }');
  await page.goto('/flex/4a/');
  await expect(cssEditor(page)).toHaveValue('.container {display:flex}');
  expect(await stored(page, 'unrelated')).toBe('preserve me');
});

for (const [path, key] of [['/grid/1/', 'ex:grid-01'], ['/sda/1/', 'ex:sda-v2:sda-01']]) {
  test(`reset cancels pending CSS and storage: ${path}`, async ({ page }) => {
    await ready(page, path); const initial = await cssEditor(page).inputValue();
    // Reset within the save debounce; programmatic dialog close also tests frame races.
    await page.evaluate(() => {
      const t = document.querySelector('.tabpanel-css textarea');
      t.value += '\n/* changed */'; t.dispatchEvent(new Event('input', { bubbles: true }));
      const dialog = document.querySelector('.reset-dialog'); dialog.show(); dialog.close('yes');
    });
    await expect(cssEditor(page)).toHaveValue(initial);
    await page.waitForTimeout(400);
    expect(await stored(page, key)).toBeNull();
    await page.reload(); await expect(cssEditor(page)).toHaveValue(initial);
  });
  test(`empty CSS and rapid navigation are preserved: ${path}`, async ({ page }) => {
    await ready(page, path); await cssEditor(page).fill(''); await page.reload();
    await expect(cssEditor(page)).toHaveValue('');
    await ready(page, path); await cssEditor(page).fill('.box { color: red }');
    await page.goto('/'); await page.goto(path);
    await expect(cssEditor(page)).toHaveValue('.box { color: red }');
    expect(await stored(page, key)).toContain('.box { color: red }');
  });
  test(`returning to defaults cancels older saves: ${path}`, async ({ page }) => {
    await ready(page, path); const initial = await cssEditor(page).inputValue();
    await cssEditor(page).fill(initial + '\n/* changed */'); await cssEditor(page).fill(initial);
    await page.waitForTimeout(400); expect(await stored(page, key)).toBeNull();
  });
}

test('box-only edits enable reset and export without opening HTML', async ({ page }) => {
  await ready(page, '/grid/4/');
  const before = await page.locator('.output .box').count();
  await page.locator('.plus').click();
  await expect(page.locator('.output .box')).toHaveCount(before + 1);
  await expect(page.locator('.reset')).toBeEnabled();
  const html = await page.evaluate(() => {
    const f = document.querySelector('.codepen-form'); f.dispatchEvent(new Event('submit', { cancelable: true }));
    return JSON.parse(f.querySelector('input').value).html;
  });
  expect(html.match(/class="box box-/g)).toHaveLength(before + 1);
  await reset(page); await expect(page.locator('.output .box')).toHaveCount(before);
  await page.waitForTimeout(400); expect(await stored(page, 'ex:grid-04')).toBeNull();
});

for (const failure of ['getItem', 'setItem', 'removeItem']) {
  test(`blocked ${failure} does not break exercises`, async ({ page }) => {
    await page.addInitScript(method => {
      Storage.prototype[method] = function () { throw new DOMException('blocked', 'SecurityError'); };
    }, failure);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await ready(page); await cssEditor(page).fill('.container { display: grid; gap: 43px }');
    await expect(page.locator('.output .container')).toHaveCSS('gap', '43px');
    await page.waitForTimeout(350); await reset(page);
    expect(errors).toEqual([]);
  });
}

test('invalid storage is ignored without losing valid CSS or unrelated keys', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ex:grid-01', '{"css":".container {gap:17px}","boxes":1000000}');
    localStorage.setItem('ex:grid-02', 'not json');
    localStorage.setItem('ex:grid-03', '{"css":{},"boxes":-1}');
  });
  await ready(page, '/grid/');
  await expect(cssEditor(page)).toHaveValue('.container {gap:17px}');
  expect(await page.locator('section').first().locator('.output .box').count()).toBeLessThan(13);
});

test('SDA overview, individual and iframe share only the new stable key', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('ex:sda-04', 'old colliding value'); });
  await ready(page, '/sda/4/'); await cssEditor(page).fill('.frame { opacity: .73 }');
  await page.goto('/iframe/sda/4/'); await expect(cssEditor(page)).toHaveValue('.frame { opacity: .73 }');
  await page.goto('/sda/');
  await expect(page.locator('[data-exercise-key="sda-03a"] .tabpanel-css textarea')).toHaveValue('.frame { opacity: .73 }');
  expect(await stored(page, 'ex:sda-04')).toBe('old colliding value');
});

test('absolute navigation preserves 4a and single-view state', async ({ page }) => {
  await ready(page, '/flex/4/');
  await expect(page.locator('.next')).toHaveAttribute('href', '/flex/4a');
  await expect(page.locator('#exercise-list a[href="/flex/4a"]')).toHaveCount(1);
  await page.goto('/flex/4a/');
  await expect(page.locator('.prev')).toHaveAttribute('href', '/flex/4');
  await expect(page.locator('.next')).toHaveAttribute('href', '/flex/5');
  await expect(page.locator('.view-toggle')).toHaveAttribute('data-view', 'single');
  await expect(page.locator('#exercise-list a[href="/flex/4a"]')).toHaveCount(1);
});

test('highlighting is lazy and readonly HTML survives editor shortcuts', async ({ page }) => {
  await ready(page, '/grid/');
  expect(await page.locator('.prism-live-source').count()).toBeLessThan(10);
  await expect(page.locator('.tabpanel-html .prism-live-source')).toHaveCount(0);
  const section = page.locator('section').first();
  await section.locator('[id$="tab-html"]').click();
  const html = section.locator('.tabpanel-html textarea');
  await expect(html).toHaveClass(/prism-live-source/); const initial = await html.inputValue();
  await html.focus();
  for (const key of ['Tab', 'Enter', '{', 'Control+Shift+D', 'Meta+/', 'Alt+ArrowUp', 'Alt+ArrowDown', 'Alt+Shift+ArrowUp', 'Alt+Shift+ArrowDown', 'Meta+Enter', 'Meta+Shift+Enter', 'Control+Enter', 'Control+Shift+Enter', 'Meta+Shift+Digit7', 'Control+Shift+Digit7']) {
    await html.focus(); await page.keyboard.press(key); await expect(html).toHaveValue(initial);
  }
});

test('shortcuts, hints, clearing, reset and long-paste highlighting stay in sync', async ({ page }) => {
  await ready(page);
  const t = cssEditor(page);
  await t.fill(''); await t.press('{'); await t.press('Enter');
  await expect(t).toHaveValue(/\{\n\t\n\}/);
  await t.fill('.container { gap: 29px; }');
  await expect(page.locator('.tabpanel-css code')).toHaveText('.container { gap: 29px; }');
  await expect(page.locator('.tabpanel-css .token.property')).toHaveText(['gap']);
  const long = '.container {\n' + Array.from({ length: 1800 }, (_, i) => `--v${i}: ${i}px;`).join('\n') + '\ngap: 9px;\n}';
  await t.fill(long);
  // Return to the previously highlighted value while a large job is in flight.
  await t.fill('.container { gap: 29px; }');
  await expect(page.locator('.tabpanel-css code')).toHaveText('.container { gap: 29px; }');
  await t.fill(long);
  await expect.poll(() => page.locator('.tabpanel-css .token.property').count()).toBeGreaterThan(1000);
  await t.fill('.container { gap: 7px; }');
  await expect(page.locator('.tabpanel-css code')).toHaveText('.container { gap: 7px; }');
  await expect(page.locator('.output .container')).toHaveCSS('gap', '7px');
  await reset(page);
  await expect(page.locator('.tabpanel-css code')).toHaveText(await t.inputValue());
});

test('failed editor download can retry and plain textarea remains readable', async ({ page }) => {
  let failures = 0;
  await page.route('**/script/prism-live.js', route => failures++ === 0 ? route.abort() : route.continue());
  await page.goto('/grid/1/');
  await expect.poll(() => failures).toBe(1);
  const t = cssEditor(page);
  await expect(page.locator('.tabpanel-css pre .token.selector')).toHaveText('.container');
  await expect(page.locator('.tabpanel-css .line-numbers-rows > span')).toHaveCount(4);
  await t.click(); await expect(t).toHaveClass(/prism-live-source/);
  await t.fill('.container { gap: 13px; }');
  await expect(page.locator('.tabpanel-css .token.property')).toHaveText(['gap']);
});

test('dispose cancels work and removed editors can be reattached', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const section = document.querySelector('section'), textarea = section.querySelector('textarea');
    const instance = Prism.Live.all.get(textarea);
    instance.scheduleUpdate(); section.remove();
    return new Promise(resolve => setTimeout(() => {
      const result = { destroyed: instance.destroyed, registered: !!Prism.Live.all.get(textarea), aborted: instance.controller.signal.aborted };
      document.querySelector('main').append(section); textarea.focus(); resolve(result);
    }, 50));
  });
  expect(result).toEqual({ destroyed: true, registered: false, aborted: true });
  await expect(cssEditor(page)).toHaveClass(/prism-live-source/);
});

test('videos retain posters without downloading all media on load', async ({ page }) => {
  const videoCount = 11;
  await ready(page, '/sda/');
  await expect(page.locator('video')).toHaveCount(videoCount);
  await expect(page.locator('video[preload=none]')).toHaveCount(videoCount - 1);
  const videos = await page.locator('video').evaluateAll(videos => videos.map(v => ({ poster: v.poster, src: v.currentSrc })));
  expect(videos.every(v => v.poster.endsWith('.poster.webp'))).toBe(true);
  const requests = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /\.mp4/.test(r.name)).length);
  expect(requests).toBeLessThan(3);
  expect(await page.evaluate(async () => Promise.all(Array.from(document.querySelectorAll('video'), v => new Promise(resolve => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = v.poster; }))))).toEqual(Array(videoCount).fill(true));
  await page.locator('.video-wrapper').first().click({ position: { x: 100, y: 60 } });
  await expect.poll(() => page.locator('video').first().evaluate(v => v.paused)).toBe(false);
});

test('SDA parser preserves colors, strings, URLs, conditional groups, nested CSS and scoped keyframes', async ({ page }) => {
  await ready(page, '/sda/1/');
  await cssEditor(page).fill(`/* } @keyframes fake { */
    .box { color: red; content: "} red"; background: url("data:image/svg+xml,red"); animation: red 1s linear, blue 2s; height: 50vh; }
    @keyframes red { from {opacity:0} to {opacity:1} }
    @supports (display: grid) { @keyframes blue { to {scale:2} } .box {animation-name:blue} }
    @media (min-width: 1px) {.box { color: red; & > span {animation: red 2s} }}
  `);
  await expect.poll(() => page.locator('.editor > style').textContent()).toContain('sda-01--red');
  const result = await page.locator('.editor > style').textContent();
  expect(result).toContain('color: red'); expect(result).toContain('"} red"');
  expect(result).toContain('data:image/svg+xml,red'); expect(result).toContain('50cqh');
  expect(result).toContain('@supports'); expect(result).toContain('@media');
  expect(result).toContain('@keyframes sda-01--red'); expect(result).toContain('@keyframes sda-01--blue');
  expect(result).toMatch(/animation-name:\s*sda-01--blue/);
  expect(result).toContain('sda-01--red'); expect(result).not.toContain('color: sda-01--red');
});

test('animation variables keep their non-animation uses and timeline', async ({ page }) => {
  await ready(page, '/sda/1/');
  await cssEditor(page).fill('.progress { --shared: red; color: var(--shared); animation: var(--shared) 1s linear both; animation-timeline: scroll(); } @keyframes red { to { opacity: .4; } }');
  const progress = page.locator('.sda-result .progress');
  await expect(progress).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(progress).toHaveCSS('animation-name', 'sda-01--red');
  if (await page.evaluate(() => CSS.supports('animation-timeline: scroll()'))) await expect(progress).toHaveCSS('animation-timeline', 'scroll()');
  await cssEditor(page).fill('.progress { --name: red; --outer: var(--name); color:red; animation-name:var(--outer); } @keyframes red { to {opacity:1} }');
  await expect(progress).toHaveCSS('animation-name', 'sda-01--red');
});

test('hint inserts, IME input and highlighting remain synchronized', async ({ page }) => {
  await ready(page);
  const t = cssEditor(page);
  await t.fill(''); await t.focus();
  await page.locator('.exercise-content p code').first().click();
  await expect(t).toHaveValue(/grid-template-columns/);
  await t.evaluate(el => {
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles:true }));
    el.value = '.container { /* 日本語 */ gap: 18px; }';
    el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: '{', isComposing: true, bubbles: true, cancelable: true }));
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles:true }));
  });
  await expect(t).toHaveValue('.container { /* 日本語 */ gap: 18px; }');
  await expect(page.locator('.tabpanel-css code')).toHaveText('.container { /* 日本語 */ gap: 18px; }');
  await expect(page.locator('.output .container')).toHaveCSS('gap', '18px');
});

test('resize keeps textarea and highlight metrics and scrolling aligned', async ({ page }, testInfo) => {
  await ready(page);
  const t = cssEditor(page);
  await t.fill('.container {\n' + '  /* a long line of CSS: ' + 'x'.repeat(200) + ' */\n' + '  gap: 10px;\n'.repeat(60) + '}');
  for (const width of [1440, 390, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => t.evaluate(el => {
      const pre = el.previousElementSibling, a = getComputedStyle(el), b = getComputedStyle(pre);
      return ['fontFamily', 'fontSize', 'lineHeight', 'tabSize', 'paddingLeft'].every(prop => a[prop] === b[prop]);
    })).toBe(true);
    await t.evaluate(el => { el.scrollTop = 50; el.scrollLeft = 80; el.dispatchEvent(new Event('scroll')); });
    expect(await t.evaluate(el => Math.abs(el.scrollTop - el.previousElementSibling.scrollTop))).toBeLessThan(2);
    await page.locator('section').first().screenshot({ path: testInfo.outputPath(`editor-${width}.png`) });
  }
});

test('Escape cancels a new reset dialog after a previous confirmed reset', async ({ page }) => {
  await ready(page);
  await cssEditor(page).fill('.container { gap: 2px }'); await reset(page);
  await cssEditor(page).fill('.container { gap: 3px }');
  await page.locator('.reset').click(); await page.keyboard.press('Escape');
  await expect(page.locator('.reset-dialog')).not.toHaveAttribute('open');
  await expect(cssEditor(page)).toHaveValue('.container { gap: 3px }');
});

test('input bursts highlight once per frame and retain the newest CSS', async ({ page }) => {
  await ready(page);
  const count = await page.evaluate(async () => {
    const highlight = Prism.highlightElement;
    let count = 0; Prism.highlightElement = (...args) => { count++; return highlight(...args); };
    const t = document.querySelector('.tabpanel-css textarea');
    for (let i = 0; i < 50; i++) { t.value = `.container { gap: ${i}px; }`; t.dispatchEvent(new Event('input', { bubbles: true })); }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    Prism.highlightElement = highlight;
    return count;
  });
  expect(count).toBe(1);
  await expect(page.locator('.tabpanel-css code')).toHaveText('.container { gap: 49px; }');
  await expect(page.locator('.output .container')).toHaveCSS('gap', '49px');
});

test('incomplete SDA CSS remains editable and does not overwrite source text', async ({ page }) => {
  await ready(page, '/sda/1/');
  const css = '.progress { color: red; /* unclosed comment';
  await cssEditor(page).fill(css);
  await expect(page.locator('.sda-result .progress')).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(cssEditor(page)).toHaveValue(css);
  await cssEditor(page).fill('.progress { color: blue; content: "a } brace"; }');
  await expect(page.locator('.sda-result .progress')).toHaveCSS('color', 'rgb(0, 0, 255)');
});

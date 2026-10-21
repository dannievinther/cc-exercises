import { test, expect } from '@playwright/test';

const firstSource = (page) => page.locator('.tabpanel-css textarea').first();
const firstCode = (page) => page.locator('.tabpanel-css pre > code').first();

test('cold first paint is already highlighted and hydration reuses its layout and nodes', async ({ page }, testInfo) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  // No application JavaScript can create or style the initial surface in this test.
  await page.route('**/_astro/*.js', async route => { await pending; await route.continue(); });
  await page.goto('/grid/1/', { waitUntil: 'commit' });
  try {
    await expect(firstCode(page).locator('.token.selector')).toHaveText('.container');
    await expect(firstCode(page).locator('.token.selector')).toHaveCSS('color', 'rgb(75, 243, 200)');
    await expect(firstCode(page).locator('.line-numbers-rows > span')).toHaveCount(4);
    await expect(firstSource(page)).not.toHaveClass(/prism-live-source/);
    await page.evaluate(() => Promise.all(Array.from(document.fonts, face => face.load())));
    const before = await firstSource(page).evaluate(source => {
      const pre = source.previousElementSibling, code = pre.querySelector('code');
      window.initialEditorNodes = { pre, code, firstToken: code.firstElementChild };
      const measure = el => {
        const cs = getComputedStyle(el), rect = el.getBoundingClientRect();
        return { x:rect.x, y:rect.y, width:rect.width, height:rect.height, paddingLeft:cs.paddingLeft, fontSize:cs.fontSize, lineHeight:cs.lineHeight };
      };
      return { source:measure(source), pre:measure(pre) };
    });
    expect(parseFloat(before.source.paddingLeft)).toBeGreaterThan(40);
    expect(before.source.paddingLeft).toBe(before.pre.paddingLeft);
    // WebKit screenshots wait for document.fonts.ready, which is intentionally
    // pending while module scripts are held. DOM/style assertions run in both.
    if (testInfo.project.name === 'chrome') await page.locator('.editor').first().screenshot({ path:testInfo.outputPath('cold-first-paint.png') });
    release();
    await expect(firstSource(page)).toHaveClass(/prism-live-source/);
    const after = await firstSource(page).evaluate(source => {
      const pre=source.previousElementSibling, code=pre.querySelector('code'), initial=window.initialEditorNodes;
      const measure=el=>{ const cs=getComputedStyle(el),r=el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,paddingLeft:cs.paddingLeft,fontSize:cs.fontSize,lineHeight:cs.lineHeight}; };
      return { source:measure(source), pre:measure(pre), reused:pre===initial.pre&&code===initial.code&&code.firstElementChild===initial.firstToken };
    });
    expect(after.reused).toBe(true);
    expect(after.source).toEqual(before.source);
    expect(after.pre).toEqual(before.pre);
  } finally { release(); }
});

test('saved CSS is highlighted before the editing extensions finish loading', async ({ page }) => {
  const saved='.container {\n  display: grid;\n  gap: 19px;\n}\n';
  await page.addInitScript(css => localStorage.setItem('ex:grid-01', JSON.stringify({css})), saved);
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  await page.route('**/script/prism-live.js', async route=>{await pending;await route.continue();});
  await page.goto('/grid/1/', {waitUntil:'domcontentloaded'});
  try {
    await expect(firstSource(page)).toHaveValue(saved);
    await expect(firstCode(page).locator('.token.property')).toHaveText(['display','gap']);
    await expect(firstCode(page).locator('.line-numbers-rows > span')).toHaveCount(5);
    await expect(firstSource(page)).not.toHaveClass(/prism-live-source/);
    release();
    await expect(firstSource(page)).toHaveClass(/prism-live-source/);
    await expect(firstSource(page)).toHaveValue(saved);
    await expect(firstCode(page).locator('.line-numbers-rows > span')).toHaveCount(5);
  } finally {release();}
});

for (const route of ['/grid/','/sda/','/iframe/grid/1/','/iframe/sda/1/']) {
  test(`all CSS and HTML surfaces start with exactly one number per line: ${route}`,async({page})=>{
    // Include hidden HTML tabs and offscreen, uninitialized editors.
    await page.goto(route);
    const invalid=await page.locator('[data-editor-shell]').evaluateAll(shells=>shells.flatMap(shell=>{
      const source=shell.querySelector('textarea'), rows=shell.querySelectorAll('.line-numbers-rows > span');
      const expected=source.value.split('\n').length;
      return rows.length===expected?[]:[{id:source.id,expected,actual:rows.length}];
    }));
    expect(invalid).toEqual([]);
  });
}

for (const [value, expected] of [['',1],['a',1],['a\nb',2],['a\nb\n',3],['\n\n',3]]) {
  test(`live numbering handles ${JSON.stringify(value)} as ${expected} lines`,async({page})=>{
    await page.goto('/grid/1/');
    await expect(firstSource(page)).toHaveClass(/prism-live-source/);
    await firstSource(page).fill(value);
    await expect(firstCode(page).locator('.line-numbers-rows > span')).toHaveCount(expected);
    await expect(firstSource(page)).toHaveValue(value);
  });
}

test('worker highlighting numbers every line including a trailing empty line',async({page})=>{
  await page.goto('/grid/1/');
  await expect(firstSource(page)).toHaveClass(/prism-live-source/);
  const css='/* '+'x'.repeat(17000)+' */\n.container {\n  display: grid;\n}\n';
  await firstSource(page).fill(css);
  await expect(firstCode(page).locator('.token.property')).toHaveText(['display']);
  await expect(firstCode(page).locator('.line-numbers-rows > span')).toHaveCount(5);
  await expect(firstSource(page)).toHaveValue(css);
});

import { test, expect } from '@playwright/test';

test('Grid initializes few editors and repeated interaction does not accumulate listeners', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'CDP counters are Chrome-specific');
  await page.goto('/grid/');
  await expect(page.locator('.prism-live-source').first()).toBeAttached();
  const initial = await page.evaluate(() => ({ editors:document.querySelectorAll('.prism-live-source').length, nodes:document.querySelectorAll('*').length }));
  expect(initial.editors).toBeLessThan(10);
  const section = page.locator('section').first();
  await section.locator('[id$="tab-html"]').click(); await section.locator('[id$="tab-css"]').click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage'); const before = await cdp.send('Memory.getDOMCounters');
  await page.evaluate(async () => {
    const s=document.querySelector('section'), t=s.querySelector('.tabpanel-css textarea');
    for(let i=0;i<100;i++) {
      t.value=`.container { gap: ${i}px; }`; t.dispatchEvent(new Event('input',{bubbles:true}));
      s.querySelector('[id$="tab-html"]').click(); s.querySelector('[id$="tab-css"]').click();
    }
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  await cdp.send('HeapProfiler.collectGarbage'); const after = await cdp.send('Memory.getDOMCounters');
  expect(after.jsEventListeners).toBeLessThanOrEqual(before.jsEventListeners);
  console.info('Grid performance:', JSON.stringify({ initial, before, after }));
  await testInfo.attach('dom-counters', { body:JSON.stringify({initial,before,after},null,2), contentType:'application/json' });
});

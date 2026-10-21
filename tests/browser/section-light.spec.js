import { test, expect } from '@playwright/test';

for (const route of ['/grid/', '/flex/', '/subgrid/', '/defensive/', '/sda/']) {
  test(`section glow follows its original entry, centre and exit: ${route}`, async ({ page }) => {
    await page.goto(route);
    const section = page.locator('section[data-exercise-key]').nth(1);
    const supported = await page.evaluate(() => CSS.supports('animation-timeline: --t') && CSS.supports('animation-range: contain 50%'));
    test.skip(!supported, 'Browser does not support scroll-driven animations');
    await expect(section).toHaveCSS('animation-name', '--a');
    await expect(section).toHaveCSS('animation-timeline', '--t');
    const { top, height, viewport } = await section.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top + scrollY, height: rect.height, viewport: innerHeight };
    });
    for (const [scrollTop, light] of [
      [top - viewport - 20, '0'],
      [top + (height - viewport) / 2, '1'],
      [top + height + 20, '0'],
    ]) {
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), scrollTop);
      await expect(section).toHaveCSS('--light', light);
      await expect.poll(() => section.evaluate(el => getComputedStyle(el, '::before').opacity)).toBe(light);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top + (height - viewport) / 2);
    await expect(section).toHaveCSS('animation-name', 'none');
    await expect.poll(() => section.evaluate(el => getComputedStyle(el, '::before').opacity)).toBe('0');
  });
}

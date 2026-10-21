import { test, expect } from '@playwright/test';

for (const route of ['/grid/', '/flex/', '/subgrid/', '/defensive/', '/sda/']) {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    test(`exercise headings retain their text, reveal and anchors: ${route} (${reducedMotion})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await page.goto(route);
      const headings = page.locator('h2.small-label');
      expect(await headings.count()).toBeGreaterThan(1);
      // Check both the initially visible title and a title reached by scrolling.
      for (const heading of [headings.first(), headings.last()]) {
        await heading.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
        const link = heading.locator('a');
        await expect(link).not.toHaveText('');
        await expect(link).toHaveAttribute('href', `#${await heading.getAttribute('id')}`);
        await expect.poll(() => link.evaluate(el => {
          const style = getComputedStyle(el);
          const enhanced = matchMedia('(prefers-reduced-motion: no-preference)').matches
            && CSS.supports('animation-timeline: view()') && CSS.supports('animation-range: entry 0% entry 100%');
          return enhanced
            ? style.animationName !== 'none' && style.animationTimeline === 'view()' && parseFloat(style.getPropertyValue('--title')) >= 99
            : style.webkitTextFillColor !== 'transparent' && style.webkitTextFillColor !== 'rgba(0, 0, 0, 0)';
        })).toBe(true);
      }
    });
  }
}

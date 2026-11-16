import { test, expect } from '@playwright/test';

for (const route of ['/grid/', '/flex/', '/subgrid/', '/defensive/', '/sda/']) {
  test(`every exercise has a completion button: ${route}`, async ({ page }) => {
    await page.goto(route);
    const sections = page.locator('section[data-exercise-key]');
    expect(await sections.count()).toBeGreaterThan(1);
    await expect(page.locator('.exercise-completion')).toHaveCount(await sections.count());
    await expect(page.locator('.exercise-completion[aria-pressed="false"]')).toHaveCount(await sections.count());
  });
}

for (const category of ['grid', 'sda']) {
  test(`completion toggles by keyboard and persists across views: ${category}`, async ({ page }) => {
    await page.goto(`/${category}/1/`);
    const section = page.locator('section[data-exercise-key]').first();
    const key = await section.getAttribute('data-exercise-key');
    const button = section.getByRole('button', { name: /^Markér som færdig:/ });
    const css = section.locator('.tabpanel-css textarea');
    const initialCSS = await css.inputValue();
    await button.focus();
    await button.press('Space');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(section).toHaveCSS('outline-width', '2px');
    await expect(section).toHaveCSS('outline-style', 'solid');
    expect(await section.evaluate(el => {
      const reference = document.createElement('div');
      reference.style.outlineColor = 'oklch(from #a2fad2f2 l 100% h)';
      document.body.append(reference);
      const matches = getComputedStyle(el).outlineColor === getComputedStyle(reference).outlineColor;
      reference.remove();
      return matches;
    })).toBe(true);
    await expect(css).toHaveValue(initialCSS);
    await page.reload();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.goto(`/${category}/`);
    const completed = page.locator(`section[data-exercise-key="${key}"]`);
    await expect(completed).toHaveAttribute('data-completed', 'true');
    await expect(page.locator('section[data-completed="true"]')).toHaveCount(1);
    await completed.locator('.exercise-completion').click();
    await expect(completed).not.toHaveAttribute('data-completed');
    await page.reload();
    await expect(completed.locator('.exercise-completion')).toHaveAttribute('aria-pressed', 'false');
  });
}

test('completion works when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      Storage.prototype[method] = () => { throw new DOMException('blocked', 'SecurityError'); };
    }
  });
  await page.goto('/grid/1/');
  const button = page.locator('.exercise-completion');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

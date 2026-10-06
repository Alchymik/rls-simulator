import { test, expect } from '@playwright/test';

test('first login, training, archive image, offline result and recovery', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // A reproducible target in the detection zone; no application internals are exposed.
  await page.addInitScript(() => {
    Math.random = () => 0.25;
  });
  await page.route('**/server.arcgisonline.com/**', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('textbox', { name: 'логин', exact: true }).fill('admin');
  await page.getByLabel('пароль', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Смените его');
  await page.getByLabel('Текущий пароль', { exact: true }).fill('admin');
  await page.getByLabel('Новый пароль', { exact: true }).fill('Test-password-2026');
  await page.getByLabel('Повтор нового пароля', { exact: true }).fill('Test-password-2026');
  await page.getByRole('button', { name: 'Изменить пароль', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Пароль изменён');
  await page.goto('/simulation');
  await expect(page).toHaveURL('/');
  const launch = page.getByRole('button', { name: 'Режим «Тренировка»', exact: true });
  await launch.click();
  const setup = page.getByRole('dialog', { name: 'Настройки тренировки' });
  await expect(setup).toBeVisible();
  await setup.getByRole('button', { name: 'Начать', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(setup.getByRole('spinbutton', { name: /^Ограничение по времени, с/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(setup).toBeHidden();
  await expect(launch).toBeFocused();
  await launch.click();
  await setup.getByRole('spinbutton', { name: /^Ограничение по времени, с/ }).fill('60');
  await setup.getByRole('spinbutton', { name: /^Период генерации объектов, мс/ }).fill('2000');
  await setup.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect(page.getByRole('button', { name: /Пауза/ })).toBeVisible();
  await expect(page.getByText('Подложка недоступна.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Повернуть карту вправо', exact: true }).click();
  const compass = page.getByRole('button', { name: 'Компас: ориентировать карту на север' });
  await expect(compass).toContainText('15°');
  await compass.click();
  await expect(compass).toContainText('0°');
  const target = page.getByTitle(/^Цель /).first();
  await expect(target).toBeVisible();
  await target.dblclick({ force: true });
  await page.getByRole('button', { name: /Пауза/ }).click();
  await expect(page.getByRole('button', { name: /Продолжить/ })).toBeVisible();
  const notifications = page.getByRole('button', { name: 'Центр уведомлений', exact: true });
  if ((await notifications.getAttribute('aria-pressed')) !== 'true') await notifications.click();
  await page.getByRole('tab', { name: /Архив событий/ }).click();
  await expect(page.getByTitle('Открыть снимок экрана').first()).toBeVisible();
  await page.getByTitle('Открыть снимок экрана').first().click();
  const shot = page.getByRole('img', { name: 'Снимок экрана в момент обнаружения цели' });
  await expect(shot).toBeVisible();
  await expect.poll(() => shot.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(960);
  const colors = await shot.evaluate((img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set<number>();
    for (let i = 0; i < pixels.length; i += 400)
      colors.add((pixels[i]! << 16) | (pixels[i + 1]! << 8) | pixels[i + 2]!);
    return colors.size;
  });
  expect(colors).toBeGreaterThan(100);
  await shot.screenshot({ path: 'test-results/archive-image.png' });
  await page.getByRole('button', { name: 'Закрыть снимок', exact: true }).click();
  await page.getByRole('button', { name: 'Закрыть центр уведомлений', exact: true }).click();
  await page.screenshot({ path: 'test-results/training.png' });
  await page.route('**/api/sessions', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Завершить/ }).click();
  const results = page.getByRole('dialog', { name: 'Результаты тренировки' });
  await expect(results.getByRole('button', { name: 'Повторить сохранение' })).toBeVisible();
  await expect(results).toContainText('Верно');
  await page.reload();
  await expect(page).toHaveURL('/');
  await page.goto('/profile');
  await expect(page.getByRole('region', { name: 'Очередь результатов' })).toContainText(
    'Ожидают отправки: 1',
  );
  await page.unroute('**/api/sessions');
  await page.getByRole('button', { name: 'Повторить отправку' }).click();
  await expect(page.getByRole('region', { name: 'Очередь результатов' })).toBeHidden();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('table').getByRole('row').nth(1).getByRole('cell').nth(2)).toHaveText('1');
  expect(errors).toEqual([]);
});

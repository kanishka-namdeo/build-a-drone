import { test, expect } from '@playwright/test';

/**
 * Drone Lab e2e — the core user journeys against the built app.
 * Uses the app's own test hooks (?bare=1, ?fly=, #craft-key) instead of
 * brittle UI traversal wherever possible.
 */

const BASE = 'http://localhost:4173';

test('boots to Fig 01 with the full chrome', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForSelector('#fig');
  await expect(page.locator('header h1')).toContainText('5-inch freestyle quad');
  // sidebar roster lists all 13 figures
  await expect(page.locator('nav.side a')).toHaveCount(13);
  // workshop buttons
  await expect(page.getByRole('button', { name: 'Smoke stopper test' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fly' })).toBeVisible();
  // stats show 12/12 parts and the reference calculator numbers
  await expect(page.locator('.stat .v').first()).toHaveText('12/12');
  await expect(page.locator('.tiles .tile').first()).toContainText('514');
  // wiring + lesson panels render
  await expect(page.locator('.wiring svg [data-act="wire"]')).toHaveCount(8);
  await expect(page.locator('.lesson .panel').first()).toContainText('Design it');
  // no page errors
  const errors = await page.evaluate(() => document.documentElement.getAttribute('data-errors'));
  expect(errors).toBeNull();
});

test('the build flow: manual pedagogy path (parts -> tests -> plug -> fly)', async ({ page }) => {
  await page.goto(`${BASE}/?bare=1`);
  await page.waitForSelector('#fig');
  await expect(page.locator('.stat .v').first()).toHaveText('0/12');

  // add parts in order, leaving PROPS off so the motor test can run
  const order = ['FRAME', 'MOTORS', 'ESC', 'MOTOR WIRES', 'FLIGHT CTRL', 'XT60 + CAP', 'CAMERA', 'RECEIVER', 'VTX', 'TOP PLATE', 'BATTERY'];
  for (const part of order) {
    await page.getByRole('button', { name: 'Add next part' }).click();
    await page.locator('.chips .chip', { hasText: `Add ${part}` }).first().click();
  }
  await expect(page.locator('.stat .v').first()).toHaveText('11/12', { timeout: 20000 });

  await page.getByRole('button', { name: 'Smoke stopper test' }).click();
  await expect(page.locator('.term')).toContainText('smoke stopper: no short', { timeout: 10000 });

  await page.getByRole('button', { name: 'Check motor direction' }).click();
  // one motor starts backwards (the deliberate fault) and the check fixes it
  await expect(page.locator('.term')).toContainText('direction reversed in ESC config', { timeout: 15000 });

  await page.getByRole('button', { name: 'Calibrate accelerometer' }).click();
  await expect(page.locator('.term')).toContainText('calibrate accelerometer: done', { timeout: 5000 });

  // the motor test auto-plugged the battery: unplug before fitting props
  await page.getByRole('button', { name: 'Plug / unplug battery' }).click();
  await expect(page.locator('.term')).toContainText('battery unplugged', { timeout: 5000 });

  // props go on last, now that the checks are done
  await page.getByRole('button', { name: 'Add next part' }).click();
  await page.locator('.chips .chip', { hasText: 'Add PROPS' }).first().click();
  await expect(page.locator('.stat .v').first()).toHaveText('12/12', { timeout: 8000 });

  await page.getByRole('button', { name: 'Plug / unplug battery' }).click();
  await expect(page.locator('.term')).toContainText('battery plugged', { timeout: 5000 });

  // fly: altitude hold
  await page.getByRole('button', { name: 'Fly' }).click();
  await page.getByRole('button', { name: 'Altitude hold (easy)' }).click();
  await page.waitForTimeout(800);
  const view = await page.evaluate(() => window.__st.view);
  expect(view).toBe('fly');
  const errors = await page.evaluate(() => document.documentElement.getAttribute('data-errors'));
  expect(errors).toBeNull();
});

test('build it for me completes the whole bench', async ({ page }) => {
  await page.goto(`${BASE}/?bare=1`);
  await page.waitForSelector('#fig');
  await page.getByRole('button', { name: 'Build it for me' }).click();
  await expect(page.locator('.stat .v').first()).toHaveText('12/12', { timeout: 20000 });
  await page.getByRole('button', { name: 'Plug / unplug battery' }).click();
  await expect(page.locator('.term')).toContainText('battery plugged', { timeout: 5000 });
});

test('flight: arm, climb, and land the reset', async ({ page }) => {
  await page.goto(`${BASE}?fly=alt`);
  await page.waitForSelector('#fig');
  await page.waitForTimeout(1200);
  await page.keyboard.press('Space');
  await page.keyboard.down('w');
  await page.waitForTimeout(900);
  await page.keyboard.up('w');
  const state = await page.evaluate(() => ({
    armed: window.__st.flight.armed,
    z: window.__st.flight.pos[2]
  }));
  expect(state.armed).toBe(true);
  expect(state.z).toBeGreaterThan(0.5);

  // reset back to the pad
  await page.keyboard.press('r');
  await page.waitForTimeout(400);
  const reset = await page.evaluate(() => window.__st.flight.pos[2]);
  expect(reset).toBe(0);
});

test('FPV view renders an OSD', async ({ page }) => {
  await page.goto(`${BASE}?fly=alt&fpv`);
  await page.waitForSelector('#fig');
  await page.waitForTimeout(1200);
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  // the stage is in FPV mode with goggles + OSD text
  await expect(page.locator('.stage')).toHaveClass(/fpv/);
  const osdCount = await page.locator('#art text').count();
  expect(osdCount).toBeGreaterThanOrEqual(4);
});

test('every craft page boots without errors', async ({ page }) => {
  const crafts: Array<[string, string]> = [
    ['quad5', '5-inch freestyle quad'],
    ['whoop65', 'Tiny Whoop'],
    ['cine35', 'cinewhoop'],
    ['lr7', 'long range'],
    ['race5', 'Racing quad'],
    ['gpscam', 'GPS camera drone'],
    ['delivery', 'Delivery drone'],
    ['agrihexa', 'Agri hexacopter'],
    ['wing9', 'flying wing'],
    ['vtol', 'VTOL tiltrotor'],
    ['swarm', 'Swarm micro'],
    ['tricopter', 'Tricopter'],
    ['octo', 'octocopter']
  ];
  for (const [key, name] of crafts) {
    await page.goto(`${BASE}/#${key}`);
    await page.waitForSelector('#fig');
    await page.waitForTimeout(700);
    await expect(page.locator('header h1'), `craft ${key} did not mount`).toContainText(name);
    const errors = await page.evaluate(() => document.documentElement.getAttribute('data-errors'));
    expect(errors, `craft ${key} reported errors`).toBeNull();
    const art = await page.evaluate(() => document.getElementById('art').innerHTML.length);
    expect(art).toBeGreaterThan(5000);
  }
});

test('hash navigation switches crafts', async ({ page }) => {
  await page.goto(`${BASE}/#quad5`);
  await page.waitForSelector('#fig');
  await page.locator('nav.side a', { hasText: 'Tricopter' }).click();
  await page.waitForTimeout(900);
  await expect(page.locator('header h1')).toContainText('Tricopter');
});

test('quiz answers persist', async ({ page }) => {
  await page.goto(`${BASE}/#quad5`);
  await page.waitForSelector('#fig');
  const wrong = page.locator('.quiz .qq').first().locator('button').nth(0);
  await wrong.click();
  await expect(wrong).toHaveClass(/no/, { timeout: 3000 });
  await page.reload();
  await page.waitForSelector('#fig');
  await page.waitForTimeout(800);
  // the wrong pick is remembered (persisted in localStorage)
  const remembered = await page.locator('.quiz .qq').first().locator('button.no').count();
  expect(remembered).toBe(1);
});

test('calculator reacts to a battery change', async ({ page }) => {
  await page.goto(`${BASE}/#quad5`);
  await page.waitForSelector('#fig');
  const weightBefore = await page.locator('.tiles .tile').first().locator('.tv').textContent();
  await page.locator('.selwrap select').first().selectOption('6s1800');
  await page.waitForTimeout(400);
  const weightAfter = await page.locator('.tiles .tile').first().locator('.tv').textContent();
  expect(parseInt(weightAfter)).toBeGreaterThan(parseInt(weightBefore));
});

test('mobile layout: the sidebar becomes a scroller and pads exist', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await page.goto(`${BASE}?fly=alt`);
  await page.waitForSelector('#fig');
  await page.waitForTimeout(1200);
  await expect(page.locator('.pad.padl')).toBeVisible();
  await expect(page.locator('.pad.padr')).toBeVisible();
});

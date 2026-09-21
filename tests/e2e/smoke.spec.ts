import { expect, test } from '@playwright/test';

test('loads the application shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('~/inbox >')).toBeVisible();
  await expect(page.getByText('TypeDone', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Command', exact: true })).toBeFocused();
});

test('onboards a first-time user and undoes task completion', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });

  await page.getByRole('button', { name: '1. Add a task' }).click();
  await expect(command).toHaveValue('add ');
  await command.fill('add Keep this task');
  await command.press('Enter');
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
  await expect(page.getByText('1 task', { exact: true })).toBeVisible();
  await command.press('ArrowUp');
  await expect(command).toHaveValue('add Keep this task');

  await command.fill('/done 1');
  await command.press('Enter');
  await expect(page.getByRole('button', { name: 'Complete Keep this task' })).toBeHidden();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Complete Keep this task' })).toBeVisible();

  const status = page.getByRole('region', { name: 'Command status' });
  await status.getByRole('button', { name: 'Dismiss status' }).click();
  await expect(status).toBeHidden();
});

test('shows transient feedback without shifting content', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });
  const heading = page.getByRole('heading', { name: 'Inbox' });
  const before = await heading.boundingBox();

  await command.fill('theme dark');
  await command.press('Enter');
  const toast = page.getByRole('region', { name: 'Command status' });
  await expect(toast).toBeVisible();
  await expect(toast.getByRole('button', { name: 'Dismiss status' })).toHaveText('×');
  const toastBox = await toast.boundingBox();
  const viewport = page.viewportSize();
  expect(
    Math.abs((toastBox?.x ?? 0) + (toastBox?.width ?? 0) / 2 - (viewport?.width ?? 0) / 2),
  ).toBeLessThan(2);
  await expect(toast.locator('.toast-progress')).toBeVisible();
  expect(await heading.boundingBox()).toEqual(before);
  await expect(toast).toBeHidden({ timeout: 5000 });
});

test('creates, persists, completes, and restores a task through commands', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });
  await command.fill('add Test the command workflow -d 2026-09-25');
  await command.press('Enter');

  const taskRow = page.getByRole('listitem').filter({ hasText: 'Test the command workflow' });
  await expect(taskRow).toBeVisible();
  await page.reload();
  await expect(taskRow).toBeVisible();

  await command.fill('/done 1');
  await command.press('Enter');
  await expect(taskRow).toBeHidden();
  await command.fill('completed');
  await command.press('Enter');
  await expect(taskRow).toBeVisible();
  await command.fill('/restore 1');
  await command.press('Enter');
  await expect(taskRow).toBeHidden();
});

test('lists and opens user directories with the slash command', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });
  await command.fill('add Directory task --dir Work');
  await command.press('Enter');
  await command.fill('/dirs');
  await expect(page.getByRole('option', { name: 'Work' })).toBeVisible();
  await command.fill('/dir Work');
  await command.press('Enter');
  await expect(page.getByText('~/Work >')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Directory task' })).toBeVisible();
});

test('rolls back an automatically created directory when task creation fails', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });
  await command.fill(`add ${'x'.repeat(301)} directory Orphan`);
  await command.press('Enter');
  await expect(page.getByRole('region', { name: 'Command status' })).toContainText(
    'Title must be between 1 and 300 characters.',
  );

  await command.fill('/dirs');
  await expect(page.getByRole('option', { name: 'Orphan' })).toHaveCount(0);
});

test('selects a user directory from the unified directory options', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });
  await command.fill('add Alpha task --dir Alpha');
  await command.press('Enter');
  await command.fill('add Beta task --dir Beta');
  await command.press('Enter');
  await command.fill('/dirs');

  await expect(page.getByRole('option', { name: 'Alpha' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Beta' })).toBeVisible();
  await command.press('ArrowUp');
  await command.press('Enter');
  await expect(page.getByText('~/Beta >')).toBeVisible();
});

test('adds a task to the current user directory without a directory flag', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });
  await command.fill('dir add Work');
  await command.press('Enter');
  await command.fill('/dir Work');
  await command.press('Enter');
  await expect(page.getByText('~/Work >')).toBeVisible();

  await command.fill('add "Current directory task"');
  await command.press('Enter');
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Current directory task' }),
  ).toBeVisible();

  await command.fill('inbox');
  await command.press('Enter');
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Current directory task' }),
  ).toBeHidden();
});

test('edits and deletes a user directory while preserving its tasks', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });
  await command.fill('dir add Work');
  await command.press('Enter');
  await command.fill('/dir Work');
  await command.press('Enter');
  await command.fill('add Keep this task');
  await command.press('Enter');

  await command.fill('dir edit Work Office');
  await command.press('Enter');
  await expect(page.getByText('~/Office >')).toBeVisible();

  await command.fill('dir delete Office');
  await command.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Delete directory?' });
  await expect(dialog).toContainText('They will be moved to Inbox.');
  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('~/inbox >')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Keep this task' })).toBeVisible();
});

test('selects a view from the directory picker', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });
  await command.fill('/dir');
  await expect(page.getByRole('option', { name: /Today —/ })).toBeVisible();
  await command.press('ArrowDown');
  await command.press('Enter');
  await expect(page.getByText('~/today >')).toBeVisible();
});

test('selects task targets from slash-command options', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });
  await command.fill('add First task');
  await command.press('Enter');
  await command.fill('add Second task');
  await command.press('Enter');
  await command.fill('/done');

  await expect(page.getByRole('option', { name: '01 First task' })).toBeVisible();
  await expect(page.getByRole('option', { name: '02 Second task' })).toBeVisible();
  await command.press('ArrowDown');
  await command.press('Enter');
  await expect(page.getByRole('button', { name: 'Complete Second task' })).toBeHidden();
});

test('adds notes through the slash-command task picker', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });
  await command.fill('add Research task');
  await command.press('Enter');
  await command.fill('/note');
  await expect(page.getByRole('option', { name: '01 Research task' })).toBeVisible();
  await command.press('Enter');
  await expect(command).toHaveValue('/note 1 ');
  await command.fill('/note 1 Check the revised drawing');
  await command.press('Enter');
  await command.fill('/find revised drawing');
  await command.press('Enter');
  await expect(page.getByRole('listitem').filter({ hasText: 'Research task' })).toBeVisible();
});

test('shows the privacy policy and terms of service', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });

  await command.fill('/privacy');
  await command.press('Enter');
  const feedback = page.locator('.command-feedback');
  await expect(feedback).toContainText('TypeDone privacy policy');
  await expect(feedback).toContainText(/stores your tasks.*locally in your browser/s);
  await feedback.getByRole('button', { name: 'Close output' }).click();

  await command.fill('/terms');
  await command.press('Enter');
  await expect(feedback).toContainText('TypeDone terms of service');
  await expect(feedback).toContainText('provided “as is” and “as available,”');
});

test('supports the canonical terminal command workflow', async ({ page }) => {
  await page.goto('/');
  const command = page.getByRole('textbox', { name: 'Command', exact: true });
  const output = page.getByRole('dialog', { name: 'Command output' });

  await command.fill('add Ship release directory Work due tomorrow');
  await command.press('Enter');
  await command.fill('dir Work');
  await command.press('Enter');
  await expect(page.getByRole('listitem').filter({ hasText: 'Ship release' })).toBeVisible();

  await command.fill('show 1');
  await command.press('Enter');
  await expect(output).toContainText('directory: Work');
  await expect(output).toContainText('notes: none');
  await output.getByRole('button', { name: 'Close output' }).click();

  await command.fill('theme dark');
  await command.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('combobox', { name: 'Theme' })).toHaveCount(0);

  await command.fill('clear');
  await command.press('Enter');
  await expect(output).toBeHidden();

  await command.fill('done 1');
  await command.press('Enter');
  await command.fill('undo');
  await command.press('Enter');
  await expect(page.getByRole('button', { name: 'Complete Ship release' })).toBeVisible();

  await command.fill('dir add Empty');
  await command.press('Enter');
  await command.fill('dir archive Empty');
  await command.press('Enter');
  await command.fill('dir archived');
  await command.press('Enter');
  await expect(output).toContainText('Empty');
  await output.getByRole('button', { name: 'Close output' }).click();
  await command.fill('dir restore Empty');
  await command.press('Enter');
  await command.fill('dir Empty');
  await command.press('Enter');
  await expect(page.getByText('~/Empty >')).toBeVisible();
});

import { expect, test } from '@playwright/test';

test('loads the application shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('~/inbox >')).toBeVisible();
  await expect(page.getByText('TypeDone', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Command', exact: true })).toBeFocused();
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

  await command.fill('add Current directory task');
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
  await expect(feedback).toContainText('privacy policy');
  await expect(feedback).toContainText(/stores your tasks.*locally in your browser/s);

  await command.fill('/terms');
  await command.press('Enter');
  await expect(feedback).toContainText('terms of service');
  await expect(feedback).toContainText('provided “as is” and “as available,”');
});

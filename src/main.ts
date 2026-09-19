import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import { createApp } from './app/app';
import { createRepositories, DatabaseOpenError, openDatabase } from './database/database';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Application root was not found.');
}

const loading = document.createElement('p');
loading.className = 'loading-screen';
loading.textContent = 'Opening your local tasks…';
app.append(loading);

try {
  const database = await openDatabase();
  app.replaceChildren(await createApp(createRepositories(database)));
} catch (error) {
  console.error(error);
  const recovery = document.createElement('main');
  recovery.className = 'recovery-screen';
  const heading = document.createElement('h1');
  heading.textContent = 'Your local tasks could not be opened';
  const message = document.createElement('p');
  message.textContent =
    error instanceof DatabaseOpenError
      ? error.message
      : 'An unexpected storage error occurred. Reload the page to try again.';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Reload';
  reload.addEventListener('click', () => {
    window.location.reload();
  });
  recovery.append(heading, message, reload);
  app.replaceChildren(recovery);
}

export interface CommandBarController {
  element: HTMLFormElement;
  input: HTMLInputElement;
  focus(value?: string): void;
  setPrompt(value: string): void;
}

export interface CommandSuggestion {
  label: string;
  value: string;
  submit?: boolean;
}

export function createCommandBar(
  history: readonly string[],
  onSubmit: (input: string) => Promise<boolean>,
  getSuggestions: (input: string) => readonly CommandSuggestion[],
): CommandBarController {
  const form = document.createElement('form');
  form.className = 'command-bar';
  const label = document.createElement('label');
  label.htmlFor = 'command-input';
  label.className = 'visually-hidden';
  label.textContent = 'Command';
  const prompt = document.createElement('span');
  prompt.className = 'command-prompt';
  prompt.setAttribute('aria-hidden', 'true');
  prompt.textContent = '~/inbox >';
  const input = document.createElement('input');
  input.id = 'command-input';
  input.name = 'command';
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'type a command or ? for help';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.tabIndex = -1;
  submit.textContent = 'Run';
  const suggestions = document.createElement('div');
  suggestions.id = 'command-suggestions';
  suggestions.className = 'command-suggestions';
  suggestions.setAttribute('role', 'listbox');
  suggestions.hidden = true;
  input.setAttribute('aria-controls', suggestions.id);
  input.setAttribute('aria-expanded', 'false');
  let historyIndex = history.length;
  let currentSuggestions: readonly CommandSuggestion[] = [];
  let suggestionIndex = -1;

  const hideSuggestions = (): void => {
    currentSuggestions = [];
    suggestionIndex = -1;
    suggestions.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };
  const renderSuggestions = (): void => {
    currentSuggestions = getSuggestions(input.value);
    suggestionIndex = currentSuggestions.length > 0 ? 0 : -1;
    suggestions.replaceChildren(
      ...currentSuggestions.map((suggestion, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.id = `command-suggestion-${String(index)}`;
        option.className = 'command-suggestion';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', index === suggestionIndex ? 'true' : 'false');
        option.textContent = suggestion.label;
        option.addEventListener('mousedown', (event) => {
          event.preventDefault();
        });
        option.addEventListener('click', () => {
          input.value = suggestion.value;
          hideSuggestions();
          if (suggestion.submit === false) {
            input.focus();
            input.dispatchEvent(new Event('input', { bubbles: true }));
          } else form.requestSubmit();
        });
        return option;
      }),
    );
    suggestions.hidden = currentSuggestions.length === 0;
    input.setAttribute('aria-expanded', String(currentSuggestions.length > 0));
    if (suggestionIndex >= 0) {
      input.setAttribute('aria-activedescendant', `command-suggestion-${String(suggestionIndex)}`);
    }
  };
  const selectSuggestion = (index: number): void => {
    suggestionIndex = index;
    for (const [optionIndex, option] of [...suggestions.children].entries()) {
      option.setAttribute('aria-selected', optionIndex === index ? 'true' : 'false');
    }
    input.setAttribute('aria-activedescendant', `command-suggestion-${String(index)}`);
  };

  input.addEventListener('keydown', (event) => {
    if (currentSuggestions.length > 0) {
      if (event.key === 'Escape') {
        event.preventDefault();
        hideSuggestions();
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        selectSuggestion(
          (suggestionIndex + direction + currentSuggestions.length) % currentSuggestions.length,
        );
        return;
      }
      if (event.key === 'Enter' && suggestionIndex >= 0) {
        event.preventDefault();
        const suggestion = currentSuggestions[suggestionIndex];
        input.value = suggestion?.value ?? input.value;
        hideSuggestions();
        if (suggestion?.submit === false) {
          input.focus();
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } else form.requestSubmit();
        return;
      }
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    historyIndex =
      event.key === 'ArrowUp'
        ? Math.max(0, historyIndex - 1)
        : Math.min(history.length, historyIndex + 1);
    input.value = history[historyIndex] ?? '';
    input.setSelectionRange(input.value.length, input.value.length);
  });
  input.addEventListener('input', renderSuggestions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    input.disabled = true;
    submit.disabled = true;
    void onSubmit(input.value)
      .then((succeeded) => {
        if (succeeded) input.value = '';
        hideSuggestions();
      })
      .finally(() => {
        input.disabled = false;
        submit.disabled = false;
        input.focus();
      });
  });
  form.append(label, prompt, input, submit, suggestions);
  return {
    element: form,
    input,
    setPrompt(value) {
      prompt.textContent = value;
    },
    focus(value) {
      if (value !== undefined) input.value = value;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    },
  };
}

export interface ConfirmationRequest {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
}

export interface ConfirmationDialogController {
  element: HTMLDialogElement;
  ask(request: ConfirmationRequest): Promise<boolean>;
}

export function createConfirmationDialog(): ConfirmationDialogController {
  const dialog = document.createElement('dialog');
  dialog.className = 'confirmation-dialog';
  dialog.setAttribute('aria-labelledby', 'confirmation-title');
  const form = document.createElement('form');
  form.method = 'dialog';
  const title = document.createElement('h2');
  title.id = 'confirmation-title';
  const message = document.createElement('p');
  const actions = document.createElement('div');
  actions.className = 'dialog-actions';
  const cancel = document.createElement('button');
  cancel.type = 'submit';
  cancel.value = 'cancel';
  cancel.textContent = 'Cancel';
  const confirm = document.createElement('button');
  confirm.type = 'submit';
  confirm.value = 'confirm';
  actions.append(cancel, confirm);
  form.append(title, message, actions);
  dialog.append(form);

  return {
    element: dialog,
    ask(request) {
      title.textContent = request.title;
      message.textContent = request.message;
      confirm.textContent = request.confirmLabel;
      confirm.className = request.destructive ? 'danger-button' : 'primary-button';
      dialog.returnValue = 'cancel';
      dialog.showModal();
      cancel.focus();
      return new Promise((resolve) => {
        dialog.addEventListener(
          'close',
          () => {
            resolve(dialog.returnValue === 'confirm');
          },
          { once: true },
        );
      });
    },
  };
}

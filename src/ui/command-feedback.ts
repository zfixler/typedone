export type FeedbackKind = 'success' | 'error' | 'info';

export interface FeedbackAction {
  label: string;
  run: () => Promise<void>;
}

export interface CommandFeedbackController {
  outputElement: HTMLElement;
  toastElement: HTMLElement;
  announce(message: string, kind?: FeedbackKind, action?: FeedbackAction): void;
  hide(): void;
}

const TOAST_DURATION = { success: 3500, error: 6000 } as const;

interface FeedbackSurface {
  element: HTMLElement;
  message: HTMLPreElement;
  actions: HTMLDivElement;
}

function createSurface(className: string, label: string): FeedbackSurface {
  const element = document.createElement('section');
  element.className = className;
  element.setAttribute('aria-label', label);
  element.hidden = true;
  const message = document.createElement('pre');
  const actions = document.createElement('div');
  actions.className = 'feedback-actions';
  element.append(message, actions);
  return { element, message, actions };
}

export function createCommandFeedback(): CommandFeedbackController {
  const output = createSurface('command-feedback', 'Command output');
  const toast = createSurface('command-toast', 'Command status');
  toast.element.setAttribute('aria-live', 'polite');
  const progress = document.createElement('span');
  progress.className = 'toast-progress';
  progress.setAttribute('aria-hidden', 'true');
  toast.element.append(progress);
  let progressAnimation: Animation | null = null;

  const hideToast = (): void => {
    toast.element.hidden = true;
    progressAnimation?.cancel();
    progressAnimation = null;
  };
  const hideOutput = (): void => {
    output.element.hidden = true;
  };
  const startDismissal = (kind: 'success' | 'error'): void => {
    const animation = progress.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      duration: TOAST_DURATION[kind],
      easing: 'linear',
      fill: 'forwards',
    });
    progressAnimation = animation;
    void animation.finished
      .then(() => {
        if (progressAnimation === animation) hideToast();
      })
      .catch(() => undefined);
  };
  const announce = (
    message: string,
    kind: FeedbackKind = 'success',
    action?: FeedbackAction,
  ): void => {
    const isOutput = kind === 'info';
    const surface = isOutput ? output : toast;
    if (!isOutput) hideToast();
    surface.element.hidden = false;
    surface.element.dataset.kind = kind;
    surface.message.textContent = message;
    surface.actions.replaceChildren();
    if (action) {
      const actionButton = document.createElement('button');
      actionButton.type = 'button';
      actionButton.textContent = action.label;
      actionButton.addEventListener('click', () => {
        actionButton.disabled = true;
        void action
          .run()
          .then(() => {
            announce('Action undone.');
          })
          .catch((error: unknown) => {
            announce(
              error instanceof Error ? error.message : 'The action could not be undone.',
              'error',
            );
          });
      });
      surface.actions.append(actionButton);
    }
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.setAttribute('aria-label', isOutput ? 'Dismiss output' : 'Dismiss status');
    dismiss.textContent = isOutput ? 'Dismiss' : '×';
    if (!isOutput) dismiss.className = 'toast-dismiss';
    dismiss.addEventListener('click', isOutput ? hideOutput : hideToast);
    surface.actions.append(dismiss);
    if (!isOutput) startDismissal(kind);
  };

  toast.element.addEventListener('mouseenter', () => progressAnimation?.pause());
  toast.element.addEventListener('mouseleave', () => progressAnimation?.play());
  toast.element.addEventListener('focusin', () => progressAnimation?.pause());
  toast.element.addEventListener('focusout', (event) => {
    if (!(event.relatedTarget instanceof Node) || !toast.element.contains(event.relatedTarget)) {
      progressAnimation?.play();
    }
  });

  return {
    outputElement: output.element,
    toastElement: toast.element,
    announce,
    hide() {
      hideToast();
      hideOutput();
    },
  };
}

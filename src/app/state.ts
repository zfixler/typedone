import type { Project, Task } from '../domain/models';

export type ActiveView = 'inbox' | 'today' | 'upcoming' | 'project' | 'completed' | 'search';
export type Theme = 'system' | 'light' | 'dark';

export interface AppState {
  activeView: ActiveView;
  activeProjectId: string | null;
  searchQuery: string;
  selectedTaskId: string | null;
  tasks: Task[];
  projects: Project[];
  theme: Theme;
  showAllUpcoming: boolean;
}

export type StateListener = (state: Readonly<AppState>, previous: Readonly<AppState>) => void;

export interface AppStore {
  getState(): Readonly<AppState>;
  setState(update: Partial<AppState> | ((state: Readonly<AppState>) => Partial<AppState>)): void;
  subscribe(listener: StateListener): () => void;
}

export const initialState: AppState = {
  activeView: 'inbox',
  activeProjectId: null,
  searchQuery: '',
  selectedTaskId: null,
  tasks: [],
  projects: [],
  theme: 'system',
  showAllUpcoming: false,
};

export function createStore(seed: AppState = initialState): AppStore {
  let state = { ...seed };
  const listeners = new Set<StateListener>();

  return {
    getState: () => state,
    setState(update) {
      const previous = state;
      const patch = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...patch };
      for (const listener of listeners) listener(state, previous);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

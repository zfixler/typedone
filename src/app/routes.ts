import type { ActiveView } from './state';

export interface AppRoute {
  view: ActiveView;
  projectId: string | null;
  searchQuery: string;
}

const fallbackRoute: AppRoute = { view: 'inbox', projectId: null, searchQuery: '' };

export function parseHash(hash: string): AppRoute {
  const raw = hash.replace(/^#/, '') || '/inbox';
  const [path = '/inbox', queryString = ''] = raw.split('?', 2);
  const segments = path.split('/').filter(Boolean);

  if ((segments[0] === 'directories' || segments[0] === 'projects') && segments[1]) {
    return { view: 'project', projectId: decodeURIComponent(segments[1]), searchQuery: '' };
  }
  if (segments[0] === 'search') {
    return {
      view: 'search',
      projectId: null,
      searchQuery: new URLSearchParams(queryString).get('q') ?? '',
    };
  }
  if (['inbox', 'today', 'upcoming', 'completed'].includes(segments[0] ?? '')) {
    return { view: segments[0] as ActiveView, projectId: null, searchQuery: '' };
  }
  return fallbackRoute;
}

export function routeToHash(route: AppRoute): string {
  if (route.view === 'project' && route.projectId) {
    return `#/directories/${encodeURIComponent(route.projectId)}`;
  }
  if (route.view === 'search') {
    const parameters = new URLSearchParams({ q: route.searchQuery });
    return `#/search?${parameters.toString()}`;
  }
  return `#/${route.view}`;
}

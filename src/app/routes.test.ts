import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from './routes';

describe('hash routing', () => {
  it('parses standard, directory, legacy project, and search routes', () => {
    expect(parseHash('#/today')).toEqual({ view: 'today', projectId: null, searchQuery: '' });
    expect(parseHash('#/directories/work%2Fhome')).toEqual({
      view: 'project',
      projectId: 'work/home',
      searchQuery: '',
    });
    expect(parseHash('#/projects/legacy')).toEqual({
      view: 'project',
      projectId: 'legacy',
      searchQuery: '',
    });
    expect(parseHash('#/search?q=revised+drawing')).toEqual({
      view: 'search',
      projectId: null,
      searchQuery: 'revised drawing',
    });
  });

  it('falls back to inbox for unknown routes', () => {
    expect(parseHash('#/unknown')).toEqual({ view: 'inbox', projectId: null, searchQuery: '' });
  });

  it('serializes directory and search routes', () => {
    expect(routeToHash({ view: 'project', projectId: 'a/b', searchQuery: '' })).toBe(
      '#/directories/a%2Fb',
    );
    expect(routeToHash({ view: 'search', projectId: null, searchQuery: 'one two' })).toBe(
      '#/search?q=one+two',
    );
  });
});

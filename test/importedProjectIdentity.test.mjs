import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const constants = await import(pathToFileURL(path.join(root, 'app/shared/constants.js')));
const { migrateProjectDocument } = await import(pathToFileURL(path.join(root, 'app/shared/editor/projectSchema.js')));

test('the actual Windows screen-preview hook resolves to a native video protocol route', async () => {
  const source = (await read('app/shared/hooks/useVideoSrc.js'))
    .replace(/^import[\s\S]*?from\s+["'][^"']+["']\s*;?\s*$/gm, '')
    .replace('export default function useVideoSrc', 'function useVideoSrc');
  const context = vm.createContext({
    ...constants,
    window: { electron: { process: { platform: 'win32' } } },
    useState: initial => [initial, () => {}],
    useMemo: callback => callback(),
    useEffect: () => {},
  });
  vm.runInContext(`${source}\nglobalThis.video = useVideoSrc('screen-preview', 'registered-demo-id');`, context);
  const request = new URL(context.video.src);
  const requestedType = request.pathname.replace(/^\//, '');
  const nativeSource = await read('src-tauri/src/lib.rs');
  const matchStart = nativeSource.indexOf('match video_type {');
  const matchEnd = nativeSource.indexOf('if !file_path.exists()', matchStart);
  const arms = nativeSource.slice(matchStart, matchEnd);
  const routeNames = [...arms.matchAll(/((?:"[a-z-]+"\s*(?:\|\s*)?)+)\s*=>/g)]
    .flatMap(match => [...match[1].matchAll(/"([a-z-]+)"/g)].map(route => route[1]));
  assert.ok(routeNames.includes(requestedType), `Windows preview requested ${requestedType}; native routes are ${routeNames.join(', ')}`);
  assert.equal(request.searchParams.get('projectId'), 'registered-demo-id');
});

test('opening an imported manifest binds frontend media requests to its registered project id', async () => {
  const helpers = await read('app/shared/helpers.js');
  const start = helpers.indexOf('export const openProject = async');
  const end = helpers.indexOf('\nexport const toS', start);
  assert.ok(start >= 0 && end > start, 'openProject source boundary was found');
  const source = helpers.slice(start, end).replace('export const openProject', 'const openProject');
  const registeredId = '715978d4-3388-4cc3-a19c-3f1a602705a6';
  const manifest = {
    version: 1,
    project: {
      id: '0ebeadc4-3958-4fdf-b826-f4e6a4979632',
      name: 'Synthetic import fixture',
      background: { type: 'color', value: '#101827' },
      videoDetails: { start: 0, end: 1000 },
    },
  };
  const contextValues = {
    console,
    Promise,
    setTimeout: () => 0,
    structuredClone,
    PROJECT_SCREEN_VIDEO: constants.PROJECT_SCREEN_VIDEO,
    loadConfigs: async () => ({ RendererInputReader: { getDuration: async () => 1000 } }),
    migrateProjectDocument,
    hydrateProjectMedia: async media => media,
    rebindTimelineMediaEntities: collection => collection,
    shallowEqual: () => true,
    window: { electron: { ipcRenderer: { invoke: async command => {
      if (command === 'open-project') return structuredClone(manifest);
      if (command === 'sync-background') return manifest.project.background;
      throw new Error(`Unexpected command ${command}`);
    } } } },
  };
  for (const name of new Set([...source.matchAll(/\b((?:set|apply|add)[A-Z]\w*)\(/g)].map(match => match[1]))) {
    contextValues[name] = payload => ({ type: name, payload });
  }
  const context = vm.createContext(contextValues);
  vm.runInContext(`${source}\nglobalThis.openFixture = openProject;`, context);
  const actions = await context.openFixture(registeredId, false);
  const projectAction = actions.find(action => action.type === 'applyProjectProperties');
  assert.ok(projectAction, 'project properties action was emitted');
  assert.equal(projectAction.payload.id, registeredId,
    'video protocol requires the registered active id, not the id from an imported manifest');
  assert.equal(projectAction.payload.name, manifest.project.name);
  assert.equal(manifest.project.id, '0ebeadc4-3958-4fdf-b826-f4e6a4979632', 'input manifest is not mutated');
});

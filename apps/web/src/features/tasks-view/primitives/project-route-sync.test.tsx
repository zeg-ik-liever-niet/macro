import {
  EntityDetailNavigationStack,
  entityDetailTarget,
  useEntityDetailNavigationStack,
} from '@app/components/entity-detail/EntityDetailNavigationStack';
import { projectRouteId } from '@app/features/projects/core/route';
import { createSplitLayout } from '@components/app/split-layout/layoutManager';
import { createContentInstanceRegistry } from '@core/contentInstanceRegistry';
import type { BlockOrchestrator } from '@core/orchestrator';
import { cleanup, render } from '@solidjs/testing-library';
import { createRoot, createSignal, onCleanup, onMount } from 'solid-js';
import { afterEach, expect, it, vi } from 'vitest';
import { createProjectRouteSync } from './project-route-sync';
import { createProjectSelectionGuard } from './project-selection-guard';

vi.mock('@components/app/split-layout/componentRegistry', () => ({
  resolveComponent: vi.fn(() => ({ element: () => null, initialMeta: {} })),
}));
vi.mock('@components/app/createPreviewSelectionGuard', () => ({
  createPreviewSelectionGuard: () => () => true,
}));
vi.mock('@core/mobile/isTouchDevice', () => ({ isTouchDevice: () => false }));
vi.mock('@components/app/split-layout/layoutUtils', () => ({
  useSplitPanel: () => undefined,
}));
vi.mock('@core/constant/allBlocks', () => ({
  isBlockAlias: () => false,
  resolveBlockAlias: (type: string) => type,
}));

afterEach(cleanup);

const project = {
  id: '01a0ca52-f1bc-7682-be89-7b12e79a0651',
  section: 'overview' as const,
};
function setup(initialProject?: typeof project, enabled = true) {
  const [projectsEnabled, setProjectsEnabled] = createSignal(enabled);
  const mounted = vi.fn();
  const unmounted = vi.fn();
  const onDuplicate = vi.fn();
  const [defaultProject, setDefaultProject] = createSignal(initialProject);
  const [collectionRoute, setCollectionRoute] = createSignal<
    'tasks' | 'tasks-projects'
  >('tasks-projects');
  let stack!: ReturnType<typeof useEntityDetailNavigationStack>;
  const manager = createRoot((dispose) => {
    const value = createSplitLayout(
      {
        contentInstances: createContentInstanceRegistry(),
        isBlockMounted: () => false,
      } as unknown as BlockOrchestrator,
      [
        {
          type: 'component',
          id: initialProject
            ? projectRouteId(initialProject)
            : 'tasks-projects',
        },
      ]
    );
    return { value, dispose };
  });
  const split = manager.value.splits()[0];
  const handle = manager.value.getSplit(split.id)!;
  const selectProject = createProjectSelectionGuard({
    manager: () => manager.value,
    handle,
    onDuplicate,
  });
  function Capture() {
    stack = useEntityDetailNavigationStack();
    createProjectRouteSync({
      entries: () => stack.entries,
      enabled: projectsEnabled,
      collectionRoute,
      handle,
    });
    onMount(mounted);
    onCleanup(unmounted);
    return null;
  }
  const view = render(() => (
    <EntityDetailNavigationStack.Root
      beforeChange={selectProject}
      defaultValue={
        defaultProject()
          ? [entityDetailTarget.initiative(defaultProject()!)]
          : undefined
      }
    >
      <Capture />
    </EntityDetailNavigationStack.Root>
  ));
  return {
    ...view,
    stack,
    handle,
    manager,
    originalMount: split.mount,
    mounted,
    unmounted,
    onDuplicate,
    setDefaultProject,
    setCollectionRoute,
    setProjectsEnabled,
  };
}

it('updates project sections and keeps the enclosing project URL for child tasks without remounting', () => {
  const context = setup();
  const { stack, handle, manager } = context;
  const historyLength = handle.history().length;
  stack.reset(entityDetailTarget.initiative(project));
  expect(handle.content().id).toBe(projectRouteId(project));
  const discussion = {
    ...project,
    section: 'overview' as const,
    discussionId: '01a0ca55-520e-7941-ae1b-847e0ead8fc2',
  };
  stack.replace(entityDetailTarget.initiative(discussion));
  expect(handle.content().id).toBe(projectRouteId(discussion));
  const parent = stack.active()!;
  stack.navigate(
    entityDetailTarget.document({
      id: 'task',
      fileType: 'md',
      subType: { type: 'task' },
    })
  );
  expect(handle.content().id).toBe(projectRouteId(discussion));
  stack.popTo(parent.value);
  expect(stack.active()?.data).toEqual({ ...discussion, type: 'initiative' });
  stack.clear();
  expect(handle.content().id).toBe('tasks-projects');
  expect(manager.value.splits()[0].mount).toBe(context.originalMount);
  expect(handle.history()).toHaveLength(historyLength);
  expect(context.mounted).toHaveBeenCalledOnce();
  expect(context.unmounted).not.toHaveBeenCalled();
  context.unmount();
  manager.dispose();
});

it.each([
  projectRouteId(project),
  `initiative-view~${project.id}`,
  `initiative-view~${project.id}~activity`,
])(
  'keeps the current detail and URL when the project is already open as %s',
  (openRoute) => {
    const context = setup();
    const { stack, handle, manager } = context;
    stack.reset(
      entityDetailTarget.document({
        id: 'current-task',
        fileType: 'md',
        subType: { type: 'task' },
      })
    );
    manager.value.createNewSplit({
      content: { type: 'component', id: openRoute },
      referredFrom: null,
    });
    const entry = stack.active();
    const content = handle.content();
    const history = [...handle.history()];

    expect(stack.reset(entityDetailTarget.initiative(project))).toBeUndefined();

    expect(context.onDuplicate).toHaveBeenCalledOnce();
    expect(stack.entries).toHaveLength(1);
    expect(stack.active()).toBe(entry);
    expect(handle.content()).toBe(content);
    expect(handle.history()).toEqual(history);
    expect(manager.value.splits()[0].mount).toBe(context.originalMount);
    expect(context.unmounted).not.toHaveBeenCalled();
    context.unmount();
    manager.dispose();
  }
);

it('rejects a section change already open in another split and allows it after that split closes', () => {
  const context = setup(project);
  const { stack, handle, manager } = context;
  const tasks = { ...project, section: 'tasks' as const };
  const other = manager.value.createNewSplit({
    content: { type: 'component', id: projectRouteId(tasks) },
    referredFrom: null,
  })!;
  const entry = stack.active();
  const content = handle.content();
  const history = [...handle.history()];

  expect(stack.replace(entityDetailTarget.initiative(tasks))).toBeUndefined();

  expect(context.onDuplicate).toHaveBeenCalledOnce();
  expect(stack.active()).toBe(entry);
  expect(handle.content()).toBe(content);
  expect(handle.history()).toEqual(history);
  manager.value.removeSplit(other.id);
  expect(stack.replace(entityDetailTarget.initiative(tasks))).toBeDefined();
  expect(handle.content().id).toBe(projectRouteId(tasks));
  expect(manager.value.splits()[0].mount).toBe(context.originalMount);
  expect(context.unmounted).not.toHaveBeenCalled();
  context.unmount();
  manager.dispose();
});

it('does not reinitialize the stack from changed deep-link props and restores the originating task collection', () => {
  const context = setup(project);
  const { stack, handle, manager } = context;
  stack.replace(
    entityDetailTarget.initiative({ ...project, section: 'tasks' })
  );
  const activeEntry = stack.active();
  // An adopted route keeps this component mounted. Its defaultValue remains initial-only.
  context.setDefaultProject({
    ...project,
    id: '01a0ca52-f1bc-7682-be89-7b12e79a0652',
  });
  expect(stack.active()).toBe(activeEntry);
  expect(handle.content().id).toBe(
    projectRouteId({ ...project, section: 'tasks' })
  );
  context.setCollectionRoute('tasks');
  stack.clear();
  expect(handle.content().id).toBe('tasks');
  expect(manager.value.splits()[0].mount).toBe(context.originalMount);
  context.unmount();
  manager.dispose();
});

it('keeps restored project URLs unchanged while the rollout is unavailable', () => {
  const context = setup(project, false);
  const { stack, handle, manager, setProjectsEnabled } = context;
  stack.clear();
  context.setCollectionRoute('tasks');
  expect(handle.content().id).toBe(projectRouteId(project));
  setProjectsEnabled(true);
  expect(handle.content().id).toBe('tasks');
  context.unmount();
  manager.dispose();
});

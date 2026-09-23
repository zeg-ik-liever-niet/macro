import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  EntityDetailNavigationStack,
  type EntityDetailNavigationStackRootProps,
  type EntityDetailTarget,
  entityDetailTarget,
  useEntityDetailNavigationStack,
} from './EntityDetailNavigationStack';

const touch = vi.hoisted(() => ({
  value: false,
  previewGuard: vi.fn(() => true),
  captureEntryState: vi.fn(),
}));
vi.mock('@components/app/split-layout/layoutUtils', () => ({
  useSplitPanel: () => ({
    handle: { captureEntryState: touch.captureEntryState },
  }),
}));
vi.mock('@core/mobile/isTouchDevice', () => ({
  isTouchDevice: () => touch.value,
}));
vi.mock('@components/app/createPreviewSelectionGuard', () => ({
  createPreviewSelectionGuard: () => touch.previewGuard,
}));

const target: EntityDetailTarget = { type: 'email', id: 'thread' };
const click = (init: MouseEventInit) => ({
  event: new MouseEvent('click', init),
});

function mount(props: EntityDetailNavigationStackRootProps = {}) {
  let stack!: ReturnType<typeof useEntityDetailNavigationStack>;
  function Capture() {
    stack = useEntityDetailNavigationStack();
    return null;
  }
  const view = render(() => (
    <EntityDetailNavigationStack.Root {...props}>
      <Capture />
    </EntityDetailNavigationStack.Root>
  ));
  return { stack, ...view };
}

beforeEach(() => {
  touch.value = false;
  touch.previewGuard.mockReset().mockReturnValue(true);
  touch.captureEntryState.mockReset();
});
afterEach(cleanup);

it('opens inline for plain activation and defers modifier clicks to a split', () => {
  const { stack } = mount();

  expect(stack.shouldNavigate(target)).toBe(true);
  expect(stack.shouldNavigate(target, click({}))).toBe(true);
  expect(stack.shouldNavigate(target, click({ shiftKey: true }))).toBe(false);
  expect(stack.shouldNavigate(target, click({ metaKey: true }))).toBe(false);
  expect(stack.shouldNavigate(target, click({ ctrlKey: true }))).toBe(false);
  expect(stack.navigate(target, click({ altKey: true }))).toBe(false);
  expect(stack.entries).toHaveLength(0);
  expect(touch.captureEntryState).not.toHaveBeenCalled();
});

it('never opens inline on touch layouts', () => {
  touch.value = true;
  const { stack } = mount();

  expect(stack.shouldNavigate(target)).toBe(false);
  expect(stack.navigate(target)).toBe(false);
  expect(stack.entries).toHaveLength(0);
});

it('lets a view replace the default policy', () => {
  touch.value = true;
  const { stack } = mount({ shouldNavigate: () => true });

  expect(stack.shouldNavigate(target, click({ shiftKey: true }))).toBe(true);
  expect(stack.navigate(target)).toBe(true);
  expect(stack.entries).toHaveLength(1);
  expect(touch.captureEntryState).toHaveBeenCalledOnce();
});

it('restores a native project discussion and returns from its task breadcrumb without claiming a document block', () => {
  const project = entityDetailTarget.initiative({
    id: 'project',
    section: 'overview',
    discussionId: 'discussion',
    fallbackName: 'Launch',
  });
  const { stack } = mount({ defaultValue: [project] });
  const projectEntry = stack.active()!;
  expect(touch.previewGuard).toHaveBeenLastCalledWith(undefined);
  expect(touch.captureEntryState).not.toHaveBeenCalled();

  const task = entityDetailTarget.document({
    id: 'task',
    fileType: 'md',
    subType: { type: 'task' },
    fallbackName: 'Checklist',
  });
  expect(stack.navigate(task)).toBe(true);
  expect(stack.entries.map((entry) => entry.data.id)).toEqual([
    'project',
    'task',
  ]);
  expect(touch.previewGuard).toHaveBeenLastCalledWith(task);
  stack.popTo(projectEntry.value);
  expect(stack.active()?.data).toEqual(project);
  expect(stack.entries).toHaveLength(1);
  expect(touch.previewGuard).toHaveBeenLastCalledWith(undefined);

  stack.replace(
    entityDetailTarget.initiative({ id: 'project', section: 'tasks' })
  );
  expect(stack.active()?.data).toEqual({
    type: 'initiative',
    id: 'project',
    section: 'tasks',
  });
  expect(stack.entries).toHaveLength(1);
  stack.clear();
  expect(stack.active()).toBeUndefined();
});

it('keeps the parent project intact when a task is already open in another split', () => {
  const project = entityDetailTarget.initiative({
    id: 'project',
    section: 'tasks',
  });
  const changed = vi.fn();
  const { stack } = mount({ defaultValue: [project], onChange: changed });
  const projectEntry = stack.active();
  touch.captureEntryState.mockClear();
  touch.previewGuard.mockReturnValue(false);
  expect(
    stack.navigate(
      entityDetailTarget.document({
        id: 'task',
        fileType: 'md',
        subType: { type: 'task' },
      })
    )
  ).toBe(false);
  expect(stack.active()).toBe(projectEntry);
  expect(stack.entries).toHaveLength(1);
  expect(changed).not.toHaveBeenCalled();
  expect(touch.captureEntryState).not.toHaveBeenCalled();
});

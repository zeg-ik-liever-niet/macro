import {
  EntityDetailNavigationStack,
  entityDetailTarget,
  useEntityDetailNavigationStack,
} from '@app/components/entity-detail/EntityDetailNavigationStack';
import type { ListDetailNavigationTarget } from '@app/components/list';
import { cleanup, render, waitFor } from '@solidjs/testing-library';
import { createContext, type ParentProps, useContext } from 'solid-js';
import { afterEach, expect, it, vi } from 'vitest';
import type { TasksDataSource } from '../queries/use-tasks-query';
import { TasksDetailView } from './TasksDetailView';

const calls = vi.hoisted(() => ({
  navigation: undefined as
    | { enabled(): boolean; navigation: ListDetailNavigationTarget }
    | undefined,
  project: vi.fn(),
}));
const SourceContext = createContext<{
  source: TasksDataSource;
  openTask(task: { id: string; fallbackName?: string }): boolean;
}>();
function source(ids: string[]): TasksDataSource {
  return {
    items: () =>
      ids.map((id) => ({
        kind: 'entity',
        id,
        entity: {
          id,
          name: id,
          ownerId: 'owner',
          type: 'document',
          fileType: 'md',
          subType: { type: 'task' },
          properties: [],
        },
      })),
    isLoading: () => false,
    isFetching: () => false,
    error: () => undefined,
    hasMore: () => false,
    isLoadingMore: () => false,
    loadMore: async () => {},
    loadMoreGroup: async () => {},
    refresh: async () => {},
  };
}

vi.mock('@components/app/createPreviewSelectionGuard', () => ({
  createPreviewSelectionGuard: () => () => true,
}));
vi.mock('@core/mobile/isTouchDevice', () => ({ isTouchDevice: () => false }));
vi.mock('@app/components/entity-detail/EntityDetail', () => ({
  EntityDetail: () => null,
}));
vi.mock('@app/components/entity-detail/EntityDetailBreadcrumbItem', () => ({
  EntityDetailBreadcrumbItem: () => null,
}));
vi.mock('@app/components/entity-detail/EntityDetailTopBar', () => ({
  EntityDetailTopBar: (props: ParentProps) => props.children,
}));
vi.mock('@app/components/entity-detail/use-list-navigation-hotkeys', () => ({
  useListNavigationHotkeys: (options: typeof calls.navigation) => {
    calls.navigation = options;
  },
}));
vi.mock(
  '@app/components/list',
  async () => await import('@app/components/list/use-list-detail-navigation')
);
vi.mock('@app/features/projects/project-detail', () => ({
  ProjectBreadcrumb: () => null,
  ProjectDetail: () => null,
}));
vi.mock('@app/features/projects/projects', () => ({
  Projects: (props: ParentProps) => props.children,
}));
// Supply the project provider's owning source while retaining the real navigation logic.
vi.mock('@app/features/projects/views/project-tasks-list', () => ({
  ProjectTasksProvider: (
    props: ParentProps<{
      projectId: string;
      onOpenTask(task: { id: string; fallbackName?: string }): boolean;
    }>
  ) => {
    calls.project(props.projectId);
    return (
      <SourceContext.Provider
        value={{
          source: source(['first-task', 'second-task']),
          openTask: props.onOpenTask,
        }}
      >
        {props.children}
      </SourceContext.Provider>
    );
  },
}));
vi.mock('@block-md/component/MarkdownDetailBreadcrumbItem', () => ({
  MarkdownDetailBreadcrumbItem: () => null,
}));
vi.mock('@components/app/side-panel', () => ({
  SidePanel: { Root: (props: ParentProps) => props.children },
}));
vi.mock('@components/app/split-layout/layoutUtils', () => ({
  useSplitPanel: () => undefined,
  useSplitPanelOrThrow: () => ({
    splitHotkeyScope: 'tasks',
    isPanelActive: () => true,
  }),
}));
vi.mock('@core/component/Toast/Toast', () => ({ toast: { failure: vi.fn() } }));
vi.mock('@core/component/TopBar/ShareButton', async () => {
  const { createContext } = await import('solid-js');
  return { ShareDialogContext: createContext(), ShareTrigger: () => null };
});
vi.mock('../tasks-view-context', () => ({
  useTasksView: () => useContext(SourceContext)!,
}));
vi.mock('./TaskDetail', () => ({
  TaskDetail: () => null,
  TaskDetailBodyState: () => null,
}));

afterEach(() => {
  cleanup();
  calls.project.mockClear();
  calls.navigation = undefined;
});

it('steps within the project task list while retaining the parent project breadcrumb', async () => {
  let stack!: ReturnType<typeof useEntityDetailNavigationStack>;
  const outsideOpen = vi.fn(() => true);
  function Capture() {
    stack = useEntityDetailNavigationStack();
    return <TasksDetailView />;
  }
  render(() => (
    <EntityDetailNavigationStack.Root
      defaultValue={[
        entityDetailTarget.initiative({ id: 'project', section: 'tasks' }),
        entityDetailTarget.document({
          id: 'first-task',
          fileType: 'md',
          subType: { type: 'task' },
        }),
      ]}
    >
      <SourceContext.Provider
        value={{ source: source(['outside-task']), openTask: outsideOpen }}
      >
        <Capture />
      </SourceContext.Provider>
    </EntityDetailNavigationStack.Root>
  ));
  const projectEntry = stack.entries[0];
  expect(calls.project).toHaveBeenCalledWith('project');
  expect(calls.navigation?.enabled()).toBe(true);
  expect(calls.navigation?.navigation.canNext()).toBe(true);
  await calls.navigation?.navigation.next();
  await waitFor(() => expect(stack.active()?.data.id).toBe('second-task'));
  expect(stack.entries).toHaveLength(2);
  expect(stack.entries[0]).toBe(projectEntry);
  expect(calls.navigation?.navigation.canPrevious()).toBe(true);
  await calls.navigation?.navigation.previous();
  await waitFor(() => expect(stack.active()?.data.id).toBe('first-task'));
  expect(stack.entries[0]).toBe(projectEntry);
  expect(outsideOpen).not.toHaveBeenCalled();
});

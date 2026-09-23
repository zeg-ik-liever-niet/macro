import {
  type EntityDetailNavigationOptions,
  entityDetailTarget,
  useEntityDetailNavigationStack,
} from '@app/components/entity-detail/EntityDetailNavigationStack';
import {
  createListController,
  type ListActivation,
  type ListController,
  listOwnedSlotName,
} from '@app/components/list';
import { setSidebarSectionCollapsed } from '@app/components/view-shell';
import { normalizeFacetSelection } from '@app/features/soup';
import { useFeatureFlag } from '@app/lib/analytics/posthog';
import { enableProjects } from '@app/lib/core/constant/featureFlags';
import { makePersistedState } from '@app/lib/persistence';
import {
  useSplitPanelOrThrow,
  withSplitPanelOwner,
} from '@components/app/split-layout/layoutUtils';
import { createAssertedContextProvider } from '@core/context/createContext';
import { useUserId } from '@core/context/user';
import { useTagSets, useTagSetsReady } from '@property/tags/tag-sets-context';
import type { ContextProviderProps } from '@solid-primitives/context';
import { type Accessor, mergeProps, onCleanup } from 'solid-js';
import {
  createStore,
  produce,
  reconcile,
  type SetStoreFunction,
  type Store,
} from 'solid-js/store';
import { TASK_DEFAULT_GROUP_BY } from './constants';
import { DEFAULT_TASK_FACET_SELECTION } from './filters/task-facets';
import { createTasksViewPersistence } from './persistence';
import {
  type TasksDataSource,
  type TasksDataSourceItem,
  type UseTasksDataSourceOptions,
  useTasksDataSource,
} from './queries/use-tasks-query';
import type {
  TaskDetailTarget,
  TaskSortId,
  TasksViewState,
  TasksViewStateOptions,
  TaskTab,
} from './types';

export type TasksViewProviderProps = ContextProviderProps & {
  initialState?: TasksViewStateOptions;
  restoreEntryState?: boolean;
  scopeKey?: string;
  sourceFactory?: (
    state: Store<TasksViewState>,
    options: UseTasksDataSourceOptions
  ) => TasksDataSource;
  onOpenTask?: (
    task: TaskDetailTarget,
    options?: EntityDetailNavigationOptions
  ) => boolean;
  onCloseTask?: () => void;
};

export type TasksListActivationMetadata = {
  event?: MouseEvent;
  newSplit?: boolean;
};

type TasksListController = ListController<
  TasksDataSourceItem,
  TasksListActivationMetadata
>;

export type TasksViewContext = {
  scopeKey?: string;
  state: Store<TasksViewState>;
  projectsEnabled: Accessor<boolean>;
  setState: SetStoreFunction<TasksViewState>;
  selectedTask: Accessor<TaskDetailTarget | undefined>;
  source: TasksDataSource;
  list: TasksListController;
  registerListActivationHandler: (
    handler: (
      activation: ListActivation<
        TasksDataSourceItem,
        TasksListActivationMetadata
      >
    ) => void
  ) => void;
  /** Returns false when inline detail is unavailable so the caller opens a split instead. */
  openTask: (
    task: TaskDetailTarget,
    options?: EntityDetailNavigationOptions
  ) => boolean;
  closeTask: () => void;
  setTab: (tab: TaskTab) => void;
  setFacets: (facets: TasksViewState['facets']) => void;
  setPrimarySort: (id: TaskSortId) => void;
  isSidebarSectionOpen: (id: string) => boolean;
  setSidebarSectionOpen: (id: string, open: boolean) => void;
};

export const [TasksViewProvider, useTasksView] = createAssertedContextProvider<
  TasksViewContext,
  TasksViewProviderProps
>('TasksView', (props) => {
  const panel = useSplitPanelOrThrow();
  const navigationStack = useEntityDetailNavigationStack();
  const userId = useUserId();
  const tagSets = useTagSets();
  const tagSetsReady = useTagSetsReady();
  const projectsFlag = useFeatureFlag(enableProjects);
  const projectsEnabled = () => projectsFlag().enabled;

  const initial = props.initialState ?? {};
  const initialTab = initial.tab ?? 'my-tasks';

  const ownedSlot = (name: string) =>
    listOwnedSlotName(props.scopeKey ? `${props.scopeKey}:${name}` : name);
  const createState = () =>
    makePersistedState(
      createStore<TasksViewState>({
        tab: initialTab,
        search: initial.search ?? '',
        groupBy: initial.groupBy ?? TASK_DEFAULT_GROUP_BY[initialTab],
        sort: (initial.sort ?? [{ id: 'updated_at' }]).map((item) => ({
          ...item,
        })),
        facets: normalizeFacetSelection(
          initial.facets ?? DEFAULT_TASK_FACET_SELECTION
        ),
        collapsedGroupIds: [...(initial.collapsedGroupIds ?? [])],
        collapsedSidebarSectionIds: [
          ...(initial.collapsedSidebarSectionIds ?? []),
        ],
      }),
      createTasksViewPersistence({
        handle: panel.handle,
        userId,
        restoreEntryState:
          props.restoreEntryState ?? props.initialState === undefined,
        restorePreferences: initial.collapsedSidebarSectionIds === undefined,
        scopeKey: props.scopeKey,
      })
    );
  const [persistedState, setState] = props.scopeKey
    ? withSplitPanelOwner(ownedSlot('view-state'), createState)
    : createState();
  // A pending or disabled rollout must not overwrite the saved Projects tab.
  const state = mergeProps(persistedState, {
    get tab(): TaskTab {
      return persistedState.tab === 'projects' && !projectsEnabled()
        ? 'my-tasks'
        : persistedState.tab;
    },
  });

  const isGroupExpanded = (groupId: string) =>
    !state.collapsedGroupIds.includes(groupId);
  const source = withSplitPanelOwner(ownedSlot('data-source'), () =>
    (props.sourceFactory ?? useTasksDataSource)(state, {
      userId,
      tagSets,
      tagSetsReady,
      isGroupExpanded,
    })
  );
  type ActivationHandler = (
    activation: ListActivation<TasksDataSourceItem, TasksListActivationMetadata>
  ) => void;
  const activation = withSplitPanelOwner(ownedSlot('activation'), () => ({
    current: undefined as ActivationHandler | undefined,
  }));
  const list = withSplitPanelOwner(ownedSlot('controller'), () =>
    createListController<TasksDataSourceItem, TasksListActivationMetadata>({
      items: source.items,
      getKey: (row) => row.id,
      selection: {
        getKey: (row) => (row.kind === 'entity' ? row.entity.id : row.id),
      },
      isNavigable: (row) => row.kind !== 'section-header',
      isSelectable: (row) => row.kind === 'entity',
      onActivate: (value) => activation.current?.(value),
    })
  );
  const registerListActivationHandler = (handler: ActivationHandler) => {
    activation.current = handler;
    onCleanup(() => {
      if (activation.current === handler) activation.current = undefined;
    });
  };

  const selectedTask = (): TaskDetailTarget | undefined => {
    const taskEntry = navigationStack.entries.find(
      (entry) =>
        entry.data.type === 'document' && entry.data.subType?.type === 'task'
    );
    if (!taskEntry) return undefined;

    if (
      taskEntry.data.type !== 'document' ||
      taskEntry.data.subType?.type !== 'task'
    ) {
      return undefined;
    }
    return {
      id: taskEntry.data.id,
      fallbackName: taskEntry.data.fallbackName,
    };
  };

  const openTask = (
    task: TaskDetailTarget,
    options?: EntityDetailNavigationOptions
  ) => {
    if (props.onOpenTask) return props.onOpenTask(task, options);
    const target = entityDetailTarget.document({
      id: task.id,
      fileType: 'md',
      subType: { type: 'task' },
      fallbackName: task.fallbackName,
    });
    if (!navigationStack.shouldNavigate(target, options)) return false;
    // A refused reset already alerted; there is nothing to fall back to.
    if (!navigationStack.reset(target)) return true;
    const row = source
      .items()
      .find((item) => item.kind === 'entity' && item.entity.id === task.id);
    if (row) {
      list.focus.set(row.id, { reason: 'programmatic', force: true });
      list.selection.setAnchor(row.id);
    }

    return true;
  };
  const closeTask = props.onCloseTask ?? navigationStack.clear;

  const setTab = (tab: TaskTab) => {
    if (tab === 'projects' && !projectsEnabled()) return;
    closeTask();
    if (persistedState.tab === tab) return;

    setState(
      produce((draft) => {
        draft.tab = tab;
        draft.groupBy = TASK_DEFAULT_GROUP_BY[tab];
        draft.facets = normalizeFacetSelection(DEFAULT_TASK_FACET_SELECTION);
        draft.collapsedGroupIds = [];
      })
    );
  };

  const setFacets = (facets: TasksViewState['facets']) => {
    closeTask();
    setState('facets', reconcile(normalizeFacetSelection(facets)));
  };

  const setPrimarySort = (id: TaskSortId) => {
    const current = state.sort[0];
    const reversed = current?.id === id ? !current.reversed : false;

    setState('sort', [{ id, reversed }]);
  };

  const isSidebarSectionOpen = (id: string) =>
    !state.collapsedSidebarSectionIds.includes(id);

  const setSidebarSectionOpen = (id: string, open: boolean) =>
    setState(
      'collapsedSidebarSectionIds',
      setSidebarSectionCollapsed(id, open)
    );

  return {
    scopeKey: props.scopeKey,
    state,
    projectsEnabled,
    setState,
    selectedTask,
    source,
    list,
    registerListActivationHandler,
    openTask,
    closeTask,
    setTab,
    setFacets,
    setPrimarySort,
    isSidebarSectionOpen,
    setSidebarSectionOpen,
  };
});

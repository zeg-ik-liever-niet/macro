import {
  EntityDetailNavigationStack,
  entityDetailTarget,
  useEntityDetailNavigationStack,
} from '@app/components/entity-detail/EntityDetailNavigationStack';
import { ViewBreadcrumbs, ViewShell } from '@app/components/view-shell';
import type { ProjectRoute } from '@app/features/projects/core/route';
import { openProject } from '@app/features/projects/open-project';
import { ProjectsTab } from '@app/features/projects/projects';
import { globalSplitManager } from '@app/signal/splitLayout';
import { useSplitLayout } from '@components/app/split-layout/layout';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { SplitPanel } from '@components/app/split-panel';
import { toast } from '@core/component/Toast/Toast';
import { ListEntityMetadataQueryProvider } from '@entity';
import SpinnerIcon from '@phosphor/spinner.svg';
import {
  createSignal,
  Match,
  onMount,
  type ParentProps,
  Suspense,
  Switch,
} from 'solid-js';
import { TasksDetailView } from './components/TasksDetailView';
import {
  TasksHeader,
  TasksTopBar,
  TaskViewBreadcrumbItem,
} from './components/TasksHeader';
import { TasksMobileTabs } from './components/TasksMobileTabs';
import { TasksSidebar } from './components/TasksSidebar';
import { TaskList } from './components/task-list/TaskList';
import { createProjectRouteSync } from './primitives/project-route-sync';
import { createProjectSelectionGuard } from './primitives/project-selection-guard';
import { TasksViewProvider, useTasksView } from './tasks-view-context';
import type { TasksViewStateOptions } from './types';

export type TasksViewProps = {
  /** Explicit navigation state. When present, it wins over entry restoration. */
  initialState?: TasksViewStateOptions;
  initialProject?: ProjectRoute;
};

function TasksListFallback() {
  return (
    <div class="grid size-full min-h-0 min-w-0 place-items-center text-ink-muted">
      <SpinnerIcon aria-label="Loading tasks" class="size-5 animate-spin" />
    </div>
  );
}

function TasksViewBreadcrumbs(props: ParentProps) {
  const { closeTask } = useTasksView();
  const navigationStack = useEntityDetailNavigationStack();

  return (
    <ViewBreadcrumbs.Root
      value={navigationStack.active()?.value ?? 'tasks-view'}
      onChange={(value) => {
        if (value === 'tasks-view') {
          closeTask();
          return;
        }
        navigationStack.popTo(value);
      }}
    >
      <TaskViewBreadcrumbItem />
      {props.children}
    </ViewBreadcrumbs.Root>
  );
}

function TasksViewRoot() {
  const panel = useSplitPanelOrThrow();
  const layout = useSplitLayout();
  const navigationStack = useEntityDetailNavigationStack();
  const { state, projectsEnabled } = useTasksView();
  const [listElement, setListElement] = createSignal<HTMLDivElement>();

  createProjectRouteSync({
    entries: () => navigationStack.entries,
    enabled: projectsEnabled,
    collectionRoute: () =>
      state.tab === 'projects' ? 'tasks-projects' : 'tasks',
    handle: panel.handle,
  });

  onMount(() => panel.handle.setDisplayName('Tasks'));

  return (
    <SplitPanel.Root>
      <SplitPanel.Body>
        <ViewShell.Root
          asidePreferenceKey="tasks"
          resizable
          aside={{ preserveDuringResize: false }}
          main={{ preferredWidth: 640 }}
        >
          <ViewShell.Aside>
            <TasksSidebar />
          </ViewShell.Aside>
          <ViewShell.Main>
            <Switch>
              <Match
                when={
                  navigationStack.entries[0] &&
                  (projectsEnabled() ||
                    navigationStack.entries.every(
                      (entry) => entry.data.type !== 'initiative'
                    ))
                }
              >
                <TasksDetailView />
              </Match>
              <Match when={state.tab === 'projects'}>
                <TasksTopBar />
                <div class="hidden @max-[720px]/view-shell:block">
                  <TasksMobileTabs />
                </div>
                <ProjectsTab
                  onOpen={(id, event, newSplit) => {
                    const target = entityDetailTarget.initiative({
                      id,
                      section: 'overview',
                    });
                    if (
                      !newSplit &&
                      navigationStack.shouldNavigate(target, { event })
                    ) {
                      navigationStack.reset(target);
                      return;
                    }
                    openProject(layout, id, {
                      newSplit: newSplit || event?.shiftKey,
                    });
                  }}
                />
              </Match>
              <Match when={true}>
                <TasksTopBar />
                <ViewShell.Header>
                  <TasksHeader onSearchEscape={() => listElement()?.focus()} />
                </ViewShell.Header>
                <ViewShell.Content>
                  <Suspense fallback={<TasksListFallback />}>
                    <TaskList ref={setListElement} />
                  </Suspense>
                </ViewShell.Content>
              </Match>
            </Switch>
          </ViewShell.Main>
        </ViewShell.Root>
      </SplitPanel.Body>
    </SplitPanel.Root>
  );
}

/** Production Tasks view. */
export function TasksView(props: TasksViewProps) {
  const panel = useSplitPanelOrThrow();
  const selectProject = createProjectSelectionGuard({
    manager: globalSplitManager,
    handle: panel.handle,
    onDuplicate: () => toast.alert('Content already open'),
  });
  return (
    <EntityDetailNavigationStack.Root
      beforeChange={selectProject}
      defaultValue={
        props.initialProject
          ? [entityDetailTarget.initiative(props.initialProject)]
          : undefined
      }
    >
      <ListEntityMetadataQueryProvider>
        <TasksViewProvider initialState={props.initialState}>
          <TasksViewBreadcrumbs>
            <TasksViewRoot />
          </TasksViewBreadcrumbs>
        </TasksViewProvider>
      </ListEntityMetadataQueryProvider>
    </EntityDetailNavigationStack.Root>
  );
}

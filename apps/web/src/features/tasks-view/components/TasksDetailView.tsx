import { EntityDetail } from '@app/components/entity-detail/EntityDetail';
import { EntityDetailBreadcrumbItem } from '@app/components/entity-detail/EntityDetailBreadcrumbItem';
import {
  EntityDetailNavigationStack,
  type EntityDetailNavigationStackEntry,
  entityDetailTarget,
  useEntityDetailNavigationStack,
} from '@app/components/entity-detail/EntityDetailNavigationStack';
import { EntityDetailTopBar } from '@app/components/entity-detail/EntityDetailTopBar';
import { useListNavigationHotkeys } from '@app/components/entity-detail/use-list-navigation-hotkeys';
import { useListDetailNavigation } from '@app/components/list';
import {
  ProjectBreadcrumb,
  ProjectDetail,
} from '@app/features/projects/project-detail';
import { Projects } from '@app/features/projects/projects';
import { ProjectTasksProvider } from '@app/features/projects/views/project-tasks-list';
import { MarkdownDetailBreadcrumbItem } from '@block-md/component/MarkdownDetailBreadcrumbItem';
import { SidePanel } from '@components/app/side-panel';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { toast } from '@core/component/Toast/Toast';
import {
  ShareDialogContext,
  ShareTrigger,
} from '@core/component/TopBar/ShareButton';
import {
  createSignal,
  ErrorBoundary,
  For,
  Match,
  Show,
  Switch,
} from 'solid-js';
import { useTasksView } from '../tasks-view-context';
import { TaskDetail, TaskDetailBodyState } from './TaskDetail';

function DetailAncestors() {
  const stack = useEntityDetailNavigationStack();
  return (
    <For each={stack.entries.slice(0, -1)}>
      {(entry, index) => (
        <Switch>
          <Match when={entry.data.type === 'initiative'}>
            <ProjectBreadcrumb entry={entry} order={index() + 1} />
          </Match>
          <Match when={true}>
            <EntityDetailBreadcrumbItem entry={entry} order={index() + 1} />
          </Match>
        </Switch>
      )}
    </For>
  );
}

function StackTaskDetail(props: {
  entry: EntityDetailNavigationStackEntry;
  order: number;
}) {
  const panel = useSplitPanelOrThrow();
  const stack = useEntityDetailNavigationStack();
  const { source, openTask } = useTasksView();
  const listNavigation = useListDetailNavigation({
    currentId: () => props.entry.data.id,
    source,
    getEntity: (row) => (row.kind === 'entity' ? row.entity : undefined),
    getContinuation: (row) => {
      if (row.kind !== 'load-more') return;
      return row.groupId === undefined
        ? source.loadMore
        : () => source.loadMoreGroup(row.groupId!);
    },
    open: (task) => openTask({ id: task.id, fallbackName: task.name }),
    onError: () => toast.failure('Unable to open the next or previous task'),
  });
  useListNavigationHotkeys({
    scopeId: panel.splitHotkeyScope,
    enabled: () =>
      panel.isPanelActive() && stack.active()?.value === props.entry.value,
    navigation: listNavigation,
  });
  const [shareOpen, setShareOpen] = createSignal(false);
  const task = () => ({
    id: props.entry.data.id,
    fallbackName: props.entry.data.fallbackName,
  });
  return (
    <ShareDialogContext.Provider
      value={{
        isOpen: shareOpen,
        open: () => setShareOpen(true),
        close: () => setShareOpen(false),
      }}
    >
      <EntityDetailTopBar>
        <ShareTrigger
          id={task().id}
          blockType="task"
          hotkeyScope={panel.splitHotkeyScope}
        />
      </EntityDetailTopBar>
      <div class="relative min-h-0 min-w-0 flex-1">
        <TaskDetail
          task={task()}
          shareOpen={shareOpen()}
          onShareOpenChange={setShareOpen}
        >
          {(context) => (
            <MarkdownDetailBreadcrumbItem
              value={props.entry.value}
              metadata={props.entry.data}
              order={props.order}
              documentId={task().id}
              kind="task"
              fallbackName={task().fallbackName}
              ownerId={context.data.metadata.owner}
              projectId={context.data.metadata.projectId ?? undefined}
              onClose={stack.pop}
              onDuplicate={(id, name) =>
                stack.replace(
                  entityDetailTarget.document({
                    id,
                    fileType: 'md',
                    subType: { type: 'task' },
                    fallbackName: name,
                  })
                )
              }
            />
          )}
        </TaskDetail>
      </div>
    </ShareDialogContext.Provider>
  );
}

/** Tasks and Projects share the same navigation stack, top bar, and side panel. */
export function TasksDetailView() {
  const stack = useEntityDetailNavigationStack();
  return (
    <SidePanel.Root persistKey="tasks">
      <DetailAncestors />
      <div class="flex size-full min-h-0 min-w-0 flex-col overflow-hidden">
        <EntityDetailNavigationStack.Outlet>
          {(entry, state) => (
            <ErrorBoundary
              fallback={(error, reset) => (
                <TaskDetailBodyState
                  error={error}
                  actionLabel="Reset"
                  onAction={reset}
                />
              )}
            >
              <Switch>
                <Match
                  when={
                    entry.data.type === 'initiative' ? entry.data : undefined
                  }
                >
                  {(project) => (
                    <ProjectDetail
                      route={{
                        id: project().id,
                        section: project().section ?? 'overview',
                        discussionId: project().discussionId,
                      }}
                      breadcrumb={{ entry, order: state.entries.length }}
                      onDelete={stack.pop}
                    />
                  )}
                </Match>
                <Match
                  when={
                    entry.data.type === 'document' &&
                    entry.data.subType?.type === 'task'
                  }
                >
                  <Show
                    when={state.entries
                      .slice(0, -1)
                      .findLast(
                        (ancestor) => ancestor.data.type === 'initiative'
                      )}
                    fallback={
                      <StackTaskDetail
                        entry={entry}
                        order={state.entries.length}
                      />
                    }
                  >
                    {(project) => (
                      <Projects>
                        <ProjectTasksProvider
                          projectId={project().data.id}
                          onOpenTask={(task, options) => {
                            const target = entityDetailTarget.document({
                              id: task.id,
                              fileType: 'md',
                              subType: { type: 'task' },
                              fallbackName: task.fallbackName,
                            });
                            if (!stack.shouldNavigate(target, options))
                              return false;
                            stack.replace(target);
                            return true;
                          }}
                        >
                          <StackTaskDetail
                            entry={entry}
                            order={state.entries.length}
                          />
                        </ProjectTasksProvider>
                      </Projects>
                    )}
                  </Show>
                </Match>
                <Match when={true}>
                  <EntityDetailBreadcrumbItem
                    entry={entry}
                    order={state.entries.length}
                  />
                  <EntityDetailTopBar />
                  <div class="relative min-h-0 min-w-0 flex-1">
                    <EntityDetail target={entry.data} />
                  </div>
                </Match>
              </Switch>
            </ErrorBoundary>
          )}
        </EntityDetailNavigationStack.Outlet>
      </div>
    </SidePanel.Root>
  );
}

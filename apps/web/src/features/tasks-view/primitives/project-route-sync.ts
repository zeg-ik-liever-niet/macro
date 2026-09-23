import type { EntityDetailNavigationStackEntry } from '@app/components/entity-detail/EntityDetailNavigationStack';
import { projectRouteId } from '@app/features/projects/core/route';
import type { SplitHandle } from '@components/app/split-layout/layoutManager';
import { type Accessor, createRenderEffect, untrack } from 'solid-js';

/** Keep native project links current without replacing the mounted Tasks workspace. */
export function createProjectRouteSync(options: {
  entries: Accessor<readonly EntityDetailNavigationStackEntry[]>;
  enabled?: Accessor<boolean>;
  collectionRoute: Accessor<'tasks' | 'tasks-projects'>;
  handle: Pick<SplitHandle, 'content' | 'adoptContentId'>;
}) {
  createRenderEffect(() => {
    if (options.enabled && !options.enabled()) return;
    const project = options
      .entries()
      .map((entry) => entry.data)
      .findLast((data) => data.type === 'initiative');
    const nextId = project
      ? projectRouteId({
          id: project.id,
          section: project.section ?? 'overview',
          discussionId: project.discussionId,
        })
      : options.collectionRoute();
    // Split content and history are outputs of this synchronization, not inputs.
    untrack(() => {
      const current = options.handle.content();
      if (current.type === 'component' && current.id !== nextId)
        options.handle.adoptContentId({ type: 'component', nextId });
    });
  });
}

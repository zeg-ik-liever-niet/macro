import type { EntityDetailTarget } from '@app/components/entity-detail/EntityDetailNavigationStack';
import {
  parseProjectRoute,
  projectRouteId,
} from '@app/features/projects/core/route';
import type {
  SplitHandle,
  SplitManager,
} from '@components/app/split-layout/layoutManager';
import type { Accessor } from 'solid-js';

/** Reject duplicate native routes before the detail stack or split URL changes. */
export function createProjectSelectionGuard(options: {
  manager: Accessor<Pick<SplitManager, 'splits'> | undefined>;
  handle: Pick<SplitHandle, 'id'>;
  onDuplicate: () => void;
}) {
  return (target: EntityDetailTarget | undefined): boolean => {
    if (target?.type !== 'initiative') return true;
    const routeId = projectRouteId({
      id: target.id,
      section: target.section ?? 'overview',
      discussionId: target.discussionId,
    });
    const duplicate = options
      .manager()
      ?.splits()
      .some((split) => {
        if (
          split.id === options.handle.id ||
          split.content.type !== 'component'
        )
          return false;
        const route = parseProjectRoute(split.content.id);
        return route !== undefined && projectRouteId(route) === routeId;
      });
    if (!duplicate) return true;
    options.onDuplicate();
    return false;
  };
}

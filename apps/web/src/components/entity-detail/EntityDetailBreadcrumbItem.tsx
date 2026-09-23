import { ViewBreadcrumbs } from '@app/components/view-shell';
import {
  EntityIcon,
  type EntityIconSelector,
} from '@core/component/EntityIcon';
import { fileTypeToBlockName } from '@core/constant/allBlocks';
import StackIcon from '@phosphor/stack.svg';
import { Show } from 'solid-js';
import type {
  EntityDetailNavigationStackEntry,
  EntityDetailTarget,
} from './EntityDetailNavigationStack';

function breadcrumbIcon(target: EntityDetailTarget): EntityIconSelector {
  if (target.type === 'document') {
    return (target.subType?.type ??
      target.fileType ??
      'unknown') as EntityIconSelector;
  }
  if (
    target.type === 'channel' ||
    target.type === 'channel_message' ||
    target.type === 'channel_thread'
  ) {
    return 'channel';
  }
  return fileTypeToBlockName(target.type, true);
}

function breadcrumbName(target: EntityDetailTarget) {
  if (target.fallbackName) return target.fallbackName;
  if (target.type === 'initiative') return 'Project';

  if (target.type === 'document' && target.subType?.type === 'task') {
    return 'New Task';
  }
  if (
    target.type === 'channel' ||
    target.type === 'channel_message' ||
    target.type === 'channel_thread'
  ) {
    return 'Channel';
  }
  return 'Untitled';
}

export function EntityDetailBreadcrumbItem(props: {
  entry: EntityDetailNavigationStackEntry;
  order: number;
}) {
  return (
    <ViewBreadcrumbs.Item
      value={props.entry.value}
      metadata={props.entry.data}
      order={props.order}
    >
      {(item) => (
        <ViewBreadcrumbs.Button
          class="gap-1.5"
          isActive={item.isActive()}
          onClick={item.onSelect}
          tooltip={breadcrumbName(props.entry.data)}
        >
          <Show
            when={props.entry.data.type === 'initiative'}
            fallback={
              <EntityIcon
                targetType={breadcrumbIcon(props.entry.data)}
                size="xs"
                class="shrink-0"
              />
            }
          >
            <StackIcon class="size-3 shrink-0" />
          </Show>
          <span class="truncate">{breadcrumbName(props.entry.data)}</span>
        </ViewBreadcrumbs.Button>
      )}
    </ViewBreadcrumbs.Item>
  );
}

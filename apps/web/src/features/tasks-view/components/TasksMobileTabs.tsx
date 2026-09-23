import { type PillTabItem, PillTabs } from '@components/app/mobile/PillTabs';
import { Show } from 'solid-js';
import { TASK_TABS, type TaskTabItem } from '../constants';
import { useTasksView } from '../tasks-view-context';
import type { TaskTab } from '../types';
import { TasksFilterDrawer } from './TasksFilterDrawer';

const toPill = (tab: TaskTabItem): PillTabItem<TaskTab> => ({
  value: tab.id,
  label: tab.label,
});

export function TasksMobileTabs() {
  const { state, setTab, projectsEnabled } = useTasksView();
  const items = (): PillTabItem<TaskTab>[] =>
    TASK_TABS.filter((tab) => tab.id !== 'projects' || projectsEnabled()).map(
      toPill
    );

  return (
    <div class="h-10 min-w-0 flex-1">
      <PillTabs
        scrollable
        class="-ml-(--mobile-chrome-gutter) w-[calc(100%+2*var(--mobile-chrome-gutter))] max-w-none flex-none"
        contentClass="px-(--mobile-chrome-gutter)"
        leading={
          <Show when={state.tab !== 'projects'}>
            <TasksFilterDrawer />
          </Show>
        }
        items={items()}
        value={state.tab}
        onChange={setTab}
      />
    </div>
  );
}

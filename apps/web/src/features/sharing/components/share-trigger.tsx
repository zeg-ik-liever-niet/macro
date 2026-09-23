import IconLink from '@phosphor/link.svg';
import IconShared from '@phosphor/share.svg';
import { Button, ButtonGroup, Tooltip } from '@ui';

export function ShareTrigger(props: {
  tooltip: string;
  open(): void;
  copyLink(): void;
}) {
  return (
    <ButtonGroup variant="outline" size="sm" class="bg-surface" depth={2}>
      <Tooltip label={props.tooltip}>
        <Button onClick={props.open}>
          <IconShared />
          Share
        </Button>
      </Tooltip>

      <ButtonGroup.Divider />

      <Button
        tooltip="Copy Share Link"
        size="icon-sm"
        onClick={(event) => {
          event.stopPropagation();
          props.copyLink();
        }}
      >
        <IconLink class="size-3.5!" />
      </Button>
    </ButtonGroup>
  );
}

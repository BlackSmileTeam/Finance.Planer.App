type HintTooltipProps = {
  text: string;
  ariaLabel?: string;
};

export function HintTooltip({ text, ariaLabel }: HintTooltipProps) {
  return (
    <span className="hint-tooltip" tabIndex={0} aria-label={ariaLabel ?? text}>
      ?
      <span className="hint-tooltip__content" role="tooltip">
        {text}
      </span>
    </span>
  );
}

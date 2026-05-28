import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PropertyDescription } from '../data/serverPropertyDescriptions';

export const TOOLTIP_GAP = 8;
export const TOOLTIP_MAX_WIDTH = 320;

export interface ActiveTooltip {
  key: string;
  info: PropertyDescription;
  top: number;
  left: number;
}

export const PropertyTooltip: React.FC<{ tooltip: ActiveTooltip }> = ({ tooltip }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [adjustedTop, setAdjustedTop] = useState(tooltip.top);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (tooltip.top - rect.height < 8) {
      setPlacement('bottom');
      setAdjustedTop(tooltip.top + rect.height + TOOLTIP_GAP * 2);
    } else {
      setPlacement('top');
      setAdjustedTop(tooltip.top);
    }
  }, [tooltip]);

  const { info, key } = tooltip;

  return createPortal(
    <div
      ref={ref}
      className={`property-tooltip property-tooltip--${placement}`}
      role="tooltip"
      style={{ top: adjustedTop, left: tooltip.left }}
    >
      <span className="property-tooltip__title">{key}</span>
      <span className="property-tooltip__description">{info.description}</span>
      {info.options && info.options.length > 0 && (
        <span className="property-tooltip__section">
          <span className="property-tooltip__section-label">Options:</span>{' '}
          <code className="property-tooltip__code">
            {info.options.join(', ')}
          </code>
        </span>
      )}
      {info.example !== undefined && (
        <span className="property-tooltip__section">
          <span className="property-tooltip__section-label">Example:</span>{' '}
          <code className="property-tooltip__code">
            {info.example === '' ? '(blank)' : info.example}
          </code>
        </span>
      )}
    </div>,
    document.body
  );
};

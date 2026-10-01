'use client';

import { MouseEvent, SyntheticEvent, useState } from 'react';
import { Tooltip, TooltipProps } from '@mui/material';

// Extended Mui Tooltip mobile friendly
export const ExtendedTooltip = (props: TooltipProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenTooltip = (e: SyntheticEvent) => {
    setIsOpen(true);
    props.onOpen?.(e);
  };

  const handleCloseTooltip = (e: Event | SyntheticEvent<Element, Event>) => {
    setIsOpen(false);
    props.onClose?.(e);
  };

  const handleClickTooltip = (e: MouseEvent<HTMLDivElement>) => {
    props.onClick?.(e);

    if (isOpen) {
      handleCloseTooltip(e);
    } else {
      handleOpenTooltip(e);
    }
  };

  return (
    <Tooltip
      open={isOpen}
      leaveTouchDelay={5000} // it closes the tooltip on mobile after duration, default value is 1500
      {...props}
      onOpen={handleOpenTooltip}
      onClose={handleCloseTooltip}
      onClick={handleClickTooltip}
    />
  );
};

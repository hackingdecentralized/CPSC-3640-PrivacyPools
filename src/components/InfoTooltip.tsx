'use client';

import { useState } from 'react';
import Image from 'next/image';
import { styled, Typography, TooltipProps } from '@mui/material';
import { tooltipClasses } from '@mui/material/Tooltip';
import { ExtendedTooltip } from '~/components';
import infoIconHover from '~/assets/icons/info-hover.svg';
import infoIcon from '~/assets/icons/info.svg';

export const InfoTooltip = ({
  message,
  iconWidth = 16,
  iconHeight = 16,
}: {
  message: string;
  iconWidth?: number;
  iconHeight?: number;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <STooltip
      title={
        <Typography variant='body2' color='text.primary'>
          {message}
        </Typography>
      }
      placement='bottom-start'
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
    >
      <Image src={isOpen ? infoIconHover : infoIcon} alt='info' width={iconWidth} height={iconHeight} />
    </STooltip>
  );
};

const STooltip = styled(({ className, ...props }: TooltipProps) => (
  <ExtendedTooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2),
    borderRadius: theme.borderRadius.sm,
    border: theme.palette.border.main,
  },
}));

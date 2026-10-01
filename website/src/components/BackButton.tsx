'use client';

import { Close, ChevronLeft } from '@carbon/icons-react';
import { IconButton, styled } from '@mui/material';

interface BackButtonProps {
  back: () => void;
}

export const CloseButton = ({ back }: BackButtonProps) => {
  return (
    <SCloseButton onClick={back}>
      <Close size={16} className='close' />
      <ChevronLeft size={16} className='back' />
    </SCloseButton>
  );
};

export const BackButton = ({ back }: BackButtonProps) => {
  return (
    <SBackButton onClick={back}>
      <ChevronLeft size={16} />
    </SBackButton>
  );
};

const SCloseButton = styled(IconButton)(({ theme }) => ({
  top: '-3rem',
  right: '-3rem',
  position: 'absolute',

  '.back': {
    display: 'none',
  },
  '.close': {
    display: 'block',
  },

  [theme.breakpoints.down('sm')]: {
    marginBottom: '0',
    marginLeft: '0',
    top: `calc(var(--header-height) + 2rem)`,
    left: '2rem',
    right: 'unset',

    '.back': {
      display: 'block',
    },
    '.close': {
      display: 'none',
    },
  },
}));

const SBackButton = styled(SCloseButton)(() => ({
  left: '-3rem',
  right: 'unset',
}));

'use client';

import { useEffect, useReducer } from 'react';
import { Close } from '@carbon/icons-react';
import { IconButton, styled, Typography } from '@mui/material';
import { getEnv } from '~/config/env';
import { useChainContext } from '~/hooks';
import { HEADER_HEIGHT } from '~/utils';

const { SHOW_DISCLAIMER } = getEnv();

const DISCLAIMER_MESSAGE = {
  // Keep messages under 80 chars for better readability
  BETA: 'This app is in beta. Use at your own risk. Lost funds cannot be recovered.',
  DEPOSIT_DISABLED: 'New deposits are disabled at the moment. Please try again later.',
};

type DisclaimerMessageKey = keyof typeof DISCLAIMER_MESSAGE;

type DisclaimerState = {
  showDisclaimer: boolean;
  messageKey: DisclaimerMessageKey;
};

type DisclaimerAction =
  | { type: 'SHOW_DISCLAIMER'; payload: DisclaimerMessageKey }
  | { type: 'HIDE_DISCLAIMER' }
  | { type: 'SET_MESSAGE'; payload: DisclaimerMessageKey };

const initialState: DisclaimerState = {
  showDisclaimer: SHOW_DISCLAIMER,
  messageKey: 'BETA',
};

function disclaimerReducer(state: DisclaimerState, action: DisclaimerAction): DisclaimerState {
  switch (action.type) {
    case 'SHOW_DISCLAIMER':
      return {
        ...state,
        showDisclaimer: true,
        messageKey: action.payload,
      };
    case 'HIDE_DISCLAIMER':
      return {
        ...state,
        showDisclaimer: false,
      };
    case 'SET_MESSAGE':
      return {
        ...state,
        messageKey: action.payload,
      };
    default:
      return state;
  }
}

export const Disclaimer = () => {
  const [state, dispatch] = useReducer(disclaimerReducer, initialState);
  const { maxDeposit } = useChainContext();

  const closeDisclaimer = () => {
    dispatch({ type: 'HIDE_DISCLAIMER' });
  };

  useEffect(() => {
    if (!BigInt(maxDeposit)) {
      dispatch({ type: 'SHOW_DISCLAIMER', payload: 'DEPOSIT_DISABLED' });
    }
  }, [maxDeposit]);

  useEffect(() => {
    if (state.showDisclaimer) {
      document.body.style.setProperty('--header-height', HEADER_HEIGHT.withDisclaimer + 'rem');
    } else {
      document.body.style.setProperty('--header-height', HEADER_HEIGHT.default + 'rem');
    }
  }, [state.showDisclaimer]);

  if (!state.showDisclaimer) return null;

  return (
    <Container>
      <Typography variant='caption'>{DISCLAIMER_MESSAGE[state.messageKey]}</Typography>
      <SIconButton size='small' onClick={closeDisclaimer}>
        <Close size={20} />
      </SIconButton>
    </Container>
  );
};

export const Container = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '1rem',
  width: '100%',
  borderBottom: '1px solid',
  padding: '0.6rem 2rem 0.6rem',
  borderColor: theme.palette.grey[400],
  backgroundColor: theme.palette.background.default,
  span: {
    lineHeight: 1.3,
    fontWeight: 500,
  },
}));

const SIconButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: 'transparent',
  border: 'none',
  color: theme.palette.text.primary,
  '&:hover, &:focus': {
    backgroundColor: 'transparent',
    color: theme.palette.text.disabled,
    border: 'none',
  },
}));

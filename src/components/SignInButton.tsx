'use client';

import { Button, styled } from '@mui/material';
import { useModal } from '~/hooks';
import { ModalType } from '~/types';

export const SignInButton = () => {
  const { setModalOpen } = useModal();

  const handleClick = () => {
    setModalOpen(ModalType.CONNECT);
  };

  return (
    <SButton data-testid='connect-wallet-button' onClick={handleClick} variant='outlined'>
      Connect
    </SButton>
  );
};

const SButton = styled(Button)(() => ({
  textTransform: 'none',
  padding: '0.5rem 1.7rem',
  lineHeight: '100%',
  height: '2.8rem',
}));

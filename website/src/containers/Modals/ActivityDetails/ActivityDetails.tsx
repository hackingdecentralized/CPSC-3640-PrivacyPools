'use client';

import { Box, Divider, styled } from '@mui/material';
import { BaseModal } from '~/components';
import { usePoolAccountsContext } from '~/hooks';
import { ModalType } from '~/types';
import { ModalTitle } from '../Deposit';
import { DataSection } from './DataSection';
import { Resume } from './Resume';
import { Transaction } from './Transaction';

export const ActivityDetails = () => {
  const { selectedHistoryData } = usePoolAccountsContext();

  return (
    <BaseModal type={ModalType.ACTIVITY_DETAILS} hasBackground>
      <ModalContainer>
        <ModalTitle variant='h2'>{selectedHistoryData?.type}</ModalTitle>

        <Resume />

        <Divider />

        <DataSection />

        <Divider />

        <Transaction />
      </ModalContainer>
    </BaseModal>
  );
};

export const ModalContainer = styled(Box)(() => {
  return {
    display: 'flex',
    padding: '3.6rem 2.4rem',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2rem',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    '& > *': {
      zIndex: 1,
    },

    h2: {
      textTransform: 'capitalize',
    },
  };
});

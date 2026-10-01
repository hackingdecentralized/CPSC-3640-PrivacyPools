'use client';

import { Warning } from '@carbon/icons-react';
import { Box, Button, Stack, styled, Typography, Alert, CircularProgress } from '@mui/material';
import { BaseModal } from '~/components';
import { useModal } from '~/hooks';
import { useSelfReport } from '~/hooks/useSelfReport';
import { ModalType } from '~/types';
import { truncateAddress } from '~/utils';

export const SelfReportModal = () => {
  return (
    <BaseModal type={ModalType.SELF_REPORT} hasBackground>
      <SelfReportForm />
    </BaseModal>
  );
};

const SelfReportForm = () => {
  const { closeModal } = useModal();
  const { address, isLoading, isSuccess, error, reportCompromisedAddress, reset } = useSelfReport();

  const handleReport = async () => {
    const success = await reportCompromisedAddress();
    if (success) {
      // Close modal after short delay to show success state
      setTimeout(() => {
        closeModal();
        reset();
      }, 2000);
    }
  };

  const handleCancel = () => {
    reset();
    closeModal();
  };

  if (isSuccess) {
    return (
      <ModalContainer>
        <Alert severity='success' sx={{ width: '100%' }}>
          <Typography variant='body1' fontWeight='bold'>
            Address Reported Successfully
          </Typography>
          <Typography variant='body2'>
            All deposits from {truncateAddress(address!)} will be blocked from anonymous withdrawal.
          </Typography>
        </Alert>
      </ModalContainer>
    );
  }

  return (
    <ModalContainer>
      <WarningIcon>
        <Warning size={48} />
      </WarningIcon>

      <ModalTitle variant='h2'>Report Compromised Address</ModalTitle>

      <Alert severity='error' sx={{ width: '100%' }}>
        <Typography variant='body2' fontWeight='bold' gutterBottom>
          This action is irreversible
        </Typography>
        <Typography variant='body2'>
          By signing this message, you are confirming that your deposit address private key has been compromised. All
          existing and future deposits from this address will be permanently blocked from anonymous withdrawal.
        </Typography>
      </Alert>

      <InfoBox>
        <Typography variant='body2' color='text.secondary'>
          Address to report:
        </Typography>
        <Typography variant='body1' fontWeight='bold' sx={{ wordBreak: 'break-all' }}>
          {address}
        </Typography>
      </InfoBox>

      <Alert severity='info' sx={{ width: '100%' }}>
        <Typography variant='body2'>
          You will be asked to sign a message with your wallet. This proves you own the address and authorizes blocking
          all deposits from it.
        </Typography>
      </Alert>

      {error && (
        <Alert severity='error' sx={{ width: '100%' }}>
          {error}
        </Alert>
      )}

      <ButtonsContainer>
        <ReportButton onClick={handleReport} disabled={isLoading || !address}>
          {isLoading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} color='inherit' />
              Signing...
            </>
          ) : (
            'Sign & Report Address'
          )}
        </ReportButton>

        <CancelButton variant='outlined' onClick={handleCancel} disabled={isLoading}>
          Cancel
        </CancelButton>
      </ButtonsContainer>
    </ModalContainer>
  );
};

const ModalContainer = styled(Box)(() => ({
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
}));

const WarningIcon = styled(Box)(({ theme }) => ({
  color: theme.palette.error.main,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const ModalTitle = styled(Typography)(() => ({
  fontSize: '2.4rem',
  fontWeight: 700,
  lineHeight: 'normal',
  width: '100%',
  textAlign: 'center',
}));

const InfoBox = styled(Box)(({ theme }) => ({
  width: '100%',
  padding: '1.6rem',
  backgroundColor: theme.palette.grey[100],
  borderRadius: '0.4rem',
  textAlign: 'center',
}));

const ButtonsContainer = styled(Stack)(() => ({
  width: '100%',
  gap: '1.2rem',
  marginTop: '1rem',
}));

const ReportButton = styled(Button)(({ theme }) => ({
  zIndex: 1,
  backgroundColor: theme.palette.error.main,
  color: theme.palette.common.white,
  '&:hover': {
    backgroundColor: theme.palette.error.dark,
  },
  '&:disabled': {
    backgroundColor: theme.palette.grey[400],
  },
}));

const CancelButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  color: theme.palette.text.primary,
  border: `1px solid ${theme.palette.grey[900]}`,
  '&:hover': {
    backgroundColor: theme.palette.grey[100],
    border: `1px solid ${theme.palette.grey[900]}`,
  },
}));

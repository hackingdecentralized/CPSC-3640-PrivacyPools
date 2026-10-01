'use client';

import { useEffect, useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, Button, CircularProgress, styled, Typography } from '@mui/material';
import { BaseModal } from '~/components';
import { ModalType } from '~/types';
import { useMigration } from '../hooks/useMigration';

const FALLBACK_ERROR_MESSAGE = 'We could not complete the migration.';
const ERROR_PREVIEW_MAX_LENGTH = 220;

const getFullErrorMessage = (message: string | null): string => {
  return message?.trim() || FALLBACK_ERROR_MESSAGE;
};

const toErrorPreview = (message: string): string => {
  if (message.length <= ERROR_PREVIEW_MAX_LENGTH) return message;
  return `${message.slice(0, ERROR_PREVIEW_MAX_LENGTH)}...`;
};

const copyTextToClipboard = async (value: string): Promise<boolean> => {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.clipboard?.writeText) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

export const MigrationModal = () => {
  const { isActive, isBlocking, flowState, errorMessage, retryCount, maxRetries, startMigration, completeMigration } =
    useMigration();
  const [hasCopiedError, setHasCopiedError] = useState(false);

  const fullErrorMessage = getFullErrorMessage(errorMessage);
  const previewErrorMessage = toErrorPreview(fullErrorMessage);
  const CopyStatusIcon = hasCopiedError ? CheckIcon : ContentCopyIcon;
  const copyButtonLabel = hasCopiedError ? 'Copied full error' : 'Copy full error';

  const handleCopyFullError = async () => {
    const isCopied = await copyTextToClipboard(fullErrorMessage);
    setHasCopiedError(isCopied);
  };

  useEffect(() => {
    setHasCopiedError(false);
    if (flowState === 'failed') {
      console.error('[migration] flow failed', { errorMessage: fullErrorMessage });
    }
  }, [flowState, fullErrorMessage]);

  if (!isActive || !isBlocking) return null;

  return (
    <BaseModal type={ModalType.MIGRATION} isClosable={false}>
      <Content>
        {flowState === 'intro' && (
          <>
            <Title>Key Migration Needed</Title>
            <Description>
              Your security is our priority. We are increasing the entropy and strength of your keys. Migrate your keys
              to continue using all features.
            </Description>
            <ActionButton onClick={startMigration}>Continue with Migration</ActionButton>
          </>
        )}

        {flowState === 'migrating' && (
          <>
            <CircularProgress size={48} />
            <Title>Migrating Keys...</Title>
            <Description>Please wait while we upgrade the entropy of your keys.</Description>
            {retryCount > 0 && (
              <RetryLabel>
                Retrying failed transactions ({retryCount}/{maxRetries})
              </RetryLabel>
            )}
          </>
        )}

        {flowState === 'success' && (
          <>
            <SuccessCircle>
              <CheckIcon />
            </SuccessCircle>
            <Title>Migration Successful</Title>
            <Description>To finalize the migration, you will have to log in again.</Description>
            <ActionButton onClick={completeMigration}>Continue</ActionButton>
          </>
        )}

        {flowState === 'failed' && (
          <>
            <Title>Migration Failed</Title>
            <ErrorDescription>{previewErrorMessage}</ErrorDescription>
            <CopyButton variant='text' onClick={handleCopyFullError}>
              <CopyButtonContent>
                <CopyStatusIcon fontSize='small' />
                <span>{copyButtonLabel}</span>
              </CopyButtonContent>
            </CopyButton>
            <ActionButton onClick={startMigration}>Retry Migration</ActionButton>
          </>
        )}
      </Content>
    </BaseModal>
  );
};

const Content = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2rem',
  width: '100%',
  padding: '3.6rem 2.4rem',
}));

const Title = styled(Typography)(() => ({
  margin: 0,
  fontSize: '2.4rem',
  fontWeight: 700,
  color: 'inherit',
  width: '100%',
  textAlign: 'center',
  lineHeight: 'normal',
}));

const Description = styled(Typography)(({ theme }) => ({
  margin: 0,
  fontSize: '1.4rem',
  lineHeight: 1.6,
  color: theme.palette.text.secondary,
  textAlign: 'center',
  maxWidth: '36rem',
}));

const ErrorDescription = styled(Description)(() => ({
  overflowWrap: 'anywhere',
}));

const RetryLabel = styled(Typography)(({ theme }) => ({
  margin: 0,
  fontSize: '1.2rem',
  lineHeight: 1.5,
  color: theme.palette.text.secondary,
  textAlign: 'center',
}));

const ActionButton = styled(Button)(() => ({
  width: '100%',
  textTransform: 'none',
}));

const CopyButton = styled(Button)(({ theme }) => ({
  width: 'fit-content',
  textTransform: 'none',
  color: theme.palette.text.secondary,
  padding: 0,
  minWidth: 0,
  '&:hover': {
    backgroundColor: 'transparent',
    color: theme.palette.text.primary,
  },
}));

const CopyButtonContent = styled(Box)(() => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.6rem',
}));

const SuccessCircle = styled(Box)(({ theme }) => ({
  width: '4.8rem',
  height: '4.8rem',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.common.white,
  backgroundColor: theme.palette.success.main,
}));

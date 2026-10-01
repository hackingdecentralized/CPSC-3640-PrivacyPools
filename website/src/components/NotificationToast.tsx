'use client';

import CloseIcon from '@mui/icons-material/Close';
import { Alert, AlertTitle, Collapse, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNotifications } from '~/hooks';
import { Notification } from '~/types';

const severityMap = {
  success: 'success',
  error: 'error',
  info: 'info',
  warning: 'warning',
} as const;

interface NotificationToastProps {
  notification: Notification;
}

export function NotificationToast({ notification }: NotificationToastProps) {
  const { id, message, type } = notification || {};
  const { removeNotification } = useNotifications();

  const handleRemoveNotification = () => {
    removeNotification(id);
  };

  return (
    <Collapse in>
      <StyledAlert
        data-testid='notification'
        severity={severityMap[notification.type]}
        action={
          <CloseButton onClick={handleRemoveNotification}>
            <CloseIcon sx={{ width: '1.6rem' }} />
          </CloseButton>
        }
      >
        <SAlertTitle>{type}</SAlertTitle>

        {message}
      </StyledAlert>
    </Collapse>
  );
}
const StyledAlert = styled(Alert)(({ theme }) => {
  return {
    borderRadius: 0,
    fontSize: '1.2rem',
    '& .MuiAlert-icon': {
      alignItems: 'center',
    },
    '& .MuiAlert-action': {
      padding: 0,
      alignItems: 'center',
    },
    border: '1px solid',
    background: theme.palette.grey[50],
    '&.MuiAlert-colorError': {
      borderColor: theme.palette.error.main,
    },
    '&.MuiAlert-colorSuccess': {
      borderColor: theme.palette.success.main,
    },
    '&.MuiAlert-colorWarning': {
      borderColor: theme.palette.warning.main,
    },
    '&.MuiAlert-colorInfo': {
      borderColor: theme.palette.info.main,
    },
  };
});

const CloseButton = styled(IconButton)({
  background: 'none',
  border: 'none',
  boxShadow: 'none',
  padding: '0.4rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  marginBottom: 'auto',
  color: 'inherit',
  height: '2.4rem',
  widht: '2.4rem',
});

const SAlertTitle = styled(AlertTitle)({
  fontSize: '1.2rem',
  fontWeight: 600,
  textTransform: 'capitalize',
});

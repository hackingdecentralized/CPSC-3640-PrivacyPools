'use client';

import { Box, styled } from '@mui/material';
import { NotificationToast } from '~/components';
import { useNotifications } from '~/hooks';
import { Notification } from '~/types';
import { zIndex } from '~/utils';

export function NotificationContainer() {
  const { notifications } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <NotificationWrapper>
      {notifications.map((notification: Notification) => (
        <NotificationToast key={notification.id} notification={notification} />
      ))}
    </NotificationWrapper>
  );
}

const NotificationWrapper = styled(Box)(({ theme }) => {
  return {
    position: 'fixed',
    bottom: '1rem',
    right: '1rem',
    zIndex: zIndex.TOAST,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    maxWidth: '32rem',
    width: '100%',
    padding: '0 1rem',
    [theme.breakpoints.down('sm')]: {
      bottom: '1.5rem',
    },
  };
});

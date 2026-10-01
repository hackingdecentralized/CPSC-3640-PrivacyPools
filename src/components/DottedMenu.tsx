'use client';

import { styled, Menu as MuiMenu, MenuItem } from '@mui/material';
import { zIndex } from '~/utils';

interface DottedMenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  handleExit?: () => void;
  handleClose: () => void;
  handleDetails: () => void;
  handleWithdraw?: () => void;
}

export const DottedMenu = ({
  open,
  anchorEl,
  handleClose,
  handleExit,
  handleDetails,
  handleWithdraw,
}: DottedMenuProps) => {
  return (
    <SMenu
      anchorEl={anchorEl}
      id='dots-menu'
      open={open}
      onClose={handleClose}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      elevation={0}
    >
      <SMenuItem onClick={handleWithdraw} disabled={!handleWithdraw} data-testid='dotted-menu-withdraw'>
        Withdraw
      </SMenuItem>
      <SMenuItem onClick={handleExit} disabled={!handleExit} data-testid='dotted-menu-exit'>
        Exit
      </SMenuItem>
      <SMenuItem onClick={handleDetails} data-testid='dotted-menu-details'>
        Details
      </SMenuItem>
    </SMenu>
  );
};

const SMenu = styled(MuiMenu)(({ theme }) => {
  return {
    zIndex: zIndex.HEADER + 1,
    '& .MuiPaper-root.MuiPaper-elevation': {
      background: 'transparent',
    },
    '& .MuiListItemIcon-root': {
      color: theme.palette.text.primary,
    },
    '& .MuiList-root': {
      borderRadius: '0.4rem',
      padding: '1.2rem 2.4rem',
      minWidth: '17.3rem',
      border: '1px solid',
      borderColor: theme.palette.grey[900],
      background: theme.palette.grey[50],
    },
    '& .MuiButtonBase-root:hover': {
      background: 'unset',
    },
  };
});

const SMenuItem = styled(MenuItem)(() => ({
  padding: '1.6rem 0',
  fontSize: '1.6rem',
  fontWeight: 400,
  lineHeight: 'normal',
}));

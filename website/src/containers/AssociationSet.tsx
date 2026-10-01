'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  FormControlLabel,
  Stack,
  styled,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { BaseError, formatUnits } from 'viem';
import { useAccount, useSignMessage } from 'wagmi';
import { courseConfig } from '~/config/course';
import { getAspEndpointForChain } from '~/config/env';
import { useModal, useNotifications } from '~/hooks';
import { ModalType } from '~/types';
import { aspClient, truncateAddress } from '~/utils';
import {
  teachingAsp,
  TeachingAspError,
  TeachingDeposit,
  TeachingDepositStatus,
  TeachingSettings,
} from '~/utils/teachingAsp';
import { PAContainer, Section } from './PoolAccountsFull';

const STATUS_COLOR: Record<TeachingDepositStatus, 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  approved: 'success',
  declined: 'error',
  exited: 'default',
};

const shortNumber = (value: string) => (value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value);

const errorMessage = (err: unknown) =>
  err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : String(err);

const formatValue = (deposit: TeachingDeposit) => {
  const decimals = courseConfig.pools.find((p) => p.scope.toString() === deposit.scope)?.decimals ?? 18;
  return formatUnits(BigInt(deposit.value), decimals);
};

/**
 * CPSC 3640: the Teaching ASP's view of every deposit, its root against the on-chain one, and, for an admin wallet,
 * approve/decline buttons and the policy settings.
 */
export const AssociationSet = () => {
  const aspUrl = getAspEndpointForChain(courseConfig.chainId);
  const scope = courseConfig.pools[0]?.scope.toString() ?? '0';
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { setModalOpen } = useModal();
  const { addNotification } = useNotifications();

  // The admin token lives in memory only: a reload signs the teacher out.
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [form, setForm] = useState<TeachingSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const deposits = useQuery({
    queryKey: ['teaching_deposits', aspUrl],
    queryFn: () => teachingAsp.deposits(aspUrl),
    enabled: !!aspUrl,
    refetchInterval: 5_000,
    retry: false,
  });

  const roots = useQuery({
    queryKey: ['teaching_mt_roots', aspUrl, scope],
    queryFn: () => aspClient.fetchMtRoots(aspUrl, courseConfig.chainId, scope),
    enabled: !!aspUrl,
    refetchInterval: 5_000,
    retry: false,
  });

  // Prefill the settings form with the live values once the teacher is signed in.
  useEffect(() => {
    if (token && !form && deposits.data) setForm(deposits.data.settings);
  }, [token, form, deposits.data]);

  const signOut = useCallback((message: string | null) => {
    setToken(null);
    setForm(null);
    setAuthError(message);
  }, []);

  const handleAdminError = (err: unknown) => {
    if (err instanceof TeachingAspError && err.status === 401) {
      signOut('Not an admin wallet, or the sign-in expired. Sign in again.');
    } else {
      addNotification('error', errorMessage(err));
    }
  };

  const handleSignIn = async () => {
    if (!address) {
      setModalOpen(ModalType.CONNECT);
      return;
    }
    setSigningIn(true);
    setAuthError(null);
    try {
      const { nonce, message } = await teachingAsp.nonce(aspUrl, address);
      const signature = await signMessageAsync({ message });
      const login = await teachingAsp.login(aspUrl, address, nonce, signature);
      setToken(login.token);
    } catch (err) {
      setAuthError(
        err instanceof TeachingAspError && err.status === 401
          ? 'Not an admin wallet.'
          : `Sign-in failed: ${errorMessage(err)}`,
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleDecide = async (label: string, action: 'approve' | 'decline') => {
    if (!token) return;
    setBusyLabel(label);
    try {
      const result = await teachingAsp.decide(aspUrl, token, label, action);
      addNotification('success', `Deposit ${shortNumber(label)} is now ${result.status}.`);
      await deposits.refetch();
    } catch (err) {
      handleAdminError(err);
    } finally {
      setBusyLabel(null);
    }
  };

  const handleSaveSettings = async () => {
    if (!token || !form) return;
    setSavingSettings(true);
    try {
      const saved = await teachingAsp.updateSettings(aspUrl, token, form);
      setForm(saved);
      addNotification('success', 'ASP settings saved.');
      await deposits.refetch();
    } catch (err) {
      handleAdminError(err);
    } finally {
      setSavingSettings(false);
    }
  };

  // The ASP's clock, advanced locally between polls, so the countdown ticks every second.
  const serverNow = deposits.data ? deposits.data.now + (nowMs - deposits.dataUpdatedAt) / 1000 : nowMs / 1000;
  const settings = deposits.data?.settings;
  const rows = deposits.data?.deposits ?? [];

  return (
    <PAContainer data-testid='association-set'>
      <Section width='100%'>
        <Typography variant='subtitle1' fontWeight='bold'>
          Association Set
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          Every pool deposit as the Teaching ASP sees it. Approved labels go into the association set, whose root the
          ASP publishes on-chain; a withdrawal must prove its label is in that set.
        </Typography>
      </Section>

      <Section width='100%' sx={{ borderTop: '1px solid', borderColor: 'grey.900' }}>
        {!aspUrl && <Alert severity='error'>NEXT_PUBLIC_ASP_ENDPOINT_TEST is not set.</Alert>}

        <Typography variant='body2' data-testid='asp-roots'>
          {roots.isError
            ? 'Roots unavailable (ASP unreachable).'
            : !roots.data
              ? 'Loading roots...'
              : roots.data.mtRoot === '0'
                ? `No association set published yet. On-chain root: ${shortNumber(roots.data.onchainMtRoot)}.`
                : `ASP root ${shortNumber(roots.data.mtRoot)} vs on-chain root ${shortNumber(roots.data.onchainMtRoot)}: `}
          {roots.data && roots.data.mtRoot !== '0' && (
            <RootMatch matches={roots.data.mtRoot === roots.data.onchainMtRoot}>
              {roots.data.mtRoot === roots.data.onchainMtRoot ? 'in sync' : 'different (waiting for the next publish)'}
            </RootMatch>
          )}
        </Typography>

        {settings && (
          <Typography variant='body2' color='text.secondary' data-testid='asp-settings'>
            Auto-approve after {settings.autoApproveDelaySec} s · publish every {settings.publishIntervalSec} s · roots{' '}
            {settings.freezeRoots ? 'frozen' : 'not frozen'}
          </Typography>
        )}
      </Section>

      <TableContainer sx={{ borderTop: '1px solid', borderColor: 'grey.900', overflowX: 'auto' }}>
        <Table size='small' data-testid='asp-deposits-table'>
          <TableHead>
            <TableRow>
              <TableCell>Label</TableCell>
              <TableCell>Asset</TableCell>
              <TableCell align='right'>Value</TableCell>
              <TableCell>Depositor</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align='right'>Auto-approve in</TableCell>
              {token && <TableCell align='right'>Teacher</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((deposit) => {
              const secondsLeft = Math.max(0, Math.ceil(deposit.approveAt - serverNow));
              const busy = busyLabel === deposit.label;
              return (
                <TableRow key={deposit.label}>
                  <TableCell title={deposit.label}>{shortNumber(deposit.label)}</TableCell>
                  <TableCell>{deposit.symbol}</TableCell>
                  <TableCell align='right'>{formatValue(deposit)}</TableCell>
                  <TableCell title={deposit.depositor}>{truncateAddress(deposit.depositor)}</TableCell>
                  <TableCell>
                    <Chip size='small' label={deposit.status} color={STATUS_COLOR[deposit.status] ?? 'default'} />
                  </TableCell>
                  <TableCell align='right'>{deposit.status === 'pending' ? `${secondsLeft} s` : '—'}</TableCell>
                  {token && (
                    <TableCell align='right'>
                      {deposit.status !== 'exited' && (
                        <Stack direction='row' gap={1} justifyContent='end'>
                          <Button
                            size='small'
                            disabled={busy || deposit.status === 'approved'}
                            onClick={() => handleDecide(deposit.label, 'approve')}
                          >
                            Approve
                          </Button>
                          <Button
                            size='small'
                            disabled={busy || deposit.status === 'declined'}
                            onClick={() => handleDecide(deposit.label, 'decline')}
                          >
                            Decline
                          </Button>
                        </Stack>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={token ? 7 : 6}>
                  {deposits.isError
                    ? `Could not reach the Teaching ASP at ${aspUrl}: ${errorMessage(deposits.error)}`
                    : deposits.isLoading
                      ? 'Loading deposits...'
                      : 'No deposits yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Section width='100%' sx={{ borderTop: '1px solid', borderColor: 'grey.900' }}>
        {!token ? (
          <Stack direction='row' alignItems='center' gap={2} flexWrap='wrap'>
            <Button onClick={handleSignIn} disabled={signingIn || !aspUrl} data-testid='teacher-sign-in'>
              {signingIn ? 'Signing in...' : address ? 'Teacher sign-in' : 'Connect wallet for teacher sign-in'}
            </Button>
            {authError && (
              <Typography variant='body2' color='error' data-testid='teacher-auth-error'>
                {authError}
              </Typography>
            )}
          </Stack>
        ) : (
          <Stack gap={2} width='100%'>
            <Stack direction='row' alignItems='center' justifyContent='space-between'>
              <Typography variant='body2' fontWeight='bold'>
                Teacher controls
              </Typography>
              <Button size='small' onClick={() => signOut(null)}>
                Sign out
              </Button>
            </Stack>
            {form && (
              <Stack direction='row' gap={2} alignItems='center' flexWrap='wrap'>
                <TextField
                  size='small'
                  type='number'
                  label='Auto-approve delay (s)'
                  value={form.autoApproveDelaySec}
                  onChange={(e) => setForm({ ...form, autoApproveDelaySec: Number(e.target.value) })}
                  inputProps={{ min: 0, max: 86400, step: 1 }}
                />
                <TextField
                  size='small'
                  type='number'
                  label='Publish interval (s)'
                  value={form.publishIntervalSec}
                  onChange={(e) => setForm({ ...form, publishIntervalSec: Number(e.target.value) })}
                  inputProps={{ min: 0, max: 3600, step: 1 }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.freezeRoots}
                      onChange={(e) => setForm({ ...form, freezeRoots: e.target.checked })}
                    />
                  }
                  label='Freeze roots'
                />
                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? 'Saving...' : 'Save settings'}
                </Button>
              </Stack>
            )}
          </Stack>
        )}
      </Section>
    </PAContainer>
  );
};

const RootMatch = styled('span', { shouldForwardProp: (prop) => prop !== 'matches' })<{ matches: boolean }>(
  ({ theme, matches }) => ({
    fontWeight: 700,
    color: matches ? theme.palette.success.main : theme.palette.warning.main,
  }),
);

import { InfoOutlined } from '@mui/icons-material';
import { Box, Stack, styled, Typography } from '@mui/material';

export const ExitMessage = () => {
  return (
    <Container>
      <Stack flexDirection='row' alignItems={'center'} gap='0.8rem'>
        <InfoOutlined sx={{ width: '2.4rem', height: '2.4rem' }} />
        <Title>You&apos;re exiting the Pool</Title>
      </Stack>

      <Text>The exit returns your funds without privacy. Use the Withdraw for untraceability.</Text>
    </Container>
  );
};

const Container = styled(Box)(({ theme }) => ({
  border: '1px solid',
  borderColor: theme.palette.warning.main,
  background: theme.palette.warning.light,
  color: theme.palette.grey[900],
  padding: '1.6rem',
  gap: '0.8rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  borderRadius: '0.4rem',
  maxWidth: '31.2rem',
  zIndex: 1,
}));

const Title = styled(Typography)(({ theme }) => ({
  color: theme.palette.grey[900],
  fontSize: '1.4rem',
  fontWeight: 600,
  lineHeight: '140%',
}));

const Text = styled(Typography)(({ theme }) => ({
  color: theme.palette.grey[900],
  fontSize: '1.4rem',
  lineHeight: '140%',
  fontWeight: 400,
}));

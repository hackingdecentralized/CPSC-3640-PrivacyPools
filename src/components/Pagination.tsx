'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { Box, Pagination, PaginationItem, Typography, styled } from '@mui/material';

interface Props {
  numberOfItems: number;
  perPage: number;
}
export function SPagination({ numberOfItems = 10, perPage }: Props) {
  const { push } = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page') || 1);
  const totalPages = useMemo(() => Math.ceil(numberOfItems / perPage), [numberOfItems, perPage]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    push(`${pathname}?${params.toString()}`);
  };

  return (
    <>
      <SBox>
        <Pagination
          count={totalPages}
          page={currentPage}
          onChange={(_e, value) => handlePageChange(value)}
          hidePrevButton
          hideNextButton
          size='small'
          renderItem={(item) => <PaginationItem {...item} />}
        />
        <PageInfo variant='caption'>{`${currentPage} of ${totalPages}`}</PageInfo>
      </SBox>
    </>
  );
}

const SBox = styled(Box)({
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0 1rem',
  '& .MuiPagination-ul': {
    display: 'flex',
    width: '100%',
  },
  '& .MuiPaginationItem-root': {
    fontSize: '1rem',
    lineHeight: '1.25rem',
    color: '#737373',
    '&.Mui-selected': {
      backgroundColor: 'transparent',
      color: '#000000',
      '&:hover': {
        backgroundColor: 'transparent',
      },
    },
    '&:hover': {
      backgroundColor: 'transparent',
    },
  },
  '& .MuiPaginationItem-previousNext': {
    display: 'none',
  },
});

const PageInfo = styled(Typography)({
  fontSize: '1rem',
  fontWeight: 400,
  lineHeight: '1.25rem',
  padding: '0 1rem',
  textAlign: 'center',
  textTransform: 'uppercase',
});

import { BaseModal } from '~/components';
import { ModalType } from '~/types';
import { DepositForm } from './DepositForm';

export const DepositModal = () => {
  return (
    <BaseModal type={ModalType.DEPOSIT} hasBackground>
      <DepositForm />
    </BaseModal>
  );
};

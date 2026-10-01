import { BaseModal } from '~/components';
import { ModalType } from '~/types';
import { WithdrawForm } from './WithdrawForm';

export const WithdrawModal = () => {
  return (
    <BaseModal type={ModalType.WITHDRAW} hasBackground>
      <WithdrawForm />
    </BaseModal>
  );
};

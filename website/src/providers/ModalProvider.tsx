'use client';

import { createContext, Dispatch, SetStateAction, useState } from 'react';
import { usePoolAccountsContext } from '~/hooks';
import { ModalType } from '~/types';

type ContextType = {
  modalOpen: ModalType;
  setModalOpen: Dispatch<SetStateAction<ModalType>>;
  closeModal: () => void;

  isClosable: boolean;
  setIsClosable: (value: boolean) => void;
};

export const ModalContext = createContext({} as ContextType);

export const ModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [modalOpen, setModalOpen] = useState<ModalType>(ModalType.NONE);
  const [isClosable, setIsClosable] = useState(true);

  const { resetTransactionState, resetInputs } = usePoolAccountsContext();

  const closeModal = () => {
    setModalOpen(ModalType.NONE);
    resetTransactionState();
    resetInputs();
  };

  return (
    <ModalContext.Provider
      value={{
        modalOpen,
        setModalOpen,
        closeModal,
        isClosable,
        setIsClosable,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

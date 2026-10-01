import { Metadata } from 'next';
import { AdvancedViewContainer } from '~/components';
import { defaultMetadata } from '~/config';
import { AssociationSet } from '~/containers/AssociationSet';

export const metadata: Metadata = { ...defaultMetadata, title: 'Association Set | Privacy Pools' };

const AssociationSetPage = () => {
  return (
    <AdvancedViewContainer>
      <AssociationSet />
    </AdvancedViewContainer>
  );
};

export default AssociationSetPage;

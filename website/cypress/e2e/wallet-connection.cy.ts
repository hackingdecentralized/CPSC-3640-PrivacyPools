describe.skip('Wallet Connection', () => {
  beforeEach(() => {
    cy.interceptAllRequests();
    cy.visit('/');
  });

  it('should show connect wallet button when not connected', () => {
    cy.getByTestId('connect-wallet-button').should('be.visible');
  });

  it('should open wallet modal when clicking connect button', () => {
    cy.getByTestId('connect-wallet-button').click();
    cy.getByTestId('wallet-modal').should('be.visible');
  });

  it('should connect wallet', () => {
    cy.getByTestId('connect-wallet-button').click();
    cy.getByTestId('wallet-option-mock').click();

    // Verify connected state
    cy.getByTestId('account-menu-button').click();
  });
});

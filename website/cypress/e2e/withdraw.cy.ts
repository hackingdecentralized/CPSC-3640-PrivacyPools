describe('Withdrawals', () => {
  beforeEach(() => {
    cy.interceptAllRequests();
    cy.visit('/');
  });

  it.skip('should allow to withdraw', () => {
    cy.connectWallet();
    cy.getByTestId('create-account').click();
    cy.url().should('include', '/create');

    cy.getByTestId('passphrase-input').type('1231231232132Aa.*');
    cy.getByTestId('confirm-passphrase-input').type('1231231232132Aa.*');
    cy.getByTestId('create-account-button').click();
    cy.getByTestId('deposit-button').click();
    cy.getByTestId('deposit-input').type('0.3');
    cy.getByTestId('confirm-deposit-button').click();
    cy.getByTestId('confirm-review-button').click();
    cy.getByTestId('success-title').should('be.visible');
    cy.getByTestId('download-button').click();
    cy.getByTestId('security-check').click();
    cy.getByTestId('go-to-dashboard-button').click();

    cy.getByTestId('withdraw-button').click();
    cy.getByTestId('withdrawal-amount-input').type('0.1');
    cy.getByTestId('target-address-input').type('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    cy.getByTestId('confirm-withdrawal-button').click();
    cy.getByTestId('confirm-review-button').click();
    cy.getByTestId('success-title').should('be.visible');
    cy.getByTestId('download-button').click();
    cy.getByTestId('security-check').click();
    cy.getByTestId('go-to-dashboard-button').click();
  });
});

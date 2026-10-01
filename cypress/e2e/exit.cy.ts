describe('Exit', () => {
  beforeEach(() => {
    cy.interceptAllRequests();
    cy.visit('/');
  });

  it.skip('should allow to exit', () => {
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

    cy.getByTestId('dotted-menu').click();
    cy.getByTestId('dotted-menu-exit').click();
    cy.getByTestId('confirm-review-button').click();
    cy.getByTestId('success-title').should('be.visible');
    cy.getByTestId('download-button').click();
    cy.getByTestId('security-check').click();
    cy.getByTestId('go-to-dashboard-button').click();
  });
});

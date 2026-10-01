describe.skip('Deposits', () => {
  beforeEach(() => {
    cy.interceptAllRequests();
    cy.visit('/');
  });

  it('should allow deposit from the created history file page', () => {
    cy.connectWallet();
    cy.getByTestId('create-account').click();
    cy.url().should('include', '/create');

    cy.getByTestId('passphrase-input').type('1231231232132Aa.*');
    cy.getByTestId('confirm-passphrase-input').type('1231231232132Aa.*');
    cy.getByTestId('create-account-button').click();
    cy.getByTestId('deposit-button').click();
    cy.getByTestId('deposit-input').type('0.1');
    cy.getByTestId('confirm-deposit-button').click();
    cy.getByTestId('confirm-review-button').click();
    cy.getByTestId('success-title').should('be.visible');
    cy.getByTestId('download-button').click();
    cy.getByTestId('security-check').click();
    cy.getByTestId('go-to-dashboard-button').click();
  });

  it('should allow deposit from the dashboard', () => {
    cy.connectWallet();
    cy.getByTestId('create-account').click();
    cy.url().should('include', '/create');

    cy.getByTestId('passphrase-input').type('1231231232132Aa.*');
    cy.getByTestId('confirm-passphrase-input').type('1231231232132Aa.*');
    cy.getByTestId('create-account-button').click();
    cy.getByTestId('return-to-dashboard-button').click();
    cy.getByTestId('deposit-button').click();
    cy.getByTestId('deposit-input').type('0.1');
    cy.getByTestId('confirm-deposit-button').click();
    cy.getByTestId('confirm-review-button').click();
    cy.getByTestId('success-title').should('be.visible');
    cy.getByTestId('download-button').click();
    cy.getByTestId('security-check').click();
    cy.getByTestId('go-to-dashboard-button').click();
  });
});

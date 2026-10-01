describe.skip('Sign in', () => {
  beforeEach(() => {
    cy.interceptAllRequests();
    cy.visit('/');
  });

  it('should show the welcome message', () => {
    cy.connectWallet();
    cy.getByTestId('welcome-message').should('be.visible');
  });
});

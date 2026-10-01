describe.skip('Renders every component', () => {
  it('Renders App component', () => {
    cy.visit('/');
    cy.getByTestId('main-content').should('exist');
  });
});

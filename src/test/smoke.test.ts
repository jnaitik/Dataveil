import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('Dataveil Phase 2 Smoke Test', () => {
  it('runs unit tests with Vitest successfully', () => {
    expect(1 + 1).toBe(2);
  });

  it('renders a DOM element via React Testing Library', () => {
    render(React.createElement('div', { 'data-testid': 'smoke-target' }, 'Dataveil Ready'));
    expect(screen.getByTestId('smoke-target')).toHaveTextContent('Dataveil Ready');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

describe('Phase 5 Profile UI In-Browser Simulation Test', () => {
  it('renders the application shell and allows loading the Monthly Sales sample', async () => {
    render(<App />);

    // 1. Verify App Header and Status Panel
    expect(screen.getByText('Dataveil')).toBeInTheDocument();
    expect(screen.getByText('Private CSV Explainer')).toBeInTheDocument();
    expect(screen.getByText('📊 Profile Module (Zero AI)')).toBeInTheDocument();

    // 2. Click the Monthly Sales sample dataset card
    const sampleBtn = screen.getByText('Monthly Sales Export (Fictional)');
    expect(sampleBtn).toBeInTheDocument();
    fireEvent.click(sampleBtn);

    // 3. Verify that the Profile Dashboard mounts with local zero-AI data
    await waitFor(() => {
      expect(screen.getByText('monthly-sales.csv')).toBeInTheDocument();
      expect(screen.getByText('Parsed Locally (No AI)')).toBeInTheDocument();
    });

    // 4. Verify KPI Cards
    expect(screen.getByText('Total Rows')).toBeInTheDocument();
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.getByText('Columns')).toBeInTheDocument();
    expect(screen.getAllByText('6').length).toBeGreaterThan(0);
    expect(screen.getByText('100% Clean')).toBeInTheDocument();

    // 5. Verify Column Schema Table & Preview
    expect(screen.getByText('Column Profiles & Statistical Summaries')).toBeInTheDocument();
    expect(screen.getAllByText('UnitsSold').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Revenue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ProductCategory').length).toBeGreaterThan(0);

    // 6. Verify Local Data Preview Table
    expect(screen.getByText('Local Data Preview')).toBeInTheDocument();

    // 7. Verify switching tabs to the Hybrid AI Verification Gate
    const gateTab = screen.getByText('🔒 Hybrid AI Verification Gate');
    fireEvent.click(gateTab);

    expect(screen.getByText('Phase 4 Verification Gate')).toBeInTheDocument();
    expect(screen.getByText('Run On-Device (Private Mode)')).toBeInTheDocument();
  });
});

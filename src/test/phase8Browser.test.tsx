import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

describe('Phase 8 In-Browser Live Test Matrix Execution', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('dataveil_onboarding_dismissed', 'true');
  });

  it('navigates to Test Matrix tab, executes all 10 scenarios live, and audits filter pills', async () => {
    render(<App />);

    // 1. Locate and click on the 🧪 Test Matrix tab in the navigation bar
    const matrixTab = screen.getByRole('tab', { name: /Test Matrix/i });
    expect(matrixTab).toBeInTheDocument();
    fireEvent.click(matrixTab);

    // 2. Assert Test Matrix view loaded
    expect(
      screen.getByText('Hackathon 10-Scenario Test Matrix & Network Privacy Inspector')
    ).toBeInTheDocument();

    // 3. Verify the 3 Network Privacy Shield cards are present
    expect(screen.getByText('0 Requests')).toBeInTheDocument();
    expect(screen.getByText('0 Records')).toBeInTheDocument();
    expect(screen.getByText('0 / 10 Passed')).toBeInTheDocument();

    // 4. Verify initial status of scenarios (all Ready to Run)
    const readyBadges = screen.getAllByText('⚪ Ready to Run');
    expect(readyBadges.length).toBe(10);

    // 5. Click the "Run All 10 Test Scenarios" button
    const runBtn = screen.getByRole('button', { name: /Run All 10 Test Scenarios/i });
    expect(runBtn).toBeInTheDocument();
    fireEvent.click(runBtn);

    // 6. Wait for all 10 scenarios to execute and pass live
    await waitFor(
      () => {
        expect(screen.getByTestId('matrix-passed-count')).toHaveTextContent('10 / 10 Passed');
      },
      { timeout: 5000 }
    );

    // 7. Verify all 10 scenarios show passed badges and verification outputs
    const passedBadges = screen.getAllByText(/✓ PASSED/i);
    expect(passedBadges.length).toBe(10);

    expect(screen.getByText(/52 MB correctly flagged > 50 MB limit/i)).toBeInTheDocument();
    expect(screen.getByText(/Byte Order Mark \\uFEFF cleanly stripped/i)).toBeInTheDocument();
    expect(screen.getByText(/Email column auto-excluded; zero raw email addresses/i)).toBeInTheDocument();
    expect(screen.getByText(/Routed to InferenceMode.ONLY_ON_DEVICE without consent/i)).toBeInTheDocument();
    expect(screen.getByText(/Recharts and math engine computed exact sum 300 offline/i)).toBeInTheDocument();

    // 8. Test Category Filter Buttons
    const parsingFilter = screen.getByRole('button', { name: 'Parsing' });
    fireEvent.click(parsingFilter);
    expect(screen.getByText('Showing 4 Scenarios')).toBeInTheDocument();

    const privacyFilter = screen.getByRole('button', { name: 'Privacy' });
    fireEvent.click(privacyFilter);
    expect(screen.getByText('Showing 2 Scenarios')).toBeInTheDocument();

    const hybridFilter = screen.getByRole('button', { name: 'Hybrid AI' });
    fireEvent.click(hybridFilter);
    expect(screen.getByText('Showing 3 Scenarios')).toBeInTheDocument();

    const networkFilter = screen.getByRole('button', { name: 'Network' });
    fireEvent.click(networkFilter);
    expect(screen.getByText('Showing 1 Scenarios')).toBeInTheDocument();

    const allFilter = screen.getByRole('button', { name: 'All' });
    fireEvent.click(allFilter);
    expect(screen.getByText('Showing 10 Scenarios')).toBeInTheDocument();
  }, 15000);
});

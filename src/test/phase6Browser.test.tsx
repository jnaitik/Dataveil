import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

describe('Phase 6 Complete In-Browser Multi-Module Verification', () => {
  it('executes the full user journey across Profile, Explain, Suggested Charts, and Ask modules', async () => {
    render(<App />);

    // 1. Load the Monthly Sales Sample
    const sampleBtn = screen.getByText('Monthly Sales Export (Fictional)');
    fireEvent.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByText('monthly-sales.csv')).toBeInTheDocument();
    });

    // Verify all 4 tabs are present in navigation
    expect(screen.getByText('📊 Profile (No AI)')).toBeInTheDocument();
    expect(screen.getByText('💡 Explain Columns (AI)')).toBeInTheDocument();
    expect(screen.getByText('📈 Suggested Charts (AI)')).toBeInTheDocument();
    expect(screen.getByText('💬 Ask (AI + Code)')).toBeInTheDocument();

    // 2. Test Module 2: Explain Columns (AI)
    const explainTab = screen.getByText('💡 Explain Columns (AI)');
    fireEvent.click(explainTab);

    // Verify "What the AI will see" preview panel exists
    expect(screen.getByText('What the AI Will See')).toBeInTheDocument();
    expect(screen.getByText('Explain Dataset')).toBeInTheDocument();

    // Click Explain Dataset (In test env without on-device Prompt API, triggers Consent Card)
    const explainBtn = screen.getByText('Explain Dataset');
    fireEvent.click(explainBtn);

    // Assert that the Consent Card appears with the exact preview (Privacy proof)
    await waitFor(() => {
      expect(screen.getByText('Cloud Inference Consent Required')).toBeInTheDocument();
    });

    // Grant one-time consent to execute
    const consentBtn = screen.getByText('Use cloud for this request (one time)');
    fireEvent.click(consentBtn);

    await waitFor(() => {
      expect(screen.getByText('AI Explanation')).toBeInTheDocument();
    });

    // 3. Test Module 3: Suggested Charts (AI)
    const chartsTab = screen.getByText('📈 Suggested Charts (AI)');
    fireEvent.click(chartsTab);

    expect(screen.getByText('Suggested Charts')).toBeInTheDocument();
    expect(screen.getByText('Suggest AI Charts')).toBeInTheDocument();

    // 4. Test Module 4: Ask (AI Maps, Code Calculates)
    const askTab = screen.getByText('💬 Ask (AI + Code)');
    fireEvent.click(askTab);

    expect(screen.getByText('Ask Your Data (AI Maps, Code Calculates)')).toBeInTheDocument();

    // Ask a question via suggestion pill
    const countPill = screen.getByText('Count of records');
    fireEvent.click(countPill);

    const askBtn = screen.getByRole('button', { name: 'Ask' });
    fireEvent.click(askBtn);

    // In test env, triggers consent card
    await waitFor(() => {
      expect(screen.getByText('Cloud Inference Consent Required')).toBeInTheDocument();
    });
    const askConsent = screen.getByText('Use cloud for this request (one time)');
    fireEvent.click(askConsent);

    await waitFor(() => {
      expect(screen.getByText('Executed Operation')).toBeInTheDocument();
      expect(screen.getByText('Exact Result')).toBeInTheDocument();
    });

    // Verify deterministic execution computed the exact number (1,810 units sold)
    expect(screen.getByText('1,810')).toBeInTheDocument();

    // 5. Test Under the Hood Inspector
    const inspectorBtn = screen.getByText('Under the Hood: Real Request Inspector');
    fireEvent.click(inspectorBtn);

    await waitFor(() => {
      expect(screen.getByText('Roundtrip Latency')).toBeInTheDocument();
      expect(screen.getByText('Payload Size')).toBeInTheDocument();
    });
  });
});

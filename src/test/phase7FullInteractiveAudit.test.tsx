import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

describe('Phase 7 Comprehensive Full-App Browser Interaction & Button Audit', () => {
  beforeEach(() => {
    localStorage.clear();
    // Suppress auto-open on initial load so we can test explicit button clicking
    localStorage.setItem('dataveil_onboarding_dismissed', 'true');

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  it('audits every single interactive button, modal, tab, and control across Dataveil', async () => {
    render(<App />);

    // ==========================================
    // 1. HEADER & TOP NAVIGATION BUTTONS AUDIT
    // ==========================================
    expect(screen.getByText('Dataveil')).toBeInTheDocument();

    // A. Nano Setup Button in Header
    const nanoSetupBtns = screen.getAllByRole('button', { name: /Nano Setup/i });
    expect(nanoSetupBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(nanoSetupBtns[0]);

    // Verify OnboardingModal opened
    const onboardingDialog = screen.getByRole('dialog', { name: /Chrome Gemini Nano Onboarding/i });
    expect(onboardingDialog).toBeInTheDocument();

    // Click "Copy URL" buttons inside OnboardingModal
    const copyFlagBtns = screen.getAllByRole('button', { name: /Copy URL/i });
    expect(copyFlagBtns.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(copyFlagBtns[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('chrome://flags/#prompt-api-for-gemini-nano');

    // Click "Run Diagnostic" button inside OnboardingModal
    const diagBtn = screen.getByRole('button', { name: /Run Diagnostic/i });
    fireEvent.click(diagBtn);
    await waitFor(() => {
      expect(screen.getByText(/Result:/i)).toBeInTheDocument();
    });

    // Close OnboardingModal via "Got It" button
    const gotItBtn = screen.getByRole('button', { name: /Got It/i });
    fireEvent.click(gotItBtn);
    expect(screen.queryByRole('dialog', { name: /Chrome Gemini Nano Onboarding/i })).not.toBeInTheDocument();

    // B. Privacy Policy Button in Header
    const privacyBtn = screen.getByRole('button', { name: /Open Data Privacy/i });
    fireEvent.click(privacyBtn);

    // Verify DataPrivacyModal opened
    const privacyDialog = screen.getByRole('dialog', { name: /How Dataveil Handles Your Data/i });
    expect(privacyDialog).toBeInTheDocument();
    expect(screen.getByText('99.99% Data Reduction Ratio')).toBeInTheDocument();

    // Close DataPrivacyModal via "Close" button
    const closePrivacyBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closePrivacyBtn);
    expect(screen.queryByRole('dialog', { name: /How Dataveil Handles Your Data/i })).not.toBeInTheDocument();

    // C. Mode Switcher Toggle Button (Private <-> Auto)
    const modeBtn = screen.getByRole('button', { name: /Toggle inference mode/i });
    expect(screen.getByText('Private (On-Device)')).toBeInTheDocument();
    fireEvent.click(modeBtn);
    expect(screen.getByText('Auto (Hybrid)')).toBeInTheDocument();
    fireEvent.click(modeBtn);
    expect(screen.getByText('Private (On-Device)')).toBeInTheDocument();

    // ==========================================
    // 2. HYBRID FLOW PIPELINE BANNER AUDIT
    // ==========================================
    const pipelineStages = [
      'Local CSV File',
      'Web Worker Profiler',
      'Privacy Sanitizer',
      'Hybrid Inference',
      'Deterministic Output',
    ];

    for (let i = 0; i < pipelineStages.length; i++) {
      const stageBtn = screen.getByRole('button', { name: new RegExp(pipelineStages[i], 'i') });
      fireEvent.click(stageBtn);
      expect(screen.getByText(new RegExp(`Stage ${i + 1} Deep-Dive:`, 'i'))).toBeInTheDocument();
    }

    // Dismiss the active stage deep dive
    const dismissStageBtn = screen.getByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissStageBtn);
    expect(screen.queryByText(/Deep-Dive:/i)).not.toBeInTheDocument();

    // ==========================================
    // 3. DATASET LOADING & PROFILE MODULE AUDIT
    // ==========================================
    // Click sample dataset button: "Monthly Sales Export (Fictional)"
    const sampleBtn = screen.getByRole('button', { name: /Monthly Sales Export/i });
    fireEvent.click(sampleBtn);

    // Verify Profile loaded
    await waitFor(() => {
      expect(screen.getByText('monthly-sales.csv')).toBeInTheDocument();
    });

    // Verify 4 KPI summary cards are present
    expect(screen.getAllByText('12')[0]).toBeInTheDocument(); // Row count
    expect(screen.getAllByText('6')[0]).toBeInTheDocument();  // Column count
    expect(screen.getByText('100% Clean')).toBeInTheDocument();

    // Verify navigation tabs now include all 4 modules
    const explainTabBtn = screen.getByRole('tab', { name: /Explain Columns/i });
    const chartsTabBtn = screen.getByRole('tab', { name: /Suggested Charts/i });
    const askTabBtn = screen.getByRole('tab', { name: /Ask \(AI \+ Code\)/i });
    const gateTabBtn = screen.getByRole('tab', { name: /Verification Gate/i });

    expect(explainTabBtn).toBeInTheDocument();
    expect(chartsTabBtn).toBeInTheDocument();
    expect(askTabBtn).toBeInTheDocument();
    expect(gateTabBtn).toBeInTheDocument();

    // ==========================================
    // 4. EXPLAIN COLUMNS (AI) MODULE AUDIT
    // ==========================================
    fireEvent.click(explainTabBtn);
    expect(screen.getByText('Plain-Language Dataset Explanation')).toBeInTheDocument();

    // A. Payload Inspector Toggle Button
    const inspectPayloadBtn = screen.getByRole('button', { name: /Inspect Payload/i });
    fireEvent.click(inspectPayloadBtn);
    expect(screen.getByText(/What the AI Will See/i)).toBeInTheDocument();
    expect(screen.getByText(/Column Privacy Filters:/i)).toBeInTheDocument();
    // Toggle close
    fireEvent.click(screen.getByRole('button', { name: /Hide Payload/i }));

    // B. Trigger Explanation & Consent Flow
    const explainActionBtn = screen.getByRole('button', { name: 'Explain Dataset' });
    fireEvent.click(explainActionBtn);

    // Verify Consent Card appears
    await waitFor(() => {
      expect(screen.getByText('Cloud Inference Consent Required')).toBeInTheDocument();
    });

    // Click Consent Button
    const explainConsentBtn = screen.getByRole('button', { name: 'Use cloud for this request (one time)' });
    fireEvent.click(explainConsentBtn);

    // Verify explanation generated and displayed
    await waitFor(() => {
      expect(screen.getByText('AI Explanation')).toBeInTheDocument();
      expect(screen.getByText(/Column Significance/i)).toBeInTheDocument();
    });

    // C. Copy Button on Explanation
    const copyExplainBtn = screen.getByRole('button', { name: /Copy/i });
    fireEvent.click(copyExplainBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(screen.getByText('✓ Copied!')).toBeInTheDocument();

    // D. Throttling Cooldown Check
    fireEvent.click(screen.getByRole('button', { name: 'Explain Dataset' }));
    await waitFor(() => {
      expect(screen.getByText(/Please wait a moment between requests to avoid duplicate processing/i)).toBeInTheDocument();
    });

    // ==========================================
    // 5. SUGGESTED CHARTS (AI) MODULE AUDIT
    // ==========================================
    fireEvent.click(chartsTabBtn);
    expect(screen.getByText('Suggested Charts')).toBeInTheDocument();

    // A. Chart Category Filter Buttons
    const barFilterBtn = screen.getByRole('button', { name: 'bar' });
    const lineFilterBtn = screen.getByRole('button', { name: 'line' });
    const allFilterBtn = screen.getByRole('button', { name: 'all' });

    fireEvent.click(barFilterBtn);
    fireEvent.click(lineFilterBtn);
    fireEvent.click(allFilterBtn);

    // B. Suggest AI Charts Trigger & Consent
    const suggestChartsBtn = screen.getByRole('button', { name: 'Suggest AI Charts' });
    fireEvent.click(suggestChartsBtn);

    await waitFor(() => {
      expect(screen.getByText('Cloud Inference Consent Required')).toBeInTheDocument();
    });

    const chartConsentBtn = screen.getByRole('button', { name: 'Use cloud for this request (one time)' });
    fireEvent.click(chartConsentBtn);

    await waitFor(() => {
      expect(screen.getByText(/Revenue Distribution by Region|Frequency Density/i)).toBeInTheDocument();
    });

    // ==========================================
    // 6. ASK (AI + CODE) MODULE AUDIT
    // ==========================================
    fireEvent.click(askTabBtn);
    expect(screen.getByText('Ask Your Data (AI Maps, Code Calculates)')).toBeInTheDocument();

    // A. Quick Query Suggestion Pill Click
    const countPill = screen.getByRole('button', { name: 'Count of records' });
    fireEvent.click(countPill);

    // B. Execute Query & Consent
    const askActionBtn = screen.getByRole('button', { name: 'Ask' });
    fireEvent.click(askActionBtn);

    await waitFor(() => {
      expect(screen.getByText('Cloud Inference Consent Required')).toBeInTheDocument();
    });

    const askConsentBtn = screen.getByRole('button', { name: 'Use cloud for this request (one time)' });
    fireEvent.click(askConsentBtn);

    // Verify Deterministic Result
    await waitFor(() => {
      expect(screen.getByText('Executed Operation')).toBeInTheDocument();
      expect(screen.getByText('Exact Result')).toBeInTheDocument();
    });

    // C. Copy Result Button
    const copyResultBtn = screen.getByRole('button', { name: /Copy/i });
    fireEvent.click(copyResultBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();

    // D. Manual Query Builder Fallback Toggle Button
    const manualToggleBtn = screen.getByRole('button', { name: /Prefer to build queries manually/i });
    fireEvent.click(manualToggleBtn);
    expect(screen.getByText('Deterministic Query Builder (Zero AI)')).toBeInTheDocument();

    const manualRunBtn = screen.getByRole('button', { name: 'Execute Manual Query' });
    expect(manualRunBtn).toBeInTheDocument();
    fireEvent.click(manualRunBtn);

    // ==========================================
    // 7. VERIFICATION GATE TAB AUDIT
    // ==========================================
    fireEvent.click(gateTabBtn);
    expect(screen.getByText('Hybrid AI Gate & Consent Inspector')).toBeInTheDocument();
    expect(screen.getByText('Phase 4 Verification Gate')).toBeInTheDocument();

    // Toggle simulate device unavailable checkbox
    const simulateCheckbox = screen.getByRole('checkbox', { name: /Simulate device unavailable/i });
    expect(simulateCheckbox).toBeInTheDocument();
    fireEvent.click(simulateCheckbox);

    // Click Run On-Device button
    const runGateBtn = screen.getByRole('button', { name: /Run On-Device/i });
    fireEvent.click(runGateBtn);

    // Verify Consent Card appears
    await waitFor(() => {
      expect(screen.getByText('Cloud Inference Consent Required')).toBeInTheDocument();
    });

    // ==========================================
    // 8. PERSISTENT TELEMETRY DRAWER AUDIT
    // ==========================================
    const underTheHoodBtn = screen.getByRole('button', { name: /Under the Hood/i });
    expect(underTheHoodBtn).toBeInTheDocument();
    fireEvent.click(underTheHoodBtn);

    // Assert drawer content
    expect(screen.getByText('Roundtrip Latency')).toBeInTheDocument();
    expect(screen.getByText('Payload Size')).toBeInTheDocument();
    expect(screen.getByText('Inference Source (Real)')).toBeInTheDocument();
    expect(screen.getByText(/Judging Note:/i)).toBeInTheDocument();

    // Toggle close
    fireEvent.click(underTheHoodBtn);
  });
});

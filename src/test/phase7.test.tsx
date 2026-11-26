import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingModal } from '../components/OnboardingModal';
import { DataPrivacyModal } from '../components/DataPrivacyModal';
import { HybridFlowBanner } from '../components/HybridFlowBanner';
import { ExplainTab } from '../features/explain/ExplainTab';
import { profileCsvData } from '../csv/profiler';
import App from '../App';

describe('Phase 7 UI/UX Polish, Accessibility & Reliability Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  it('verifies OnboardingModal renders, copies flags, runs diagnostic, and closes', async () => {
    const handleClose = vi.fn();
    render(<OnboardingModal isOpen={true} onClose={handleClose} />);

    // Assert accessible dialog semantics
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Chrome Gemini Nano Onboarding')).toBeInTheDocument();

    // Verify Copy Flag URLs
    const copyBtns = screen.getAllByText('📋 Copy URL');
    expect(copyBtns.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(copyBtns[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('chrome://flags/#prompt-api-for-gemini-nano');

    // Run Live Diagnostic
    const runDiagBtn = screen.getByText('Run Diagnostic');
    fireEvent.click(runDiagBtn);

    await waitFor(() => {
      expect(screen.getByText(/Result:/i)).toBeInTheDocument();
    });

    // Close Modal via Got It button
    const gotItBtn = screen.getByText('Got It');
    fireEvent.click(gotItBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('verifies DataPrivacyModal renders comparative architecture and closes on Escape', () => {
    const handleClose = vi.fn();
    render(<DataPrivacyModal isOpen={true} onClose={handleClose} />);

    expect(screen.getByText('How Dataveil Handles Your Data')).toBeInTheDocument();
    expect(screen.getByText('99.99% Data Reduction Ratio')).toBeInTheDocument();
    expect(screen.getByText('❌ Traditional Cloud AI Tools')).toBeInTheDocument();
    expect(screen.getByText('✅ Dataveil Hybrid AI')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  it('verifies HybridFlowBanner renders all 5 pipeline stages and allows deep-dive toggle', () => {
    render(<HybridFlowBanner />);

    expect(screen.getByText('Local CSV File')).toBeInTheDocument();
    expect(screen.getByText('Web Worker Profiler')).toBeInTheDocument();
    expect(screen.getByText('Privacy Sanitizer')).toBeInTheDocument();
    expect(screen.getByText('Hybrid Inference')).toBeInTheDocument();
    expect(screen.getByText('Deterministic Output')).toBeInTheDocument();

    // Click on Privacy Sanitizer
    const privacyBtn = screen.getByText('Privacy Sanitizer');
    fireEvent.click(privacyBtn);

    expect(screen.getByText(/Stage 3 Deep-Dive:/i)).toBeInTheDocument();
  });

  it('verifies request throttling in ExplainTab', async () => {
    const profile = profileCsvData(
      'sample.csv',
      ['Item', 'Qty', 'Price'],
      [
        ['Widget A', '10', '25.0'],
        ['Widget B', '20', '50.0'],
      ],
      100
    );

    render(
      <ExplainTab
        profile={profile}
        preferredMode="private"
        onLogUpdate={vi.fn()}
      />
    );

    const explainBtn = screen.getByText('Explain Dataset');

    // First click triggers consent requirement in private mode
    fireEvent.click(explainBtn);

    await waitFor(() => {
      expect(screen.getByText('Cloud Inference Consent Required')).toBeInTheDocument();
    });

    const consentBtn = screen.getByText('Use cloud for this request (one time)');
    fireEvent.click(consentBtn);

    // Wait for the first analysis to complete and button to be active
    await waitFor(() => {
      expect(screen.getByText('AI Explanation')).toBeInTheDocument();
    });

    // Rapid second click within 2000ms cooldown window
    fireEvent.click(screen.getByText('Explain Dataset'));

    await waitFor(() => {
      expect(
        screen.getByText(/Please wait a moment between requests to avoid duplicate processing/i)
      ).toBeInTheDocument();
    });
  });

  it('verifies accessibility roles and attributes across the App shell', () => {
    render(<App />);

    // Tablist exists with role="tablist"
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    expect(tablist).toHaveAttribute('aria-label', 'Application Modules');

    // Tabs have role="tab"
    const profileTab = screen.getByRole('tab', { name: /Profile/i });
    expect(profileTab).toHaveAttribute('aria-selected', 'true');

    const gateTab = screen.getByRole('tab', { name: /Verification Gate/i });
    expect(gateTab).toHaveAttribute('aria-selected', 'false');
  });
});

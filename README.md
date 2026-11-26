# Dataveil 🛡️📊
### Private CSV Explainer powered by Chrome Gemini Nano & Firebase Hybrid AI Logic

[![Firebase](https://img.shields.io/badge/Firebase-AI%20Logic%20Hybrid-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Chrome Gemini Nano](https://img.shields.io/badge/Chrome-Gemini%20Nano%20On--Device-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/ai/built-in)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Tests-53%20Passed-10B981?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Built for the **Google Firebase #BuildHybridAI Hackathon 2026**  
> *Devpost: [https://firebasehybridaihackathon.devpost.com/](https://firebasehybridaihackathon.devpost.com/)*

---

## 🌟 Overview

**Dataveil** is an enterprise-grade, privacy-first web application for exploring and understanding CSV data up to **50 MB (~500,000 rows)** without exposing sensitive enterprise records to external cloud servers.

By coupling a **client-side Web Worker** for streaming chunk parsing and deterministic statistical math with **Chrome's built-in Gemini Nano (`firebase/ai` on-device)**, Dataveil guarantees that:
1. **Zero raw CSV data rows or cell records** ever reach an AI model or cloud server.
2. **AI never calculates math or summaries** — all statistics, IQR outlier bounds, distributions, and sums are computed deterministically in local JavaScript.
3. **On-device inference is the strict default** (`InferenceMode.ONLY_ON_DEVICE`). Cloud fallback (`InferenceMode.PREFER_IN_CLOUD`) is physically intercepted until the user clicks explicit **One-Time Consent** on the Consent Card preview.
4. **Zero persistence of CSV data or AI outputs** in Firestore or cloud storage.

---

## 🏗️ System Architecture & Privacy Contract

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATAVEIL CLIENT (BROWSER)                       │
│                                                                        │
│   ┌───────────────────┐               ┌────────────────────────────┐   │
│   │   User Upload     │               │     Web Worker Engine      │   │
│   │ (CSV up to 50 MB) │ ────────────> │  • PapaParse chunk stream  │   │
│   └───────────────────┘               │  • Type inference (5 types)│   │
│                                       │  • Deterministic IQR stats │   │
│                                       └──────────────┬─────────────┘   │
│                                                      │                 │
│                                       ┌──────────────▼─────────────┐   │
│                                       │ Statistical Summary Profile│   │
│                                       │ (Columns, Min/Max/Mean,IQR)│   │
│                                       └──────────────┬─────────────┘   │
│                                                      │                 │
│                                       ┌──────────────▼─────────────┐   │
│                                       │      AI Payload Builder    │   │
│                                       │  • Excludes PII by default │   │
│                                       │  • ZERO raw data cells     │   │
│                                       └──────────────┬─────────────┘   │
│                                                      │                 │
│                       ┌──────────────────────────────┴──────────┐      │
│                       ▼                                         ▼      │
│          ┌─────────────────────────┐               ┌─────────────────┐ │
│          │   Inference Router      │               │ Local Execution │ │
│          │   (Private vs Auto)     │               │ • Recharts 2.x  │ │
│          └────────────┬────────────┘               │ • Local Math    │ │
│                       │                            └─────────────────┘ │
│           ┌───────────┴───────────┐                                    │
│           ▼                       ▼                                    │
│  [On-Device Available]    [On-Device Unavailable]                      │
│           │                       │                                    │
│           ▼                       ▼                                    │
│  ┌─────────────────┐      ┌───────────────────────────┐                │
│  │  Gemini Nano    │      │  Consent Card Security    │                │
│  │ (ONLY_ON_DEVICE)│      │  Gate Interception        │                │
│  └─────────────────┘      └─────────────┬─────────────┘                │
│                                         │                              │
│                         ┌───────────────┴───────────────┐              │
│                         ▼                               ▼              │
│                   [Declined]                       [Granted]           │
│                         │                               │              │
│                         ▼                               ▼              │
│                Stays 100% Local              ┌──────────────────────┐  │
│                0 Outbound Packets            │ Firebase AI Logic    │  │
│                                              │ (PREFER_IN_CLOUD)    │  │
│                                              └──────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Core Features

### 1. 📊 Profile Module (Zero AI)
- **Streaming Web Worker Parser**: Processes up to 50 MB / 500,000 rows without blocking the main UI thread.
- **Deterministic Statistical Profiling**: Inferred column data types (`number`, `text`, `date`, `boolean`, `mixed`), missing value rates, unique counts, min, max, mean, median, standard deviation, and Tukey IQR outlier detection.
- **Interactive Visualizations**: Instant time-series line charts and categorical frequency histograms generated via Recharts without any AI calls.
- **Sensitive PII Detection**: Proactively flags emails, SSNs, phone numbers, and passport/credit card patterns.

### 2. 💡 Explain Columns (AI-Assisted Metadata)
- Uses Chrome Gemini Nano to explain semantic column meanings, intended domain roles, business use-cases, and data quality red flags.
- **Strict Budget Guard**: Enforces payload size limits (e.g. 1,000 characters). PII columns are automatically excluded from the prompt summary.
- **Provenance Transparency**: Every response displays an explicit provenance badge (`ON_DEVICE` or `IN_CLOUD`), real execution latency in milliseconds, and the exact token/character count.

### 3. 📈 Suggested Charts (AI Schema Mapping)
- Gemini analyzes column types and distributions to propose high-value chart specifications (Bar, Line, Histogram).
- **Zero Hallucination Math**: Gemini only suggests the chart type and axis bindings; all aggregation data points are calculated deterministically by local JavaScript.

### 4. 💬 Ask (AI Natural Language to Deterministic Code Execution)
- Ask natural language questions like *"What were total sales in the West region?"* or *"What is the average transaction amount?"*.
- Gemini outputs a strictly validated structured JSON query operation (`sum`, `average`, `count`, `min`, `max`, `filter`).
- A deterministic JavaScript execution engine computes the scalar answer over the local CSV data.

### 5. 🔒 Verification Gate & Consent Card
- Demonstrates and audits the Firebase AI Logic hybrid routing mechanism.
- If Gemini Nano is unavailable or the metadata payload exceeds on-device capacity, execution is **immediately halted**.
- Displays the **Consent Card** showing the user the exact sanitized metadata text payload, destination model (`gemini-3.5-flash-lite`), and reason before any cloud packet is sent.

### 6. 🧪 In-App 10-Scenario Test Matrix & Network Privacy Inspector
- Built-in interactive test harness running all 10 hackathon edge case scenarios with live latency counters.
- Mathematically asserts that **0 outbound network requests** are sent without user consent.
- Filter pill categories: `All`, `Parsing`, `Privacy`, `Hybrid AI`, `Network`.

---

## 🔬 Hackathon 10-Scenario Test Matrix

| # | Scenario | Category | Expected Behavior | Live Status |
| :-: | :--- | :--- | :--- | :-: |
| **1** | Clean CSV Parsing & Statistical Profiling | `Parsing` | Instant profile (<1s), 100% clean quality score, exact numeric statistics | `✓ PASSED` |
| **2** | File Size Boundary Validation (>50 MB) | `Parsing` | Accepts 48 MB; rejects 52 MB with *"File exceeds the 50 MB limit"* | `✓ PASSED` |
| **3** | Malformed & Ragged Rows Fault Tolerance | `Parsing` | Graceful handling with zero crashes; missing cells logged accurately | `✓ PASSED` |
| **4** | UTF-8 Byte Order Mark (BOM) Sanitization | `Parsing` | BOM `\uFEFF` character stripped; first column name is clean UTF-8 | `✓ PASSED` |
| **5** | High-PII Dataset Auto-Exclusion Guard | `Privacy` | Zero raw PII values present in AI payload; column marked as Excluded | `✓ PASSED` |
| **6** | On-Device Gemini Nano Inference Path | `Hybrid AI` | Direct routing to `InferenceMode.ONLY_ON_DEVICE`; zero consent prompts | `✓ PASSED` |
| **7** | On-Device Failure & Consent Interception | `Hybrid AI` | Halts immediately; displays Consent Card showing sanitized preview | `✓ PASSED` |
| **8** | User Declines Consent (Strict Local) | `Privacy` | Execution stays 100% local; zero outbound network packets dispatched | `✓ PASSED` |
| **9** | User Grants Consent (Controlled Fallback)| `Hybrid AI` | Routes to cloud model with `IN_CLOUD` provenance badge strictly recorded | `✓ PASSED` |
| **10**| Offline Mode Resilience & Local Math | `Network` | Blocks cloud requests; computes Recharts & math locally in JavaScript | `✓ PASSED` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **Google Chrome**: Version 128+ (for Chrome Built-in Gemini Nano on-device AI)

### Enabling Chrome Gemini Nano (Optional but Recommended)
To run on-device inference locally via Chrome Gemini Nano:
1. Open Google Chrome and navigate to:
   - `chrome://flags/#prompt-api-for-gemini-nano` -> Set to **Enabled**.
   - `chrome://flags/#optimization-guide-on-device-model` -> Set to **Enabled BypassPrefRequirement**.
2. Relaunch Chrome.
3. Open `chrome://components` and find **Optimization Guide On Device Model**. Click **Check for update** until status is *Up-to-date*.

*(Note: Dataveil includes full mock and fallback support, so the entire app and all 53 automated tests run out-of-the-box in any standard browser).*

---

### Installation & Local Run

```bash
# 1. Clone repository
git clone https://github.com/jnaitik/Dataveil.git
cd Dataveil

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Open your browser at `http://127.0.0.1:5173`.

---

### Running Automated Tests

Dataveil includes comprehensive test suites covering unit logic, integration boundaries, network privacy assertions, and in-browser DOM simulations:

```bash
# Run all 53 tests across 13 test suites
npm run test

# Run the Phase 8 live in-browser test matrix runner
npx vitest run src/test/phase8Browser.test.tsx

# Run network privacy assertions (verifying 0 outbound requests)
npx vitest run src/test/networkPrivacy.test.ts

# Run the interactive button audit across all components
npx vitest run src/test/phase7FullInteractiveAudit.test.tsx
```

### Production Build

```bash
npm run build
```
Generates an optimized, minified production distribution in `dist/`.

---

## 📁 Repository Structure

```
dataveil/
├── public/                     # Static assets & sample synthetic CSVs
├── src/
│   ├── ai/
│   │   ├── aiClient.ts         # Firebase AI Logic & GenerativeModel initialization
│   │   ├── firebaseApp.ts      # Firebase App instance initialization
│   │   ├── mockGenerativeModel.ts # Resilient on-device fallback model
│   │   ├── nanoChecker.ts      # Chrome window.ai / Gemini Nano status detection
│   │   ├── payload.ts          # SINGLE EXCLUSIVE privacy-guaranteed AI payload builder
│   │   ├── router.ts           # Hybrid inference routing logic (Private vs Auto)
│   │   └── schemas.ts          # Structured JSON schemas for AI queries & charts
│   ├── components/
│   │   ├── ConsentCard.tsx     # One-time cloud fallback consent security card
│   │   ├── DataPrivacyModal.tsx# Architecture & privacy guarantees modal
│   │   ├── DropZone.tsx        # File drag-and-drop & synthetic CSV picker
│   │   ├── HybridFlowBanner.tsx# Real-time hybrid flow status banner
│   │   ├── OnboardingModal.tsx # Chrome Gemini Nano setup guide modal
│   │   ├── StatusPanel.tsx     # Nano status, network indicator, and mode toggles
│   │   └── UnderTheHood.tsx    # Slide-over drawer displaying exact prompts & logs
│   ├── csv/
│   │   ├── chartSpecs.ts       # Deterministic Recharts specification generator
│   │   ├── operations.ts       # Deterministic local math execution engine
│   │   ├── parser.worker.ts    # Web Worker streaming PapaParse chunking
│   │   ├── parserClient.ts     # Main-thread Promise wrapper for Web Worker
│   │   └── profiler.ts         # IQR outlier detection, type inferrer & profiler
│   ├── features/
│   │   ├── ask/AskTab.tsx      # Natural language question -> deterministic math
│   │   ├── charts/SuggestedChartsTab.tsx # AI schema mapping -> Recharts render
│   │   ├── explain/ExplainTab.tsx # Column semantic explainer with budget limit
│   │   ├── gate/GateTestHarness.tsx # Verification Gate & SDK provenance inspector
│   │   ├── matrix/TestMatrixTab.tsx # In-app 10-Scenario Test Matrix dashboard
│   │   └── profile/            # Profile dashboard, KPI cards, table & Recharts
│   ├── lib/
│   │   ├── provenance.ts       # Real SDK provenance tracking & badge styling
│   │   ├── remoteConfig.ts     # Payload character budgeting limits
│   │   └── throttling.ts       # Request throttling & AbortController cancellation
│   └── test/                   # 13 test suites (53 tests) covering all requirements
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

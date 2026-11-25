export interface SyntheticDataset {
  id: string;
  name: string;
  description: string;
  csvContent: string;
}

export const SAMPLE_DATASETS: SyntheticDataset[] = [
  {
    id: 'monthly-sales',
    name: 'Monthly Sales Export (Fictional)',
    description: 'Regional sales performance with revenue, units sold, and profit across product categories.',
    csvContent: `Date,Region,ProductCategory,UnitsSold,Revenue,Profit
2026-01-15,North,Electronics,45,13500.50,3200.00
2026-01-18,South,Home & Garden,120,4800.00,1250.75
2026-01-22,East,Office Supplies,310,3100.00,890.20
2026-02-05,West,Electronics,60,18000.00,4500.50
2026-02-12,North,Home & Garden,85,3400.00,920.00
2026-02-19,South,Electronics,30,9000.00,2100.00
2026-03-02,East,Office Supplies,400,4000.00,1150.00
2026-03-14,West,Home & Garden,95,3800.00,980.50
2026-03-25,North,Office Supplies,210,2100.00,610.00
2026-04-04,South,Home & Garden,110,4400.00,1100.00
2026-04-18,East,Electronics,55,16500.00,3900.00
2026-04-29,West,Office Supplies,290,2900.00,830.00`,
  },
  {
    id: 'student-marks',
    name: 'Class Academic Records (Fictional)',
    description: 'Anonymized student performance data with exam scores, attendance rate, and final letter grades.',
    csvContent: `StudentID,Subject,MidtermScore,FinalScore,AttendancePct,Grade
STD-101,Mathematics,84,89,95.5,A
STD-102,Mathematics,62,68,82.0,C
STD-103,Physics,91,95,98.0,A
STD-104,Physics,45,52,71.5,F
STD-105,Computer Science,88,94,92.0,A
STD-106,Computer Science,75,79,88.5,B
STD-107,Mathematics,78,82,90.0,B
STD-108,Physics,83,86,93.0,B
STD-109,Computer Science,96,99,99.0,A
STD-110,Mathematics,55,59,75.0,D
STD-111,Physics,72,74,85.0,C
STD-112,Computer Science,82,85,91.0,B`,
  },
  {
    id: 'personal-expenses',
    name: 'Household Expenses Log (Fictional)',
    description: 'Daily expense transactions categorized by spending type, amount, and payment method.',
    csvContent: `TransactionDate,Category,Description,Amount,PaymentMethod,IsTaxDeductible
2026-01-02,Groceries,Supermarket groceries,84.50,Credit Card,no
2026-01-05,Utilities,Electricity bill,125.00,Bank Transfer,yes
2026-01-09,Dining,Family dinner,62.30,Debit Card,no
2026-01-14,Healthcare,Prescription refill,35.00,Credit Card,yes
2026-01-20,Transportation,Monthly subway pass,90.00,Debit Card,yes
2026-02-01,Groceries,Weekly grocery run,112.40,Credit Card,no
2026-02-06,Entertainment,Cinema tickets,28.00,Debit Card,no
2026-02-15,Utilities,Water and sewer,45.20,Bank Transfer,no
2026-02-22,Healthcare,Dental cleaning,150.00,Credit Card,yes
2026-03-03,Groceries,Produce and market,76.80,Debit Card,no
2026-03-12,Transportation,Fuel station,55.00,Credit Card,no
2026-03-28,Dining,Weekend lunch,42.10,Debit Card,no`,
  },
];

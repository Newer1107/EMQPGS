/** Checked against UAF v3.3 source PDF, physical pages 3, 7, 15, 19, 25, 46.
 * These correct omissions/paraphrases in docs/architecture/uaf-framework-extraction.md.
 * Keep this explicit so a markdown-only regression test cannot silently drop source columns.
 */
export const SOURCE_PDF_HEADERS: Record<string, string[]> = {
  "1.3": ["Phase", "Mandatory Evaluation Component"],
  "2.3": ["Level", "Evidence Type", "Description"],
  "4.2": ["Stage", "Required Activity"],
  "4.3": ["QID", "Question Text", "Marks", "CO", "PO", "PI", "RBT", "Difficulty", "Status"],
  "5.2": ["CO", "Questions Mapped", "Marks", "Coverage Status", "Coverage Percentage"],
  "6.14": ["Finding", "Risk", "Priority"],
  "11.7": ["ID", "Strength"],
  "11.8": ["ID", "Weakness"],
  "11.9": ["ID", "Finding", "Evidence", "Recommendation", "Priority"],
};
export const MISSING_DATA_PROTOCOL = {
  id: "2.2", title: "2.2 Missing Data Protocol", headers: ["Step", "Required Action"],
  rows: [["1", "Identify Missing Information"], ["2", 'Record "Unable to Verify"'], ["3", "Document Missing Evidence"], ["4", "Reduce Confidence Score"], ["5", "Continue Evaluation Using Verified Evidence Only"]],
};

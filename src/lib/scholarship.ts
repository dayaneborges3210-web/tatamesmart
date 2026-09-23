export function includeScholarshipInvoice(status: string, scholarship: boolean) {
  return status === "paga" || !scholarship;
}

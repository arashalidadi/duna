/**
 * ReleaseOrder eligibility POLICY — the single seam an employer ruling replaces
 * (ADR-046 ruling 3 / ADR-045 decision 3).
 *
 * DEFAULT (the ruling-3 "no money, no cargo" principle):
 *   eligible = bill is in the issued-equivalent `APPROVED` state AND all of its
 *   invoices are fully paid (zero invoices counts as settled).
 *
 * What is deliberately NOT hard-coded anywhere else: partial-payment thresholds,
 * credit terms, approver tiers, extra statuses — those stay POLICY INPUTS. A future
 * employer ruling is a CONFIG CHANGE to this object (or a successor strategy with
 * the same shape), never a hunt through the service flow:
 *   - `requiredBillStatus` feeds eligibility()'s status gate;
 *   - `paymentTolerance` feeds billFinancials()'s fully-paid comparison;
 *   - `evaluate()` is the verdict both eligibility() and the RO-create money block
 *     derive their outcome from.
 *
 * Scope note (explicit): the D-O/R-O CREATION gates (`requireIssuedBill`) keep their
 * U4-shipped literal `APPROVED` rule — per P4-U6's brief, gates are not changed by
 * this unit; the policy governs the ELIGIBILITY axis only.
 *
 * Override path: when this policy says "not eligible", release is still possible
 * only via force + overrideReason behind `release:override`, and that override
 * WRITS AN AUDITLOG ROW (ruling 3's "audited override path").
 */
export const RELEASE_ORDER_ELIGIBILITY_POLICY = {
  name: 'adr-046-ruling-3-default',
  /** Bill status required for eligibility (the issued-equivalent). */
  requiredBillStatus: 'APPROVED',
  /** Payment rule name: every invoice fully settled; no invoices = settled. */
  paymentRule: 'FULL_SETTLEMENT',
  /** Cent tolerance for "fully paid" — a policy input per ruling 3's last sentence. */
  paymentTolerance: 0.005,
  evaluate(input: {
    billStatus: string;
    fullyPaid: boolean;
  }): { eligible: boolean; needsOverride: boolean } {
    const eligible =
      input.billStatus === this.requiredBillStatus && input.fullyPaid;
    return { eligible, needsOverride: !eligible };
  },
};

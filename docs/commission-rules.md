# Smartegy Commission Rules

## 1. Purpose and Authority

This document isolates the commission rules because they affect money, agent hierarchy, approvals, reporting, and audit history. It is the working source of truth for commission-related frontend and backend behaviour.

Do not infer a general formula from a single example. Any unresolved rule must remain clearly labelled until Smartegy confirms it.

## 2. Trigger

- A commission is generated only after an authorised user verifies the relevant qualifying customer payment.
- Payment verification must record the verifier and timestamp.
- The same qualifying payment event must not generate duplicate commission schedules.
- If a payment is reversed or corrected, the original calculation remains auditable and any reversal/adjustment is recorded separately.

## 3. Total Entitlement

For the approved RM24,500 worked example, total commission is 20% of the sale:

| Recipient | Percentage of sale | Total entitlement |
|---|---:|---:|
| Level 1 | 5.5% | RM1,347.50 |
| Level 2 | 3.0% | RM735.00 |
| Level 3 | 1.5% | RM367.50 |
| Office | 10.0% | RM2,450.00 |
| **Total** | **20.0%** | **RM4,900.00** |

Calculation:

```text
total commission pool = sale amount × 20%
recipient entitlement = sale amount × recipient percentage
```

The system must confirm which actual agent occupies each eligible level for the case. No payment should be assigned merely because a level exists in the table.

## 4. First-Payment Distribution

For the worked example, Smartegy supplied an approved first-payment commission pool of RM1,747.20.

This pool is allocated as follows:

| Recipient | Share of first-payment pool | First payment | Deferred balance |
|---|---:|---:|---:|
| Level 1 | 60% | RM1,048.32 | RM299.18 |
| Level 2 | 15% | RM262.08 | RM472.92 |
| Level 3 | 5% | RM87.36 | RM280.14 |
| Office | 20% | RM349.44 | RM2,100.56 |
| **Total** | **100%** | **RM1,747.20** | **RM3,152.80** |

Important distinction:

- The 5.5%, 3%, 1.5%, and 10% values are percentages of the total sale and determine total entitlement.
- The 60%, 15%, 5%, and 20% values are shares of the approved first-payment pool, not percentages of the total sale.
- Deferred balance equals total entitlement minus the first payment for that recipient.

```text
first payment = approved first-payment pool × recipient pool share
deferred balance = total entitlement − first payment
```

## 5. Deferred Schedule

- Each recipient's deferred balance is paid over 17 months.
- Store money in integer sen.
- Scheduled instalments must sum exactly to the recipient's deferred balance.
- When equal instalments create a rounding remainder, adjust the final instalment so the schedule reconciles exactly.
- Do not independently round multiple intermediate values in a way that changes the total pool.

Recommended deterministic allocation:

```text
base instalment = floor(deferred balance in sen ÷ 17)
first 16 instalments = base instalment
final instalment = deferred balance − sum(first 16 instalments)
```

The commencement date, due-day convention, and weekend/public-holiday treatment remain to be confirmed.

## 6. Status Model

Proposed commission statuses:

- `calculated` — created by the trusted calculation engine but not yet approved.
- `scheduled` — included in an approved payment schedule.
- `approved` — approved for payment.
- `paid` — payment has been recorded.
- `withheld` — temporarily held with a required reason.
- `adjusted` — changed by an authorised adjustment with an audit record.
- `reversed` — reversed following an authorised correction.

Exact allowed transitions require confirmation. The UI must not imply that changing a badge is equivalent to executing a bank transfer.

## 7. Review, Approval, and Adjustment

- The calculation engine runs on the server or other trusted backend.
- Authorised staff can review the calculation and recipient breakdown.
- Only authorised roles can approve, withhold, mark paid, reverse, or adjust commissions.
- Every manual adjustment requires a reason.
- Store both the original calculated value and the adjustment rather than overwriting the original silently.
- Audit records include actor, action, old value, new value, reason, and timestamp.
- Version 1 exports approved commission data for separate bank processing; it does not disburse money.

## 8. Frontend Presentation

### Commission List

Show at minimum:

- Commission/case reference.
- Customer or case context permitted to the viewer.
- Recipient and level.
- Total entitlement.
- First-payment amount.
- Deferred balance.
- Next due amount/date where applicable.
- Paid amount.
- Status.

### Commission Detail

The detail page or drawer must show:

- Source case and verified payment.
- Sale amount and total commission pool.
- All eligible recipients and their entitlement percentages.
- First-payment distribution.
- Full 17-month schedule.
- Totals for paid, remaining, withheld, and adjusted amounts.
- Approval and adjustment history.
- Clear labels distinguishing percentages of sale from shares of the first-payment pool.

Agents see only their permitted entries. Administrative and finance users may see the case-wide allocation according to permissions.

## 9. Worked Example Checks

The approved example must reconcile to all of the following:

```text
RM24,500.00 × 20% = RM4,900.00 total commission
RM1,347.50 + RM735.00 + RM367.50 + RM2,450.00 = RM4,900.00
RM1,048.32 + RM262.08 + RM87.36 + RM349.44 = RM1,747.20 first payment
RM299.18 + RM472.92 + RM280.14 + RM2,100.56 = RM3,152.80 deferred
RM1,747.20 + RM3,152.80 = RM4,900.00
```

These checks should be covered by automated tests when the calculation engine is implemented.

## 10. Unresolved Rules

Do not mark the commission engine production-ready until Smartegy confirms:

1. The reusable formula for deriving the first-payment pool. RM1,747.20 is currently an approved input for the example only.
2. How recipients are selected from the referral hierarchy for each level.
3. What happens if an eligible level is vacant or a recipient is inactive.
4. Whether the Office always receives 10% and the stated first-payment share.
5. Whether partial customer payments trigger proportional commissions or no commission until a threshold is reached.
6. When the 17-month schedule begins and how due dates are determined.
7. Rules for cancellations, refunds, clawbacks, agent exits, and withheld payments.
8. Whether tax or statutory deductions affect the displayed or paid amounts.
9. Who may approve, adjust, reverse, and mark commissions paid.


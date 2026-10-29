/** Static admin guide: what happens after payment for each delivery type, and what you must do. */
const GUIDE: ReadonlyArray<{
  type: string;
  auto: string;
  you: string;
  done: string;
}> = [
  {
    type: "Download",
    auto: "Access is granted the moment payment is confirmed. The customer can download from Account → Purchases.",
    you: "Nothing. Reset the download count or extend access from the order if the customer asks.",
    done: "Order becomes Fulfilled automatically.",
  },
  {
    type: "Licence key",
    auto: "Automated provisioning issues a key on payment. Manual provisioning opens a task instead.",
    you: "Manual only: open the order, enter the key under Items & fulfilment and save.",
    done: "Fulfilled once a key exists. Customer is emailed a dashboard link, never the key.",
  },
  {
    type: "Hosted website",
    auto: "A provision task is opened and the customer sees Provisioning.",
    you: "Set the site up, then press Mark delivered on the order (add the login link or a note).",
    done: "Fulfilled after Mark delivered. Customer is notified in-app.",
  },
  {
    type: "SaaS",
    auto: "Access is active at once, a provision task is opened and the customer sees Provisioning.",
    you: "Create the customer's account, then press Mark delivered (add instructions or a link).",
    done: "Fulfilled after Mark delivered.",
  },
  {
    type: "Custom",
    auto: "A provision task is opened and the customer sees Provisioning. The order stays Paid.",
    you: "Do the work, then press Mark delivered with a note or link for the customer.",
    done: "Fulfilled after Mark delivered.",
  },
  {
    type: "Service",
    auto: "The checklist from the offering is shown to the customer.",
    you: "Tick each step as you finish it.",
    done: "Fulfilled when every step is done.",
  },
  {
    type: "Subscriptions",
    auto: "Renewal orders are created by the customer; paying one extends the period. The daily job moves an unpaid subscription to past due, suspends it after a 7-day grace, and expires one set to cancel at period end.",
    you: "Confirm the renewal payment like any order. Revoked access is never revived by a renewal.",
    done: "Active until the period ends; then Past due, Suspended or Expired.",
  },
];

export function FulfilmentGuide() {
  return (
    <div className="space-y-4" data-testid="fulfilment-guide">
      <p className="text-body-sm text-fg-muted">
        After you confirm a payment, every order follows the steps below. Anything marked “You”
        needs an admin action on the order page.
      </p>
      {GUIDE.map((g) => (
        <section
          key={g.type}
          aria-label={g.type}
          className="space-y-2 rounded-lg border border-border bg-surface p-4"
        >
          <h3 className="text-h4">{g.type}</h3>
          <dl className="space-y-2 text-body-sm">
            {(
              [
                ["Automatic", g.auto],
                ["You", g.you],
                ["Done when", g.done],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="grid gap-1 sm:grid-cols-[110px_1fr]">
                <dt className="font-medium">{k}</dt>
                <dd className="text-fg-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

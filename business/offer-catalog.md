# Offline Helper Offer Catalog (2026-07-20)

Single source of truth for site copy, Stripe products, worker `CATALOG`, and funnel messaging.

**Policy:** Free Fit Check first. Checkout links only after confirmed fit.

## Funnel layers

| Layer | SKU key | Name | Price | Mode | What they buy |
|-------|---------|------|-------|------|---------------|
| L0 | `fit_check` | Private AI Fit Check | $0 | n/a | 15–20 min diagnosis; no payment |
| L1a | `home_setup` | Home Setup | **$497** | payment | Done-for-you install on **their** Mac/PC + training + 14-day fix guarantee |
| L1b | `family_care_setup` | Family Care Setup | **$997** | payment | Home Setup + caregiver orientation, consent sheet, 30-min follow-up |
| L1c | `org_setup` | Micro-Org Setup | **$1,500** | payment | 1–3 seats / small office / library-style partner site |
| L2 | `care_plan` | **Care Plan** (primary sub) | **$79/mo** | subscription | Monthly updates, health check, skill of the month, 1 support call, privacy review |
| R1 | `paid_rescue` | **Paid Rescue Session** | **$99** | payment | 90-minute live-system rescue call after Pete confirms fit and timing |
| H1 | `hw_edge` | Edge Privacy Kit | **$349** | payment | Network + device hygiene; soft offline; models limited by **existing** hardware |
| H2 | `hw_home` | Home AI Node | **$1,499** | payment | Curated mini PC + LAN setup; **mostly offline**; host ~7B–14B open models daily |
| H3 | `hw_lab` | Open Model Lab | **$3,997** | payment | GPU workstation stack; **deep offline**; host ~32B–70B quantized open models |

Legacy pilot SKUs (still in worker for open links):

| SKU | Name | Price |
|-----|------|-------|
| `starter_setup` | Starter Setup (pilot) | $149 |
| `family_setup` | Family Setup (pilot) | $249 |
| `family_support` | Family Support (legacy) | $29/mo |

## Hardware → offline depth → open models

| Tier | Offline depth | Realistic open models | Who |
|------|---------------|----------------------|-----|
| BYO (with L1) | Soft offline | 3B–8B if RAM allows | Budget / try-first |
| H1 Edge | Soft + cleaner network | Still BYO compute | Privacy-anxious on current laptop |
| H2 Home Node | Mostly offline | **7B–14B** daily | Family wants home-controlled AI |
| H3 Lab | Deep offline / self-host | **32B–70B** quantized | Power users, small orgs |

## Checkout

Worker: `POST https://offline-helper-payments.offline-helper-payments.workers.dev/api/checkout`

```json
{
  "package": "home_setup | family_care_setup | org_setup | care_plan | paid_rescue | hw_edge | hw_home | hw_lab | starter_setup | family_setup | family_support",
  "fit_check_id": "optional",
  "customer_email": "optional",
  "setup_window": "optional"
}
```

New SKUs use Stripe Checkout `price_data` until Dashboard Price IDs are pasted into `worker/src/index.js`.

## Messaging spine

1. Cloud chatbots eat family context; parents don’t want to become IT.
2. Local-first helper on *your* computer (or curated home node), patient setup.
3. Fit-check first; memoir proof; no secrets in forms.
4. Fit Check → Setup (± hardware) → Care Plan.
5. Ask: book free Fit Check / warm intro / partner mini-session.


## Safety and trust boundaries

- No public checkout as the first step for setup packages; fit check first.
- Never ask customers to paste passwords, recovery keys, private documents, medical/legal/financial details, or crisis information into forms, Telegram, email, or Stripe Checkout.
- Payment copy should say what is included, what is not included, and the follow-up/refund path plainly.
- Hardware SKUs require human confirmation before purchase because device fit, availability, shipping, and local constraints can change.

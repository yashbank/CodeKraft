# Content guide for writers

For: the person who writes the words and picks the pictures for the site. No coding needed.

You do everything in the admin area (the admin address your team gave you), under the menu
called Content (and Products for product pages). Nothing goes live until you press Publish.
You can save a draft as many times as you like.

Field names below are the exact labels you will see on screen. The number after a field is the
most characters it accepts. The "aim for" number is the length that reads well on the page and in
Google.

## Quick rules

- Write for one reader: a business owner who wants a result. Short sentences. No jargon.
- Say what the person gets, not what we do. "Your shop takes orders in a week" beats "We use agile sprints".
- Use the same spelling and the same product names everywhere.
- Never paste text straight from Word. It brings hidden formatting. Paste into Notepad first, then copy.
- Every picture needs a short description of what it shows (the "Alt text" field). It helps blind visitors and Google.
- Slug = the last part of the web address. Lower case, words joined with hyphens, no spaces: `online-shop-for-bakeries`. Do not change a slug after publishing; the old address stops working.

## Pictures and files

| Use | Best size | Format | Limit |
|-----|-----------|--------|-------|
| Hero / cover image | 1600 x 900 pixels (wide) | JPG or WebP | 10 MB (aim for under 400 KB) |
| Product image / screenshot | 1600 x 1000 pixels | PNG for screens, JPG for photos | 10 MB |
| Blog cover | 1200 x 630 pixels | JPG or WebP | 10 MB |
| Client logo | 400 x 200 pixels, transparent background | PNG or SVG | 10 MB (SVG 1 MB) |
| Share picture for social media (OG image) | 1200 x 630 pixels | JPG or PNG | 10 MB |
| Video | 1920 x 1080, under 60 seconds | MP4 | 200 MB |
| Other files (PDF, Word, Excel, PowerPoint, ZIP, audio, fonts) | | | See the limits in `docs/R2-CORS.md` |

Not allowed: web pages (html), scripts (js), programs (exe). Compress photos first (squoosh.app is free).

---

## 1. Home page hero (top of the home page)

Where: Content, Landing. Open the first section, called "hero (top of the page)".

| Field | What to write | Aim for |
|-------|---------------|---------|
| Hero image | Picture beside the headline | 1600 x 900, JPG/WebP |
| Image label / Image label style | Small tag on the picture. Optional | 2 to 4 words |
| Eyebrow | Small line above the headline | up to 60, aim for 20 to 40 |
| Title | The headline. The promise | up to 120, aim for 40 to 70 |
| Subtitle | One sentence that backs the promise | up to 200, aim for 100 to 160 |
| Primary CTA label | Main button text. A verb | 2 to 4 words, "Get a quote" |
| Primary CTA target | Where the main button goes | pick from the list |
| Secondary CTA label | Quieter button text | 2 to 4 words, "See our work" |
| Secondary CTA target | Where it goes | pick from the list |

Copy and paste:

```
Eyebrow: [Who it is for, e.g. Websites for small businesses]
Title: [Result the customer gets, in plain words]
Subtitle: [How, how fast, and what makes us safe to choose. One sentence.]
Primary CTA label: [Get a quote]
Secondary CTA label: [See our work]
Hero image alt text: [What the picture shows]
```

## 2. The other landing sections (Build, Sell, Proof, Talk to us)

Same page, next sections. Each has Eyebrow, Title and Body (the paragraph under the headline) and
two buttons. They do not show a picture or a subtitle.

```
Eyebrow: [2 to 4 words]
Title: [One clear line, 40 to 70 characters]
Body: [2 to 4 short sentences, 200 to 400 characters]
Primary CTA label / target: [button + where it goes]
Secondary CTA label / target: [button + where it goes]
```

Featured products strip: in the same area, "Add product" picks up to 8 products to show on the home page.

## 3. Services

Where: Content, Services. One entry per service.

| Field | What to write | Limit / aim for |
|-------|---------------|-----------------|
| Title | Service name | 120 / 20 to 50 |
| Slug | Address ending | lower case, hyphens |
| Summary | What the customer gets, one or two sentences | 300 / 120 to 200 |
| Icon | Pick a small symbol | |
| Body | Full description. Use short headings and bullet points | 300 to 600 words |
| Published | Tick when ready | |

```
Title: [Service name]
Slug: [service-name]
Summary: [Who it is for + the result + how long it takes.]
Body:
  What you get: [3 to 6 bullet points]
  How it works: [3 to 5 steps]
  What it costs and how long it takes: [honest range]
  Who it is not for: [one line, builds trust]
  Next step: [what to click or call]
```

## 4. Products

Where: Products, then open or create a product. The page has sections (tabs); fill these.

| Field | What to write | Limit / aim for |
|-------|---------------|-----------------|
| Name | Product name | 120 / 20 to 40 |
| Slug | Address ending | lower case, hyphens |
| Short description | One line that sells it. Shows on cards and in search | 300 / 100 to 160 |
| Category, Tags | Pick, then add up to 20 tags | 3 to 6 tags |
| Rich description | Full description with headings and bullets | 300 to 500 words |
| Features | One short benefit per line | 5 to 8 lines |
| Benefits | What changes for the buyer | 3 to 5 lines |
| Requirements | What the buyer needs first | short list |
| Instructions | How to start after buying | numbered steps |
| Live demo URL, App URL, Repo URL | Links, only if public | |
| Current version, Changelog summary | e.g. 1.2.0 and what changed | one line each |
| Purchase model, Currency, price fields | Ask the owner. Do not guess | |
| Update policy, Access months, Download cap | Ask the owner | |
| Cover image, screenshots, video, Alt text | See the picture table | 1 cover, 3 to 6 screenshots |
| SEO title, SEO description, Canonical URL, OG image override | See section 7 | |
| Status, Publish at | Draft or Published; date to go live | |

```
Name: [Product name]
Slug: [product-name]
Short description: [Who it is for + the main result, one sentence]
Features:
- [Feature in plain words]
Benefits:
- [What the buyer gains]
Requirements:
- [What they need]
Instructions:
1. [First step after purchase]
```

## 5. Case studies (Projects)

Where: Content, Case studies.

| Field | What to write | Limit / aim for |
|-------|---------------|-----------------|
| Title | Result-style headline | 160 / 50 to 80 |
| Slug | Address ending | |
| Client name | Company name (get their OK) | 120 |
| Industry | e.g. Retail | 80 |
| Problem | What was wrong | 80 to 150 words |
| Solution | What we built | 100 to 200 words |
| Results | What changed, with numbers | 80 to 150 words |
| Result highlight | One short number line, e.g. "Orders up 40%" | 60 |
| Tech stack | Tools used (tags) | up to 30 |
| Cover image file, Gallery image files | Pictures, each with alt text (125) | 1 cover, 3 to 6 gallery |
| SEO title / Meta description | See section 7 | 70 / 160 |
| Status | Draft or Published | |

```
Title: [How we helped CLIENT achieve RESULT]
Client name: [..]   Industry: [..]
Problem: [Their situation before. One number if you have it.]
Solution: [What we did, in 3 or 4 plain sentences.]
Results: [Numbers: before and after, and the time it took.]
Result highlight: [Orders up 40%]
```

## 6. Blog

Where: Content, Blog.

| Field | What to write | Limit / aim for |
|-------|---------------|-----------------|
| Title | The headline | 160 / 40 to 65 |
| Slug | Address ending | 3 to 6 words |
| Cover image | 1200 x 630 | |
| Excerpt | Two sentences shown on the blog list | 300 / 120 to 200 |
| Body | The article. Headings, short paragraphs | 600 to 1,200 words |
| Product | Tie the post to a product (optional) | |
| SEO title / SEO description | See section 7 | |

```
Title: [Question or promise your reader has]
Slug: [short-keyword-phrase]
Excerpt: [What the reader will learn. One or two sentences.]
Body:
  Opening: [2 sentences: the problem]
  Heading 1 + 2 to 3 short paragraphs
  Heading 2 + ...
  Closing: [What to do next + link to a product or the contact page]
```

## 7. Search engine fields (SEO)

Every product, case study and blog post has these. If you leave them empty the page title and
short text are used, which is fine for a draft but weaker in Google.

| Field | Rule | Aim for |
|-------|------|---------|
| SEO title | Main phrase first, brand last. Different on every page | 50 to 60 characters |
| SEO description (Meta description) | One sentence with a reason to click. No quotation marks | 140 to 155 characters |
| Slug | Short, the main phrase, hyphens | 3 to 6 words |
| OG image override | Picture shown when shared on WhatsApp, LinkedIn | 1200 x 630 |
| noindex | Hides the page from Google. Leave off unless told | off |

```
SEO title: [Main phrase] | [Brand]
SEO description: [What the page offers + who it is for + a reason to click.]
```

## 8. FAQs and testimonials

FAQs (Content, FAQs): Question (300) and Answer. One question, one short answer, 2 to 4
sentences. Choose where it shows (site, chatbot or a product).

Testimonials (Content, Testimonials & logos): Quote (1,000), Author name, Author title, Company,
Product (if it belongs to one), Published. Use the customer's real words and get their written OK.
Client logos: Name, Link URL, Logo image file, Published.

## 9. Legal pages

Where: Content, Legal pages. There are four pages: Privacy, Terms, Refunds (refund policy), and
License. Each has Title, Body, Effective date and a Change summary (an internal note, visitors
never see it). Every save is kept in Version history.

Cookie policy: the site shows a short cookie notice that says it uses only essential cookies
(sign-in, theme, currency) and no tracking. There is no separate Cookie page in the admin today.
Until one exists, put a short "Cookies" heading inside the Privacy page that says the same thing.

Do not invent legal text. Get each document written or checked by a lawyer, then paste it here.

```
Title: Privacy Policy
Body:
  1. Who we are and how to contact us
  2. What we collect (name, email, phone, payment details handled by the payment provider, files you send)
  3. Why we collect it and how long we keep it
  4. Who we share it with (payment provider, email provider, hosting)
  5. Cookies
  6. Your rights: see, fix, delete your data; how to ask
  7. How to complain
  8. Changes to this policy
Effective date: [date]
Change summary: [what changed]
```

Terms, Refunds and License follow the same shape: plain numbered headings, short paragraphs,
a date at the top, and a contact address at the bottom.

## 10. Before you press Publish: checklist

- [ ] Title and headline are clear and have no spelling mistakes
- [ ] The first sentence says what the reader gets
- [ ] Slug is short, lower case, with hyphens, and unique
- [ ] Every picture has alt text and is the right size (see the picture table)
- [ ] SEO title (50 to 60) and SEO description (140 to 155) are filled and different from other pages
- [ ] Prices, dates, versions and client names are checked with the owner
- [ ] Every button and link goes to the right place (click each one in the preview)
- [ ] Looked at it on a phone as well as a computer
- [ ] No pasted text with strange fonts or spacing
- [ ] Client names, logos and quotes have written permission
- [ ] Published is ticked (or the date in Publish at is set)

---

## For Sanket Shrikant: legal documents needed before launch

Please arrange these, written or checked by a lawyer, in plain language. Send each to the content
writer as a Word or PDF file with the date it takes effect.

1. Privacy Policy (what personal data is collected, why, how long, who it is shared with, how to ask for deletion). Should follow the Indian Digital Personal Data Protection Act, 2023; add GDPR wording if you sell to the EU or UK.
2. Terms of Service (what we sell, payment terms, delivery, acceptable use, liability, governing law and where disputes are heard).
3. Refund and Cancellation Policy (what can be refunded, how many days, how refunds are paid, what cannot be refunded such as delivered downloads or started custom work). Must match the "refundable" setting on each product.
4. License terms for products and downloads (what a buyer may do with the code or files, how many sites or users, resale rules, how updates and support work).
5. Cookie wording (short; what cookies are used and why). Today: essential only, no tracking. If analytics or ads are added later, this must change and the notice must ask for consent.
6. Invoice and tax details: business legal name, address, GSTIN (if registered), PAN as needed, the right invoice wording and the places to show them.
7. Payment provider requirements (Razorpay and others normally need published Terms, Privacy, Refund policy, contact details and business address on the site).
8. Contact and grievance officer details required by Indian law for online businesses (name, email, response time).
9. Client permission letters or emails for each case study, logo and testimonial.
10. Domain, hosting and email: owner of the company name on the domain, and the sender address for customer emails.

# content-rules.md — Premier Courier Services website

The only source of facts, claims, and verbatim copy for this site. `npm run audit` enforces the forbidden-strings list below against `dist/`. If a fact is not on this page, it does not go on the site.

## Approved facts

| Fact | Use |
|---|---|
| Legal name: Premier Courier Services, LLC | Footer, schema `legalName`, legal/terms text |
| Everyday name: Premier Courier | Running copy |
| Directory / page-title form: Premier Courier Services, Prescott AZ | `<title>` suffix, schema `name` |
| Founded 1999 (confirmed 2026-09-23 by the project lead) | Home and About headline ("since 1999"), elevator pitch, schema `foundingDate` "1999" |
| Owner and manager: Alanna Hanigan, since 2014 | About page, schema `founder` is NOT Alanna — see below |
| Founder: Travis Womack. Built the founding hospital relationship in the early 2000s; grew the company across Central and Northern Arizona; passed away in 2014 | About page only, as the approved origin text |
| Phone: (928) 533-3585 | Every page; schema `telephone` as `+19285333585` |
| Email: alanna@premiercourieraz.com | Contact, footer, schema `email` |
| Mailing address: P.O. Box 10762, Prescott, AZ 86304 | Contact page and footer only. Schema: `addressLocality` Prescott, `addressRegion` AZ, `postalCode` 86304, no `streetAddress` |
| Hours: 24 hours a day, 7 days a week, including holidays | Every page; schema `openingHoursSpecification` Mon–Sun 00:00–23:59 |
| Service counties: Yavapai, Coconino, Maricopa, Pima, Mohave | Coverage sections; schema `areaServed` |
| Towns named on the current site: Prescott, Prescott Valley, Chino Valley, Sedona, Cottonwood, Jerome, Flagstaff, Phoenix, Mesa, Tempe, Scottsdale, Tucson, Kingman | Coverage lists and area pages |
| Drivers (first names, as published on the current site): Johnna, Dave, Sherry, Sergio, Brandon, Zaine | About page, with the photos already published. No surnames. New photos only after the shoot and consent |
| Drivers handle every item in a HIPAA-compliant manner | Wording is exactly "HIPAA-compliant handling" or "HIPAA-compliant" |
| Items carried: specimens, blood products, platelets, surgical trays, sterilized instruments, pharmaceuticals, legal documents, financial documents, dental impressions and lab work, records and supplies | Service pages |
| Audiences served: hospitals, labs, emergency rooms, operating rooms, sterile processing departments, physician offices, dentists, pharmacies, law firms, accountant offices, airport retrievals | Who-we-serve grid |
| A real person answers the phone; no answering service | Home, About, Contact. Never say the owner or one named person answers — it reads as a business that depends on one person |

## Do not publish (until Alanna confirms in writing)

| Item | Status |
|---|---|
| "HIPAA-trained" | Unconfirmed whether formal training exists. Use "HIPAA-compliant handling" |
| Any on-time percentage, delivery count, years-of-service figure for a driver | No approved number exists |
| The proposed first-person line "No answering service. When you call, you get the owner." | Withdrawn — the site no longer says the owner answers |
| Any new testimonial not listed below | Needs the customer's approval for public use |
| Chain of custody | Process claim, unconfirmed. Not on `/how-we-handle-it/` or anywhere else until Alanna confirms |
| Temperature-appropriate transport | Process claim, unconfirmed. Same |
| Signature on delivery | Process claim, unconfirmed. Same — including the legal-and-financial service page |

## Forbidden strings (audit fails the build)

Case-insensitive, **whole-word** matches (a term must not be preceded or followed by a letter or digit), in `dist/**/*.html`, `*.txt`, `*.xml`, `*.json`, `*.css`, `*.js`, image EXIF, and `<meta>` content.

Matching rules:

- `#1` is matched only in HTML text nodes and `<meta>` content — never in CSS or JS, where hex colors like `#178EC7` would false-positive.
- Allowlist: `Womack` (the founder's surname) is never a match for `mack`. Whole-word matching already excludes it; the allowlist makes that explicit.
- Verbatim approved testimonials are exempt from the exclamation-point limit and from Restricted language. They are not exempt from the forbidden-strings list.

```
hemang
true lean
trueleansolutions
tls
techtranspire
tech transpire
akhani
mack
meera
deep, technical support
asinpa
odoo
gps
real-time tracking
live tracking
#1
number one
best in arizona
best courier
guaranteed
hipaa certified
hipaa-certified
hipaa trained
hipaa-trained
most trusted
```

`most trusted` is on the list deliberately: the current site uses it, the new site does not. Use "trusted" without the superlative.

## Restricted language

| Never | Use instead |
|---|---|
| logistics solutions, last-mile, seamless, cutting-edge, state-of-the-art, leverage, game changer, disrupt, synergy | Plain words: pickup, delivery, route, scheduled, urgent, same-day |
| packages | The actual item: specimens, trays, filings, medications |
| Guaranteed delivery times | "On time, every time" |
| Contact our team today! | "Call (928) 533-3585. A real person answers." |
| Em dashes (—) anywhere in site copy | A period, comma, colon, or parentheses. Approved lines below are published this way |
| "24 hours a day, 7 days a week, including holidays" (hours field) | "24x7 (Incl. Holidays)" |

Exclamation points: at most one per page in our own copy; none on service pages or the how-we-handle-it page. Verbatim testimonials don't count toward the limit and are never edited to meet it.

## Approved positioning copy

**Primary brand line (hero, footer):**
Arizona's Trusted Courier. On Time, Every Time.

**Primary positioning statement:**
Premier Courier Services is the trusted medical and business courier for Central and Northern Arizona — on time, every time, 24/7, including holidays.

**Elevator pitch (home intro / about lead):**
Premier Courier has served Central and Northern Arizona since 1999, transporting specimens, blood products, surgical trays, pharmaceuticals, and confidential documents for hospitals, labs, pharmacies, physician offices, and law firms. Our drivers are meticulous and HIPAA-compliant in how they handle every item, we run 24 hours a day including holidays, and when you call, a real person answers.

**Short version (meta descriptions, schema `description`):**
Arizona's trusted medical and business courier. On time, every time — 24/7, including holidays, and a real person answers the phone.

**Signature statements (approved, company voice):**
- We treat every item with the utmost care, no matter its value.
- Business doesn't stop at 5 p.m., on weekends, or on holidays. Neither do we.
- Serving Central and Northern Arizona since 1999. Owned and operated by Alanna since 2014.
- Friendly, meticulous drivers your staff will know by name.

**CTA library:**

| Context | CTA |
|---|---|
| General | Get a Quote |
| Urgent / after-hours | Call Now — (928) 533-3585 |
| Recurring routes | Set Up a Scheduled Route |
| Mobile bottom bar | (928) 533-3585 · Available 24/7 |
| Form failure state | Call us instead — (928) 533-3585. We answer. |

## Approved origin text (About page, verbatim from the current site, approved)

Premier Courier was founded by Travis Womack — an entrepreneur at heart from the very beginning. As a kid, he ran a door-to-door car washing service. In the 1990s, he launched a food delivery business long before apps made it mainstream. By the early 2000s, he had built a relationship with a local hospital that would become the foundation of Premier Courier.

For over two decades, Travis grew Premier Courier into the trusted name it is today throughout Central and Northern Arizona. He passed away in 2014 after a brave battle with cancer, leaving behind a business built on integrity, reliability, and genuine care for the community he served.

His legacy lives on in everything we do.

## Approved first-person text (About page, "Meet Alanna", verbatim from the current site)

My name is Alanna, and I am the owner and manager of Premier Courier Services, LLC. I have proudly operated this business since 2014.

I am dedicated to providing professional, honest, and reliable courier services, ensuring timely and secure deliveries of important documents, specimens, pharmaceuticals, surgical trays, blood, and platelets. We treat every item with the utmost care, no matter its value. Our services are available 24/7, including holidays, because we understand that sometimes business needs to happen at any time.

As a small business owner, I highly value personal connections and strive to get to know each customer individually. This approach distinguishes Premier Courier from larger corporations, as I am personally involved in daily operations, building trust and strong relationships with our clients. My commitment to Premier Courier means my phone is always with me for any delivery needs. Many inquire why I don't use a phone answering service; my response is that no one will take the same pride and joy in this business as I do.

I look forward to the opportunity to meet with you soon and discuss how we can establish a successful partnership.

## Approved testimonials (verbatim from the current site; one spelling correction noted)

**Alex Castaneda**
"I've had an outstanding experience with Premier Courier Services! Their team is professional, punctual, and incredibly reliable. From urgent same-day deliveries to scheduled logistics, they've consistently exceeded expectations. Communication is clear and prompt, and their attention to detail ensures that packages arrive on time and in perfect condition. It's rare to find a courier service that combines efficiency with such friendly and personalized customer service. Highly recommended for anyone looking for dependable and top-notch courier solutions!"

**Jacob Konigseder**
"A review honestly can't say enough about them, they were simply beyond amazing. Let's face it, we expect every business we work with to be professional. This level was just exceptional! An incredible degree of service from start to finish and most importantly communication that alleviates any doubt, concern, or worry. Personal service that made you feel like you were there along during the process. I specifically needed this service to tranpsort two large items that were basically unexpectedly freight and they managed without issues and with unmatched helpfulness. I would recommend them to anyone in a heartbeat."

(The misspelling "tranpsort" is the customer's own text. Leave it, or use a shortened excerpt that ends before it. Do not silently correct a customer's words.)

**Suzanne Sullivan**
"Alanna at Premier Courier services has always been professional and able to meet any courier needs in a timely manner."

(Correction applied: the current site spells the owner's name "Alana" here. "Alanna" is the correct spelling of the business owner's name; this is a proper-noun correction, not an edit to the customer's opinion.)

**JJ Bullard**
"Quick response and scheduling! Super flexible and easy to work with."

## Who-we-serve copy (verbatim from the current site, approved)

| Audience | Line |
|---|---|
| Hospitals | Specimens, blood products, platelets, and surgical trays transported on time, every time. |
| Sterile Processing Departments | Compliant transport of sterilized instruments and trays with proper handling protocols. |
| Emergency Rooms | 24/7 availability for critical deliveries when every minute matters. |
| Doctor Offices | Flexible specimen, record, and supply deliveries that fit your office schedule. |
| Labs | Time-sensitive specimen pickups handled with precision so your results never wait on logistics. |
| Operating Rooms | Urgent surgical supply runs available day or night, including holidays. |
| Pharmacies | Prompt, discreet delivery of time-sensitive medications and pharmaceuticals. |
| Airport Retrievals | Pickup and drop-off at the airport, on your timeline. |
| Law Firms | Same-day, discreet delivery of legal documents, filings, and confidential materials. |
| Dentists | Reliable pickup and delivery of impressions, lab work, and supplies to keep your schedule running. |
| Accountant Offices | Secure same-day delivery of sensitive financial documents, tax season and beyond. |
| And More | If it needs to get there fast and handled right, we'll make it happen. |

Order on the site: medical audiences first (Hospitals, Labs, Emergency Rooms, Operating Rooms, Sterile Processing, Pharmacies, Doctor Offices, Dentists), then Law Firms, Accountant Offices, Airport Retrievals, And More.

## Privacy rules for all site content

- No customer, facility, department, or patient is ever named.
- No image shows a labeled specimen, requisition, manifest, or signature log.
- No image is taken at or in front of a customer site.
- Reviews appear as the customer published them (see above).
- Driver first names and existing photos only; nothing new without consent.
- People in photos are real photographs of real people. AI edits a real photo; it never generates one.

## Schema JSON-LD (every page)

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://www.premiercourieraz.com/#business",
  "name": "Premier Courier Services",
  "legalName": "Premier Courier Services, LLC",
  "description": "Arizona's trusted medical and business courier. On time, every time — 24/7, including holidays, and a real person answers the phone.",
  "url": "https://www.premiercourieraz.com/",
  "telephone": "+19285333585",
  "email": "alanna@premiercourieraz.com",
  "image": "https://www.premiercourieraz.com/assets/img/logo.png",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Prescott",
    "addressRegion": "AZ",
    "postalCode": "86304",
    "addressCountry": "US"
  },
  "areaServed": [
    { "@type": "AdministrativeArea", "name": "Yavapai County, AZ" },
    { "@type": "AdministrativeArea", "name": "Coconino County, AZ" },
    { "@type": "AdministrativeArea", "name": "Maricopa County, AZ" },
    { "@type": "AdministrativeArea", "name": "Pima County, AZ" },
    { "@type": "AdministrativeArea", "name": "Mohave County, AZ" }
  ],
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    "opens": "00:00",
    "closes": "23:59"
  },
  "foundingDate": "1999",
  "founder": { "@type": "Person", "name": "Travis Womack" },
  "employee": { "@type": "Person", "name": "Alanna Hanigan", "jobTitle": "Owner and Manager" }
}
```

`foundingDate` is "1999" (the audit requires exactly that). No `streetAddress`. No `aggregateRating` — the four testimonials are not a rating source.

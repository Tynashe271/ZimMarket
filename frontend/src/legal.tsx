// Centralised legal/compliance content so registration flows, the footer and the
// policy pages all reference the same version date and business details.
export const POLICY_VERSION = '2026-09-18';

// TODO(operator): replace these placeholders with ZimMarket's real registered
// business name, registration number, physical address and a monitored support
// inbox before this goes in front of real customers. Values shown as "Add "
// are deliberately left incomplete rather than invented.
export const BUSINESS_DETAILS = {
  legalName: 'ZimMarket',
  registrationNumber: '',
  address: '',
  supportEmail: 'support@zimmarket.local',
};

export function BusinessDetails() {
  const { legalName, registrationNumber, address, supportEmail } = BUSINESS_DETAILS;
  return <div className="business-details">
    <b>{legalName}</b>
    <span>Registration number: {registrationNumber || 'add before launch'}</span>
    <span>Registered address: {address || 'add before launch'}</span>
    <span>Support: <a href={`mailto:${supportEmail}`}>{supportEmail}</a></span>
  </div>;
}

function LegalMeta() {
  return <p className="legal-meta">Last updated {POLICY_VERSION}. This page is a plain-language template — have it reviewed by a lawyer familiar with Zimbabwean law before relying on it.</p>;
}

export function PrivacyPolicyContent() {
  return <div className="legal">
    <LegalMeta/>
    <p>ZimMarket ("we", "us") operates an online marketplace that connects customers with independent local businesses across Zimbabwe. This policy explains what personal data we collect through the app, why we collect it, and the choices you have.</p>

    <h2>What we collect</h2>
    <ul>
      <li><b>Account details:</b> full name, phone number, email address (optional), and a securely hashed password.</li>
      <li><b>Delivery details:</b> province, city, suburb and delivery address, so businesses and couriers can fulfil your orders.</li>
      <li><b>Notification preference:</b> whether you'd like updates by SMS, email, both, or in-app only.</li>
      <li><b>Business profile data:</b> for sellers, business name, industry, branches and storefront details.</li>
      <li><b>Order, payment and review data:</b> what you order, its status, and reviews you leave after a completed order.</li>
      <li><b>Verification codes:</b> one-time codes sent to your phone to confirm you control the number.</li>
      <li><b>Support and assistant messages:</b> anything you send through the feedback form or the "Zim" assistant chat.</li>
    </ul>
    <p>We only collect what's needed to run your account, fulfil orders and keep the marketplace safe — we don't ask for information unrelated to those purposes.</p>

    <h2>How we use it</h2>
    <p>We use your data to create and secure your account, connect you with the businesses you order from, arrange delivery, process payments, send order and verification updates, respond to support requests, and improve the marketplace.</p>

    <h2>Who we share it with</h2>
    <ul>
      <li>The business (or businesses) you place an order or booking with, so they can fulfil it.</li>
      <li>Our payment processor, Paynow, to process card and mobile money payments. ZimMarket does not see or store your card number, mobile money PIN, or banking credentials.</li>
      <li>Our SMS providers (Africa's Talking, with Twilio as a backup) to deliver verification codes and order notifications.</li>
      <li>OpenAI, only for the text of messages you send to the "Zim" assistant, so it can generate a reply. The assistant is told never to ask for passwords or payment details.</li>
    </ul>
    <p>We do not sell your personal data, and we do not share it with third parties for their own marketing.</p>

    <h2>Cookies</h2>
    <p>ZimMarket does not currently use tracking or advertising cookies. Your session is kept in your browser's local storage rather than a cookie. If that changes, this policy and a cookie banner will be updated first.</p>

    <h2>Children's data</h2>
    <p>ZimMarket is intended for people aged 18 and over, and account registration requires confirming you meet that age. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, contact us using the details below and we will remove it.</p>

    <h2>Data retention and security</h2>
    <p>We keep account and order data for as long as your account is active and as needed to meet our legal and accounting obligations. Passwords are stored as salted hashes, never in plain text, and access to customer data is limited by account role.</p>

    <h2>Your rights</h2>
    <p>From your account dashboard you can request an export of your personal data or request that your account be deleted. Deletion is completed once you have no open orders, and is logged for audit purposes. You can also contact us directly with any privacy request.</p>

    <h2>Changes to this policy</h2>
    <p>If we make material changes to this policy, we'll update the "last updated" date above and, where required, ask you to re-accept it.</p>

    <h2>Contact us</h2>
    <BusinessDetails/>
  </div>;
}

export function TermsContent() {
  return <div className="legal">
    <LegalMeta/>
    <p>These terms govern your use of ZimMarket. By creating an account you agree to them. If you don't agree, please don't use ZimMarket.</p>

    <h2>Eligibility</h2>
    <p>You must be at least 18 years old and able to form a binding contract to register a ZimMarket account, whether as a customer or a business.</p>

    <h2>What ZimMarket is</h2>
    <p>ZimMarket is a marketplace that connects customers with independent local businesses. Businesses listed on ZimMarket are independent third parties responsible for their own products, services, pricing, availability and licensing — ZimMarket is not the seller of record unless stated otherwise. ZimMarket supports businesses with their registration and licence application process, but official licences are issued by the relevant authorities, not by ZimMarket.</p>

    <h2>Your account</h2>
    <p>You're responsible for keeping your login details secure and for activity that happens under your account. Tell us right away if you suspect unauthorised access.</p>

    <h2 id="purchasing">Purchasing rules</h2>
    <p>Product and service listings, pricing and availability are set by the individual business, not ZimMarket, and can change without notice. Placing an order is an offer to buy at the listed price; a business may decline or cancel an order it cannot fulfil, in which case any payment already taken will be refunded per our <a href="/refunds">refund policy</a>.</p>

    <h2>Payments</h2>
    <p>Payments are processed through Paynow. ZimMarket does not store your full card number or mobile money PIN. All prices shown at checkout are the full amount you'll be charged — we don't add undisclosed fees after you've confirmed an order.</p>

    <h2 id="reviews-and-conduct">Review and conduct rules</h2>
    <p>Only customers with a completed order for a product or service may leave a review for it, and reviews must reflect a genuine experience. Fabricated, incentivised or manipulated reviews are not permitted and may be removed. Don't harass other users, misrepresent yourself or your business, or attempt to circumvent the marketplace's safety and moderation features.</p>

    <h2>Limitation of liability</h2>
    <p>ZimMarket facilitates connections between customers and businesses but is not responsible for the quality, safety or legality of items listed by businesses, except where required by law. To the extent permitted by law, ZimMarket's liability is limited to the amount of fees you paid to ZimMarket in the relevant transaction.</p>

    <h2>Suspension and termination</h2>
    <p>We may suspend or close an account that breaches these terms, engages in fraud, or puts other users at risk. You may close your account at any time from your dashboard.</p>

    <h2>Governing law</h2>
    <p>These terms are governed by the laws of Zimbabwe.</p>

    <h2>Changes to these terms</h2>
    <p>If we make material changes, we'll update the "last updated" date above and, where required, ask you to re-accept them.</p>

    <h2>Contact us</h2>
    <BusinessDetails/>
  </div>;
}

export function RefundsContent() {
  return <div className="legal">
    <LegalMeta/>
    <p>This policy explains how refunds work for orders placed through ZimMarket. Because ZimMarket connects you with independent businesses, refund eligibility for a specific product or service also depends on that business's own stated policy, where one exists.</p>

    <h2>When a refund applies</h2>
    <ul>
      <li>A business is unable to fulfil an order you've paid for.</li>
      <li>An item received is significantly different from what was listed, or arrives faulty or damaged.</li>
      <li>A booked service is cancelled by the business.</li>
      <li>A payment was taken in error or duplicated.</li>
    </ul>

    <h2>How to request a refund</h2>
    <p>Contact the business through your order details first, since they can usually resolve it fastest. If that doesn't resolve things, use the feedback button in the app (category "Payment problem") or contact us directly, and include your order reference.</p>

    <h2>Timeframes</h2>
    <p>We aim to acknowledge refund requests within 2 business days. Approved refunds are returned to the original Paynow payment method; how long it takes to appear depends on your bank or mobile money provider, typically a few business days.</p>

    <h2>What isn't covered</h2>
    <p>Change-of-mind returns are handled at the individual business's discretion once an order has been fulfilled, unless required otherwise by consumer protection law. Services already performed in full are generally not refundable except where the service was materially not as described.</p>

    <h2>Contact us</h2>
    <BusinessDetails/>
  </div>;
}

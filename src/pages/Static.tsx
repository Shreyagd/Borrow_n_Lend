import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FAQ_ITEMS } from '../lib/faq'
import { usePageMeta } from '../lib/hooks'

function Doc({ title, desc, draft, children }: { title: string; desc: string; draft?: boolean; children: ReactNode }) {
  usePageMeta(title, desc)
  return (
    <article className="container-page max-w-3xl py-10">
      <h1>{title}</h1>
      {draft && (
        <p role="note" className="mt-4 rounded-lg border border-clay/40 bg-clay-light p-3 text-sm text-clay-dark">
          <strong>DRAFT PLACEHOLDER — not legal advice.</strong> This text has not been reviewed by a lawyer and must be replaced with
          finalized, locally compliant wording before public launch.
        </p>
      )}
      <div className="mt-6 space-y-4 text-ink-soft [&_h2]:mb-1 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </article>
  )
}

export function HowItWorks() {
  return (
    <Doc title="How BorrowLend works" desc="How renting, buying and listing books works on BorrowLend.">
      <h2>If you want to read</h2>
      <ol className="space-y-2 [&_li]:list-decimal">
        <li><strong>Find a book</strong> with search and filters.</li>
        <li><strong>Request to borrow or buy.</strong> You’ll see the full price breakdown first. Nothing is charged by sending a request.</li>
        <li><strong>The owner accepts or declines.</strong> If accepted, you’ll see handover instructions and agree on a time and place.</li>
        <li><strong>Confirm the handover</strong> in the app — both of you confirm, and the rental clock starts.</li>
        <li><strong>Return by the due date.</strong> Tell the owner when you’re returning; they confirm and the rental completes.</li>
      </ol>
      <h2>If you own books</h2>
      <ol className="space-y-2 [&_li]:list-decimal">
        <li><Link to="/list">List a book</Link> with a photo, condition, and your rent and/or sale price.</li>
        <li>Review requests in your dashboard and accept the ones you’re comfortable with.</li>
        <li>Hand over the book locally, confirm it, and confirm the return or sale. Your earnings are tracked in the dashboard.</li>
      </ol>
      <h2>Fees and payments (pilot)</h2>
      <p>BorrowLend charges a platform fee on completed transactions, shown before you confirm and deducted from the owner’s earnings. During the pilot, payment is arranged directly between the two people at handover — BorrowLend does not hold funds or process payments yet.</p>
      <h2>Safety</h2>
      <p>Your exact address and phone number stay private until a request is accepted. Meet in public places where possible. Use “Report” or “Open a dispute” if something goes wrong.</p>
    </Doc>
  )
}

export function About() {
  return (
    <Doc title="About BorrowLend" desc="BorrowLend is a peer-to-peer book rental and resale marketplace.">
      <p>BorrowLend helps people share the books already sitting on their shelves. Owners earn from lending or selling; readers get affordable access to more books; and every reused book is one fewer printed.</p>
      <p>We’re starting small — one launch area, local pickup — and growing as we learn from our first readers and lenders.</p>
    </Doc>
  )
}

export function Contact() {
  return (
    <Doc title="Contact" desc="Contact the BorrowLend team.">
      <p>Questions, feedback or safety concerns? Reach the team at <strong>[support email — set before launch]</strong>.</p>
      <p>To report a listing or a person, use the “Report” button on the listing, or open a dispute from your dashboard for an in-progress rental or order.</p>
    </Doc>
  )
}

export function Faq() {
  const qa = FAQ_ITEMS
  return (
    <Doc title="Help & FAQ" desc="Answers to common questions about renting, buying and listing books on BorrowLend.">
      {qa.map(([q, a]) => (<div key={q}><h2 className="!mt-4 !text-lg">{q}</h2><p>{a}</p></div>))}
    </Doc>
  )
}

export function Terms() {
  return (
    <Doc title="Terms of use" desc="Draft terms of use for BorrowLend." draft>
      <h2>1. About the service</h2>
      <p>[Draft] BorrowLend is a marketplace that connects book owners and readers. BorrowLend is not a party to the transactions between users.</p>
      <h2>2. Accounts</h2>
      <p>[Draft] You must provide accurate information and keep your login secure. Accounts may be suspended for policy violations.</p>
      <h2>3. Listings and conduct</h2>
      <p>[Draft] List only books you own and can lend or sell. Be honest about condition. No illegal, counterfeit or infringing items.</p>
      <h2>4. Fees</h2>
      <p>[Draft] A platform fee applies to completed transactions as displayed before confirmation.</p>
      <h2>5. Liability</h2>
      <p>[Draft — requires legal review for the launch jurisdiction.]</p>
    </Doc>
  )
}

export function Privacy() {
  return (
    <Doc title="Privacy policy" desc="Draft privacy policy for BorrowLend." draft>
      <h2>What we collect</h2>
      <p>[Draft] Account details (name, email), optional phone and city, listing content and photos, and transaction history.</p>
      <h2>What stays private</h2>
      <p>[Draft] Your email, phone and exact pickup address are never shown publicly. A phone number and exact address are shared with the other party only after a request is accepted.</p>
      <h2>Payments</h2>
      <p>[Draft] BorrowLend does not collect or store card details.</p>
      <h2>Your rights</h2>
      <p>[Draft — retention, deletion and data-protection wording must be finalized for the launch jurisdiction.]</p>
    </Doc>
  )
}

export function Policies() {
  return (
    <Doc title="Rental & return policy" desc="Draft rental, return, dispute and fee policy for BorrowLend." draft>
      <h2>Rental period</h2>
      <p>[Draft] A rental starts when both the owner and borrower confirm the handover. The due date is the start date plus the agreed period (7, 14, 21 or 30 days).</p>
      <h2>Returns</h2>
      <p>[Draft] The borrower returns the book by the due date and marks the return; the owner confirms receipt to complete the rental. Rentals past their due date are marked <em>overdue</em>.</p>
      <h2>Late and damage fees</h2>
      <p>[Draft] BorrowLend does <strong>not</strong> automatically charge late or damage fees. A fee process will be introduced only after it is disclosed and legally reviewed.</p>
      <h2>Deposits and payments</h2>
      <p>[Draft] No deposits are collected. During the pilot, payment is arranged directly between users; BorrowLend does not hold funds in escrow.</p>
      <h2>Disputes</h2>
      <p>[Draft] Either party can open a dispute on an in-progress rental or accepted order. An admin reviews it and records an outcome.</p>
      <h2>Cancellations and refunds</h2>
      <p>[Draft — to be defined with the payment provider.]</p>
    </Doc>
  )
}

export function NotFound() {
  usePageMeta('Page not found')
  return (
    <div className="container-page py-20 text-center">
      <h1>Page not found</h1>
      <p className="mt-2 text-ink-soft">The page you’re looking for doesn’t exist.</p>
      <Link to="/" className="btn-primary mt-6 no-underline text-white">Back to home</Link>
    </div>
  )
}

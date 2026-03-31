import { useEffect, useRef } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

const FAQ_ITEMS = [
  {
    question: "What can verify.nexart.io verify?",
    answer:
      "verify.nexart.io verifies Certified Execution Records (CERs) produced by the NexArt execution runtime. It checks certificate hash integrity, node attestation signatures, and receipt consistency. You can look up records by execution ID, certificate hash, or upload a CER bundle directly.",
  },
  {
    question: "Does verification require a NexArt account?",
    answer:
      "No. Verification is anonymous and does not require an account, login, or API key. Anyone with a record identifier or a CER bundle file can verify independently.",
  },
  {
    question: 'What does "verified" mean?',
    answer:
      'When a record shows "Verified" on verify.nexart.io, it means the certificate hash matches the canonical representation of the bundle contents, the node attestation signature is cryptographically valid, and all required attestation fields are present and well-formed. Verification confirms structural integrity and cryptographic consistency. It does not evaluate the correctness of the underlying model.',
  },
  {
    question: "What is being checked during verification?",
    answer:
      "Three things are checked: (1) the SHA-256 certificate hash is recomputed from the record's canonical JSON and compared against the declared hash, (2) if an attestation receipt is present, the Ed25519 node signature is verified, and (3) protocol version, runtime hash, and structural fields are checked for completeness.",
  },
  {
    question: "What happens if verification fails?",
    answer:
      'If any check fails, the record is marked "Not Verified." This may indicate the bundle has been modified after certification, is incomplete, or contains mismatched hashes. A failed verification does not necessarily mean fraud. It can also result from truncated exports or format errors.',
  },
  {
    question: "What is the difference between logs and verification?",
    answer:
      "Logs record what happened within a system. Verification confirms that a record is structurally intact and cryptographically consistent, independently of the system that created it. verify.nexart.io is not a log viewer — it is a proof-checking surface.",
  },
  {
    question: "What is the difference between a CER and a verification result?",
    answer:
      "A CER (Certified Execution Record) is the sealed record itself — it contains inputs, outputs, conditions, and cryptographic proof. A verification result is the outcome of checking that CER on verify.nexart.io: Verified, Not Verified, or Record Not Found.",
  },
  {
    question: "Why does verification need a separate surface?",
    answer:
      "For verification to be meaningful, it must be independent from the system that produced the record. verify.nexart.io operates as a separate surface with no privileged access to the originating runtime. This ensures that verification results are not self-attested.",
  },
];

/** FAQ section with JSON-LD FAQPage schema for GEO/snippet readiness. */
export function VerifierFAQ() {
  const injectedRef = useRef(false);

  useEffect(() => {
    if (injectedRef.current) return;
    injectedRef.current = true;

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    script.dataset.faq = "verifier";
    document.head.appendChild(script);

    return () => {
      script.remove();
      injectedRef.current = false;
    };
  }, []);

  return (
    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-lg font-semibold mb-3">
        Frequently Asked Questions
      </h2>
      <Accordion type="multiple" className="space-y-1">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-border/60">
            <AccordionTrigger className="text-sm text-left font-medium hover:no-underline py-3">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

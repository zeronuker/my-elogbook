import { useState } from "react";
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// ════════════════════════════════════════════════════════════════════
//  FeedbackModal — in-app bug report / feature request → Firestore
// ════════════════════════════════════════════════════════════════════

const APP_VERSION = "v6.7.1";

// ── Google Form dual-write (fire-and-forget) ─────────────────────────────────
const GF_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdUR2dmIbFXxalz29VkWfHZbIJlJq7sHHjZwZvm1741OCsgzA/formResponse";
const GF_FIELDS = {
  type:    "entry.1726619161",
  subject: "entry.1516881691",
  message: "entry.1999386103",
  version: "entry.247546104",
  email:   "entry.1988935079",
};

function submitToGoogleForm({ type, subject, message, version, email }) {
  const body = new URLSearchParams();
  body.append(GF_FIELDS.type,    type);
  body.append(GF_FIELDS.subject, subject);
  body.append(GF_FIELDS.message, message);
  body.append(GF_FIELDS.version, version);
  body.append(GF_FIELDS.email,   email || "not signed in");
  fetch(GF_URL, { method: "POST", mode: "no-cors", body }).catch(() => {});
}

const css = `
  .fb-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.72);
    z-index: 4000;
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    font-family: var(--elb-font, 'Courier New', monospace);
  }
  .fb-modal {
    background: var(--elb-bg2, #141a2e);
    border: 1px solid var(--elb-border, #1a3050);
    border-top: 2px solid var(--elb-acc, #3FE0C5);
    border-radius: 4px;
    width: 100%; max-width: 480px;
    display: flex; flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.85);
    max-height: 90vh;
  }
  .fb-head {
    padding: 20px 22px 16px;
    border-bottom: 1px solid var(--elb-border, #1a3050);
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
  }
  .fb-eyebrow {
    font-size: 10px; letter-spacing: 0.12em;
    color: var(--elb-acc, #3FE0C5); opacity: 0.7;
    text-transform: uppercase; margin-bottom: 4px;
  }
  .fb-title {
    font-size: 15px; font-weight: 700; letter-spacing: 0.08em;
    color: var(--elb-text, #e8eaf6); margin: 0;
    text-transform: uppercase;
  }
  .fb-close {
    background: none; border: none; cursor: pointer;
    color: var(--elb-text-dim, #8899aa);
    font-size: 18px; line-height: 1; padding: 2px 4px;
    border-radius: 3px; flex-shrink: 0;
    transition: color 0.15s;
  }
  .fb-close:hover { color: var(--elb-text, #e8eaf6); }
  .fb-body {
    padding: 20px 22px;
    overflow-y: auto; flex: 1 1 auto; min-height: 0;
    display: flex; flex-direction: column; gap: 16px;
  }
  .fb-field { display: flex; flex-direction: column; gap: 6px; }
  .fb-label {
    font-size: 10px; letter-spacing: 0.1em;
    color: var(--elb-acc, #3FE0C5); text-transform: uppercase;
  }
  .fb-type-row { display: flex; gap: 8px; }
  .fb-type-btn {
    flex: 1; padding: 8px 10px;
    background: var(--elb-bg3, #0d1322);
    border: 1px solid var(--elb-border, #1a3050);
    border-radius: 3px; cursor: pointer;
    color: var(--elb-text-dim, #8899aa);
    font-family: var(--elb-font, 'Courier New', monospace);
    font-size: 12px; letter-spacing: 0.06em;
    text-align: center; transition: all 0.15s;
    text-transform: uppercase;
  }
  .fb-type-btn:hover {
    border-color: var(--elb-acc, #3FE0C5);
    color: var(--elb-text, #e8eaf6);
  }
  .fb-type-btn.active {
    border-color: var(--elb-acc, #3FE0C5);
    color: var(--elb-acc, #3FE0C5);
    background: rgba(63,224,197,0.07);
  }
  .fb-textarea {
    background: var(--elb-bg3, #0d1322);
    border: 1px solid var(--elb-border, #1a3050);
    border-radius: 3px;
    color: var(--elb-text, #e8eaf6);
    font-family: var(--elb-font, 'Courier New', monospace);
    font-size: 13px;
    padding: 10px 12px;
    resize: vertical;
    width: 100%; box-sizing: border-box;
    line-height: 1.5;
    outline: none;
    transition: border-color 0.15s;
  }
  .fb-textarea:focus { border-color: var(--elb-acc, #3FE0C5); }
  .fb-textarea::placeholder { color: var(--elb-text-dim, #8899aa); opacity: 0.6; }
  .fb-hint {
    font-size: 11px; color: var(--elb-text-dim, #8899aa);
    opacity: 0.7; letter-spacing: 0.02em;
  }
  .fb-foot {
    padding: 14px 22px;
    border-top: 1px solid var(--elb-border, #1a3050);
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    flex-shrink: 0;
  }
  .fb-meta {
    font-size: 10px; color: var(--elb-text-dim, #8899aa);
    opacity: 0.6; letter-spacing: 0.04em;
  }
  .fb-btn-row { display: flex; gap: 8px; }
  .fb-btn {
    padding: 8px 18px;
    font-family: var(--elb-font, 'Courier New', monospace);
    font-size: 12px; letter-spacing: 0.08em;
    text-transform: uppercase; border-radius: 3px;
    cursor: pointer; border: 1px solid transparent;
    transition: all 0.15s;
  }
  .fb-btn-cancel {
    background: transparent;
    border-color: var(--elb-border, #1a3050);
    color: var(--elb-text-dim, #8899aa);
  }
  .fb-btn-cancel:hover {
    border-color: var(--elb-text-dim, #8899aa);
    color: var(--elb-text, #e8eaf6);
  }
  .fb-btn-submit {
    background: var(--elb-acc, #3FE0C5);
    color: #0a0f1e; border-color: var(--elb-acc, #3FE0C5);
    font-weight: 700;
  }
  .fb-btn-submit:hover { opacity: 0.88; }
  .fb-btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }
  .fb-success {
    padding: 32px 22px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px; text-align: center;
  }
  .fb-success-icon { font-size: 36px; }
  .fb-success-title {
    font-size: 14px; font-weight: 700;
    letter-spacing: 0.1em; color: var(--elb-acc, #3FE0C5);
    text-transform: uppercase;
  }
  .fb-success-sub {
    font-size: 12px; color: var(--elb-text-dim, #8899aa);
    letter-spacing: 0.04em;
  }
  .fb-error {
    font-size: 11px; color: #f87171;
    letter-spacing: 0.04em;
  }
`;

export default function FeedbackModal({ open, onClose, type: initialType = "bug", user }) {
  const [type, setType]           = useState(initialType);
  const [description, setDesc]    = useState("");
  const [steps, setSteps]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState("");

  // Reset state when modal opens
  const handleOpen = (prevOpen) => {
    if (!prevOpen && open) {
      setType(initialType);
      setDesc("");
      setSteps("");
      setSubmitting(false);
      setSubmitted(false);
      setError("");
    }
  };

  // Sync type when initialType changes (bug vs feature)
  // and reset form on open
  if (!open) {
    // Reset on next open by returning early
    if (submitted || submitting || description || steps || error) {
      // Will reset via useEffect equivalent — handled below
    }
    return null;
  }

  const handleClose = () => {
    setType(initialType);
    setDesc("");
    setSteps("");
    setSubmitting(false);
    setSubmitted(false);
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const typeLabel = type === "bug" ? "Bug Report" : type === "feature" ? "Feature Request" : "General Feedback";
      const fullMessage = steps.trim()
        ? `${description.trim()}\n\nSteps to reproduce:\n${steps.trim()}`
        : description.trim();

      // Primary write → Firestore
      await addDoc(collection(db, "feedback"), {
        type,
        description: description.trim(),
        steps: steps.trim() || null,
        uid: user?.uid || null,
        email: user?.email || null,
        version: APP_VERSION,
        timestamp: serverTimestamp(),
      });

      // Secondary write → Google Form (fire-and-forget, no-cors)
      submitToGoogleForm({
        type:    typeLabel,
        subject: `${typeLabel} — ${APP_VERSION}`,
        message: fullMessage,
        version: APP_VERSION,
        email:   user?.email || "",
      });

      setSubmitted(true);
    } catch (err) {
      console.error("Feedback submit error:", err);
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = type === "bug" ? "Bug Report" : "Feature Request";

  return (
    <>
      <style>{css}</style>
      <div className="fb-backdrop" onClick={handleClose}>
        <div className="fb-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>

          {/* HEAD */}
          <header className="fb-head">
            <div>
              <div className="fb-eyebrow">// feedback</div>
              <h2 className="fb-title">{submitted ? "Submitted" : typeLabel}</h2>
            </div>
            <button className="fb-close" onClick={handleClose} aria-label="Close">✕</button>
          </header>

          {submitted ? (
            /* SUCCESS STATE */
            <div className="fb-success">
              <span className="fb-success-icon">{type === "bug" ? "🐛" : type === "feature" ? "💡" : "✉"}</span>
              <div className="fb-success-title">Thank you!</div>
              <div className="fb-success-sub">
                Your {type === "bug" ? "bug report" : type === "feature" ? "feature request" : "message"} has been received.<br />
                We review all submissions and will follow up if needed.
              </div>
              <button className="fb-btn fb-btn-submit" style={{ marginTop: 8 }} onClick={handleClose}>
                Close
              </button>
            </div>
          ) : (
            <>
              {/* FORM */}
              <div className="fb-body">

                {/* Type selector */}
                <div className="fb-field">
                  <div className="fb-label">Type</div>
                  <div className="fb-type-row">
                    <button
                      className={`fb-type-btn ${type === "bug" ? "active" : ""}`}
                      onClick={() => setType("bug")}
                    >
                      <span style={{ fontSize: 14 }}>🐛</span> Bug Report
                    </button>
                    <button
                      className={`fb-type-btn ${type === "feature" ? "active" : ""}`}
                      onClick={() => setType("feature")}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                    >
                      <span style={{ fontSize: 14 }}>💡</span>
                      <span style={{ whiteSpace: "nowrap" }}>Feature Request</span>
                    </button>
                    <button
                      className={`fb-type-btn ${type === "general" ? "active" : ""}`}
                      onClick={() => setType("general")}
                    >
                      <span style={{ fontSize: 14 }}>🛰️</span> General
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div className="fb-field">
                  <div className="fb-label">
                    {type === "bug" ? "What went wrong?" : type === "feature" ? "What would you like?" : "Your message"}
                  </div>
                  <textarea
                    className="fb-textarea"
                    rows={4}
                    placeholder={
                      type === "bug"
                        ? "Describe the issue clearly..."
                        : type === "feature"
                        ? "Describe the feature you'd like to see..."
                        : "Write your message here..."
                    }
                    value={description}
                    onChange={e => setDesc(e.target.value)}
                  />
                </div>

                {/* Steps (bug only) */}
                {type === "bug" && (
                  <div className="fb-field">
                    <div className="fb-label">Steps to reproduce <span style={{ opacity: 0.5 }}>(optional)</span></div>
                    <textarea
                      className="fb-textarea"
                      rows={3}
                      placeholder={"1. Go to...\n2. Click...\n3. See error"}
                      value={steps}
                      onChange={e => setSteps(e.target.value)}
                    />
                  </div>
                )}

                {error && <div className="fb-error">{error}</div>}
              </div>

              {/* FOOTER */}
              <footer className="fb-foot">
                <div className="fb-meta">
                  {user?.email || "Not signed in"} · {APP_VERSION}
                </div>
                <div className="fb-btn-row">
                  <button className="fb-btn fb-btn-cancel" onClick={handleClose}>Cancel</button>
                  <button
                    className="fb-btn fb-btn-submit"
                    onClick={handleSubmit}
                    disabled={!description.trim() || submitting}
                  >
                    {submitting ? "Sending..." : "Submit"}
                  </button>
                </div>
              </footer>
            </>
          )}

        </div>
      </div>
    </>
  );
}

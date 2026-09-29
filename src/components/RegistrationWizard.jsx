import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { cn } from "../lib/utils";
import {
  cleanSpaces,
  DUPLICATE_REGISTRATION_MESSAGE,
  firstInvalidVisitorField,
  JACKET_SIZES,
  MEMBER_CONFIRMATION,
  normalizeCanadianPhone,
  normalizeEmail,
  REGISTRATION_CLOSED_MESSAGE,
  validateField,
  VISITOR_CONFIRMATION,
} from "../lib/registration";
import {
  fetchJacketAvailability,
  recordMemberResponse,
  submitVisitorRegistration,
} from "../lib/submitToGoogleSheet";

const STEPS = [
  { field: "registrationType", title: "Are you a member or visitor?" },
  { field: "fullName", title: "Full Name" },
  { field: "phone", title: "Phone Number" },
  { field: "email", title: "Email Address" },
  { field: "location", title: "Location (City or Area)" },
  { field: "age", title: "Age" },
  { field: "gender", title: "Gender" },
  { field: "jacketSize", title: "Jacket Size" },
  { field: "preferredContactMethod", title: "What is your preferred contact method?" },
];

const FIELD_STEP_INDEX = Object.fromEntries(STEPS.map(({ field }, index) => [field, index]));

function createSessionKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `reg_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function newForm() {
  return {
    registrationType: "",
    fullName: "",
    phone: "",
    email: "",
    location: "",
    age: "",
    gender: "",
    jacketSize: "",
    preferredContactMethod: "",
    idempotencyKey: createSessionKey(),
  };
}

function ChoiceList({ field, value, options, onChange, inventory = null, disabled = false }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={field}>
      {options.map((option) => {
        const optionValue = typeof option === "string" ? option : option.value;
        const label = typeof option === "string" ? option : option.label;
        const available = field !== "jacketSize" || inventory?.[optionValue] !== false;
        const unavailable = disabled || !available;
        return (
          <label
            key={optionValue}
            className={cn(
              "group flex min-h-16 items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left font-semibold text-text transition-all",
              value === optionValue
                ? "border-gold-600 bg-gold-100 shadow-[var(--shadow-medium)]"
                : "border-gold-200 bg-ivory-50 hover:border-gold-500 hover:bg-ivory-50",
              unavailable &&
                "cursor-not-allowed border-neutral-400 bg-neutral-100 text-neutral-700",
              !unavailable && "cursor-pointer"
            )}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name={field}
                value={optionValue}
                checked={value === optionValue}
                disabled={unavailable}
                onChange={() => onChange(optionValue)}
                className="h-5 w-5 border-gold-500 text-gold-500 focus:ring-gold-400"
              />
              <span>{label}</span>
            </span>
            {field === "jacketSize" && unavailable && (
              <span className="whitespace-nowrap text-xs font-medium text-neutral-700">
                Unavailable
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function ConfirmationCard({ title = "Registration complete", message, registrationId = "" }) {
  return (
    <Card className="winter-card wizard-card overflow-hidden">
      <CardContent className="px-6 py-10 text-center sm:px-10 sm:py-14">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-forest-800 text-2xl text-ivory-50 shadow-md"
          aria-hidden="true"
        >
          ✓
        </div>
        <h2 className="text-2xl font-bold text-forest-950 sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-text/85 sm:text-lg">
          {message}
        </p>
        {registrationId && (
          <p className="mt-6 text-sm font-semibold text-forest-900">
            Registration ID: <span className="font-mono">{registrationId}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ClosedCard() {
  return (
    <Card className="winter-card wizard-card overflow-hidden">
      <CardContent className="px-6 py-10 text-center sm:px-10 sm:py-14">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gold-200 text-2xl text-forest-950 shadow-sm"
          aria-hidden="true"
        >
          ⏱
        </div>
        <h2 className="text-2xl font-bold text-forest-950 sm:text-3xl">Registration closed</h2>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-text/85 sm:text-lg">
          {REGISTRATION_CLOSED_MESSAGE}
        </p>
      </CardContent>
    </Card>
  );
}

export function RegistrationWizard() {
  const [form, setForm] = useState(newForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState("form");
  const [error, setError] = useState("");
  const [inventory, setInventory] = useState(null);
  const [inventoryError, setInventoryError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationId, setRegistrationId] = useState("");
  const headingRef = useRef(null);
  const submittingRef = useRef(false);

  const loadAvailability = useCallback(async () => {
    setInventoryError("");
    try {
      const latest = await fetchJacketAvailability();
      if (latest.closed) {
        setStatus("closed");
        return { ok: false, closed: true };
      }
      setInventory(latest.inventory);
      return { ok: true, closed: false };
    } catch (availabilityError) {
      setInventory(Object.fromEntries(JACKET_SIZES.map((size) => [size, true])));
      setInventoryError(
        `${availabilityError.message || "Live jacket availability could not be loaded."} You can still select a size and continue; availability will be checked when you submit.`
      );
      return { ok: false, closed: false };
    }
  }, []);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex, status]);

  const step = STEPS[stepIndex];
  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const submitMember = async (registrationType = form.registrationType) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError("");
    try {
      const result = await recordMemberResponse({
        registrationType,
        idempotencyKey: form.idempotencyKey,
      });
      setRegistrationId(result.registrationId || "");
      setStatus("memberComplete");
    } catch (submissionError) {
      if (submissionError.code === "REGISTRATION_CLOSED") {
        setStatus("closed");
      } else if (submissionError.code === "DUPLICATE_REGISTRATION") {
        setError(DUPLICATE_REGISTRATION_MESSAGE);
      } else {
        setError(submissionError.message || "Your response could not be saved. Please try again.");
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const chooseRegistrationType = async (value) => {
    update("registrationType", value);
    if (value === "Member") await submitMember(value);
  };

  const goBack = () => {
    if (isSubmitting || stepIndex === 0) return;
    setError("");
    setStepIndex((current) => current - 1);
  };

  const normalizeCurrentAnswer = (field) => {
    let value = form[field];
    if (field === "fullName" || field === "location") value = cleanSpaces(value);
    if (field === "phone") value = normalizeCanadianPhone(value) || value;
    if (field === "email") value = normalizeEmail(value);
    if (field === "age") value = String(value).trim();
    if (value !== form[field]) update(field, value);
  };

  const submitVisitor = async () => {
    if (submittingRef.current) return;

    const invalidField = firstInvalidVisitorField(form, { inventory });
    if (invalidField) {
      setStepIndex(FIELD_STEP_INDEX[invalidField]);
      setError(validateField(invalidField, form[invalidField], { inventory }));
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError("");
    try {
      const result = await submitVisitorRegistration(form);
      if (result.inventory) {
        setInventory(result.inventory);
      }
      setRegistrationId(result.registrationId || "");
      setStatus("visitorComplete");
    } catch (submissionError) {
      if (submissionError.inventory) {
        setInventory(submissionError.inventory);
      }
      if (submissionError.code === "SIZE_UNAVAILABLE") {
        setStepIndex(FIELD_STEP_INDEX.jacketSize);
        setError("This size is no longer available. Please select another available size.");
        await loadAvailability();
      } else if (submissionError.code === "DUPLICATE_REGISTRATION") {
        setError(DUPLICATE_REGISTRATION_MESSAGE);
      } else if (submissionError.code === "REGISTRATION_CLOSED") {
        setStatus("closed");
      } else if (submissionError.code === "VALIDATION_ERROR" && submissionError.errors) {
        const field = STEPS.find(
          ({ field: candidate }) => submissionError.errors[candidate]
        )?.field;
        if (field) setStepIndex(FIELD_STEP_INDEX[field]);
        setError(field ? submissionError.errors[field] : submissionError.message);
      } else {
        setError(submissionError.message || "Registration could not be saved. Please try again.");
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleContinue = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const field = step.field;
    const fieldError = validateField(field, form[field], { inventory });
    if (fieldError) {
      setError(fieldError);
      return;
    }
    normalizeCurrentAnswer(field);

    if (field === "registrationType" && form.registrationType === "Member") {
      await submitMember("Member");
      return;
    }

    if (field === "preferredContactMethod") {
      await submitVisitor();
      return;
    }
    if (field === "gender") {
      const availabilityResult = await loadAvailability();
      if (availabilityResult.closed) return;
    }
    setError("");
    setStepIndex((current) => current + 1);
  };

  if (status === "memberComplete") {
    return (
      <ConfirmationCard title="Registration could not be completed" message={MEMBER_CONFIRMATION} />
    );
  }
  if (status === "visitorComplete") {
    return <ConfirmationCard message={VISITOR_CONFIRMATION} registrationId={registrationId} />;
  }
  if (status === "closed") {
    return <ClosedCard />;
  }

  const inputClass = cn(
    "mt-5 block w-full rounded-xl border-2 border-gold-200 bg-ivory-50 px-4 py-3.5 text-lg text-text shadow-sm",
    "placeholder:text-neutral-700 focus:border-gold-600 focus:ring-2 focus:ring-gold-400/45"
  );
  const isSizeStep = step.field === "jacketSize";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-4 text-sm font-medium text-ivory-50 drop-shadow">
        <span>
          Question {stepIndex + 1} of {STEPS.length}
        </span>
        <span>{Math.round(((stepIndex + 1) / STEPS.length) * 100)}%</span>
      </div>
      <div
        className="mb-6 h-2 overflow-hidden rounded-full bg-ivory-50/30"
        role="progressbar"
        aria-label="Registration progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(((stepIndex + 1) / STEPS.length) * 100)}
      >
        <div
          className="h-full rounded-full bg-gold-500 transition-all duration-500"
          style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <Card key={step.field} className="winter-card wizard-card overflow-hidden">
        <CardContent className="p-6 sm:p-10">
          <form onSubmit={handleContinue} noValidate>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-forest-700">
              {stepIndex + 1} →
            </p>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl leading-tight font-bold text-forest-950 outline-none sm:text-3xl"
            >
              {step.title}
            </h2>

            <div className="mt-7">
              {step.field === "registrationType" && (
                <ChoiceList
                  field="registrationType"
                  value={form.registrationType}
                  options={["Member", "Visitor"]}
                  onChange={chooseRegistrationType}
                  disabled={isSubmitting}
                />
              )}
              {step.field === "fullName" && (
                <>
                  <label htmlFor="fullName" className="sr-only">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    autoFocus
                    value={form.fullName}
                    onChange={(event) => update("fullName", event.target.value)}
                    placeholder="First and last name"
                    className={inputClass}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "question-error" : undefined}
                  />
                </>
              )}
              {step.field === "phone" && (
                <>
                  <label htmlFor="phone" className="sr-only">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    autoFocus
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder="e.g. (416) 555-1234"
                    className={inputClass}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "question-error" : undefined}
                  />
                </>
              )}
              {step.field === "email" && (
                <>
                  <label htmlFor="email" className="sr-only">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    placeholder="you@example.com"
                    className={inputClass}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "question-error" : undefined}
                  />
                </>
              )}
              {step.field === "location" && (
                <>
                  <label htmlFor="location" className="sr-only">
                    Location (City or Area)
                  </label>
                  <input
                    id="location"
                    type="text"
                    autoComplete="address-level2"
                    autoFocus
                    value={form.location}
                    onChange={(event) => update("location", event.target.value)}
                    placeholder="City, neighbourhood, or area"
                    className={inputClass}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "question-error" : undefined}
                  />
                </>
              )}
              {step.field === "age" && (
                <>
                  <label htmlFor="age" className="sr-only">
                    Age
                  </label>
                  <input
                    id="age"
                    type="number"
                    inputMode="numeric"
                    min="12"
                    max="120"
                    step="1"
                    autoFocus
                    value={form.age}
                    onChange={(event) => update("age", event.target.value)}
                    placeholder="Age"
                    className={inputClass}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "question-error" : undefined}
                  />
                </>
              )}
              {step.field === "gender" && (
                <ChoiceList
                  field="gender"
                  value={form.gender}
                  options={["Male", "Female"]}
                  onChange={(value) => update("gender", value)}
                />
              )}
              {isSizeStep && !inventory && (
                <div className="rounded-xl border border-gold-500 bg-warning-background p-4 text-sm text-warning-text">
                  <p>Checking current jacket availability…</p>
                </div>
              )}
              {isSizeStep && inventoryError && inventory && (
                <div
                  className="mb-4 rounded-xl border border-gold-500 bg-warning-background p-4 text-sm text-warning-text"
                  role="status"
                >
                  <p>{inventoryError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={loadAvailability}
                  >
                    Retry live availability
                  </Button>
                </div>
              )}
              {isSizeStep && inventory && (
                <ChoiceList
                  field="jacketSize"
                  value={form.jacketSize}
                  options={JACKET_SIZES}
                  onChange={(value) => update("jacketSize", value)}
                  inventory={inventory}
                />
              )}
              {step.field === "preferredContactMethod" && (
                <ChoiceList
                  field="preferredContactMethod"
                  value={form.preferredContactMethod}
                  options={["Phone", "Email"]}
                  onChange={(value) => update("preferredContactMethod", value)}
                />
              )}
            </div>

            {error && (
              <p
                id="question-error"
                className="mt-4 rounded-lg border border-error/35 bg-error-background px-3 py-2 text-sm font-semibold text-error"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={goBack}
                disabled={stepIndex === 0 || isSubmitting}
                className={stepIndex === 0 ? "invisible" : ""}
              >
                ← Back
              </Button>
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting || (isSizeStep && !inventory)}
                  className="min-w-40"
                >
                  {isSubmitting
                    ? step.field === "registrationType"
                      ? "Saving…"
                      : "Submitting…"
                    : step.field === "preferredContactMethod"
                      ? "Submit Registration"
                      : "Continue →"}
                </Button>
                <span className="text-center text-xs text-neutral-700 sm:text-right">
                  press Enter ↵
                </span>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="sr-only" aria-live="polite">
        {error || `Question ${stepIndex + 1} of ${STEPS.length}: ${step.title}`}
      </p>
    </div>
  );
}

import { useState } from "react";
import { useInView } from "react-intersection-observer";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import toast from "react-hot-toast";

const VOLUNTEER_AREAS = [
  { value: "drywall", label: "Drywall Installation" },
  { value: "painting", label: "Painting & Finishing" },
  { value: "electrical", label: "Electrical Works" },
  { value: "plumbing", label: "Plumbing" },
  { value: "carpentry", label: "Carpentry / Woodwork" },
  { value: "cleaning", label: "Cleaning" },
  { value: "interior", label: "Interior Decoration" },
  { value: "furniture", label: "Furniture Assembly" },
  { value: "av", label: "Technical Support (Audio/Visual Setup)" },
  { value: "logistics", label: "Logistics & material handling" },
  { value: "catering", label: "Catering / Food Support" },
  { value: "labour", label: "General Labour" },
  { value: "others", label: "Others" },
];

const WEEKDAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
];

const initialDays = () =>
  WEEKDAYS.reduce((acc, { key }) => ({ ...acc, [key]: false }), {});

const initialForm = {
  fullName: "",
  phone: "",
  gender: "",
  areaOfVolunteering: "",
  otherVolunteerArea: "",
  availableDays: initialDays(),
  availabilityNotes: "",
  supportAmount: "",
  remittanceDate: "",
};

function SectionRule() {
  return (
    <div className="flex items-center gap-3 my-8" aria-hidden="true">
      <div className="flex-1 h-px bg-amber-300/70" />
      <span className="text-amber-600/90 text-lg select-none">⸻</span>
      <div className="flex-1 h-px bg-amber-300/70" />
    </div>
  );
}

export function RegistrationPage() {
  const [form, setForm] = useState(initialForm);
  const [heroRef, heroInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [formRef, formInView] = useInView({ threshold: 0.1, triggerOnce: true });

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDay = (key) => {
    setForm((prev) => ({
      ...prev,
      availableDays: { ...prev.availableDays, [key]: !prev.availableDays[key] },
    }));
  };

  const selectedDaysCount = Object.values(form.availableDays).filter(Boolean).length;
  const showOthersField = form.areaOfVolunteering === "others";

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Please enter your phone number.");
      return;
    }
    if (!form.gender) {
      toast.error("Please select your gender.");
      return;
    }
    if (!form.areaOfVolunteering) {
      toast.error("Please select an area of volunteering.");
      return;
    }
    if (showOthersField && !form.otherVolunteerArea.trim()) {
      toast.error('Please describe your area under "Others".');
      return;
    }
    if (selectedDaysCount === 0 && !form.availabilityNotes.trim()) {
      toast.error(
        "Please select at least one available day (Monday–Saturday) or describe your availability in the text box."
      );
      return;
    }

    // In production: POST to your API
    toast.success("Thank you! Your volunteer registration has been submitted.");
    setForm(initialForm);
  };

  return (
    <div className="min-h-screen relative">
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
          style={{ backgroundImage: "url(/bg.png)" }}
        />
        <div className="fixed inset-0 bg-black/55 -z-10" />

        <div className="relative z-0 max-w-2xl mx-auto px-4 py-8 sm:py-12 pb-16">
          {/* HEADER */}
          <section
            id="hero"
            ref={heroRef}
            className={cn(
              "text-center mb-6 transition-all duration-500",
              heroInView && "animate-slide-up"
            )}
          >
            <div
              className={cn(
                "glass rounded-2xl p-6 sm:p-8 bg-amber-50/95 border border-amber-200/60 text-left sm:text-center",
                heroInView && "animate-scale-in"
              )}
            >
              <img
                src="/logo2.jpeg"
                alt="Eagles Nest Church — Gospel Pillars"
                className="mx-auto h-20 sm:h-24 w-auto object-contain rounded-lg mb-5"
              />
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-black leading-tight mb-1">
                Eagles Nest New Church Facility Project
              </h1>
              <p className="text-lg sm:text-xl font-semibold text-amber-900 mb-4">
                Volunteer Registration Form
              </p>
              <p className="text-black text-sm sm:text-base leading-relaxed max-w-xl mx-auto mb-6">
                Join us as we come together to build and prepare our new facility for God&apos;s work.
                Your time, skills, and service will make a lasting impact. We welcome all willing hands
                to be part of this great project.
              </p>
              <div className="rounded-xl bg-amber-100/90 border border-amber-200/70 px-4 py-3 text-black text-sm sm:text-base">
                <p className="font-semibold text-amber-950 mb-1">Project Duration:</p>
                <p className="text-black/90">23rd March – 4th April</p>
              </div>
            </div>
          </section>

          <SectionRule />

          {/* BODY */}
          <section className="glass rounded-2xl p-6 sm:p-8 bg-amber-50/92 border border-amber-200/60 mb-8 text-black">
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              We are inviting volunteers to support various aspects of the Eagles Nest New Facility
              Project. Whether you have professional experience or simply a willing heart to serve,
              there is a place for you.
            </p>
            <p className="text-sm sm:text-base leading-relaxed">
              Please fill out the form below with accurate details so we can assign you to the
              appropriate team.
            </p>
          </section>

          {/* FORM */}
          <section
            id="registration"
            ref={formRef}
            className={cn("transition-all duration-500", formInView && "animate-slide-up delay-2")}
          >
            <Card className={cn("glass border-amber-200/80 shadow-xl", formInView && "animate-scale-in")}>
              <CardHeader>
                <h2 className="text-xl font-semibold text-black">Volunteer details</h2>
                <p className="text-sm text-black/75 mt-1">
                  Fields marked <span className="text-black">*</span> are required.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-black mb-1">
                      Full Name <span className="text-black">*</span>
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(e) => update("fullName", e.target.value)}
                      className={cn(
                        "mt-1 block w-full rounded-lg border border-amber-300/80",
                        "bg-white text-black placeholder:text-neutral-500",
                        "px-4 py-2.5 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      )}
                      placeholder="Your full name"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-black mb-1">
                      Phone Number <span className="text-black">*</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className={cn(
                        "mt-1 block w-full rounded-lg border border-amber-300/80",
                        "bg-white text-black placeholder:text-neutral-500",
                        "px-4 py-2.5 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      )}
                      placeholder="e.g. (416) 555-0123"
                    />
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-black mb-2">
                      Gender <span className="text-black">*</span>
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {["Male", "Female"].map((g) => (
                        <label
                          key={g}
                          className={cn(
                            "flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2.5 transition-colors",
                            form.gender === g
                              ? "border-amber-500 bg-amber-100 text-black"
                              : "border-amber-300/80 hover:border-amber-400 bg-white text-black"
                          )}
                        >
                          <input
                            type="radio"
                            name="gender"
                            value={g}
                            checked={form.gender === g}
                            onChange={(e) => update("gender", e.target.value)}
                            className="sr-only"
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="areaOfVolunteering" className="block text-sm font-medium text-black mb-1">
                      Area of Volunteering <span className="text-black">*</span>
                    </label>
                    <select
                      id="areaOfVolunteering"
                      value={form.areaOfVolunteering}
                      onChange={(e) => update("areaOfVolunteering", e.target.value)}
                      className={cn(
                        "mt-1 block w-full rounded-lg border border-amber-300/80",
                        "bg-white text-black",
                        "px-4 py-2.5 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      )}
                    >
                      <option value="">Select an area</option>
                      {VOLUNTEER_AREAS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {showOthersField && (
                      <div className="mt-3">
                        <label htmlFor="otherVolunteerArea" className="block text-sm font-medium text-black mb-1">
                          Please specify (Others) <span className="text-black">*</span>
                        </label>
                        <input
                          id="otherVolunteerArea"
                          type="text"
                          value={form.otherVolunteerArea}
                          onChange={(e) => update("otherVolunteerArea", e.target.value)}
                          className={cn(
                            "mt-1 block w-full rounded-lg border border-amber-300/80",
                            "bg-white text-black placeholder:text-neutral-500",
                            "px-4 py-2.5 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                          )}
                          placeholder="Describe how you’d like to serve"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-black mb-1">
                      Available Days (Monday – Saturday) <span className="text-black">*</span>
                    </span>
                    <p className="text-xs text-black/75 mb-3">
                      Please specify availability — you can choose multiple days. Or describe your
                      availability in the text box below.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {WEEKDAYS.map(({ key, label }) => (
                        <label
                          key={key}
                          className={cn(
                            "flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors",
                            form.availableDays[key]
                              ? "border-amber-500 bg-amber-100 text-black"
                              : "border-amber-300/80 bg-white text-black hover:border-amber-400"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={form.availableDays[key]}
                            onChange={() => toggleDay(key)}
                            className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <label htmlFor="availabilityNotes" className="block text-sm font-medium text-black mt-4 mb-1">
                      Availability notes (optional if days are selected above)
                    </label>
                    <textarea
                      id="availabilityNotes"
                      rows={3}
                      value={form.availabilityNotes}
                      onChange={(e) => update("availabilityNotes", e.target.value)}
                      className={cn(
                        "mt-1 block w-full rounded-lg border border-amber-300/80",
                        "bg-white text-black placeholder:text-neutral-500",
                        "px-4 py-2.5 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      )}
                      placeholder="e.g. Mornings only, or specific dates within the project window"
                    />
                  </div>

                  <SectionRule />

                  <div className="rounded-xl bg-amber-100/85 border border-amber-200/70 p-4 space-y-3">
                    <h3 className="text-base font-semibold text-black">Financial Support / Offering</h3>
                    <p className="text-sm text-black/85 leading-relaxed">
                      If you would like to support this project financially, kindly use the project
                      account details provided below:
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-black">INTERAC e-Transfer: </span>
                      <a
                        href="mailto:Gospelpillarsontario@gmail.com"
                        className="text-amber-900 underline underline-offset-2 break-all"
                      >
                        Gospelpillarsontario@gmail.com
                      </a>
                    </p>
                    <div>
                      <label htmlFor="supportAmount" className="block text-sm font-medium text-black mb-1">
                        Support Amount
                      </label>
                      <input
                        id="supportAmount"
                        type="text"
                        inputMode="decimal"
                        value={form.supportAmount}
                        onChange={(e) => update("supportAmount", e.target.value)}
                        className={cn(
                          "mt-1 block w-full rounded-lg border border-amber-300/80",
                          "bg-white text-black placeholder:text-neutral-500",
                          "px-4 py-2.5 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        )}
                        placeholder="Optional — e.g. $100"
                      />
                    </div>
                    <div>
                      <label htmlFor="remittanceDate" className="block text-sm font-medium text-black mb-1">
                        Date of remission
                      </label>
                      <input
                        id="remittanceDate"
                        type="date"
                        value={form.remittanceDate}
                        onChange={(e) => update("remittanceDate", e.target.value)}
                        className={cn(
                          "mt-1 block w-full rounded-lg border border-amber-300/80",
                          "bg-white text-black",
                          "px-4 py-2.5 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        )}
                      />
                    </div>
                    <p className="text-xs text-black/75 pt-1">
                      All contributions will go directly toward the successful completion of the facility.
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button type="submit" size="sm" className="w-full sm:w-auto">
                      Submit registration
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </section>

          <SectionRule />

          {/* FOOTER */}
          <footer className="text-center text-white text-sm sm:text-base space-y-4 drop-shadow-md px-2 no-print">
            <p className="leading-relaxed max-w-xl mx-auto">
              Thank you for your willingness to serve and be part of what God is doing through this
              project. Your contribution, whether in service or giving, is highly valued and
              appreciated.
            </p>
            <blockquote className="italic text-white/95 max-w-lg mx-auto border-l-4 border-amber-400/80 pl-4 text-left">
              &ldquo;Each of you should use whatever gift you have received to serve others.&rdquo; – 1
              Peter 4:10
            </blockquote>
            <p className="text-white/90">
              For inquiries or further information, please contact the project coordination team.
            </p>
            <div className="pt-2 border-t border-white/25 max-w-md mx-auto">
              <p className="font-semibold text-white">Eagles Nest Church</p>
              <p className="text-white/90 text-sm mt-1">Building Together, Growing in Faith</p>
            </div>
            <p className="text-white/80 text-xs sm:text-sm pt-2">
              © Gospel Pillars 2026
            </p>
          </footer>
        </div>
      </div>
  );
}

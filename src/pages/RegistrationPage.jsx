import { useState } from "react";
import { useInView } from "react-intersection-observer";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import toast from "react-hot-toast";

const AREAS = [
  { value: "toronto", label: "Toronto (Pst Caleb)" },
  { value: "peel1", label: "Peel 1 (Princess)" },
  { value: "peel2", label: "Peel 2 (Pst Duke)" },
  { value: "waterloo", label: "Waterloo (Ivy)" },
  { value: "york", label: "York (Pst Freda)" },
  { value: "durham", label: "Durham (Cynthia)" },
  { value: "campus", label: "Campus (Osahon)" },
];

const MEN_T_SHIRT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];
const LADIES_T_SHIRT_SIZES = ["S", "M", "L", "XL", "2XL"];
const MEN_FIT_LABEL = "Men's fit";
const LADIES_FIT_LABEL = "Ladies fit";

const initialForm = {
  fullName: "",
  gender: "",
  phone: "",
  area: "",
  tShirtSize: "",
};

export function RegistrationPage() {
  const [form, setForm] = useState(initialForm);
  const [heroRef, heroInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [formRef, formInView] = useInView({ threshold: 0.1, triggerOnce: true });

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "gender") next.tShirtSize = "";
      return next;
    });
  };

  const tShirtSizes = form.gender === "Male" ? MEN_T_SHIRT_SIZES : form.gender === "Female" ? LADIES_T_SHIRT_SIZES : [];
  const tShirtFitLabel = form.gender === "Male" ? MEN_FIT_LABEL : form.gender === "Female" ? LADIES_FIT_LABEL : null;
  const tShirtDisabled = !form.gender;

  const handleSubmit = (e) => {
    e.preventDefault();
    const missing = Object.entries(form).filter(([, v]) => !String(v).trim());
    if (missing.length) {
      toast.error("Please fill in all fields.");
      return;
    }
    // In a real app you would POST to an API here
    toast.success("Registration submitted successfully! We'll be in touch.");
    setForm(initialForm);
  };

  return (
    <div className="min-h-screen relative">
      {/* Background image – full viewport, fully fit */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: "url(/bg.png)" }}
      />
      <div className="fixed inset-0 bg-black/50 -z-10" />

      <div className="relative z-0 max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Hero / Intro section – scroll-triggered animation */}
        <section
          id="hero"
          ref={heroRef}
          className={cn("text-center mb-10 transition-all duration-500", heroInView && "animate-slide-up")}
        >
          <div className={cn("glass rounded-2xl p-6 sm:p-8 bg-amber-50/95 border border-amber-200/60", heroInView && "animate-scale-in")}>
            <img
              src="/logo2.jpeg"
              alt="Gospel Pillars Canada"
              className="mx-auto h-24 w-auto object-contain rounded-lg mb-4"
            />
            <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2">
              Four Jesus Sundays Special Campaign
            </h1>
            <p className="text-black text-sm sm:text-base leading-relaxed max-w-xl mx-auto mb-4">
              Register to be part of our Four Jesus Sundays Toronto Special Campaign / Combined Outreach.
            </p>
            <p className="text-black/90 text-sm mb-2">
              This program holds this <strong>Saturday at 12:00 noon</strong> in North York.
            </p>
            <div className="mt-4 p-4 rounded-xl bg-amber-100/80 border border-amber-200/60 text-left text-sm text-black">
              <p className="font-semibold mb-1">Dress Code:</p>
              <p>White T-shirt with blue or black jeans.</p>
              <p className="mt-2 text-black/90">
                Customized Four Jesus Sundays T-shirts are also available. Please reach out to your area Pastor.
              </p>
            </div>
          </div>
        </section>

        {/* Registration form section – scroll-triggered animation */}
        <section
          id="registration"
          ref={formRef}
          className={cn("transition-all duration-500", formInView && "animate-slide-up delay-2")}
        >
          <Card className={cn("glass border-amber-200/80 shadow-xl", formInView && "animate-scale-in")}>
            <CardHeader>
              <h2 className="text-xl font-semibold text-black">
                Registration Form
              </h2>
              <p className="text-sm text-black/80 mt-1">
                Gospel Pillars Canada – Four Jesus Sundays
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Full Name */}
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-black mb-1">
                    Full Name <span className="text-black">*</span>
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
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

                {/* Gender */}
                <div>
                  <span className="block text-sm font-medium text-black mb-2">
                    Gender <span className="text-black">*</span>
                  </span>
                  <div className="flex gap-4">
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

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-black mb-1">
                    Phone Number <span className="text-black">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
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

                {/* Area */}
                <div>
                  <label htmlFor="area" className="block text-sm font-medium text-black mb-1">
                    Area <span className="text-black">*</span>
                  </label>
                  <select
                    id="area"
                    required
                    value={form.area}
                    onChange={(e) => update("area", e.target.value)}
                    className={cn(
                      "mt-1 block w-full rounded-lg border border-amber-300/80",
                      "bg-white text-black",
                      "px-4 py-2.5 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    )}
                  >
                    <option value="">Select your area</option>
                    {AREAS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* T-Shirt Size – Men's fit or Ladies fit based on gender */}
                <div>
                  <label htmlFor="tShirtSize" className="block text-sm font-medium text-black mb-1">
                    T-Shirt Size <span className="text-black">*</span>
                    {tShirtFitLabel && (
                      <span className="ml-2 font-normal text-black/80">({tShirtFitLabel})</span>
                    )}
                  </label>
                  <select
                    id="tShirtSize"
                    required
                    disabled={tShirtDisabled}
                    value={form.tShirtSize}
                    onChange={(e) => update("tShirtSize", e.target.value)}
                    className={cn(
                      "mt-1 block w-full rounded-lg border border-amber-300/80",
                      "bg-white text-black",
                      "px-4 py-2.5 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500",
                      tShirtDisabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <option value="">
                      {tShirtDisabled ? "Select gender first" : `Select size (${tShirtFitLabel})`}
                    </option>
                    {tShirtFitLabel && (
                      <optgroup label={tShirtFitLabel}>
                        {tShirtSizes.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="pt-2">
                  <Button type="submit" size="sm" className="w-full sm:w-auto">
                    Submit Registration
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>

        <footer className="mt-12 text-center text-white text-sm no-print drop-shadow">
          Gospel Pillars Canada © 2026
        </footer>
      </div>
    </div>
  );
}

import { useInView } from "react-intersection-observer";
import { RegistrationWizard } from "../components/RegistrationWizard";
import { cn } from "../lib/utils";

function SectionRule() {
  return (
    <div className="flex items-center gap-3 my-8" aria-hidden="true">
      <div className="h-px flex-1 bg-gold-400/65" />
      <span className="select-none text-lg text-gold-400/90">⸻</span>
      <div className="h-px flex-1 bg-gold-400/65" />
    </div>
  );
}

export function RegistrationPage() {
  const [heroRef, heroInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [formRef, formInView] = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <div className="min-h-screen relative">
      <div
        className="winter-background fixed inset-0 -z-10 bg-cover bg-no-repeat"
        style={{ backgroundImage: "url(/bg2.png)" }}
      />
      <div className="winter-overlay fixed inset-0 -z-10" />

      <div className="relative z-0 max-w-2xl mx-auto px-4 py-8 sm:py-12 pb-16">
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
              "winter-card rounded-2xl p-6 text-left sm:p-8 sm:text-center",
              heroInView && "animate-scale-in"
            )}
          >
            <img
              src="/onesoundlogo.jpg"
              alt="One Sound logo"
              className="mx-auto mb-5 h-20 w-auto rounded-lg border border-gold-500/35 object-contain shadow-sm sm:h-24"
            />
            <h1 className="mb-4 text-xl leading-tight font-bold text-forest-950 sm:text-2xl md:text-3xl">
              Winter Welfare Sunday Registration Form
            </h1>
            <div className="mx-auto max-w-2xl space-y-4 text-left text-sm leading-relaxed text-text sm:text-base">
              <p>
                We are thrilled to support our community by providing free winter jackets for
                adults.
              </p>
              <p className="font-bold">Register to receive yours by completing the form below.</p>
              <div>
                <h2 className="font-bold mb-2">Important Registration Information</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    Winter jackets will be given only to individuals who are physically present at
                    the church on the collection day.
                  </li>
                  <li>If you have registered previously, please do not register again.</li>
                  <li>
                    If you will not be available on the day of the winter jacket collection, please
                    do not register. This will allow the opportunity to be given to someone who can
                    attend.
                  </li>
                </ul>
              </div>
              <p>
                <strong>Venue:</strong> GOSPEL PILLARS CHURCH TORONTO (The Eagle’s Nest)
                <br />
                1860 Wilson Ave, Suite 400
                <br />
                Toronto, ON M9M 3A7, Canada
              </p>
              <p>
                <strong>Date:</strong> Sunday, October 4, 2026
              </p>
              <p>
                <strong>Time:</strong> 10:00 AM (EST)
              </p>
              <p className="italic">Registration closes Friday, October 2, 2026.</p>
            </div>
          </div>
        </section>

        <SectionRule />

        <section
          id="registration"
          ref={formRef}
          aria-label="Winter jacket registration"
          className={cn("transition-all duration-500", formInView && "animate-slide-up delay-2")}
        >
          <RegistrationWizard />
        </section>

        <SectionRule />

        <footer className="no-print space-y-4 px-2 text-center text-sm text-ivory-50 drop-shadow-md sm:text-base">
          <p className="pt-2 text-xs text-ivory-50/80 sm:text-sm">© Gospel Pillars Toronto 2026</p>
        </footer>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "react-hot-toast";
import { RegistrationPage } from "./pages/RegistrationPage";
import { SEO } from "./components/SEO";
import { cn } from "./lib/utils";

const SECTIONS = [
  { id: "hero", label: "About" },
  { id: "registration", label: "Volunteer" },
];

function Layout({ children }) {
  const [activeSection, setActiveSection] = useState("hero");
  const [scrolled, setScrolled] = useState(false);

  // Scroll detection: listen to scroll events
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      const scrollY = window.scrollY;
      const viewportMid = scrollY + window.innerHeight / 2;

      let current = "hero";
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.offsetTop;
        const height = el.offsetHeight;
        if (viewportMid >= top && viewportMid < top + height) {
          current = id;
          break;
        }
        if (viewportMid >= top) current = id;
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen">
      <SEO />
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 no-print",
          scrolled
            ? "bg-amber-50/98 py-2 shadow-lg border-b border-amber-200/60 backdrop-blur-sm"
            : "py-4 bg-transparent"
        )}
      >
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <img
            src="/logo2.jpeg"
            alt="Eagles Nest New Facility Project"
            className="h-10 w-auto object-contain rounded"
          />
          <div className="flex gap-1 sm:gap-2">
            {SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  scrolled
                    ? activeSection === id
                      ? "bg-amber-500 text-black"
                      : "text-black hover:bg-amber-200/80"
                    : activeSection === id
                      ? "bg-amber-500/90 text-black"
                      : "text-white/95 hover:bg-white/15 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <main className="pt-16">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<RegistrationPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: "var(--bg-base)",
            color: "var(--text-base)",
            border: "1px solid var(--border-base)",
          },
        }}
      />
    </HelmetProvider>
  );
}

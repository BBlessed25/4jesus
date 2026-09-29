import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "react-hot-toast";
import { RegistrationPage } from "./pages/RegistrationPage";
import { SEO } from "./components/SEO";
import { cn } from "./lib/utils";

const SECTIONS = [
  { id: "hero", label: "About" },
  { id: "registration", label: "Register" },
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
          "no-print fixed top-0 right-0 left-0 z-50 border-b border-gold-500/45 bg-forest-950/90 text-ivory-50 backdrop-blur-md transition-all duration-300",
          scrolled ? "py-2 shadow-[var(--shadow-medium)]" : "bg-forest-950/80 py-4"
        )}
      >
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <img
            src="/logo2.jpeg"
            alt="Gospel Pillars"
            className="h-10 w-auto object-contain rounded"
          />
          <div className="flex gap-1 sm:gap-2">
            {SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                aria-current={activeSection === id ? "location" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-300 focus-visible:ring-2 focus-visible:ring-gold-400",
                  activeSection === id
                    ? "bg-gold-500 text-forest-950 shadow-sm hover:bg-gold-400 active:bg-gold-600"
                    : "text-ivory-50 hover:bg-ivory-50/10 hover:text-gold-200"
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

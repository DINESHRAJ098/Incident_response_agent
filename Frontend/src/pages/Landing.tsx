import { motion } from "framer-motion";
import { Navbar } from "@/features/landing/sections/Navbar";
import { Hero } from "@/features/landing/sections/Hero";
import { StatsStrip } from "@/features/landing/sections/StatsStrip";
import { HowItWorks } from "@/features/landing/sections/HowItWorks";
import { Features } from "@/features/landing/sections/Features";
import { DemoSection } from "@/features/landing/sections/DemoSection";
import { FinalCta } from "@/features/landing/sections/FinalCta";
import { Footer } from "@/features/landing/sections/Footer";

/**
 * Landing — the public face of Incident AI.
 *
 * Theme: dark, quiet, technical. Thin borders instead of shadows, mono
 * eyebrows, one emerald signal color for anything to do with memory or
 * health. Every CTA leads into the live console, which is the product.
 * Each section lives in `features/landing/sections/`.
 */
export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-background text-foreground"
    >
      <Navbar />
      <Hero />
      <StatsStrip />
      <HowItWorks />
      <Features />
      <DemoSection />
      <FinalCta />
      <Footer />
    </motion.div>
  );
}

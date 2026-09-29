/** Layout + animation constants shared by every landing-page section. */

export const CONTAINER = "mx-auto w-full max-w-6xl px-5 sm:px-8";

export const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

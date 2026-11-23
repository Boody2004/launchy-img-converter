import { LazyMotion, MotionConfig, domAnimation, m } from "framer-motion";
import site from "../content/site.json";

export default function Home() {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {site.home.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-700">
            {site.home.intro}
          </p>
        </m.div>
      </MotionConfig>
    </LazyMotion>
  );
}

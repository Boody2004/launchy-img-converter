import { useEffect } from "react";
import { Link } from "react-router-dom";
import site from "../content/site.json";

export default function NotFound() {
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex";
    document.head.appendChild(tag);
    return () => tag.remove();
  }, []);

  return (
    <div>
      <h1 className="text-4xl font-bold tracking-tight">
        {site.notFound.title}
      </h1>
      <p className="mt-4 text-lg text-slate-700">{site.notFound.text}</p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center font-semibold text-blue-700 underline"
      >
        {site.notFound.homeLink}
      </Link>
    </div>
  );
}

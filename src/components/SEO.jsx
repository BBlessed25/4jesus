import { Helmet } from "react-helmet-async";

const defaultTitle =
  "Eagles Nest New Facility Project — Volunteer Registration | Gospel Pillars";
const defaultDescription =
  "Volunteer for the Eagles Nest New Facility Project (23 March – 4 April). Register your skills, availability, and how many hours you can serve.";

export function SEO({
  title = defaultTitle,
  description = defaultDescription,
  image = "/logo2.jpeg",
  url = "",
}) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}

import { Helmet } from "react-helmet-async";

const defaultTitle = "Four Jesus Sundays Special Campaign | Gospel Pillars Canada";
const defaultDescription =
  "Register for the Four Jesus Sundays Toronto Special Campaign. This Saturday at 12:00 noon in North York. White T-shirt with blue or black jeans.";

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

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}

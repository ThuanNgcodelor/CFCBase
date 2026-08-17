import { Helmet } from 'react-helmet-async';

/**
 * SEOHead - Component tái sử dụng để inject meta tags SEO động theo từng trang
 * @param {string} title - Tiêu đề trang (không cần thêm " | CFC Base", sẽ tự thêm)
 * @param {string} description - Mô tả trang
 * @param {string} image - URL ảnh Open Graph (mặc định dùng og-image chung)
 * @param {string} url - URL trang hiện tại (mặc định là trang chủ)
 * @param {string} noIndex - Nếu true, yêu cầu Google không index trang này
 */
export default function SEOHead({
  title = 'Hệ thống quản lý nội bộ',
  description = 'CFC Base - Hệ thống điều phối nội bộ và quản trị nhân sự.',
  image,
  url,
  noIndex = false,
}) {
  const fullTitle = !title
    ? 'CFC Base'
    : (title.includes('CFC Base') ? title : `${title} | CFC Base`);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cfcbooking.io.vn';
  const canonicalUrl = url
    ? (url.startsWith('http') ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`)
    : (typeof window !== 'undefined' ? window.location.href : 'https://cfcbooking.io.vn');

  const ogImage = image
    ? (image.startsWith('http') ? image : `${origin}${image.startsWith('/') ? '' : '/'}${image}`)
    : `${origin}/og-image-20260717.png`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1024" />
      <meta property="og:image:height" content="1024" />
      <meta property="og:url" content={canonicalUrl} />

      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}

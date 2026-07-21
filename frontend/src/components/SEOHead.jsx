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
  title = 'CFC Base | Hệ thống đặt phòng họp & xe nội bộ',
  description = 'CFC Base - Hệ thống đặt phòng họp và xe công nội bộ của CFC. Đặt lịch nhanh chóng, tiện lợi, quản lý tập trung.',
  image = 'https://cfcbooking.io.vn/og-image-20260717.png',
  url = 'https://cfcbooking.io.vn/',
  noIndex = false,
}) {
  const fullTitle = title.includes('CFC Base')
    ? title
    : `${title} | CFC Base`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:secure_url" content={image} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1024" />
      <meta property="og:image:height" content="1024" />
      <meta property="og:url" content={url} />

      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}

/** URL segment of a class page: "Crâ" -> "cra". Shared by the build-time SEO pages and the app. */
export const classSlug = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

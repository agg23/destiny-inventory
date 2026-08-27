// The store factory imports emblem placeholders, which the bundler turns into URLs
declare module "images/*" {
  const url: string;
  export default url;
}

declare module "destiny-icons/*" {
  const url: string;
  export default url;
}

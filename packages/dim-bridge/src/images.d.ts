// DIM's store factory imports emblem placeholders as URLs
declare module "images/*" {
  const url: string;
  export default url;
}

declare module "destiny-icons/*" {
  const url: string;
  export default url;
}

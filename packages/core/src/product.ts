export const Product = {
  name: "DeepCode",
  cli: "deepcode",
  slug: "deepcode",
  envPrefix: "DEEPCODE",
  config: {
    basename: "deepcode",
    directory: ".deepcode",
    files: ["deepcode.json", "deepcode.jsonc"] as const,
  },
  managedPlistDomain: "org.starseas.deepcode.managed",
} as const

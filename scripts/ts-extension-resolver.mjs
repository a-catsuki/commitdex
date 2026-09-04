/** Resolve the project's extensionless relative TypeScript imports in Node tests. */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error &&
      typeof specifier === "string" &&
      specifier.startsWith(".") &&
      !/\.[cm]?[jt]sx?$/i.test(specifier)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
}

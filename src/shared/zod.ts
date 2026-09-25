// Shared Zod setup: adds `.openapi()` to every Zod schema so slices can
// register OpenAPI paths from the same schemas they validate with.
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export { z };

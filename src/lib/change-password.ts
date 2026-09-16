import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const changePasswordFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { current: string; next: string; confirm: string }) => d)
  .handler(async ({ context, data }) => {
    const { changePasswordCore } = await import("@/lib/school-auth");
    if (data.next.trim() !== data.confirm.trim()) {
      throw new Error("As senhas novas não são iguais.");
    }
    return changePasswordCore(context.userId, data.current, data.next);
  });

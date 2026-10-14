// Compile-time Deno host surface; production uses Supabase's actual Deno runtime.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

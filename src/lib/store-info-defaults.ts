// Kept apart from store-settings.ts (which reads the database through the server-only client) so the
// demo seed (prisma/seed.ts), which runs outside Next.js, can import the defaults too.

export type StoreInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export const DEFAULT_STORE_INFO: StoreInfo = {
  name: "Inverted Crayon",
  email: "invertedcrayonofficial@gmail.com",
  phone: "+880 17725-46800",
  address: "Dhaka, Bangladesh",
};
